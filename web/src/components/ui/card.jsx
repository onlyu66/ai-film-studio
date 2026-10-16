import React from "react"
import { cn } from "../../lib/utils"

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-800/80 bg-[#0D121F]/80 backdrop-blur-xl text-slate-100 shadow-xl shadow-black/40",
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn("flex flex-col space-y-1.5 p-6 pb-4", className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn("text-base font-bold leading-none tracking-tight text-white", className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }) {
  return (
    <p className={cn("text-xs text-slate-400 leading-relaxed", className)} {...props} />
  )
}

export function CardContent({ className, ...props }) {
  return <div className={cn("p-6 pt-0", className)} {...props} />
}

export function CardFooter({ className, ...props }) {
  return (
    <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
  )
}
