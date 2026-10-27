import React from "react"
import { cn } from "../../lib/utils"

export type ButtonVariant = "default" | "gradient" | "outline" | "secondary" | "ghost" | "danger"
export type ButtonSize = "sm" | "default" | "lg" | "icon"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  variant = "default",
  size = "default",
  children,
  disabled,
  ...props
}, ref) => {
  const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/50 disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer active:scale-[0.98]"

  const variants: Record<ButtonVariant, string> = {
    default: "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-400/30 shadow-sm",
    gradient: "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-400/30 shadow-sm",
    outline: "border border-white/[0.1] bg-[#121622] hover:bg-[#1A2030] text-slate-200 hover:text-white",
    secondary: "bg-[#161B26] text-slate-200 border border-white/[0.08] hover:bg-[#1F2535] hover:text-white",
    ghost: "hover:bg-white/[0.06] text-slate-400 hover:text-slate-200",
    danger: "bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40",
  }

  const sizes: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-xs",
    default: "h-10 px-4 py-2 text-sm",
    lg: "h-12 px-6 text-base font-semibold",
    icon: "h-9 w-9 p-0",
  }

  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  )
})

Button.displayName = "Button"
