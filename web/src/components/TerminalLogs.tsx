import { useEffect, useRef, useState } from 'react'
import { Terminal, Copy, Check, ArrowDownCircle, Clock, X } from 'lucide-react'
import { cn } from '../lib/utils'

export interface TerminalLogsProps {
  logs?: string[]
  className?: string
  onClose?: () => void
}

export default function TerminalLogs({ logs, className, onClose }: TerminalLogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
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
    <div className={cn("glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full min-h-[360px] border border-white/[0.08]", className)}>
      {/* Console Header */}
      <div className="px-4 py-3 bg-zinc-950/80 border-b border-white/[0.08] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-amber-400/10 flex items-center justify-center text-amber-400">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-zinc-200">Execution Console</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-zinc-900 border border-white/[0.08] text-zinc-400">
              {logs?.length || 0} events
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-[10px] font-mono px-2 py-1 rounded-md border flex items-center gap-1 transition-colors cursor-pointer ${
              autoScroll
                ? 'bg-amber-400/15 text-amber-300 border-amber-400/30 font-semibold'
                : 'bg-zinc-900 text-zinc-400 border-white/[0.08]'
            }`}
            title="Tự động cuộn theo log mới nhất"
          >
            <ArrowDownCircle className="w-3 h-3" />
            <span>Auto-scroll</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!logs?.length}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-30 cursor-pointer"
            title="Sao chép toàn bộ nhật ký"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Thu nhỏ console"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Logs Output Body */}
      <div
        ref={scrollRef}
        className="p-4 flex-1 overflow-y-auto font-mono text-[11px] sm:text-xs space-y-1.5 text-zinc-300 select-text leading-relaxed bg-zinc-950/90"
      >
        {(!logs || logs.length === 0) ? (
          <div className="text-zinc-600 italic py-16 text-center flex flex-col items-center justify-center gap-2">
            <Clock className="w-6 h-6 text-zinc-700 stroke-[1.5]" />
            <span className="text-xs">[Studio Idle] Hệ thống sẵn sàng tiếp nhận lệnh sản xuất phim...</span>
          </div>
        ) : (
          logs.map((log, index) => {
            const isError = log.includes("Lỗi") || log.includes("failed") || log.includes("Warning")
            const isSuccess = log.includes("Thành công") || log.includes("✓") || log.includes("hoàn thành")
            const isStage = log.includes("[Stage") || log.includes("Khởi động") || log.includes("START")

            return (
              <div
                key={index}
                className={`font-mono transition-colors break-words ${
                  isError
                    ? 'text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border-l-2 border-rose-500'
                    : isSuccess
                    ? 'text-emerald-400 font-semibold'
                    : isStage
                    ? 'text-amber-300 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border-l-2 border-amber-400'
                    : 'text-zinc-400'
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
