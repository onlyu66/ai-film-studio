import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { X, Download, FileText, Film, Sparkles, Palette, Smartphone } from 'lucide-react'
import { Badge } from './ui/badge'
import ColorCompareSlider from './ColorCompareSlider'
import AutoReframeModal from './AutoReframeModal'

export interface VideoPlayerModalProps {
  videoUrl: string | null
  srtUrl?: string | null
  onClose: () => void
}

export default function VideoPlayerModal({ videoUrl, srtUrl, onClose }: VideoPlayerModalProps) {
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false)
  const [isReframeOpen, setIsReframeOpen] = useState<boolean>(false)
  const [selectedLut, setSelectedLut] = useState<string>(
    localStorage.getItem('studio_color_lut') || 'teal_and_orange'
  )

  useEffect(() => {
    // Fire festive fireworks confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!videoUrl) return null

  const handleSelectLut = (lutId: string) => {
    setSelectedLut(lutId)
    localStorage.setItem('studio_color_lut', lutId)
  }

  return (
    <AnimatePresence>
      <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-fadeIn cursor-pointer">
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="relative w-full max-w-5xl bg-cinema-deck border border-cinema-border rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh] cursor-default"
        >
          {/* Cinema Header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-cinema-card border-b border-cinema-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cinema-deck border border-cinema-border flex items-center justify-center text-cinema-amber font-bold">
                <Film className="w-4 h-4 text-cinema-amber" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-zinc-100">
                    Master Cinema Cut (Full HD 1080p)
                  </h3>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-mono px-2 py-0 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  >
                    MASTER READY
                  </Badge>
                </div>
                <p className="text-xs text-zinc-400">
                  Đã tích hợp âm thanh vòm, giọng đọc truyền cảm và phụ đề đồng bộ
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCompareMode(!isCompareMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isCompareMode
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                }`}
                title="Bật/Tắt chế độ so sánh màu sắc A/B Split-Screen"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>{isCompareMode ? 'Tắt So Màu A/B' : 'So Màu A/B (Split-Screen)'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Video Player or A/B Color Comparison Slider */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {isCompareMode ? (
              <div className="p-4 bg-cinema-deck">
                <ColorCompareSlider
                  mediaSrc={videoUrl}
                  isVideo={true}
                  activeLut={selectedLut}
                  onSelectLut={handleSelectLut}
                  showLutSelector={true}
                />
              </div>
            ) : (
              <div className="relative aspect-video bg-black flex items-center justify-center shadow-inner">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain focus:outline-none"
                >
                  Trình duyệt của bạn không hỗ trợ thẻ video HTML5.
                </video>
              </div>
            )}
          </div>

          {/* Actions & Download Toolbar */}
          <div className="p-4 bg-cinema-card border-t border-cinema-border flex flex-wrap items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Sparkles className="w-3.5 h-3.5 text-cinema-amber" />
              <span className="font-mono text-[11px]">AI FILM STUDIO WORKSTATION EDITION</span>
            </div>

            <div className="flex items-center gap-2.5">
              {srtUrl && (
                <a
                  href={srtUrl}
                  download
                  className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Tải Phụ đề (.srt)</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setIsReframeOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500/20 to-rose-500/20 hover:from-amber-500/30 hover:to-rose-500/30 text-amber-300 border border-amber-500/40 transition-all shadow-sm cursor-pointer"
                title="Chuyển đổi sang video dọc 9:16 cho TikTok / YouTube Shorts"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span>Xuất 9:16 Shorts/TikTok</span>
              </button>

              <a
                href={videoUrl}
                download
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-cinema-amber hover:bg-amber-400 text-zinc-950 transition-colors shadow-md shadow-amber-500/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải Video Phim (.mp4)</span>
              </a>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Auto-Reframe Modal */}
      <AutoReframeModal
        isOpen={isReframeOpen}
        onClose={() => setIsReframeOpen(false)}
        projectId="current"
        sourceVideoUrl={videoUrl}
      />
    </AnimatePresence>
  )
}
