"use client"

import { LoadingState } from "@/types"
import { Loader2 } from "lucide-react"

interface LoadingStatusProps {
  loadingState: LoadingState
}

export function LoadingStatus({ loadingState }: LoadingStatusProps) {
  if (loadingState.status === 'idle') return null

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3 rounded-2xl bg-[#2A2A2A]/80 px-4 py-3.5 text-white/80 backdrop-blur-sm">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">{loadingState.message}</span>
      </div>
    </div>
  )
} 