import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Smartphone,
  Sparkles,
  Download,
  Loader2,
  CheckCircle2,
  Film,
  Maximize2,
  Type,
} from 'lucide-react'
import { useCreateAutoReframe } from '../api/queries'
import type { ReframeResultResponse } from '../types'

export interface AutoReframeModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  sourceVideoUrl?: string | null
}

const REFRAME_MODES = [
  {
    id: 'blur_padding',
    name: 'Ambient Glass Blur (Nền Mờ)',
    tag: 'Phổ biến TikTok / Shorts',
    desc: 'Giữ trọn khung hình 16:9 ở giữa, nền trên và dưới được phóng to và làm mờ bokeh lung linh',
    icon: Sparkles,
    color: 'from-amber-500/20 to-orange-500/10 text-amber-300 border-amber-500/40',
  },
  {
    id: 'pan_scan',
    name: 'Dynamic Pan & Scan (Tràn Viền)',
    tag: 'Full 1080x1920',
    desc: 'Cắt cúp tỉ lệ 9:16 trực tiếp tràn toàn màn hình, bám sát tâm điểm phân cảnh kịch tính',
    icon: Maximize2,
    color: 'from-rose-500/20 to-pink-500/10 text-rose-300 border-rose-500/40',
  },
  {
    id: 'fit_center',
    name: 'Fit Letterbox (Khung Viền)',
    tag: 'Tối Giản Điện Ảnh',
    desc: 'Video 16:9 nguyên bản đặt giữa với hai dải viền đen điện ảnh tối giản trên dưới',
    icon: Film,
    color: 'from-cyan-500/20 to-blue-500/10 text-cyan-300 border-cyan-500/40',
  },
]

