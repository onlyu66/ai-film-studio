import { motion } from 'framer-motion'
import { FileText, Mic, Image, Video, Sparkles, CheckCircle2, Loader2, type LucideIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Badge } from './ui/badge'

export interface StageItem {
  id: number
  name: string
  desc: string
  icon: LucideIcon
  tag: string
}

const STAGES: StageItem[] = [
  { id: 1, name: "Kịch bản & Phân cảnh", desc: "Viết kịch bản & nhân vật", icon: FileText, tag: "LLM" },
  { id: 2, name: "Giọng đọc (TTS)", desc: "Lồng tiếng cảm xúc Edge-TTS", icon: Mic, tag: "Audio" },
  { id: 3, name: "Tạo hình ảnh (Flux)", desc: "Kết xuất visual 8K điện ảnh", icon: Image, tag: "Visual" },
  { id: 4, name: "Chuyển động (Motion)", desc: "Lia máy quay & VFX", icon: Video, tag: "Motion" },
  { id: 5, name: "Hậu kỳ & Xuất phim", desc: "Ghép BGM ducking & Phụ đề", icon: Sparkles, tag: "Master" },
]

export interface ProgressStageProps {
  currentStage: number
  status: string
  progress: number
}

export default function ProgressStage({ currentStage, status, progress }: ProgressStageProps) {
  const isRunning = status === 'running'
  const isCompleted = status === 'completed'

  return (
    <Card className="relative overflow-hidden border-cinema-border bg-cinema-deck shadow-2xl">
      <CardHeader className="pb-3 border-b border-cinema-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-cinema-amber">
                Production Pipeline
              </span>
              <Badge variant="secondary" className="text-[10px] py-0 px-2 font-mono bg-cinema-card border-cinema-border text-zinc-400">
                5 GIAI ĐOẠN ĐIỆN ẢNH
              </Badge>
            </div>
            <CardTitle className="text-base font-bold text-zinc-100 mt-1 tracking-tight">
              Tiến trình sản xuất tự động
            </CardTitle>
          </div>
          <div className="flex items-center sm:justify-end gap-3">
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider">Tiến độ:</span>
            <span className="text-3xl font-bold font-mono text-cinema-amber tracking-tight">
              {progress}%
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Sleek Cinema Amber Progress Bar */}
        <div className="w-full h-2 bg-cinema-canvas rounded-full overflow-hidden p-0.5 border border-cinema-border">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full shadow-sm shadow-amber-500/20"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Stages Timeline Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {STAGES.map((s) => {
            const Icon = s.icon
            const isDone = isCompleted || currentStage > s.id
            const isActive = isRunning && currentStage === s.id

            return (
              <motion.div
                key={s.id}
                whileHover={{ y: -1 }}
                transition={{ duration: 0.15 }}
                className={`relative rounded-xl p-3 border transition-all flex flex-col justify-between ${
                  isActive
                    ? 'bg-amber-500/[0.08] border-amber-500/50 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30'
                    : isDone
                    ? 'bg-emerald-500/[0.05] border-emerald-500/30'
                    : 'bg-cinema-card border-cinema-border opacity-70 hover:opacity-90'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-cinema-amber text-zinc-950 font-bold'
                          : isDone
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {isActive ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
                      ) : isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span className="text-[10px] font-mono font-medium text-zinc-500">0{s.id}</span>
                  </div>

                  <h3 className={`text-xs font-semibold leading-snug ${isActive ? 'text-amber-300' : isDone ? 'text-zinc-200' : 'text-zinc-400'}`}>
                    {s.name}
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-snug font-normal">
                    {s.desc}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-cinema-border flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-wider font-mono text-zinc-500">{s.tag}</span>
                  {isActive && (
                    <span className="flex h-1.5 w-1.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
