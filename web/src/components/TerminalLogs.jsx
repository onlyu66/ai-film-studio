import React, { useEffect, useRef, useState } from 'react'
import { Terminal, Copy, Check, ArrowDownCircle } from 'lucide-react'
import { Badge } from './ui/badge'

export default function TerminalLogs({ logs }) {
  const scrollRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleCopy = () => {
    if (!logs?.length) return
    navigator.clipboard.writeText(logs.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-[#06080F] border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
      {/* Console Header */}
      <div className="px-4 py-3 bg-[#0A0E18] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-200">Studio Execution Console</span>
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono">
                {logs?.length || 0} events
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-[10px] font-mono px-2 py-1 rounded-md border flex items-center gap-1 transition-colors ${
              autoScroll
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Tự động cuộn theo log mới nhất"
          >
            <ArrowDownCircle className="w-3 h-3" />
            <span>Auto-scroll</span>
          </button>

          <button
            onClick={handleCopy}
            disabled={!logs?.length}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors disabled:opacity-30"
            title="Sao chép toàn bộ nhật ký"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Logs Output Body */}
      <div
        ref={scrollRef}
        className="p-4 h-56 overflow-y-auto font-mono text-[11px] sm:text-xs space-y-1.5 text-slate-300 select-text leading-relaxed bg-[#05070D]"
      >
        {(!logs || logs.length === 0) ? (
          <div className="text-slate-600 italic py-4 text-center">
            [Studio Idle] Hệ thống đang ở trạng thái chờ lệnh sản xuất phim...
          </div>
        ) : (
          logs.map((log, index) => {
            const isError = log.includes("Lỗi") || log.includes("failed") || log.includes("Warning")
            const isSuccess = log.includes("Thành công") || log.includes("✓") || log.includes("hoàn thành")
            const isStage = log.includes("[Stage") || log.includes("Khởi động") || log.includes("START")

            return (
              <div
                key={index}
                className={`font-mono transition-colors ${
                  isError
                    ? 'text-rose-400 bg-rose-500/5 px-2 py-0.5 rounded border-l-2 border-rose-500'
                    : isSuccess
                    ? 'text-emerald-400 font-semibold'
                    : isStage
                    ? 'text-amber-300 font-bold bg-amber-500/5 px-2 py-0.5 rounded border-l-2 border-amber-400'
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
