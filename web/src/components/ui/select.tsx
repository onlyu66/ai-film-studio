import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { SelectOption } from '../../types'

export interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options?: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = "Chọn...",
  disabled = false,
  className,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-medium transition-all duration-200 select-none cursor-pointer",
          "bg-slate-950/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/90 text-slate-100",
          isOpen && "ring-2 ring-amber-500/40 border-amber-500/80 bg-slate-900",
          disabled && "opacity-50 cursor-not-allowed hover:border-slate-800"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          {selectedOption?.icon && (
            <span className="text-base flex-shrink-0">{selectedOption.icon}</span>
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-slate-200 text-xs truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            {selectedOption?.subtext && (
              <span className="text-[10px] text-slate-400 truncate">
                {selectedOption.subtext}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ml-1.5",
            isOpen && "rotate-180 text-amber-400"
          )}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute z-50 left-0 mt-1.5 min-w-full w-max max-w-[calc(100vw-2rem)] sm:max-w-md p-1.5 rounded-2xl bg-[#090D18]/95 backdrop-blur-2xl border border-slate-700/80 shadow-2xl shadow-black/90 max-h-72 overflow-y-auto animate-fadeIn space-y-1">
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all select-none gap-3",
                  isSelected
                    ? "bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                )}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  {opt.icon && (
                    <span className="text-base flex-shrink-0 mt-0.5">{opt.icon}</span>
                  )}
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold leading-snug">
                      {opt.label}
                    </span>
                    {opt.subtext && (
                      <span className="text-[11px] text-slate-400 mt-0.5 leading-snug font-normal">
                        {opt.subtext}
                      </span>
                    )}
                  </div>
                </div>

                {isSelected && (
                  <Check className="w-4 h-4 text-amber-400 flex-shrink-0 ml-2" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
