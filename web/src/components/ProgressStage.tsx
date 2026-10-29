import { motion } from 'framer-motion'
import { FileText, Mic, Image, Video, Sparkles, CheckCircle2, Loader2, Square, type LucideIcon } from 'lucide-react'

export interface StageItem {
  id: number
  name: string
  shortName: string
  desc: string
  icon: LucideIcon
  tag: string
}

const STAGES: StageItem[] = [
  { id: 1, name: "Kịch bản & Phân cảnh", shortName: "Kịch bản", desc: "Viết kịch bản & nhân vật", icon: FileText, tag: "LLM" },
  { id: 2, name: "Giọng đọc (TTS)", shortName: "Giọng đọc", desc: "Lồng tiếng Edge-TTS", icon: Mic, tag: "Audio" },
  { id: 3, name: "Tạo hình ảnh (Flux)", shortName: "Hình ảnh", desc: "Visual 8K điện ảnh", icon: Image, tag: "Visual" },
  { id: 4, name: "Chuyển động (Motion)", shortName: "Chuyển động", desc: "Lia máy quay & VFX", icon: Video, tag: "Motion" },
  { id: 5, name: "Hậu kỳ & Xuất phim", shortName: "Hậu kỳ", desc: "BGM ducking & Phụ đề", icon: Sparkles, tag: "Master" },
]

export interface ProgressStageProps {
  currentStage: number
  status: string
  progress: number
  currentShotId?: string | null
  currentShotIndex?: number | null
  shotsTotal?: number | null
  activeAction?: string | null
  canCancel?: boolean
  onCancel?: () => void
  isCancelling?: boolean
}

export default function ProgressStage({
  currentStage,
  status,
  progress,
  currentShotId,
  currentShotIndex,
  shotsTotal,
  activeAction,
  onCancel,
  isCancelling,
}: ProgressStageProps) {
  const isRunning = status === 'running'
  const isCompleted = status === 'completed'
  const isScriptReady = status === 'script_ready'
  const isActiveProduction = isRunning || isCompleted || isScriptReady

  // When Idle: Render an ultra-sleek, minimalist pipeline track (no truncated boxes!)
  if (!isActiveProduction) {
    return (
      <div className="w-full studio-panel rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all border border-studio-border">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-zinc-200 block">
              Pipeline 5 Giai Đoạn
            </span>
            <span className="text-[11px] text-studio-muted block">
              Tự động hóa từ Kịch bản đến Master Video
            </span>
          </div>
        </div>

        {/* Minimalist horizontal milestone flow */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {STAGES.map((s, idx) => {
            const Icon = s.icon
            return (
              <div key={s.id} className="flex items-center gap-1.5 shrink-0">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-studio-input border border-studio-border hover:border-studio-border-hover text-zinc-400 transition-colors">
                  <Icon className="w-3.5 h-3.5 text-studio-muted" />
                  <span className="font-medium text-[11px] text-zinc-300">{s.shortName}</span>
                </div>
                {idx < STAGES.length - 1 && (
                  <span className="text-zinc-600 text-xs select-none">›</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // When Running / Script Ready / Completed: Expand into active visual production dashboard
  return (
    <div className="w-full studio-panel rounded-2xl p-4 sm:p-5 transition-all border border-amber-500/30">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
            {isRunning ? `Đang thực thi Giai đoạn ${currentStage}/5` : isScriptReady ? 'Giai đoạn 1 Hoàn tất — Chờ duyệt' : 'Sản xuất hoàn tất'}
          </span>

          {/* Per-shot live indicator badge */}
          {isRunning && currentShotId && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[11px] font-semibold flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>
                Phân cảnh {currentShotIndex || '?'}/{shotsTotal || '?'}: {currentShotId}
                {activeAction ? ` • ${activeAction.toUpperCase()}` : ''}
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Cancel button when running */}
          {isRunning && onCancel && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Bạn có chắc chắn muốn dừng tiến trình sản xuất phim hiện tại không?")) {
                  onCancel()
                }
              }}
              disabled={isCancelling}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-semibold cursor-pointer transition-all active:scale-95 disabled:opacity-50"
              title="Hủy/Dừng tiến trình sản xuất ngay lập tức"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>{isCancelling ? "Đang dừng..." : "Dừng tác vụ"}</span>
            </button>
          )}

          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <span className="text-xs font-mono text-amber-300/80">Tiến độ</span>
            <span className="text-base font-bold font-mono text-amber-400">
              {progress}%
            </span>
          </div>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full h-2 bg-studio-input rounded-full overflow-hidden mb-4 border border-studio-border p-0.5">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 rounded-full shadow-sm shadow-amber-500/40"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Expanded Stages Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {STAGES.map((s) => {
          const Icon = s.icon
          const isDone = isCompleted || currentStage > s.id
          const isActive = isRunning && currentStage === s.id

          return (
            <div
              key={s.id}
              className={`rounded-2xl p-3.5 transition-all border relative overflow-hidden flex items-center gap-3 ${
                isActive
                  ? 'bg-amber-500/10 border-amber-400/60 shadow-lg shadow-amber-500/15 ring-2 ring-amber-400/20'
                  : isDone
                  ? 'bg-emerald-500/[0.08] border-emerald-500/30 text-zinc-300'
                  : 'bg-studio-card/80 border-studio-border text-zinc-500 opacity-60'
              }`}
            >
              {/* Active stage top border accent */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" />
              )}

              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all shadow-sm ${
                  isActive
                    ? 'bg-amber-400 text-zinc-950 font-bold shadow-amber-500/30'
                    : isDone
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-studio-input text-studio-muted'
                }`}
              >
                {isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950 stroke-[3]" />
                ) : isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-bold truncate ${isActive ? 'text-amber-300' : isDone ? 'text-zinc-100' : 'text-zinc-400'}`}>
                    {s.name}
                  </span>
                  <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-studio-deck border border-studio-border/60 text-zinc-400 shrink-0">
                    {s.tag}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 truncate leading-tight mt-0.5">
                  {s.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
