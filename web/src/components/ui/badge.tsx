import React from "react"
import { cn } from "../../lib/utils"

export type BadgeVariant = "default" | "secondary" | "success" | "danger" | "outline"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-amber-500/10 text-cinema-amber border-amber-500/30",
    secondary: "bg-cinema-card text-zinc-400 border-cinema-border",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    danger: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    outline: "text-zinc-400 border-cinema-border",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-mono font-medium transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
