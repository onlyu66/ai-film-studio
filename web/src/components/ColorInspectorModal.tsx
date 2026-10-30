import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Palette, CheckCircle2, Clapperboard, Sparkles } from 'lucide-react'
import type { Shot } from '../types'
import ColorCompareSlider from './ColorCompareSlider'
import { COLOR_LUT_PRESETS } from '../utils/colorGradingStyles'

export interface ColorInspectorModalProps {
  shot: Shot
  shotIndex: number
  onClose: () => void
  onApplyLutToProject: (lutId: string) => void
  currentProjectLut?: string
}

export default function ColorInspectorModal({
  shot,
  shotIndex,
  onClose,
  onApplyLutToProject,
  currentProjectLut = 'none',
}: ColorInspectorModalProps) {
  const [selectedLut, setSelectedLut] = useState<string>(
    localStorage.getItem('studio_color_lut') || currentProjectLut || 'teal_and_orange'
  )
  const [appliedToast, setAppliedToast] = useState<string | null>(null)

  // Determine media URL: use video if available, else image
  const mediaSrc = shot.video_path
    ? `/api/outputs/${shot.video_path}?t=${Date.now()}`
    : `/api/outputs/${shot.image_path}?t=${Date.now()}`
  const isVideo = Boolean(shot.video_path)

  const activeLutObj = COLOR_LUT_PRESETS.find((l) => l.id === selectedLut) || COLOR_LUT_PRESETS[0]

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleApply = () => {
    onApplyLutToProject(selectedLut)
    setAppliedToast(activeLutObj.name)
    setTimeout(() => {
      setAppliedToast(null)
    }, 3000)
  }

  return (
    <AnimatePresence>
      <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-fadeIn cursor-pointer">
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="relative w-full max-w-5xl bg-cinema-deck border border-cinema-border rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] cursor-default"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-cinema-card border-b border-cinema-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <span>So Màu A/B & Color Grading Inspector</span>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300">
                      Shot #{shotIndex + 1}
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-1 max-w-xl">
                  {shot.dialogue ? `Thoại: "${shot.dialogue}"` : shot.image_prompt || 'Không có mô tả'}
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

          {/* Body with Comparison Slider */}
          <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0 flex flex-col gap-4">
            <ColorCompareSlider
              mediaSrc={mediaSrc}
              isVideo={isVideo}
              activeLut={selectedLut}
              onSelectLut={setSelectedLut}
              showLutSelector={true}
            />

            {/* Description Card */}
            <div className="p-3.5 rounded-xl bg-studio-deck/60 border border-studio-border/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-6 h-6 rounded-lg bg-gradient-to-tr ${activeLutObj.css_gradient} shrink-0 border border-white/20`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-200">
                    {activeLutObj.name}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {activeLutObj.description}
                  </div>
                </div>
              </div>

              {appliedToast && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Đã áp dụng: {appliedToast}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Toolbar */}
          <div className="p-4 bg-cinema-card border-t border-cinema-border flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Clapperboard className="w-4 h-4 text-rose-400" />
              <span>Chỉnh màu thời gian thực 60 FPS — Áp dụng tự động khi xuất bản phim Master</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Đóng
              </button>

              <button
                type="button"
                onClick={handleApply}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/20 transition-all hover:scale-102 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Áp Dụng Cho Toàn Bộ Dự Án</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
