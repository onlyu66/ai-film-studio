import { Film, Trash2, CheckCircle2, Loader2, AlertCircle, MonitorPlay, FileEdit, Clapperboard, Terminal } from 'lucide-react'
import { Button } from './ui/button'
import type { StudioStatus } from '../types'

export interface NavbarProps {
  status: StudioStatus | null
  onClean: () => void
  isCleaning: boolean
  onWatchMovie: () => void
  onOpenLibrary: () => void
  onToggleConsole?: () => void
  showConsole?: boolean
  logsCount?: number
}

export default function Navbar({
  status,
  onClean,
  isCleaning,
  onWatchMovie,
  onOpenLibrary,
  onToggleConsole,
  showConsole = false,
  logsCount = 0,
}: NavbarProps) {
  const isRunning = status?.status === 'running'
  const isScriptReady = status?.status === 'script_ready'
  const isCompleted = status?.status === 'completed'
  const isError = status?.status === 'error'

  const getStatusBadge = () => {
    if (isScriptReady) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <FileEdit className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Kịch bản chờ duyệt</span>
        </div>
      )
    }
    if (isRunning) {
      return (
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
          <span className="truncate max-w-[130px] font-semibold">{status?.stage_name || 'Đang tạo phim...'}</span>
        </div>
      )
    }
    if (isCompleted) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Phim hoàn tất</span>
        </div>
      )
    }
    if (isError) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
          <AlertCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Lỗi xử lý</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900/80 border border-white/[0.08] text-zinc-400 text-xs font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span>Ready</span>
      </div>
    )
  }

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <header className="sticky top-0 z-40 px-3 sm:px-6 pt-3 pb-2">
      <div className="max-w-7xl mx-auto glass-panel rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-2xl">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-sm">
            <Clapperboard className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold tracking-tight text-white font-sans">
              AI FILM STUDIO
            </span>
            <span className="text-[9px] font-mono uppercase tracking-widest text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
              PRO
            </span>
          </div>
        </div>

        {/* Center Section Navigations */}
        <nav className="hidden lg:flex items-center p-1 rounded-xl bg-zinc-950/40 border border-white/[0.06] text-xs font-medium text-zinc-400">
          <button
            type="button"
            onClick={() => scrollTo('director-inspector')}
            className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            Đạo diễn
          </button>
          <button
            type="button"
            onClick={() => scrollTo('storyboard-section')}
            className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            Phân cảnh & Kịch bản
          </button>
          <button
            type="button"
            onClick={() => scrollTo('storyboard-section')}
            className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            Timeline 35mm
          </button>
        </nav>

        {/* Status & Studio Action Controls */}
        <div className="flex items-center gap-2">
          {getStatusBadge()}

          {/* Toggle Console Logs */}
          {onToggleConsole && (
            <button
              type="button"
              onClick={onToggleConsole}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer border ${
                showConsole
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : 'bg-zinc-900/70 text-zinc-400 hover:text-white hover:bg-zinc-800 border-white/[0.08]'
              }`}
              title="Mở bảng nhật ký thực thi (Execution Logs)"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Console</span>
              {logsCount > 0 && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-white/[0.08] text-zinc-300">
                  {logsCount}
                </span>
              )}
            </button>
          )}

          {isCompleted && status?.final_video && (
            <Button
              variant="default"
              size="sm"
              onClick={onWatchMovie}
              className="gap-1.5 text-xs h-8 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <MonitorPlay className="w-3.5 h-3.5 fill-current" />
              <span>Xem Phim</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenLibrary}
            className="gap-1.5 text-xs h-8 border-white/[0.08] hover:bg-white/[0.06] text-zinc-300 cursor-pointer"
            title="Thư viện phim đã sản xuất"
          >
            <Film className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Thư viện</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClean}
            disabled={isRunning || isCleaning}
            className="h-8 text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
            title="Làm mới dự án"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
