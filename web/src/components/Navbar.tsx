
import { Film, Trash2, CheckCircle2, Loader2, AlertCircle, MonitorPlay, FileEdit, Clapperboard } from 'lucide-react'
import { Button } from './ui/button'
import type { StudioStatus } from '../types'

export interface NavbarProps {
  status: StudioStatus | null
  onClean: () => void
  isCleaning: boolean
  onWatchMovie: () => void
  onOpenLibrary: () => void
}

export default function Navbar({ status, onClean, isCleaning, onWatchMovie, onOpenLibrary }: NavbarProps) {
  const getStatusBadge = () => {
    switch (status?.status) {
      case 'script_ready':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <FileEdit className="w-3.5 h-3.5 text-amber-400" />
            <span>Kịch bản chờ duyệt</span>
          </div>
        )
      case 'running':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
            <span className="truncate max-w-[150px]">{status.stage_name || 'Đang render...'}</span>
          </div>
        )
      case 'completed':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Phim hoàn tất</span>
          </div>
        )
      case 'error':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Có lỗi phát sinh</span>
          </div>
        )
      default:
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#121622] border border-white/[0.08] text-slate-400 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Ready</span>
          </div>
        )
    }
  }

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <header className="sticky top-0 z-40 bg-[#080A0F]/90 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-6 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo & Workstation Badge */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#141824] border border-white/[0.1] flex items-center justify-center text-amber-400 shadow-sm">
            <Clapperboard className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-white font-sans">
              AI FILM STUDIO
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 bg-white/[0.04] border border-white/[0.08] px-1.5 py-0.5 rounded">
              Workstation
            </span>
          </div>
        </div>

        {/* Central Workstation Navigation Deck */}
        <nav className="hidden md:flex items-center p-1 rounded-xl bg-[#10131C] border border-white/[0.06] text-xs font-medium text-slate-400">
          <button
            type="button"
            onClick={() => scrollTo('director-inspector')}
            className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            Đạo diễn & Kịch bản
          </button>
          <button
            type="button"
            onClick={() => scrollTo('storyboard-section')}
            className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            Bảng phân cảnh
          </button>
          <button
            type="button"
            onClick={() => scrollTo('timeline-section')}
            className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            Dòng thời gian
          </button>
        </nav>

        {/* Status & Studio Action Controls */}
        <div className="flex items-center gap-2.5">
          {getStatusBadge()}

          {status?.status === 'completed' && status?.final_video && (
            <Button
              variant="default"
              size="sm"
              onClick={onWatchMovie}
              className="gap-1.5 text-xs h-8 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-sm cursor-pointer"
            >
              <MonitorPlay className="w-3.5 h-3.5 fill-current" />
              <span>Xem Phim</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenLibrary}
            className="gap-1.5 text-xs h-8 cursor-pointer"
            title="Thư viện phim đã sản xuất"
          >
            <Film className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Thư viện</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClean}
            disabled={status?.status === 'running' || isCleaning}
            className="h-8 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
            title="Làm mới dự án"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
