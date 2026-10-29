import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  SlidersHorizontal,
  Columns,
  Eye,
  RotateCcw,
  Sparkles,
  Check,
} from 'lucide-react'
import { COLOR_LUT_PRESETS, getColorLutCss } from '../utils/colorGradingStyles'

export interface ColorCompareSliderProps {
  mediaSrc: string
  isVideo?: boolean
  activeLut: string
  onSelectLut?: (lutId: string) => void
  showLutSelector?: boolean
  className?: string
}

export default function ColorCompareSlider({
  mediaSrc,
  isVideo = false,
  activeLut,
  onSelectLut,
  showLutSelector = true,
  className = '',
}: ColorCompareSliderProps) {
  const [sliderPos, setSliderPos] = useState<number>(50)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [compareMode, setCompareMode] = useState<'wipe' | 'side_by_side' | 'toggle'>('wipe')
  const [isHoldingOriginal, setIsHoldingOriginal] = useState<boolean>(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const origVideoRef = useRef<HTMLVideoElement>(null)
  const lutVideoRef = useRef<HTMLVideoElement>(null)

  const lutConfig = getColorLutCss(activeLut)
  const activeLutObj = COLOR_LUT_PRESETS.find((l) => l.id === activeLut) || COLOR_LUT_PRESETS[0]

  // Synchronize playback between original and LUT video elements
  useEffect(() => {
    if (!isVideo) return
    const orig = origVideoRef.current
    const lut = lutVideoRef.current
    if (!orig || !lut) return

    const handlePlay = () => {
      lut.play().catch(() => {})
    }
    const handlePause = () => {
      lut.pause()
    }
    const handleSeeking = () => {
      lut.currentTime = orig.currentTime
    }
    const handleTimeUpdate = () => {
      if (Math.abs(lut.currentTime - orig.currentTime) > 0.15) {
        lut.currentTime = orig.currentTime
      }
    }

    orig.addEventListener('play', handlePlay)
    orig.addEventListener('pause', handlePause)
    orig.addEventListener('seeking', handleSeeking)
    orig.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      orig.removeEventListener('play', handlePlay)
      orig.removeEventListener('pause', handlePause)
      orig.removeEventListener('seeking', handleSeeking)
      orig.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [isVideo, mediaSrc])

  // Dragging logic
  const updateSliderPosition = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPos(percentage)
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (compareMode !== 'wipe') return
    setIsDragging(true)
    updateSliderPosition(e.clientX)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || compareMode !== 'wipe') return
    updateSliderPosition(e.clientX)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false)
      try {
        ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
      } catch {
        // Ignore if already released
      }
    }
  }

  // Keyboard shortcut: hold space to see original in toggle mode
  useEffect(() => {
    if (compareMode !== 'toggle') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        setIsHoldingOriginal(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setIsHoldingOriginal(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [compareMode])

  return (
    <div className={`flex flex-col gap-3 select-none ${className}`}>
      {/* Top Comparison Mode Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 bg-studio-deck/80 border border-studio-border/70 rounded-xl text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1 mr-2">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span>Chế độ so sánh A/B:</span>
          </span>

          <button
            type="button"
            onClick={() => setCompareMode('wipe')}
            className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              compareMode === 'wipe'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="Thanh trượt chia đôi màn hình tự do (Wipe Slider)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Wipe Slider</span>
          </button>

          <button
            type="button"
            onClick={() => setCompareMode('side_by_side')}
            className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              compareMode === 'side_by_side'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="So sánh song song hai nửa màn hình (Side-by-Side)"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Song Song</span>
          </button>

          <button
            type="button"
            onClick={() => setCompareMode('toggle')}
            className={`px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              compareMode === 'toggle'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="Nhấn giữ để đối chiếu bản gốc tức thì (Toggle)"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Nhấn Giữ So Gốc</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {compareMode === 'wipe' && (
            <button
              type="button"
              onClick={() => setSliderPos(50)}
              className="px-2 py-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 flex items-center gap-1 text-[11px] transition-all"
              title="Đặt lại thanh chia đôi về giữa 50%"
            >
              <RotateCcw className="w-3 h-3" />
              <span>50%</span>
            </button>
          )}

          {compareMode === 'toggle' && (
            <button
              type="button"
              onPointerDown={() => setIsHoldingOriginal(true)}
              onPointerUp={() => setIsHoldingOriginal(false)}
              onPointerLeave={() => setIsHoldingOriginal(false)}
              className={`px-3 py-1 rounded-lg font-bold text-xs transition-all shadow-sm ${
                isHoldingOriginal
                  ? 'bg-amber-500 text-zinc-950 scale-95'
                  : 'bg-zinc-800 text-zinc-200 border border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              {isHoldingOriginal ? 'ĐANG XEM GỐC (REC.709)' : 'GIỮ ĐỂ XEM GỐC'}
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`relative aspect-video w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-studio-border/80 group ${
          compareMode === 'wipe' ? 'cursor-ew-resize' : ''
        }`}
      >
        {/* Mode 1: Wipe Slider */}
        {compareMode === 'wipe' && (
          <>
            {/* Layer 1 (Bottom): Original Rec.709 (Left Side) */}
            <div className="absolute inset-0 w-full h-full">
              {isVideo ? (
                <video
                  ref={origVideoRef}
                  src={mediaSrc}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={mediaSrc}
                  alt="Original Footage"
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Layer 2 (Top): Color Graded LUT (Right Side clipped) */}
            <div
              className="absolute inset-0 w-full h-full pointer-events-none transition-none"
              style={{
                clipPath: `polygon(${sliderPos}% 0%, 100% 0%, 100% 100%, ${sliderPos}% 100%)`,
              }}
            >
              {isVideo ? (
                <video
                  ref={lutVideoRef}
                  src={mediaSrc}
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                  style={{
                    filter: lutConfig.filter,
                  }}
                />
              ) : (
                <img
                  src={mediaSrc}
                  alt="Color Graded Footage"
                  className="w-full h-full object-contain"
                  style={{
                    filter: lutConfig.filter,
                  }}
                />
              )}

              {/* Optional Vignette overlay */}
              {lutConfig.hasVignette && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle, transparent 60%, rgba(0,0,0,0.45) 100%)',
                  }}
                />
              )}
            </div>

            {/* Vertical Divider Wipe Bar */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] pointer-events-none z-20"
              style={{ left: `${sliderPos}%` }}
            >
              {/* Center Handle Button */}
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-zinc-900/90 border-2 border-white shadow-xl flex items-center justify-center text-white backdrop-blur-sm group-hover:scale-110 transition-transform">
                <span className="text-[10px] font-mono font-bold tracking-tighter">↔</span>
              </div>
            </div>

            {/* Floating Labels */}
            <div className="absolute top-3 left-3 z-30 pointer-events-none">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-black/70 backdrop-blur-md border border-white/20 text-zinc-300 shadow-md">
                Gốc / Rec.709
              </span>
            </div>

            <div className="absolute top-3 right-3 z-30 pointer-events-none">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-rose-500/80 backdrop-blur-md border border-rose-400 text-white shadow-md flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>LUT: {activeLutObj.name}</span>
              </span>
            </div>
          </>
        )}

        {/* Mode 2: Side-by-Side Dual View */}
        {compareMode === 'side_by_side' && (
          <div className="absolute inset-0 w-full h-full grid grid-cols-2 divide-x divide-white/20">
            {/* Left Box: Original */}
            <div className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center">
              {isVideo ? (
                <video
                  ref={origVideoRef}
                  src={mediaSrc}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={mediaSrc}
                  alt="Original Footage"
                  className="w-full h-full object-contain"
                />
              )}
              <div className="absolute top-2 left-2 z-10 pointer-events-none">
                <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase bg-black/80 border border-white/20 text-zinc-300">
                  GỐC / REC.709
                </span>
              </div>
            </div>

            {/* Right Box: LUT */}
            <div className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center">
              {isVideo ? (
                <video
                  ref={lutVideoRef}
                  src={mediaSrc}
                  muted
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                  style={{
                    filter: lutConfig.filter,
                  }}
                />
              ) : (
                <img
                  src={mediaSrc}
                  alt="Color Graded Footage"
                  className="w-full h-full object-contain"
                  style={{
                    filter: lutConfig.filter,
                  }}
                />
              )}
              {lutConfig.hasVignette && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'radial-gradient(circle, transparent 60%, rgba(0,0,0,0.45) 100%)',
                  }}
                />
              )}
              <div className="absolute top-2 right-2 z-10 pointer-events-none">
                <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase bg-rose-500/80 border border-rose-400 text-white">
                  LUT: {activeLutObj.name}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Mode 3: Hold to Compare Toggle */}
        {compareMode === 'toggle' && (
          <div className="relative w-full h-full bg-black flex items-center justify-center">
            {isVideo ? (
              <video
                ref={origVideoRef}
                src={mediaSrc}
                controls
                autoPlay
                loop
                playsInline
                className="w-full h-full object-contain transition-all"
                style={{
                  filter: isHoldingOriginal ? 'none' : lutConfig.filter,
                }}
              />
            ) : (
              <img
                src={mediaSrc}
                alt="Footage"
                className="w-full h-full object-contain transition-all"
                style={{
                  filter: isHoldingOriginal ? 'none' : lutConfig.filter,
                }}
              />
            )}

            {!isHoldingOriginal && lutConfig.hasVignette && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, transparent 60%, rgba(0,0,0,0.45) 100%)',
                }}
              />
            )}

            <div className="absolute top-3 left-3 z-30 pointer-events-none">
              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase backdrop-blur-md border shadow-md transition-all ${
                  isHoldingOriginal
                    ? 'bg-amber-500/90 text-zinc-950 border-amber-400'
                    : 'bg-rose-500/80 text-white border-rose-400'
                }`}
              >
                {isHoldingOriginal ? 'BẢN GỐC (REC.709)' : `LUT: ${activeLutObj.name}`}
              </span>
            </div>

            <div className="absolute bottom-3 inset-x-0 flex justify-center z-30 pointer-events-none">
              <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-black/75 border border-white/20 text-zinc-300 backdrop-blur-md">
                Nhấn giữ nút &quot;Giữ để xem gốc&quot; hoặc phím Space để so sánh
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick LUT Selector Bar */}
      {showLutSelector && onSelectLut && (
        <div className="mt-1">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rose-400" />
              <span>Chọn Thử Bộ Lọc Màu Điện Ảnh (Real-time 60 FPS):</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              {COLOR_LUT_PRESETS.length} màu sắc
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
            {COLOR_LUT_PRESETS.map((lut) => {
              const isActive = activeLut === lut.id
              return (
                <button
                  key={lut.id}
                  type="button"
                  onClick={() => onSelectLut(lut.id)}
                  className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 group ${
                    isActive
                      ? 'bg-rose-500/20 border-rose-500/60 text-rose-200 shadow-sm'
                      : 'bg-studio-card/50 border-studio-border/60 hover:bg-studio-card text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-gradient-to-tr ${lut.css_gradient} shrink-0 shadow-sm border border-white/20`}
                  />
                  <div className="min-w-0 flex-1 truncate">
                    <div className="text-[11px] font-semibold leading-tight truncate">
                      {lut.name}
                    </div>
                  </div>
                  {isActive && <Check className="w-3 h-3 text-rose-400 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
