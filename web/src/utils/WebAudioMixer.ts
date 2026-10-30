/**
 * WebAudioMixer - In-browser multi-track Web Audio API mixing engine.
 *
 * Provides real-time synchronized playback of Voice, SFX, and BGM tracks with:
 * - Dynamic Auto-Ducking on BGM when dialogue/voice is active.
 * - Non-blocking AudioBuffer caching.
 * - Track mute, volume, seeking, and fade automation.
 */

export type AudioTrackType = 'voice' | 'sfx' | 'bgm' | 'master'

export interface TrackState {
  isMuted: boolean
  volume: number
}

export interface ShotAudioItem {
  id: string
  duration?: number
  dialogue?: string
  audio_url?: string
  has_audio?: boolean
  fade_in?: number
  fade_out?: number
  sfx?: string
  sfx_offset_ms?: number
  sfx_volume?: number
  [key: string]: unknown
}

export interface PlayOptions {
  isVoiceMuted?: boolean
  isSfxMuted?: boolean
  isBgmMuted?: boolean
}

export interface ActiveAudioSource {
  stop: () => void
  node?: AudioNode
}

export class WebAudioMixer {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private voiceGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private bgmGain: GainNode | null = null

  private bufferCache = new Map<string, AudioBuffer>()
  private activeSources: ActiveAudioSource[] = []
  private isPlaying = false
  private playheadTimeSec = 0

  private trackStates: Record<AudioTrackType, TrackState> = {
    master: { isMuted: false, volume: 1.0 },
    voice: { isMuted: false, volume: 1.0 },
    sfx: { isMuted: false, volume: 0.85 },
    bgm: { isMuted: false, volume: 0.7 },
  }

  constructor() {
    // AudioContext will be initialized lazily on user gesture
  }

  /**
   * Lazily creates and resumes AudioContext and audio routing graph.
   */
  public ensureAudioContext(): AudioContext {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) {
        this.ctx = new AudioContextClass()
        this.initRoutingGraph()
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch((err) => {
        console.warn('[WebAudioMixer] Failed to resume AudioContext:', err)
      })
    }

    if (!this.ctx) {
      throw new Error('Web Audio API is not supported in this environment.')
    }

