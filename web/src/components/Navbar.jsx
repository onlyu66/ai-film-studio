import React from 'react'
import { Clapperboard, Trash2, Film, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

export default function Navbar({ status, onClean, isCleaning }) {
  const getStatusBadge = () => {
    switch (status?.status) {
      case 'running':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Đang sản xuất phim ({status.stage_name})</span>
          </div>
        )
      case 'completed':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Phim hoàn tất!</span>
          </div>
        )
      case 'error':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Có lỗi phát sinh</span>
          </div>
        )
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Studio Sẵn Sàng</span>
          </div>
        )
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-[#0B0F19]/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Clapperboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">AI FILM STUDIO</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase">PRO</span>
            </div>
            <p className="text-xs text-slate-400">Hệ thống sản xuất phim tự động 1-chạm</p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-4">
          {getStatusBadge()}

          <button
            onClick={onClean}
            disabled={status?.status === 'running' || isCleaning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-800/50 border border-slate-700/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Dọn dẹp thư mục outputs để bắt đầu dự án mới"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isCleaning ? 'Đang dọn...' : 'Xóa Output'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
