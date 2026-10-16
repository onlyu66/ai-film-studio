
import { motion } from 'framer-motion'
import { Clapperboard, Trash2, CheckCircle2, Loader2, AlertCircle, MonitorPlay } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import type { StudioStatus } from '../types'

export interface NavbarProps {
  status: StudioStatus | null
  onClean: () => void
  isCleaning: boolean
  onWatchMovie: () => void
}

export default function Navbar({ status, onClean, isCleaning, onWatchMovie }: NavbarProps) {
  const getStatusBadge = () => {
    switch (status?.status) {
      case 'running':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold shadow-sm shadow-amber-500/20"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
            <span>{status.stage_name || 'Đang sản xuất...'}</span>
          </motion.div>
        )
      case 'completed':
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-sm shadow-emerald-500/20"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Phim hoàn tất</span>
          </motion.div>
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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-slate-400 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Studio Sẵn Sàng</span>
          </div>
        )
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-[#070A11]/80 backdrop-blur-xl border-b border-slate-800/80 px-6 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3.5">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 2 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/25 ring-1 ring-white/20"
          >
            <Clapperboard className="w-5 h-5 text-white" />
          </motion.div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
                AI FILM STUDIO
              </span>
              <Badge variant="default" className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0">
                2.0 PRO
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Automated Hollywood-Grade Cinema Pipeline</p>
          </div>
        </div>

        {/* Status Badges & Quick Action Buttons */}
        <div className="flex items-center gap-3">
          {getStatusBadge()}

          {status?.status === 'completed' && status?.final_video && (
            <Button
              variant="default"
              size="sm"
              onClick={onWatchMovie}
              className="gap-1.5 text-xs shadow-emerald-500/20 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950"
            >
              <MonitorPlay className="w-3.5 h-3.5 fill-current" />
              <span>Xem Phim</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onClean}
            disabled={status?.status === 'running' || isCleaning}
            className="gap-1.5 text-xs hover:border-rose-500/40 hover:text-rose-400 hover:bg-rose-500/10 text-slate-400"
            title="Dọn dẹp thư mục outputs để bắt đầu dự án mới"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isCleaning ? 'Đang dọn...' : 'Xóa Output'}</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
