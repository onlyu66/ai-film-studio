import { useEffect, useState, useCallback } from 'react'

export interface ProgressEventPayload {
  task_id: string
  stage: string
  percent: number
  detail: string
}

export function useProgressSSE(targetTaskId?: string) {
  const [progress, setProgress] = useState<number>(0)
  const [stage, setStage] = useState<string>('')
  const [detail, setDetail] = useState<string>('')
  const [isConnected, setIsConnected] = useState<boolean>(false)
  const [lastEvent, setLastEvent] = useState<ProgressEventPayload | null>(null)

  useEffect(() => {
    let eventSource: EventSource | null = null
    try {
      eventSource = new EventSource('/api/events/progress')

      eventSource.onopen = () => {
        setIsConnected(true)
      }

      eventSource.onmessage = (event) => {
        try {
          if (!event.data || event.data.trim() === '') return
          const payload: ProgressEventPayload = JSON.parse(event.data)
          if (!targetTaskId || payload.task_id === targetTaskId || payload.task_id.startsWith(targetTaskId)) {
            setProgress(payload.percent)
            setStage(payload.stage)
            setDetail(payload.detail)
            setLastEvent(payload)
          }
        } catch {
          // Ignore heartbeats or non-JSON payloads
        }
      }

      eventSource.onerror = () => {
        setIsConnected(false)
      }
    } catch {
      setIsConnected(false)
    }

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [targetTaskId])

  const resetProgress = useCallback(() => {
    setProgress(0)
    setStage('')
    setDetail('')
    setLastEvent(null)
  }, [])

  return {
    progress,
    stage,
    detail,
    isConnected,
    lastEvent,
    resetProgress,
  }
}
