import { useState, useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Film,
  Mic,
  Music,
  Volume2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Download
} from 'lucide-react'
import { Badge } from './ui/badge'
import { getTimelineExportUrl } from '../api/studio'
import type { Shot } from '../types'

export interface TimelineScrubberProps {
  shots: Shot[]
  onSelectShot?: (shotId: string) => void
  selectedShotId?: string | null
}

export default function TimelineScrubber({
  shots,
  onSelectShot,
  selectedShotId,
}: TimelineScrubberProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [zoomScale, setZoomScale] = useState(1) // 1x, 1.5x, 2x
  const animationFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  // Calculate cumulative timestamps for each shot
  const shotTimeline = shots.map((s, idx) => {
    const dur = s.duration || 5.0
    return {
      shot: s,
      index: idx,
      duration: dur,
    }
  })

  const totalDuration = shotTimeline.reduce((acc, item) => acc + item.duration, 0) || 1

  // Playback timer ticker
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now()
      const tick = (now: number) => {
        if (lastTimeRef.current !== null) {
          const deltaSec = (now - lastTimeRef.current) / 1000
          setCurrentTime((prev) => {
            const next = prev + deltaSec
            if (next >= totalDuration) {
              setIsPlaying(false)
              return 0
            }
            return next
          })
        }
        lastTimeRef.current = now
        animationFrameRef.current = requestAnimationFrame(tick)
      }
      animationFrameRef.current = requestAnimationFrame(tick)
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      lastTimeRef.current = null
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, totalDuration])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`
  }

  // Pixels per second base
  const pxPerSec = 28 * zoomScale
  const timelineWidth = Math.max(800, totalDuration * pxPerSec)

  const playheadPositionPx = (currentTime / totalDuration) * timelineWidth

  return (
    <div className="rounded-xl bg-cinema-card border border-cinema-border p-4 shadow-xl space-y-3">
      {/* Top Scrubber Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cinema-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 rounded-lg bg-cinema-amber hover:bg-amber-400 text-zinc-950 flex items-center justify-center font-bold transition-colors cursor-pointer"
              title={isPlaying ? 'Tạm dừng timeline' : 'Phát timeline thử nghiệm'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false)
                setCurrentTime(0)
              }}
              className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors cursor-pointer border border-zinc-700"
              title="Quay lại đầu phim"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="font-mono text-xs text-zinc-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cinema-canvas border border-cinema-border">
            <span className="text-cinema-amber font-bold">{formatTime(currentTime)}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400">{formatTime(totalDuration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={getTimelineExportUrl()}
            download
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cinema-amber text-xs font-medium border border-cinema-amber/30 transition-all hover:scale-[1.02] shadow-sm cursor-pointer"
            title="Xuất timeline FCPXML chuyên nghiệp cho Adobe Premiere / DaVinci Resolve"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Xuất Timeline (FCPXML)</span>
            <span className="md:hidden">FCPXML</span>
          </a>

          <div className="flex items-center gap-1 bg-cinema-canvas border border-cinema-border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.2))}
              className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              title="Thu nhỏ timeline"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-zinc-300 px-1">{Math.round(zoomScale * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.min(2.5, z + 0.2))}
              className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              title="Phóng to timeline"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Multi-track View Container */}
      <div className="overflow-x-auto pb-2 relative select-none">
        <div style={{ width: `${timelineWidth}px` }} className="relative space-y-2 pt-5">
          {/* Timeline Time Ruler */}
          <div className="absolute top-0 left-0 right-0 h-4 border-b border-cinema-border flex items-end text-[9px] font-mono text-zinc-500">
            {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }).map((_, idx) => {
              const sec = idx * 5
              const pos = (sec / totalDuration) * timelineWidth
              return (
                <div
                  key={idx}
                  style={{ left: `${pos}px` }}
                  className="absolute bottom-0 flex flex-col items-center"
                >
                  <span className="text-[8px] -mb-0.5">{sec}s</span>
                  <div className="w-[1px] h-1.5 bg-zinc-700" />
                </div>
              )
            })}
          </div>

          {/* Red Playhead Line */}
          <div
            style={{ transform: `translateX(${playheadPositionPx}px)` }}
            className="absolute top-0 bottom-0 w-[2px] bg-rose-500 z-30 pointer-events-none transition-transform duration-75"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-[4px] -mt-[1px] shadow-sm shadow-rose-500/50" />
          </div>

          {/* Track 1: Video Shots Track */}
          <div className="space-y-1">
            <div className="text-[9px] font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Film className="w-3 h-3 text-cinema-amber" />
              <span>Track 1: Video Clips & Angles</span>
            </div>
            <div className="h-14 flex items-stretch gap-1">
              {shotTimeline.map(({ shot, index, duration }) => {
                const widthPx = duration * pxPerSec
                const isSelected = selectedShotId === shot.id

                return (
                  <div
                    key={shot.id}
                    onClick={() => onSelectShot?.(shot.id)}
                    style={{ width: `${widthPx}px` }}
                    className={`rounded-lg border overflow-hidden p-1.5 flex flex-col justify-between transition-all cursor-pointer group shrink-0 ${
                      isSelected
                        ? 'bg-amber-500/15 border-cinema-amber'
                        : 'bg-cinema-deck border-cinema-border hover:border-cinema-border-hover'
                    }`}
                    title={`Phân cảnh ${index + 1} (${duration}s): ${shot.dialogue || shot.image_prompt}`}
                  >
                    <div className="flex items-center justify-between text-[9px] font-mono text-zinc-300">
                      <span className="font-semibold text-cinema-amber truncate">#{index + 1} {shot.id}</span>
                      <span className="text-[8px] text-zinc-500">{duration.toFixed(1)}s</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono uppercase bg-zinc-800 text-zinc-300 truncate border-none">
                        {String(shot.motion || 'zoom_in')}
                      </Badge>
                      {shot.act && (
                        <span className="text-[8px] px-1 rounded bg-zinc-800 text-zinc-300 font-mono border border-zinc-700">
                          H{String(shot.act)}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Track 2: Dialogue & Voiceover Track */}
          <div className="space-y-1 pt-1">
            <div className="text-[9px] font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Mic className="w-3 h-3 text-cyan-400" />
              <span>Track 2: Voiceover & Dialogue</span>
            </div>
            <div className="h-9 flex items-stretch gap-1">
              {shotTimeline.map(({ shot, duration }) => {
                const widthPx = duration * pxPerSec
                const hasDialogue = Boolean(shot.dialogue && String(shot.dialogue).trim())

                return (
                  <div
                    key={shot.id}
                    style={{ width: `${widthPx}px` }}
                    className={`rounded-md border px-2 py-1 flex items-center justify-between gap-1 overflow-hidden shrink-0 ${
                      hasDialogue
                        ? 'bg-cyan-950/30 border-cyan-800/40 text-cyan-200'
                        : 'bg-cinema-canvas/50 border-dashed border-cinema-border text-zinc-600'
                    }`}
                  >
                    {hasDialogue ? (
                      <>
                        <span className="text-[9px] truncate font-normal">"{String(shot.dialogue)}"</span>
                        <Volume2 className="w-3 h-3 text-cyan-400 shrink-0 opacity-70" />
                      </>
                    ) : (
                      <span className="text-[8px] italic text-zinc-600 truncate">(Tĩnh)</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Track 3: Foley SFX Track */}
          <div className="space-y-1 pt-1">
            <div className="text-[9px] font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Track 3: Foley & SFX Audio</span>
            </div>
            <div className="h-7 flex items-stretch gap-1">
              {shotTimeline.map(({ shot, duration }) => {
                const widthPx = duration * pxPerSec
                const hasSfx = Boolean(shot.sfx)

                return (
                  <div
                    key={shot.id}
                    style={{ width: `${widthPx}px` }}
                    className={`rounded-md border px-1.5 py-0.5 flex items-center justify-center shrink-0 ${
                      hasSfx
                        ? 'bg-emerald-950/30 border-emerald-700/40 text-emerald-300 font-mono text-[9px] font-medium'
                        : 'bg-cinema-canvas/30 border-cinema-border text-zinc-700'
                    }`}
                  >
                    {hasSfx ? (
                      <span className="flex items-center gap-1 truncate">
                        <Volume2 className="w-2.5 h-2.5" />
                        <span>{String(shot.sfx)}</span>
                      </span>
                    ) : (
                      <span className="text-[8px] opacity-40">-</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Track 4: BGM Mood Track */}
          <div className="space-y-1 pt-1">
            <div className="text-[9px] font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <Music className="w-3 h-3 text-purple-400" />
              <span>Track 4: Dynamic Mood BGM</span>
            </div>
            <div className="h-7 flex items-stretch gap-1">
              {shotTimeline.map(({ shot, duration }) => {
                const widthPx = duration * pxPerSec
                const mood = String(shot.mood || 'cinematic')

                return (
                  <div
                    key={shot.id}
                    style={{ width: `${widthPx}px` }}
                    className="rounded-md border border-purple-800/30 bg-purple-950/20 px-1.5 py-0.5 flex items-center justify-center text-purple-300 font-mono text-[9px] shrink-0 font-medium"
                  >
                    <span className="flex items-center gap-1 truncate">
                      <Music className="w-2.5 h-2.5" />
                      <span>{mood}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
