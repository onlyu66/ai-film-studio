import React from 'react'
import { motion } from 'framer-motion'
import { FileText, Mic, Image, Video, Sparkles, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Badge } from './ui/badge'

const STAGES = [
  { id: 1, name: "Kịch bản & Phân cảnh", desc: "Viết kịch bản & nhân vật", icon: FileText, tag: "LLM" },
  { id: 2, name: "Giọng đọc (TTS)", desc: "Lồng tiếng cảm xúc Edge-TTS", icon: Mic, tag: "Audio" },
  { id: 3, name: "Tạo hình ảnh (Flux)", desc: "Kết xuất visual 8K điện ảnh", icon: Image, tag: "Visual" },
  { id: 4, name: "Chuyển động (Motion)", desc: "Lia máy quay, VFX & Lip-sync", icon: Video, tag: "Motion" },
  { id: 5, name: "Hậu kỳ & Xuất phim", desc: "Ghép BGM ducking & Subtitle", icon: Sparkles, tag: "Master" },
]

export default function ProgressStage({ currentStage, status, progress }) {
  const isRunning = status === 'running'
  const isCompleted = status === 'completed'

  return (
    <Card className="relative overflow-hidden border-slate-800/80 bg-gradient-to-b from-[#0F1628]/90 to-[#0A0E1A]/90">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Production Pipeline</span>
              <Badge variant="secondary" className="text-[10px] py-0 px-2 font-mono">5 GIAI ĐOẠN</Badge>
            </div>
            <CardTitle className="text-base font-extrabold text-white mt-1">
              Tiến trình sản xuất tự động
            </CardTitle>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400">
              {progress}%
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Glowing Progress bar */}
        <div className="w-full h-2.5 bg-slate-900/90 rounded-full overflow-hidden p-0.5 border border-slate-800/80">
          <motion.div
            className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500 rounded-full shadow-lg shadow-amber-500/30"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Stages Timeline Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {STAGES.map((s, idx) => {
            const Icon = s.icon
            const isDone = isCompleted || currentStage > s.id
            const isActive = isRunning && currentStage === s.id

            return (
              <motion.div
                key={s.id}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className={`relative rounded-xl p-3.5 border transition-all flex flex-col justify-between ${
                  isActive
                    ? 'bg-gradient-to-b from-amber-500/15 to-transparent border-amber-500/60 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/40'
                    : isDone
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : 'bg-slate-900/40 border-slate-800/60 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30'
                          : isDone
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800/80 text-slate-400'
                      }`}
                    >
                      {isActive ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      ) : isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-500">#{s.id}</span>
                  </div>

                  <h3 className={`text-xs font-bold line-clamp-1 ${isActive ? 'text-amber-300' : isDone ? 'text-slate-200' : 'text-slate-400'}`}>
                    {s.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-1 leading-snug">
                    {s.desc}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-wider font-mono text-slate-500">{s.tag}</span>
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
