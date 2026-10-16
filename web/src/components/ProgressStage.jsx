import React from 'react'
import { FileText, Mic, Image, Video, Sparkles, CheckCircle2, Loader2 } from 'lucide-react'

const STAGES = [
  { id: 1, name: "Kịch bản & Phân cảnh", desc: "Viết cốt truyện & nhân vật", icon: FileText },
  { id: 2, name: "Lồng tiếng (TTS)", desc: "Tổng hợp giọng đọc tự nhiên", icon: Mic },
  { id: 3, name: "Tạo hình ảnh (Flux)", desc: "Vẽ nhân vật & bối cảnh", icon: Image },
  { id: 4, name: "Chuyển động (Motion)", desc: "Hiệu ứng máy quay & VFX", icon: Video },
  { id: 5, name: "Hậu kỳ & Xuất phim", desc: "Ghép nhạc nền & phụ đề", icon: Sparkles },
]

export default function ProgressStage({ currentStage, status, progress }) {
  const isRunning = status === 'running'
  const isCompleted = status === 'completed'

  return (
    <div className="bg-[#0F1626]/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Quy trình sản xuất 5 giai đoạn</h2>
          <p className="text-xs text-slate-500 mt-0.5">Mỗi phân cảnh được tự động xử lý tuần tự qua các pipeline</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-amber-400 font-mono">{progress}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500 transition-all duration-500 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stages Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        {STAGES.map((s) => {
          const Icon = s.icon
          const isDone = isCompleted || currentStage > s.id
          const isActive = isRunning && currentStage === s.id

          return (
            <div
              key={s.id}
              className={`relative rounded-xl p-3.5 border transition-all ${
                isActive
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
                  : isDone
                  ? 'bg-emerald-500/5 border-emerald-500/30'
                  : 'bg-slate-900/40 border-slate-800/80 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : isDone
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-950" />
                  ) : isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-500">STAGE {s.id}</span>
              </div>
              <h3 className="text-xs font-semibold text-slate-200 line-clamp-1">{s.name}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{s.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
