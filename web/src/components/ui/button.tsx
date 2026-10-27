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
  const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/40 disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer active:scale-[0.98]"

  const variants: Record<ButtonVariant, string> = {
    default: "bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold border border-amber-300/40 shadow-sm",
    gradient: "bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold border border-amber-300/40 shadow-sm",
    outline: "border border-studio-border bg-studio-card hover:bg-studio-elevated text-zinc-200 hover:border-studio-border-hover",
    secondary: "bg-studio-card text-zinc-200 border border-studio-border hover:bg-studio-elevated hover:border-studio-border-hover",
    ghost: "hover:bg-studio-card text-zinc-400 hover:text-zinc-200",
    danger: "bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40",
  }

  const sizes: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-xs",
    default: "h-9 px-4 py-1.5 text-xs sm:text-sm",
    lg: "h-11 px-6 text-sm font-semibold",
    icon: "h-8 w-8 p-0",
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
