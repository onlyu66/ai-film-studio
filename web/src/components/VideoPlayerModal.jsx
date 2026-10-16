import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { X, Download, FileText, Film, Sparkles, MonitorPlay } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

export default function VideoPlayerModal({ videoUrl, srtUrl, onClose }) {
  useEffect(() => {
    // Fire festive fireworks confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    })
  }, [])

  if (!videoUrl) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-xl animate-fadeIn">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-5xl bg-[#090C16] border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col ring-1 ring-white/10"
        >
          {/* Cinema Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#0D1220]/90 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
                <Film className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-extrabold text-white">
                    Master Cinema Cut (Full HD 1080p)
                  </h3>
                  <Badge variant="success" className="text-[10px] font-mono px-2 py-0">
                    MASTER READY
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">Đã tích hợp âm thanh vòm, giọng đọc truyền cảm và phụ đề đồng bộ</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Video Player */}
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

          {/* Actions & Download Toolbar */}
          <div className="p-5 bg-[#0D1220]/90 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-medium">Sản xuất hoàn chỉnh tự động bởi AI Film Studio 2.0</span>
            </div>

            <div className="flex items-center gap-3">
              {srtUrl && (
                <a
                  href={srtUrl}
                  download
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <FileText className="w-4 h-4 text-indigo-400" />
                  <span>Tải Phụ đề (.srt)</span>
                </a>
              )}

              <a
                href={videoUrl}
                download
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:opacity-95 text-white shadow-xl shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                <span>Tải Video Phim (.mp4)</span>
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
