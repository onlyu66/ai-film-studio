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
  const [openUpward, setOpenUpward] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  const handleToggle = () => {
    if (disabled) return
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const spaceRight = window.innerWidth - rect.left

      // Flip upward if space below is limited (< 280px) and there's more space above
      if (spaceBelow < 280 && spaceAbove > 200) {
        setOpenUpward(true)
      } else {
        setOpenUpward(false)
      }

      // Align right if close to the right edge of the screen (< 360px)
      if (spaceRight < 360 && rect.right > 360) {
        setAlignRight(true)
      } else {
        setAlignRight(false)
      }
    }
    setIsOpen(!isOpen)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", isOpen ? "z-50" : "z-10", className)}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition-all duration-150 select-none cursor-pointer",
          "bg-[#121622] border border-white/[0.08] hover:border-white/[0.16] hover:bg-[#161B28] text-slate-100",
          isOpen && "border-amber-500/70 bg-[#161B28]",
          disabled && "opacity-50 cursor-not-allowed hover:border-white/[0.08]"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          {selectedOption?.icon && (
            <span className="text-sm flex-shrink-0 text-slate-300">{selectedOption.icon}</span>
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-slate-100 text-xs truncate">
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
            "w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ml-1.5",
            isOpen && (openUpward ? "-rotate-180 text-amber-400" : "rotate-180 text-amber-400")
          )}
        />
      </button>

      {/* Dropdown Popover with Smart Upward/Downward and Left/Right Positioning */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-[100] min-w-full w-max max-w-[calc(100vw-2rem)] sm:max-w-md p-1.5 rounded-xl bg-[#0F121A] border border-white/[0.12] shadow-2xl shadow-black/90 max-h-64 overflow-y-auto animate-fadeIn space-y-1",
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5",
            alignRight ? "right-0" : "left-0"
          )}
        >
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
