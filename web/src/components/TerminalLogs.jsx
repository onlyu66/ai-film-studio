import React, { useEffect, useRef } from 'react'
import { Terminal, ShieldCheck } from 'lucide-react'

export default function TerminalLogs({ logs }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="bg-[#0A0D14] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Console Header */}
      <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-mono font-semibold text-slate-300">Live Studio Pipeline Console</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700"></span>
        </div>
      </div>

      {/* Logs Output */}
      <div
        ref={scrollRef}
        className="p-4 h-52 overflow-y-auto font-mono text-xs space-y-1.5 text-slate-300 select-text"
      >
        {(!logs || logs.length === 0) ? (
          <div className="text-slate-600 italic">Chưa có nhật ký hoạt động. Bấm "Bắt đầu sản xuất phim" để chạy quy trình.</div>
        ) : (
          logs.map((log, index) => {
            const isError = log.includes("Lỗi") || log.includes("failed") || log.includes("Warning")
            const isSuccess = log.includes("Thành công") || log.includes("✓") || log.includes("hoàn thành")
            const isStage = log.includes("[Stage") || log.includes("Khởi động")

            return (
              <div
                key={index}
                className={`leading-relaxed ${
                  isError
                    ? 'text-rose-400'
                    : isSuccess
                    ? 'text-emerald-400'
                    : isStage
                    ? 'text-amber-300 font-semibold'
                    : 'text-slate-400'
                }`}
              >
                {log}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
