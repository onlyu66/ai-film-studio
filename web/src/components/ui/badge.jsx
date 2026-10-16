import React from "react"
import { cn } from "../../lib/utils"

export function Badge({ className, variant = "default", ...props }) {
  const variants = {
    default: "border-transparent bg-amber-500/10 text-amber-300 border border-amber-500/30",
    secondary: "border-transparent bg-slate-800 text-slate-300 border border-slate-700",
    success: "border-transparent bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
    danger: "border-transparent bg-rose-500/10 text-rose-400 border border-rose-500/30",
    outline: "text-slate-400 border-slate-700",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
