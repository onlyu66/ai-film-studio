import React, { useState, useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  Film,
  Mic,
  Music,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Download,
  Scissors,
  GripVertical,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from './ui/badge'
import { getTimelineExportUrl, snapTimelineToBeat } from '../api/studio'
import {
  fetchWaveformData,
  snapShotsToBeatTimes,
  type WaveformData,
} from '../utils/audioWaveform'
import AudioWaveformTrack from './AudioWaveformTrack'
import type { Shot } from '../types'

export interface TimelineScrubberProps {
  shots: Shot[]
  onSelectShot?: (shotId: string) => void
  selectedShotId?: string | null
  onUpdateShotDuration?: (shotId: string, duration: number) => void
  onBatchUpdateDurations?: (updates: Array<{ id: string; duration: number }>) => void
  onReorderShots?: (newShotIds: string[]) => void
  onSplitShot?: (shotId: string, splitAtSec: number) => void
  bgmTrack?: string
}

interface TrimmingState {
  shotId: string
  edge: 'left' | 'right'
  startX: number
  initialDuration: number
  currentDuration: number
}

export default function TimelineScrubber({
  shots,
  onSelectShot,
  selectedShotId,
  onUpdateShotDuration,
  onBatchUpdateDurations,
  onReorderShots,
  onSplitShot,
  bgmTrack,
}: TimelineScrubberProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [zoomScale, setZoomScale] = useState(1.0) // 0.6x - 2.5x

  // Waveform & Beat-Sync States
  const [waveformData, setWaveformData] = useState<WaveformData>({
    duration: 30,
    tempoBpm: 120,
    beatTimes: [],
    peaks: [],
  })
  const [showBeatGrid, setShowBeatGrid] = useState(true)
  const [isSnapping, setIsSnapping] = useState(false)

  // Track Mute States
  const [isVoiceMuted, setIsVoiceMuted] = useState(false)
  const [isSfxMuted, setIsSfxMuted] = useState(false)
  const [isBgmMuted, setIsBgmMuted] = useState(false)

  // Load Waveform & Beat Data when component mounts or BGM changes
  useEffect(() => {
    let isMounted = true
    const activeTrack = bgmTrack || localStorage.getItem('studio_bgm_preset') || 'cinematic'
    fetchWaveformData(activeTrack).then((data) => {
      if (isMounted) {
        setWaveformData(data)
      }
    })
    return () => {
      isMounted = false
    }
  }, [bgmTrack])

  // Handle Snap-to-Beat
  const handleSnapToBeat = async () => {
    if (shots.length === 0) return
    setIsSnapping(true)
    const activeTrack = bgmTrack || localStorage.getItem('studio_bgm_preset') || 'cinematic'

    try {
      // 1. Phản hồi client-side tức thì (0ms latency)
      if (waveformData.beatTimes && waveformData.beatTimes.length > 0) {
        const clientSnapped = snapShotsToBeatTimes(
          shots.map((s) => ({ id: s.id, duration: Number(s.duration) || 5.0 })),
          waveformData.beatTimes,
          1.5,
          12.0
        )
        onBatchUpdateDurations?.(clientSnapped)
      }

      // 2. Gửi request đồng bộ lưu xuống backend và storyboard.json
      const res = await snapTimelineToBeat({
        project_id: 'current',
        bgm_track: activeTrack,
        min_shot_duration: 1.5,
        save_to_storyboard: true,
      })

      if (res.success && res.shots) {
        onBatchUpdateDurations?.(res.shots)
        toast.success(
          `Đã bắt nhịp thành công! ${res.shots.length} phân cảnh đã được khớp chính xác theo phách bài nhạc (${res.tempo_bpm} BPM).`
        )
      }
    } catch (err) {
      console.error('[SnapToBeat] Lỗi bắt nhịp:', err)
      toast.error('Không thể bắt nhịp âm nhạc tự động. Vui lòng thử lại.')
    } finally {
      setIsSnapping(false)
    }
  }

  // Drag & Drop reorder state
  const [draggedShotId, setDraggedShotId] = useState<string | null>(null)
  const [dragOverShotId, setDragOverShotId] = useState<string | null>(null)

  // Trimming state
  const [trimming, setTrimming] = useState<TrimmingState | null>(null)

  const animationFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const rulerRef = useRef<HTMLDivElement | null>(null)
  const isScrubbingRef = useRef<boolean>(false)

  // Pixels per second calculation
  const pxPerSec = 28 * zoomScale

  // Calculate cumulative timestamps for each shot
  let accumulatedTime = 0
  const shotTimeline = shots.map((s, idx) => {
    const dur =
      trimming && trimming.shotId === s.id
        ? trimming.currentDuration
        : Number(s.duration) || 5.0

    const startSec = accumulatedTime
    const endSec = accumulatedTime + dur
    accumulatedTime += dur

    return {
      shot: s,
      index: idx,
      duration: dur,
      startSec,
      endSec,
    }
  })

  const totalDuration = Math.max(1, accumulatedTime)
  const timelineWidth = Math.max(800, totalDuration * pxPerSec)
  const playheadPositionPx = (currentTime / totalDuration) * timelineWidth

  // Find active shot at playhead
  const currentShotItem = shotTimeline.find(
    (item) => currentTime >= item.startSec && currentTime < item.endSec
  ) || shotTimeline[shotTimeline.length - 1]

  const canSplitCurrentShot = Boolean(
    currentShotItem &&
      currentTime >= currentShotItem.startSec + 0.5 &&
      currentTime <= currentShotItem.endSec - 0.5
  )

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

  // Mouse move and up listeners for clip trimming
  useEffect(() => {
    if (!trimming) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - trimming.startX
      const deltaSec = deltaPx / pxPerSec
      let newDur: number

      if (trimming.edge === 'right') {
        newDur = Math.max(1.0, Math.min(15.0, trimming.initialDuration + deltaSec))
      } else {
        newDur = Math.max(1.0, Math.min(15.0, trimming.initialDuration - deltaSec))
      }

      setTrimming((prev) =>
        prev ? { ...prev, currentDuration: Math.round(newDur * 10) / 10 } : null
      )
    }

    const handleMouseUp = () => {
      if (trimming) {
        onUpdateShotDuration?.(trimming.shotId, trimming.currentDuration)
      }
      setTrimming(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [trimming, pxPerSec, onUpdateShotDuration])

  // Start trimming clip duration
  const startTrimming = (
    shotId: string,
    edge: 'left' | 'right',
    e: React.MouseEvent
  ) => {
    e.stopPropagation()
    const targetShot = shots.find((s) => s.id === shotId)
    const initialDuration = Number(targetShot?.duration) || 5.0
    setTrimming({
      shotId,
      edge,
      startX: e.clientX,
      initialDuration,
      currentDuration: initialDuration,
    })
  }

  // Handle Drag & Drop reorder
  const handleDragStart = (shotId: string, e: React.DragEvent) => {
    if (trimming) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('text/plain', shotId)
    setDraggedShotId(shotId)
  }

  const handleDragOver = (shotId: string, e: React.DragEvent) => {
    e.preventDefault()
    if (draggedShotId && draggedShotId !== shotId) {
      setDragOverShotId(shotId)
    }
  }

  const handleDragLeave = () => {
    setDragOverShotId(null)
  }

  const handleDrop = (targetShotId: string, e: React.DragEvent) => {
    e.preventDefault()
    const sourceId = draggedShotId || e.dataTransfer.getData('text/plain')
    if (sourceId && sourceId !== targetShotId) {
      const sourceIndex = shots.findIndex((s) => s.id === sourceId)
      const targetIndex = shots.findIndex((s) => s.id === targetShotId)

      if (sourceIndex >= 0 && targetIndex >= 0) {
        const reordered = [...shots]
        const [moved] = reordered.splice(sourceIndex, 1)
        reordered.splice(targetIndex, 0, moved)
        onReorderShots?.(reordered.map((s) => s.id))
      }
    }
    setDraggedShotId(null)
    setDragOverShotId(null)
  }

  // Ruler Scrubbing
  const handleRulerSeek = (clientX: number) => {
    if (!rulerRef.current) return
    const rect = rulerRef.current.getBoundingClientRect()
    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const targetSec = (clickX / timelineWidth) * totalDuration
    setCurrentTime(Math.max(0, Math.min(totalDuration, targetSec)))
  }

  const handleRulerMouseDown = (e: React.MouseEvent) => {
    isScrubbingRef.current = true
    handleRulerSeek(e.clientX)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (isScrubbingRef.current) {
        handleRulerSeek(moveEvent.clientX)
      }
    }

    const handleMouseUp = () => {
      isScrubbingRef.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Handle Split Shot action
  const handleSplitShotClick = () => {
    if (!canSplitCurrentShot || !currentShotItem) return
    const splitAtSec = currentTime - currentShotItem.startSec
    onSplitShot?.(currentShotItem.shot.id, Math.round(splitAtSec * 10) / 10)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`
  }

  return (
    <div className="rounded-2xl bg-cinema-card border border-cinema-border p-4 shadow-2xl space-y-3">
      {/* Top Scrubber Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-cinema-border">
        {/* Playback Controls & Timestamp */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-8 h-8 rounded-lg bg-cinema-amber hover:bg-amber-400 text-zinc-950 flex items-center justify-center font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              title={isPlaying ? 'Tạm dừng timeline' : 'Phát timeline'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
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

          <div className="font-mono text-xs text-zinc-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cinema-canvas border border-cinema-border shadow-inner">
            <span className="text-cinema-amber font-bold">{formatTime(currentTime)}</span>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400">{formatTime(totalDuration)}</span>
          </div>

          {/* Split Shot CTA */}
          <button
            type="button"
            onClick={handleSplitShotClick}
            disabled={!canSplitCurrentShot}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              canSplitCurrentShot
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30 hover:border-rose-400 shadow-sm active:scale-95 cursor-pointer'
                : 'bg-zinc-800/40 text-zinc-600 border-zinc-800 cursor-not-allowed opacity-50'
            }`}
            title={
              canSplitCurrentShot
                ? `Cắt phân cảnh #${currentShotItem?.shot.id} tại giây ${(
                    currentTime - (currentShotItem?.startSec || 0)
                  ).toFixed(1)}s`
                : 'Di chuyển playhead vào giữa một phân cảnh để cắt'
            }
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Cắt Phân Cảnh (Split)</span>
          </button>

          {/* Snap to Beat CTA */}
          <button
            type="button"
            onClick={handleSnapToBeat}
            disabled={isSnapping || shots.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              isSnapping
                ? 'bg-purple-950/40 text-purple-300 border-purple-500/30 opacity-70 cursor-wait'
                : 'bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border-purple-500/40 hover:border-purple-300 shadow-sm active:scale-95 cursor-pointer'
            }`}
            title={`Tự động co giãn thời lượng ${shots.length} phân cảnh khớp theo phách nhạc BGM (~${waveformData.tempoBpm} BPM)`}
          >
            <Music className={`w-3.5 h-3.5 ${isSnapping ? 'animate-spin' : ''}`} />
            <span>{isSnapping ? 'Đang Bắt Nhịp...' : '🎵 Bắt Nhịp (Snap to Beat)'}</span>
          </button>
        </div>

        {/* Right Tools: Export & Zoom */}
        <div className="flex items-center gap-2">
          <a
            href={getTimelineExportUrl()}
            download
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cinema-amber text-xs font-medium border border-cinema-amber/30 transition-all hover:scale-[1.02] shadow-sm cursor-pointer"
            title="Xuất timeline FCPXML chuyên nghiệp cho Adobe Premiere / DaVinci Resolve"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Xuất Timeline (FCPXML)</span>
            <span className="md:hidden">FCPXML</span>
          </a>

          <div className="flex items-center gap-1 bg-cinema-canvas border border-cinema-border rounded-lg p-0.5 shadow-inner">
            <button
              type="button"
              onClick={() => setZoomScale((z) => Math.max(0.6, z - 0.2))}
              className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
              title="Thu nhỏ timeline"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-zinc-300 px-1">
              {Math.round(zoomScale * 100)}%
            </span>
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

      {/* Main Multi-Track NLE Editor Layout (Track Headers + Scrollable Tracks) */}
      <div className="flex items-start border border-cinema-border rounded-xl bg-cinema-canvas/80 overflow-hidden">
        {/* Left Fixed Column: Track Headers */}
        <div className="w-36 sm:w-44 shrink-0 bg-cinema-deck/90 border-r border-cinema-border flex flex-col select-none z-20">
          {/* Header Spacer for Ruler */}
          <div className="h-6 border-b border-cinema-border px-2 flex items-center text-[9px] font-mono font-semibold text-zinc-500 uppercase tracking-wider">
            <span>Track Name</span>
          </div>

          {/* Track 1 Header: Video */}
          <div className="h-16 px-2.5 flex items-center justify-between border-b border-cinema-border/60">
            <div className="flex items-center gap-1.5 min-w-0">
              <Film className="w-3.5 h-3.5 text-cinema-amber shrink-0" />
              <div className="truncate">
                <span className="text-xs font-semibold text-zinc-200 block truncate">
                  V1: Video
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {shots.length} clips
                </span>
              </div>
            </div>
          </div>

          {/* Track 2 Header: Dialogue */}
          <div className="h-10 px-2.5 flex items-center justify-between border-b border-cinema-border/60">
            <div className="flex items-center gap-1.5 min-w-0">
              <Mic className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-xs font-medium text-zinc-300 truncate">
                A1: Thoại
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsVoiceMuted(!isVoiceMuted)}
              className={`p-1 rounded transition-colors ${
                isVoiceMuted
                  ? 'text-rose-400 hover:bg-rose-950/40'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title={isVoiceMuted ? 'Bật âm thoại' : 'Tắt âm thoại (Mute)'}
            >
              {isVoiceMuted ? (
                <VolumeX className="w-3 h-3" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Track 3 Header: SFX */}
          <div className="h-9 px-2.5 flex items-center justify-between border-b border-cinema-border/60">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="text-xs font-medium text-zinc-300 truncate">
                A2: SFX
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsSfxMuted(!isSfxMuted)}
              className={`p-1 rounded transition-colors ${
                isSfxMuted
                  ? 'text-rose-400 hover:bg-rose-950/40'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              title={isSfxMuted ? 'Bật âm SFX' : 'Tắt âm SFX (Mute)'}
            >
              {isSfxMuted ? (
                <VolumeX className="w-3 h-3" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Track 4 Header: BGM */}
          <div className="h-10 px-2.5 flex items-center justify-between border-t border-cinema-border/40">
            <div className="flex items-center gap-1.5 min-w-0">
              <Music className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-zinc-300 truncate">
                  A3: BGM
                </span>
                <span className="text-[9px] font-mono text-purple-400 font-bold">
                  {waveformData.tempoBpm} BPM
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowBeatGrid(!showBeatGrid)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors border ${
                  showBeatGrid
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                }`}
                title={showBeatGrid ? 'Ẩn lưới nhịp phách' : 'Hiện lưới nhịp phách'}
              >
                Nhịp
              </button>
              <button
                type="button"
                onClick={() => setIsBgmMuted(!isBgmMuted)}
                className={`p-1 rounded transition-colors ${
                  isBgmMuted
                    ? 'text-rose-400 hover:bg-rose-950/40'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title={isBgmMuted ? 'Bật nhạc nền' : 'Tắt nhạc nền (Mute)'}
              >
                {isBgmMuted ? (
                  <VolumeX className="w-3 h-3" />
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Scrollable Timeline View */}
        <div className="flex-1 min-w-0 overflow-x-auto relative select-none scrollbar-thin">
          <div style={{ width: `${timelineWidth}px` }} className="relative">
            {/* 1. Time Ruler Bar (Interactive click & scrub) */}
            <div
              ref={rulerRef}
              onMouseDown={handleRulerMouseDown}
              className="h-6 border-b border-cinema-border relative cursor-pointer bg-cinema-deck/50 hover:bg-cinema-deck/80 transition-colors"
              title="Nhấp chuột hoặc kéo để tua playhead"
            >
              {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }).map((_, idx) => {
                const sec = idx * 5
                const pos = (sec / totalDuration) * timelineWidth
                return (
                  <div
                    key={idx}
                    style={{ left: `${pos}px` }}
                    className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
                  >
                    <span className="text-[8px] font-mono text-zinc-500 leading-tight">
                      {sec}s
                    </span>
                    <div className="w-[1px] h-2 bg-zinc-700 mt-auto" />
                  </div>
                )
              })}
            </div>

            {/* Red Playhead Line */}
            <div
              style={{ transform: `translateX(${playheadPositionPx}px)` }}
              className="absolute top-0 bottom-0 w-[2px] bg-rose-500 z-30 pointer-events-none transition-transform duration-75"
            >
              <div className="w-3 h-3 rounded-full bg-rose-500 -ml-[5px] -mt-[1px] shadow-sm shadow-rose-500/80 flex items-center justify-center">
                <div className="w-1 h-1 rounded-full bg-white" />
              </div>
            </div>

            {/* Track 1: Video Shots (Trimmable & Draggable) */}
            <div className="h-16 flex items-stretch border-b border-cinema-border/60 relative">
              {shotTimeline.map(({ shot, index, duration }) => {
                const widthPx = duration * pxPerSec
                const isSelected = selectedShotId === shot.id
                const isTrimmingThis = trimming?.shotId === shot.id
                const isDragOverThis = dragOverShotId === shot.id

                return (
                  <div
                    key={shot.id}
                    draggable={!trimming}
                    onDragStart={(e) => handleDragStart(shot.id, e)}
                    onDragOver={(e) => handleDragOver(shot.id, e)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(shot.id, e)}
                    onClick={() => onSelectShot?.(shot.id)}
                    style={{ width: `${widthPx}px` }}
                    className={`relative rounded-md border overflow-hidden p-1.5 flex flex-col justify-between transition-all group shrink-0 ${
                      isSelected
                        ? 'bg-amber-500/15 border-cinema-amber ring-1 ring-cinema-amber/40 shadow-md'
                        : isDragOverThis
                        ? 'bg-sky-500/20 border-sky-400 ring-2 ring-sky-400/50 scale-[0.99]'
                        : 'bg-cinema-deck border-cinema-border hover:border-cinema-border-hover'
                    }`}
                  >
                    {/* Floating Trimming Tooltip */}
                    {isTrimmingThis && (
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 z-40 px-2 py-0.5 rounded bg-amber-500 text-zinc-950 font-mono text-[10px] font-bold shadow-lg shadow-amber-500/30 whitespace-nowrap pointer-events-none animate-in fade-in">
                        ⏱️ {duration.toFixed(1)}s
                      </div>
                    )}

                    {/* Left Trim Handle */}
                    <div
                      onMouseDown={(e) => startTrimming(shot.id, 'left', e)}
                      className="absolute top-0 bottom-0 left-0 w-2.5 bg-transparent hover:bg-amber-400/50 cursor-col-resize z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Kéo mép trái để cắt tỉa đầu phân cảnh"
                    >
                      <div className="w-[2px] h-4 bg-amber-400/80 rounded" />
                    </div>

                    {/* Top Row: Title, Index & Drag Grip */}
                    <div className="flex items-center justify-between text-[9px] font-mono text-zinc-300 pointer-events-none">
                      <div className="flex items-center gap-1 min-w-0">
                        <GripVertical className="w-2.5 h-2.5 text-zinc-500 opacity-60 shrink-0" />
                        <span className="font-semibold text-cinema-amber truncate">
                          #{index + 1} {shot.id}
                        </span>
                      </div>
                      <span className="text-[8px] text-zinc-400 font-bold shrink-0">
                        {duration.toFixed(1)}s
                      </span>
                    </div>

                    {/* Bottom Row: Motion badge & Act */}
                    <div className="flex items-center gap-1 pointer-events-none">
                      <Badge
                        variant="secondary"
                        className="text-[8px] px-1 py-0 font-mono uppercase bg-zinc-800 text-zinc-300 truncate border-none"
                      >
                        {String(shot.motion || 'zoom_in')}
                      </Badge>
                      {shot.act && (
                        <span className="text-[8px] px-1 rounded bg-zinc-800 text-zinc-300 font-mono border border-zinc-700">
                          H{String(shot.act)}
                        </span>
                      )}
                    </div>

                    {/* Right Trim Handle */}
                    <div
                      onMouseDown={(e) => startTrimming(shot.id, 'right', e)}
                      className="absolute top-0 bottom-0 right-0 w-2.5 bg-transparent hover:bg-amber-400/50 cursor-col-resize z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Kéo mép phải để co giãn thời lượng phân cảnh"
                    >
                      <div className="w-[2px] h-4 bg-amber-400/80 rounded" />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Track 2: Dialogue Track with Waveform Simulation */}
            <div
              className={`h-10 flex items-stretch border-b border-cinema-border/60 transition-opacity ${
                isVoiceMuted ? 'opacity-35 grayscale' : ''
              }`}
            >
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
                        : 'bg-cinema-canvas/30 border-dashed border-cinema-border/50 text-zinc-600'
                    }`}
                  >
                    {hasDialogue ? (
                      <>
                        <div className="flex items-center gap-1 min-w-0">
                          {/* Simulated Waveform Bars */}
                          <div className="flex items-end gap-0.5 h-4 shrink-0">
                            {[6, 12, 16, 9, 14, 18, 10, 8, 15, 11, 7].map((h, i) => (
                              <div
                                key={i}
                                style={{ height: `${h}px` }}
                                className="w-[2px] bg-cyan-400/70 rounded-full"
                              />
                            ))}
                          </div>
                          <span className="text-[9px] truncate font-normal">
                            "{String(shot.dialogue)}"
                          </span>
                        </div>
                        <Volume2 className="w-3 h-3 text-cyan-400 shrink-0 opacity-70" />
                      </>
                    ) : (
                      <span className="text-[8px] italic text-zinc-600 truncate">
                        (Tĩnh)
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Track 3: Foley SFX Track with Offset Positioning */}
            <div
              className={`h-9 flex items-stretch border-b border-cinema-border/60 transition-opacity ${
                isSfxMuted ? 'opacity-35 grayscale' : ''
              }`}
            >
              {shotTimeline.map(({ shot, duration }) => {
                const widthPx = duration * pxPerSec
                const hasSfx = Boolean(shot.sfx)
                const offsetSec = (shot.sfx_offset_ms || 0) / 1000
                const offsetLeftPercent = Math.min(
                  80,
                  Math.max(0, (offsetSec / duration) * 100)
                )

                return (
                  <div
                    key={shot.id}
                    style={{ width: `${widthPx}px` }}
                    className="rounded-md border border-cinema-border/50 bg-cinema-canvas/20 relative overflow-hidden shrink-0"
                  >
                    {hasSfx ? (
                      <div
                        style={{ left: `${offsetLeftPercent}%` }}
                        className="absolute top-1 bottom-1 px-1.5 rounded bg-violet-950/60 border border-violet-600/50 text-violet-300 font-mono text-[9px] font-medium flex items-center gap-1 shadow-sm max-w-[85%] truncate"
                      >
                        <Volume2 className="w-2.5 h-2.5 text-violet-400 shrink-0" />
                        <span className="truncate">{String(shot.sfx)}</span>
                        {offsetSec > 0 && (
                          <span className="text-[8px] text-violet-400/80">
                            @{offsetSec.toFixed(1)}s
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[8px] opacity-25 flex items-center justify-center h-full">
                        -
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Track 4: Dynamic Mood BGM with Real Waveform & Beat Markers */}
            <div
              className={`h-10 flex items-stretch border border-purple-900/40 rounded-md bg-purple-950/20 relative overflow-hidden transition-opacity ${
                isBgmMuted ? 'opacity-35 grayscale' : ''
              }`}
              style={{ width: `${timelineWidth}px` }}
            >
              {/* Audio Waveform Canvas Layer */}
              <div className="absolute inset-0 pointer-events-none">
                <AudioWaveformTrack
                  peaks={waveformData.peaks}
                  beatTimes={waveformData.beatTimes}
                  totalDuration={totalDuration}
                  audioDuration={waveformData.duration}
                  timelineWidth={timelineWidth}
                  playheadPositionPx={playheadPositionPx}
                  color="purple"
                  showBeatMarkers={showBeatGrid}
                  height={38}
                />
              </div>

              {/* Shot markers overlay */}
              <div className="absolute inset-0 flex items-stretch pointer-events-none">
                {shotTimeline.map(({ shot, duration }, idx) => {
                  const widthPx = duration * pxPerSec
                  const mood = String(shot.mood || 'cinematic')

                  return (
                    <div
                      key={shot.id}
                      style={{ width: `${widthPx}px` }}
                      className="border-r border-purple-500/30 px-1.5 py-0.5 flex items-center justify-between text-purple-300 font-mono text-[9px] shrink-0 font-medium bg-purple-950/20 backdrop-blur-[1px]"
                    >
                      <span className="flex items-center gap-1 truncate opacity-80">
                        <Music className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                        <span className="truncate">#{idx + 1} {mood}</span>
                      </span>
                      <span className="text-[8px] text-purple-400/80 font-mono">
                        {duration.toFixed(1)}s
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
