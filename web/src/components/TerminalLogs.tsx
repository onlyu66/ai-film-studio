import { useEffect, useRef, useState } from 'react'
import { Terminal, Copy, Check, ArrowDownCircle, Clock, X, Maximize2, Minimize2 } from 'lucide-react'
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
  const [isExpanded, setIsExpanded] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'error' | 'stage' | 'success'>('all')

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 35
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false)
    } else if (isAtBottom && !autoScroll) {
      setAutoScroll(true)
    }
  }

  const handleCopy = () => {
    if (!logs?.length) return
    navigator.clipboard.writeText(logs.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const baseLogs = logs && logs.length > 250 ? logs.slice(-250) : (logs || [])
  const hiddenCount = logs && logs.length > 250 ? logs.length - 250 : 0

  const visibleLogs = baseLogs.filter((log) => {
    if (filterType === 'all') return true
    if (filterType === 'error') return log.includes("Lỗi") || log.includes("failed") || log.includes("Warning")
    if (filterType === 'stage') return log.includes("[Stage") || log.includes("Khởi động") || log.includes("START")
    if (filterType === 'success') return log.includes("Thành công") || log.includes("✓") || log.includes("hoàn thành")
    return true
  })

  return (
    <div
      className={cn(
        "glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-studio-border bg-studio-deck transition-all duration-300",
        isExpanded ? "h-[540px] max-h-[80vh]" : "h-[360px] sm:h-[400px] max-h-[50vh]",
        className
      )}
    >
      {/* Console Header */}
      <div className="px-4 py-3 bg-studio-deck border-b border-studio-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-amber-400/10 flex items-center justify-center text-amber-400">
            <Terminal className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-zinc-200">Execution Console</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-studio-card border border-studio-border text-zinc-400">
              {logs?.length || 0} events
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const next = !autoScroll
              setAutoScroll(next)
              if (next && scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight
              }
            }}
            className={`text-[10px] font-mono px-2 py-1 rounded-md border flex items-center gap-1 transition-colors cursor-pointer ${
              autoScroll
                ? 'bg-amber-400/15 text-amber-300 border-amber-400/30 font-semibold'
                : 'bg-studio-card text-zinc-400 border-studio-border hover:border-studio-border-hover'
            }`}
            title="Tự động cuộn theo log mới nhất"
          >
            <ArrowDownCircle className="w-3 h-3" />
            <span>Auto-scroll</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-studio-card transition-colors cursor-pointer"
            title={isExpanded ? "Thu nhỏ chiều cao" : "Mở rộng chiều cao"}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5 text-amber-400" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!logs?.length}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-studio-card transition-colors disabled:opacity-30 cursor-pointer"
            title="Sao chép toàn bộ nhật ký"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-studio-card transition-colors cursor-pointer"
              title="Thu nhỏ console"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Filter Bar */}
      <div className="px-4 py-1.5 bg-studio-input/80 border-b border-studio-border/60 flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500 text-[10px]">Lọc:</span>
          {(['all', 'error', 'stage', 'success'] as const).map((ft) => (
            <button
              key={ft}
              type="button"
              onClick={() => setFilterType(ft)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer ${
                filterType === ft
                  ? ft === 'error' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                    : ft === 'stage' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                    : ft === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'bg-zinc-800 text-zinc-100 border border-zinc-700 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-studio-card'
              }`}
            >
              {ft === 'all' ? 'Tất cả' : ft === 'error' ? 'Lỗi' : ft === 'stage' ? 'Giai đoạn' : 'Thành công'}
            </button>
          ))}
        </div>
        {hiddenCount > 0 && (
          <span className="text-[10px] text-zinc-500 hidden sm:inline">
            Ẩn {hiddenCount} sự kiện cũ
          </span>
        )}
      </div>

      {/* Logs Output Body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative p-4 flex-1 min-h-0 overflow-y-auto font-mono text-[11px] sm:text-xs space-y-1.5 text-zinc-300 select-text leading-relaxed bg-studio-input"
      >
        {(!logs || logs.length === 0) ? (
          <div className="text-zinc-600 italic py-16 text-center flex flex-col items-center justify-center gap-2">
            <Clock className="w-6 h-6 text-zinc-700 stroke-[1.5]" />
            <span className="text-xs">[Studio Idle] Hệ thống sẵn sàng tiếp nhận lệnh sản xuất phim...</span>
          </div>
        ) : (
          <>
            {hiddenCount > 0 && (
              <div className="text-[10px] text-zinc-500 font-mono italic pb-1 border-b border-studio-border/40">
                ... Đã ẩn {hiddenCount} sự kiện cũ để tối ưu hiệu năng hiển thị (Nhấn biểu tượng Copy để lấy đầy đủ) ...
              </div>
            )}
            {visibleLogs.map((log, index) => {
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
            })}
          </>
        )}

        {/* Floating Quick Scroll to Bottom Button if user scrolled up */}
        {!autoScroll && logs && logs.length > 8 && (
          <div className="sticky bottom-1 flex justify-end pointer-events-none pt-2">
            <button
              type="button"
              onClick={() => {
                setAutoScroll(true)
                if (scrollRef.current) {
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight
                }
              }}
              className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-mono border border-amber-500/40 backdrop-blur-md shadow-xl transition-all cursor-pointer"
            >
              <ArrowDownCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Cuộn xuống mới nhất</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