export default function AutoReframeModal({
  isOpen,
  onClose,
  projectId,
  sourceVideoUrl,
}: AutoReframeModalProps) {
  const [selectedMode, setSelectedMode] = useState<string>('blur_padding')
  const [burnSubtitles, setBurnSubtitles] = useState<boolean>(true)
  const [subtitleStyle, setSubtitleStyle] = useState<string>('mrbeast')
  const [reframeResult, setReframeResult] = useState<ReframeResultResponse | null>(null)
  const [videoError, setVideoError] = useState<boolean>(false)

  const reframeMutation = useCreateAutoReframe()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleStartReframe = () => {
    reframeMutation.mutate(
      {
        project_id: projectId,
        mode: selectedMode,
        burn_subtitles: burnSubtitles,
        subtitle_style: subtitleStyle,
      },
      {
        onSuccess: (data) => {
          setReframeResult(data)
        },
        onError: (err: any) => {
          alert(`Lỗi chuyển đổi video dọc 9:16: ${err?.message || 'Không thể xử lý'}`)
        },
      }
    )
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-fadeIn">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="relative w-full max-w-4xl bg-cinema-deck border border-cinema-border rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-cinema-card border-b border-cinema-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-rose-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <span>Smart Auto-Reframe 16:9 ➔ 9:16 Shorts/TikTok Studio</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                    Full HD 1080x1920
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Tự động tái định dạng video ngang thành video dọc tối ưu cho YouTube Shorts, TikTok & Reels
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body: Split 2 columns (Left: Options, Right: Smartphone Mockup) */}
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left: Options (7 cols) */}
            <div className="md:col-span-7 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Chọn Phong Cách Chuyển Đổi (Reframe Mode)
                </label>
                <div className="space-y-2.5">
                  {REFRAME_MODES.map((mode) => {
                    const isActive = selectedMode === mode.id
                    const IconComponent = mode.icon
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setSelectedMode(mode.id)}
                        className={`w-full p-3.5 rounded-2xl border text-left transition-all relative group flex items-start gap-3.5 ${
                          isActive
                            ? `bg-gradient-to-r ${mode.color} shadow-md`
                            : 'bg-studio-card/50 border-studio-border/60 hover:bg-studio-card text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105 ${
                            isActive
                              ? 'bg-black/40 border-white/20 text-white'
                              : 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-bold text-zinc-100">{mode.name}</span>
                            <span className="text-[9px] font-mono px-2 py-0.2 rounded-md bg-white/10 text-zinc-300">
                              {mode.tag}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">{mode.desc}</p>
                        </div>

                        {isActive && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-1" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Safe-Zone Subtitle Option */}
              <div className="p-3.5 rounded-xl bg-studio-deck border border-studio-border space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Type className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-zinc-200">
                        Khắc Phụ Đề Chuẩn Vùng An Toàn (Safe Zone)
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        Tự động căn lề cao để không bị che bởi thanh tương tác TikTok / Shorts
                      </div>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={burnSubtitles}
                    onChange={(e) => setBurnSubtitles(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                  />
                </div>

                {/* Subtitle Style Chooser if enabled */}
                {burnSubtitles && (
                  <div className="pt-2 border-t border-zinc-800/80">
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-2">
                      Phong Cách Phụ Đề Viral (Subtitle Typography):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          id: 'mrbeast',
                          name: '⚡ MrBeast Yellow',
                          sub: 'Vàng viền đen đậm, viral cao',
                          badge: 'CHỮ VÀNG',
                          badgeStyle: 'bg-yellow-400 text-black font-black',
                        },
                        {
                          id: 'neon_cyan',
                          name: '💎 Neon Cyan',
                          sub: 'Xanh huỳnh quang hiện đại',
                          badge: 'CHỮ CYAN',
                          badgeStyle: 'bg-cyan-400 text-black font-black',
                        },
                        {
                          id: 'cinema_white',
                          name: '🎬 Cinema White',
                          sub: 'Trắng thanh lịch tối giản',
                          badge: 'CHỮ TRẮNG',
                          badgeStyle: 'bg-white text-black font-bold',
                        },
                      ].map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setSubtitleStyle(style.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                            subtitleStyle === style.id
                              ? 'bg-amber-500/15 border-amber-400/80 shadow-sm shadow-amber-500/10'
                              : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-zinc-200">{style.name}</div>
                            <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">{style.sub}</div>
                          </div>
                          <div className={`px-2 py-0.5 rounded text-[10px] text-center tracking-wider w-fit mt-1 ${style.badgeStyle}`}>
                            {style.badge}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Start Button */}
              <button
                type="button"
                onClick={handleStartReframe}
                disabled={reframeMutation.isPending}
                className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-bold text-xs sm:text-sm tracking-wide shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
              >
                {reframeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950 shrink-0" />
                    <span>Đang render video dọc 9:16 (FFmpeg Hardware Filter)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-zinc-950" />
                    <span>Bắt Đầu Chuyển Đổi Sang 9:16 Shorts/TikTok</span>
                  </>
                )}
              </button>

              {reframeResult && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Chuyển đổi hoàn tất! File: {reframeResult.filename}</span>
                  </div>

                  <a
                    href={reframeResult.video_url}
                    download
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs hover:bg-emerald-400 transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải Về</span>
                  </a>
                </div>
              )}
            </div>

            {/* Right: Smartphone Mockup Frame (5 cols) */}
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="relative w-[210px] sm:w-[230px] h-[420px] sm:h-[460px] bg-zinc-950 rounded-[38px] p-2.5 shadow-[0_0_35px_rgba(0,0,0,0.9)] border-4 border-zinc-800 flex flex-col items-center">
                {/* Speaker notch */}
                <div className="w-16 h-4 bg-zinc-900 rounded-full mb-1 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-950 mr-1.5 border border-zinc-800" />
                  <div className="w-6 h-1 rounded-full bg-zinc-800" />
                </div>

                {/* Inner Screen Area */}
                <div className="relative w-full flex-1 bg-zinc-900 rounded-[28px] overflow-hidden flex items-center justify-center border border-zinc-800/80">
                  {reframeResult ? (
                    <video
                      src={reframeResult.video_url}
                      controls
                      autoPlay
                      loop
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : sourceVideoUrl && !videoError ? (
                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                      {selectedMode === 'blur_padding' && (
                        <>
                          <video
                            src={sourceVideoUrl}
                            muted
                            autoPlay
                            loop
                            onError={() => setVideoError(true)}
                            className="absolute inset-0 w-full h-full object-cover blur-md scale-125 opacity-60"
                          />
                          <video
                            src={sourceVideoUrl}
                            muted
                            autoPlay
                            loop
                            onError={() => setVideoError(true)}
                            className="relative z-10 w-full object-contain"
                          />
                        </>
                      )}

                      {selectedMode === 'pan_scan' && (
                        <video
                          src={sourceVideoUrl}
                          muted
                          autoPlay
                          loop
                          onError={() => setVideoError(true)}
                          className="w-full h-full object-cover scale-110"
                        />
                      )}

                      {selectedMode === 'fit_center' && (
                        <video
                          src={sourceVideoUrl}
                          muted
                          autoPlay
                          loop
                          onError={() => setVideoError(true)}
                          className="w-full object-contain"
                        />
                      )}

                      {/* Mockup TikTok overlay UI */}
                      <div className="absolute right-2 bottom-12 flex flex-col items-center gap-2.5 z-20 pointer-events-none opacity-80">
                        <div className="w-6 h-6 rounded-full bg-rose-500/80 flex items-center justify-center text-[10px] text-white font-bold">
                          ♥
                        </div>
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[9px] text-white">
                          💬
                        </div>
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[9px] text-white">
                          ↗
                        </div>
                      </div>

                      <div className="absolute bottom-2 left-2 right-10 text-[9px] text-zinc-300 z-20 pointer-events-none bg-black/40 backdrop-blur-sm p-1.5 rounded-lg">
                        <div className="font-bold truncate">@aifilmstudio #Shorts #TikTok</div>
                        <div className="text-[8px] text-zinc-400 truncate">Preview: {selectedMode}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-zinc-500 text-xs flex flex-col items-center">
                      <Smartphone className="w-8 h-8 mb-2 text-zinc-600 animate-pulse" />
                      <span className="font-medium text-zinc-400">Chưa có video 16:9 để mô phỏng</span>
                      <span className="text-[10px] text-zinc-500 mt-1 max-w-[170px]">
                        Hãy tạo các clip phân cảnh hoặc xuất bản Master Movie để kích hoạt xem trước
                      </span>
                    </div>
                  )}
                </div>

                {/* Home Indicator bar */}
                <div className="w-24 h-1 bg-zinc-700 rounded-full mt-1.5" />
              </div>
              <span className="text-[10px] font-mono text-zinc-500 mt-2">Mô hình hiển thị Smartphone 9:16</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
