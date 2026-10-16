import React from 'react'
import { X, Download, FileText, Film, Sparkles } from 'lucide-react'

export default function VideoPlayerModal({ videoUrl, srtUrl, onClose }) {
  if (!videoUrl) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Phim Hoàn Chỉnh (Master Video)</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">1080p</span>
              </h3>
              <p className="text-xs text-slate-400">Đã tích hợp đầy đủ âm nhạc, giọng thuyết minh và chuyển động</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video bg-black flex items-center justify-center">
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full h-full object-contain"
          >
            Trình duyệt của bạn không hỗ trợ phát thẻ video.
          </video>
        </div>

        {/* Actions & Download */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Sản xuất hoàn tất bởi AI Film Studio</span>
          </div>

          <div className="flex items-center gap-2.5">
            {srtUrl && (
              <a
                href={srtUrl}
                download
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span>Tải Phụ đề (.srt)</span>
              </a>
            )}

            <a
              href={videoUrl}
              download
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-white shadow-lg shadow-amber-500/20 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải Video Phim (.mp4)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
