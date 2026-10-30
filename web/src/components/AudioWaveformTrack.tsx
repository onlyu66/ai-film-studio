import React, { useRef, useEffect } from 'react'

export interface AudioWaveformTrackProps {
  peaks: number[]
  beatTimes: number[]
  totalDuration: number
  timelineWidth: number
  playheadPositionPx?: number
  color?: 'cyan' | 'purple' | 'amber'
  showBeatMarkers?: boolean
  height?: number
  isLoading?: boolean
}

export const AudioWaveformTrack: React.FC<AudioWaveformTrackProps> = ({
  peaks,
  beatTimes,
  totalDuration,
  timelineWidth,
  playheadPositionPx = 0,
  color = 'purple',
  showBeatMarkers = true,
  height = 36,
  isLoading = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const displayWidth = Math.max(100, Math.floor(timelineWidth))
    const displayHeight = Math.max(20, Math.floor(height))

    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${displayHeight}px`

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, displayWidth, displayHeight)

    if (isLoading) {
      // Hiển thị hiệu ứng tải đang xử lý
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Đang nạp sóng âm...', displayWidth / 2, displayHeight / 2 + 3)
      return
    }

    const midY = displayHeight / 2
    const maxBarH = displayHeight * 0.42

    // Màu sắc theo chủ đề
    let activeFill = '#c084fc' // purple-400
    let dimFill = 'rgba(168, 85, 247, 0.45)' // purple-500 dim
    if (color === 'cyan') {
      activeFill = '#22d3ee'
      dimFill = 'rgba(6, 182, 212, 0.45)'
    } else if (color === 'amber') {
      activeFill = '#fbbf24'
      dimFill = 'rgba(245, 158, 11, 0.45)'
    }

    // 1. Vẽ các cột sóng âm đối xứng (Mirror Waveform)
    if (peaks && peaks.length > 0) {
      const barCount = Math.min(peaks.length, Math.floor(displayWidth / 3))
      const step = displayWidth / barCount
      const barWidth = Math.max(1.5, step * 0.65)

      for (let i = 0; i < barCount; i++) {
        const peakIndex = Math.floor((i / barCount) * peaks.length)
        const peakVal = Math.max(0.08, Math.min(1.0, peaks[peakIndex] || 0.1))
        const barH = peakVal * maxBarH
        const x = i * step

        // Phân biệt trạng thái đã phát qua Playhead
        const isPlayed = x <= playheadPositionPx
        ctx.fillStyle = isPlayed ? activeFill : dimFill

        // Vẽ thanh trên và dưới đối xứng
        const topY = midY - barH
        const totalH = barH * 2
        ctx.beginPath()
        ctx.roundRect
          ? ctx.roundRect(x, topY, barWidth, totalH, 1)
          : ctx.rect(x, topY, barWidth, totalH)
        ctx.fill()
      }
    }

    // 2. Vẽ đường phách nhịp Beat Markers (nếu bật)
    if (showBeatMarkers && beatTimes && beatTimes.length > 0 && totalDuration > 0) {
      ctx.lineWidth = 1
      for (let i = 0; i < beatTimes.length; i++) {
        const beatSec = beatTimes[i]
        if (beatSec > totalDuration) continue
        const beatX = (beatSec / totalDuration) * displayWidth

        // Vạch phách vàng hổ phách tinh tế
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)' // amber-400
        ctx.setLineDash([3, 2])
        ctx.beginPath()
        ctx.moveTo(beatX, 2)
        ctx.lineTo(beatX, displayHeight - 2)
        ctx.stroke()

        // Điểm đánh dấu phách trên đỉnh
        ctx.fillStyle = '#fbbf24'
        ctx.beginPath()
        ctx.arc(beatX, 3, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.setLineDash([])
    }
  }, [
    peaks,
    beatTimes,
    totalDuration,
    timelineWidth,
    playheadPositionPx,
    color,
    showBeatMarkers,
    height,
    isLoading,
  ])

  return (
    <canvas
      ref={canvasRef}
      className="block pointer-events-none select-none"
      style={{
        width: `${timelineWidth}px`,
        height: `${height}px`,
      }}
    />
  )
}

export default AudioWaveformTrack
