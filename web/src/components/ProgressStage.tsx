import { motion } from 'framer-motion'
import { FileText, Mic, Image, Video, Sparkles, CheckCircle2, Loader2, type LucideIcon } from 'lucide-react'

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
}

export default function ProgressStage({ currentStage, status, progress }: ProgressStageProps) {
  const isRunning = status === 'running'
  const isCompleted = status === 'completed'
  const isScriptReady = status === 'script_ready'
  const isActiveProduction = isRunning || isCompleted || isScriptReady

  // When Idle: Render an ultra-sleek, minimalist pipeline track (no truncated boxes!)
  if (!isActiveProduction) {
    return (
      <div className="w-full studio-panel rounded-2xl px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all border border-studio-border">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-zinc-300">
            Pipeline 5 Giai Đoạn
          </span>
          <span className="text-[10px] font-mono text-studio-muted hidden md:inline">
            • Tự động hóa từ Kịch bản đến Master Video
          </span>
        </div>

        {/* Minimalist horizontal milestone flow */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {STAGES.map((s, idx) => {
            const Icon = s.icon
            return (
              <div key={s.id} className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-studio-input border border-studio-border text-zinc-400 text-xs">
                  <Icon className="w-3 h-3 text-studio-muted" />
                  <span className="font-medium text-[11px] text-zinc-300">{s.shortName}</span>
                </div>
                {idx < STAGES.length - 1 && (
                  <span className="text-zinc-600 text-xs font-mono">→</span>
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
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
            {isRunning ? `Đang thực thi Giai đoạn ${currentStage}/5` : isScriptReady ? 'Giai đoạn 1 Hoàn tất — Chờ duyệt' : 'Sản xuất hoàn tất'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-studio-muted">Tiến độ:</span>
          <span className="text-2xl font-bold font-mono text-amber-400">
            {progress}%
          </span>
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
              className={`rounded-xl p-3 transition-all border flex items-center gap-2.5 ${
                isActive
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30'
                  : isDone
                  ? 'bg-emerald-500/[0.08] border-emerald-500/30 text-zinc-300'
                  : 'bg-studio-card border-studio-border text-zinc-500 opacity-60'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-amber-400 text-zinc-950 font-bold'
                    : isDone
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-studio-input text-studio-muted'
                }`}
              >
                {isActive ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                ) : isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-semibold truncate ${isActive ? 'text-amber-300 font-bold' : isDone ? 'text-zinc-200' : 'text-zinc-400'}`}>
                    {s.name}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 shrink-0">0{s.id}</span>
                </div>
                <p className="text-[10px] text-zinc-500 truncate leading-tight mt-0.5">
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