    return this.ctx
  }

  private initRoutingGraph(): void {
    if (!this.ctx) return

    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = this.trackStates.master.isMuted ? 0 : this.trackStates.master.volume
    this.masterGain.connect(this.ctx.destination)

    this.voiceGain = this.ctx.createGain()
    this.voiceGain.gain.value = this.trackStates.voice.isMuted ? 0 : this.trackStates.voice.volume
    this.voiceGain.connect(this.masterGain)

    this.sfxGain = this.ctx.createGain()
    this.sfxGain.gain.value = this.trackStates.sfx.isMuted ? 0 : this.trackStates.sfx.volume
    this.sfxGain.connect(this.masterGain)

    this.bgmGain = this.ctx.createGain()
    this.bgmGain.gain.value = this.trackStates.bgm.isMuted ? 0 : this.trackStates.bgm.volume
    this.bgmGain.connect(this.masterGain)
  }

  public getTrackState(track: AudioTrackType): TrackState {
    return { ...this.trackStates[track] }
  }

  public setTrackMute(track: AudioTrackType, isMuted: boolean): void {
    this.trackStates[track].isMuted = isMuted
    const targetVolume = isMuted ? 0 : this.trackStates[track].volume

    if (this.ctx && this.ctx.state !== 'closed') {
      const node = this.getGainNode(track)
      if (node) {
        node.gain.setValueAtTime(targetVolume, this.ctx.currentTime)
      }
    }
  }

  public setTrackVolume(track: AudioTrackType, volume: number): void {
    const clamped = Math.max(0, Math.min(1.5, volume))
    this.trackStates[track].volume = clamped

    if (!this.trackStates[track].isMuted && this.ctx && this.ctx.state !== 'closed') {
      const node = this.getGainNode(track)
      if (node) {
        node.gain.setValueAtTime(clamped, this.ctx.currentTime)
      }
    }
  }

  private getGainNode(track: AudioTrackType): GainNode | null {
    switch (track) {
      case 'master':
        return this.masterGain
      case 'voice':
        return this.voiceGain
      case 'sfx':
        return this.sfxGain
      case 'bgm':
        return this.bgmGain
      default:
        return null
    }
  }

  /**
   * Asynchronously loads and decodes audio buffer into memory cache.
   */
  public async loadAudioBuffer(url: string): Promise<AudioBuffer | null> {
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!
    }

    try {
      const ctx = this.ensureAudioContext()
      const response = await fetch(url)
      if (!response.ok) {
        return null
      }
      const arrayBuffer = await response.arrayBuffer()
      const decoded = await ctx.decodeAudioData(arrayBuffer)
      this.bufferCache.set(url, decoded)
      return decoded
    } catch (err) {
      console.warn(`[WebAudioMixer] Could not load audio buffer from ${url}:`, err)
      return null
    }
  }

  /**
   * Helper to locate which shot is active at a given timecode.
   */
  public findShotAtTime<T extends { id: string; duration?: number }>(
    timeSec: number,
    shots: T[]
  ): { shot: T; startSec: number; endSec: number; offsetSec: number } | null {
    let accumulated = 0
    for (const shot of shots) {
      const dur = Number(shot.duration) || 5.0
      const startSec = accumulated
      const endSec = accumulated + dur
      if (timeSec >= startSec && timeSec < endSec) {
        return {
          shot,
          startSec,
          endSec,
          offsetSec: timeSec - startSec,
        }
      }
      accumulated = endSec
    }
    return null
  }

  /**
   * Calculate cumulative timeline start/end for shots.
   */
  public calculateTimeline<T extends { duration?: number }>(
    shots: T[]
  ): Array<{ shot: T; startSec: number; endSec: number; duration: number }> {
    let accumulated = 0
    return shots.map((shot) => {
      const duration = Number(shot.duration) || 5.0
      const startSec = accumulated
      const endSec = accumulated + duration
      accumulated = endSec
      return { shot, startSec, endSec, duration }
    })
  }

  /**
   * Starts multi-track playback from currentTimeSec.
   */
  public async play(
    currentTimeSec: number,
    shots: ShotAudioItem[],
    bgmTrackOrUrl?: string,
    options?: PlayOptions
  ): Promise<void> {
    this.pause()
    this.playheadTimeSec = currentTimeSec
    this.isPlaying = true

    if (options) {
      if (options.isVoiceMuted !== undefined) this.setTrackMute('voice', options.isVoiceMuted)
      if (options.isSfxMuted !== undefined) this.setTrackMute('sfx', options.isSfxMuted)
      if (options.isBgmMuted !== undefined) this.setTrackMute('bgm', options.isBgmMuted)
    }

    const ctx = this.ensureAudioContext()
    const ctxStartTime = ctx.currentTime
    const timeline = this.calculateTimeline(shots)

    // 1. Schedule Voice tracks with Fade-in and Fade-out
    for (const item of timeline) {
      const { shot, startSec, endSec, duration } = item
      if (endSec <= currentTimeSec) continue

      const audioUrl = shot.audio_url || (shot.has_audio ? `/api/outputs/audio/${shot.id}.mp3` : null)

      if (audioUrl) {
        this.loadAudioBuffer(audioUrl).then((buffer) => {
          if (!this.isPlaying || !buffer || !this.voiceGain) return

          const delay = Math.max(0, startSec - currentTimeSec)
          const offsetInShot = Math.max(0, currentTimeSec - startSec)
          if (offsetInShot >= buffer.duration) return

          const source = ctx.createBufferSource()
          source.buffer = buffer

          // Dedicated GainNode for shot volume and fade envelope
          const shotGain = ctx.createGain()
          const shotVol = typeof shot.voice_volume === 'number' ? shot.voice_volume : 1.0
          const startCtxTime = ctxStartTime + delay
          const playDuration = Math.min(buffer.duration - offsetInShot, duration - offsetInShot)

          const fadeInSec = Math.max(0, Number(shot.fade_in) || 0)
          const fadeOutSec = Math.max(0, Number(shot.fade_out) || 0)

          if (fadeInSec > 0 && offsetInShot < fadeInSec) {
            const initialGain = (offsetInShot / fadeInSec) * shotVol
            shotGain.gain.setValueAtTime(initialGain, startCtxTime)
            shotGain.gain.linearRampToValueAtTime(shotVol, startCtxTime + (fadeInSec - offsetInShot))
          } else {
            shotGain.gain.setValueAtTime(shotVol, startCtxTime)
          }

          if (fadeOutSec > 0 && playDuration > fadeOutSec) {
            const fadeOutStartTime = startCtxTime + playDuration - fadeOutSec
            shotGain.gain.setValueAtTime(shotVol, fadeOutStartTime)
            shotGain.gain.linearRampToValueAtTime(0, startCtxTime + playDuration)
          }

          source.connect(shotGain)
          shotGain.connect(this.voiceGain)

          try {
            source.start(startCtxTime, offsetInShot, playDuration)
            this.activeSources.push({
              stop: () => {
                try {
                  source.stop()
                  source.disconnect()
                  shotGain.disconnect()
                } catch {
                  // ignore already stopped
                }
              },
              node: source,
            })
          } catch (e) {
            console.warn('[WebAudioMixer] Error starting voice source:', e)
          }
        })
      }
    }

    // 2. Schedule SFX tracks
    for (const item of timeline) {
      const { shot, startSec, duration } = item
      if (!shot.sfx) continue

      const sfxOffsetSec = (shot.sfx_offset_ms || 0) / 1000
      const sfxStartSec = startSec + sfxOffsetSec
      const sfxUrl = `/api/assets/sfx/${shot.sfx}.mp3`

      this.loadAudioBuffer(sfxUrl).then((buffer) => {
        if (!this.isPlaying || !buffer || !this.sfxGain) return

        const sfxEndSec = sfxStartSec + buffer.duration
        if (sfxEndSec <= currentTimeSec) return

        const delay = Math.max(0, sfxStartSec - currentTimeSec)
        const offsetInSfx = Math.max(0, currentTimeSec - sfxStartSec)
        if (offsetInSfx >= buffer.duration) return

        const source = ctx.createBufferSource()
        source.buffer = buffer

        const sfxVol = typeof shot.sfx_volume === 'number' ? shot.sfx_volume : 1.0
        const gainNode = ctx.createGain()
        gainNode.gain.value = sfxVol

        source.connect(gainNode)
        gainNode.connect(this.sfxGain)

        const startCtxTime = ctxStartTime + delay
        const playDuration = Math.min(buffer.duration - offsetInShotSafe(offsetInSfx), Math.max(0.1, duration - sfxOffsetSec))

        try {
          source.start(startCtxTime, offsetInSfx, playDuration)
          this.activeSources.push({
            stop: () => {
              try {
                source.stop()
                source.disconnect()
                gainNode.disconnect()
              } catch {
                // ignore
              }
            },
            node: source,
          })
        } catch (e) {
          console.warn('[WebAudioMixer] Error starting SFX source:', e)
        }
      })
    }

    // 3. Schedule BGM track with real-time Auto-Ducking
    if (bgmTrackOrUrl) {
      const bgmUrl =
        bgmTrackOrUrl.startsWith('http') || bgmTrackOrUrl.startsWith('/')
          ? bgmTrackOrUrl
          : `/api/assets/bgm/${bgmTrackOrUrl}.mp3`

      this.loadAudioBuffer(bgmUrl).then((buffer) => {
        if (!this.isPlaying || !buffer || !this.bgmGain) return

        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true

        const bgmOffset = buffer.duration > 0 ? currentTimeSec % buffer.duration : 0
        source.connect(this.bgmGain)

        // Auto-Ducking gain automation schedule
        const baseBgmVolume = this.trackStates.bgm.isMuted ? 0 : this.trackStates.bgm.volume
        const duckedBgmVolume = baseBgmVolume * 0.35

        this.bgmGain.gain.cancelScheduledValues(ctxStartTime)
        this.bgmGain.gain.setValueAtTime(baseBgmVolume, ctxStartTime)

        // Find all voice/dialogue active intervals after currentTimeSec
        const dialogueRegions = timeline
          .filter(({ shot }) => Boolean(shot.dialogue && String(shot.dialogue).trim()))
          .filter(({ endSec }) => endSec > currentTimeSec)

        for (const reg of dialogueRegions) {
          const leadIn = 0.3 // 300ms duck ramp-down
          const rampUp = 0.5 // 500ms recovery ramp-up

          const duckStartCtx = Math.max(ctxStartTime, ctxStartTime + (reg.startSec - leadIn - currentTimeSec))
          const duckFullCtx = Math.max(ctxStartTime, ctxStartTime + (reg.startSec - currentTimeSec))
          const duckEndCtx = Math.max(ctxStartTime, ctxStartTime + (reg.endSec - currentTimeSec))
          const releaseEndCtx = duckEndCtx + rampUp

          try {
            if (duckStartCtx > ctxStartTime) {
              this.bgmGain.gain.setValueAtTime(baseBgmVolume, duckStartCtx)
              this.bgmGain.gain.linearRampToValueAtTime(duckedBgmVolume, duckFullCtx)
            } else {
              this.bgmGain.gain.setValueAtTime(duckedBgmVolume, ctxStartTime)
            }
            this.bgmGain.gain.setValueAtTime(duckedBgmVolume, duckEndCtx)
            this.bgmGain.gain.linearRampToValueAtTime(baseBgmVolume, releaseEndCtx)
          } catch (e) {
            console.warn('[WebAudioMixer] Failed to schedule auto-ducking ramp:', e)
          }
        }

        try {
          source.start(ctxStartTime, bgmOffset)
          this.activeSources.push({
            stop: () => {
              try {
                source.stop()
                source.disconnect()
              } catch {
                // ignore
              }
            },
            node: source,
          })
        } catch (e) {
          console.warn('[WebAudioMixer] Error starting BGM source:', e)
        }
      })
    }
  }

  /**
   * Pauses all active playback and resets ducking automation.
   */
  public pause(): void {
    this.isPlaying = false

    for (const source of this.activeSources) {
      try {
        source.stop()
      } catch {
        // ignore
      }
    }
    this.activeSources = []

    if (this.bgmGain && this.ctx && this.ctx.state !== 'closed') {
      try {
        this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime)
        const baseBgmVolume = this.trackStates.bgm.isMuted ? 0 : this.trackStates.bgm.volume
        this.bgmGain.gain.setValueAtTime(baseBgmVolume, this.ctx.currentTime)
      } catch {
        // ignore
      }
    }
  }

  /**
   * Seeks playback to target time in seconds.
   */
  public seek(
    timeSec: number,
    shots?: ShotAudioItem[],
    bgmTrack?: string,
    options?: PlayOptions
  ): void {
    const wasPlaying = this.isPlaying
    this.pause()
    this.playheadTimeSec = Math.max(0, timeSec)
    if (wasPlaying && shots) {
      this.play(this.playheadTimeSec, shots, bgmTrack, options)
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying
  }

  public getPlayheadTime(): number {
    return this.playheadTimeSec
  }

  public destroy(): void {
    this.pause()
    this.bufferCache.clear()
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {})
      this.ctx = null
    }
  }
}

function offsetInShotSafe(val: number): number {
  return Math.max(0, isNaN(val) ? 0 : val)
}
