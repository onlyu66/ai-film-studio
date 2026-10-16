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
  const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-[0.98]"

  const variants: Record<ButtonVariant, string> = {
    default: "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/30",
    gradient: "bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white font-bold shadow-xl shadow-amber-500/20 hover:opacity-95 hover:shadow-amber-500/30",
    outline: "border border-slate-700/80 bg-slate-900/50 hover:bg-slate-800 text-slate-200 hover:text-white hover:border-slate-600",
    secondary: "bg-slate-800 text-slate-200 hover:bg-slate-700/90 hover:text-white",
    ghost: "hover:bg-slate-800/60 text-slate-400 hover:text-slate-200",
    danger: "bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50",
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
