import React, { useRef, useEffect } from 'react'

export interface DuckingRegion {
  startSec: number
  endSec: number
  duckRatio?: number
}

export interface AudioWaveformTrackProps {
  peaks: number[]
  beatTimes: number[]
  totalDuration: number
  audioDuration?: number
  timelineWidth: number
  playheadPositionPx?: number
  color?: 'cyan' | 'purple' | 'amber'
  showBeatMarkers?: boolean
  height?: number
  isLoading?: boolean
  duckingRegions?: DuckingRegion[]
}

export const AudioWaveformTrack: React.FC<AudioWaveformTrackProps> = ({
  peaks,
  beatTimes,
  totalDuration,
  audioDuration,
  timelineWidth,
  playheadPositionPx = 0,
  color = 'purple',
  showBeatMarkers = true,
  height = 36,
  isLoading = false,
  duckingRegions = [],
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

    const targetW = displayWidth * dpr
    const targetH = displayHeight * dpr
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW
      canvas.height = targetH
      canvas.style.width = `${displayWidth}px`
      canvas.style.height = `${displayHeight}px`
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
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

    // 0. Vẽ vùng đánh dấu Auto-Ducking mờ ở nền (nếu có)
    if (duckingRegions && duckingRegions.length > 0 && totalDuration > 0) {
      for (const reg of duckingRegions) {
        const startX = Math.max(0, (reg.startSec / totalDuration) * displayWidth)
        const endX = Math.min(displayWidth, (reg.endSec / totalDuration) * displayWidth)
        const regW = Math.max(2, endX - startX)

        ctx.fillStyle = 'rgba(147, 51, 234, 0.08)'
        ctx.fillRect(startX, 1, regW, displayHeight - 2)

        const duckLevel = maxBarH * (reg.duckRatio ?? 0.35)
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)'
        ctx.lineWidth = 1
        ctx.setLineDash([2, 2])
        ctx.beginPath()
        ctx.moveTo(startX, midY - duckLevel)
        ctx.lineTo(endX, midY - duckLevel)
        ctx.moveTo(startX, midY + duckLevel)
        ctx.lineTo(endX, midY + duckLevel)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // 1. Vẽ các cột sóng âm đối xứng (Mirror Waveform)
    // Căn chỉnh chính xác theo trục thời gian thực tế của bài nhạc và timeline
    if (peaks && peaks.length > 0) {
      const barCount = Math.min(peaks.length, Math.floor(displayWidth / 3))
      const step = displayWidth / barCount
      const barWidth = Math.max(1.5, step * 0.65)
      const baseAudioDur = audioDuration && audioDuration > 0 ? audioDuration : (totalDuration || 30.0)

      for (let i = 0; i < barCount; i++) {
        const x = i * step
        // Quy đổi tọa độ x trên timeline ra giây thực tế
        const timelineSec = (x / displayWidth) * totalDuration
        const peakSec = timelineSec % baseAudioDur
        const peakIndex = Math.min(
          peaks.length - 1,
          Math.max(0, Math.floor((peakSec / baseAudioDur) * peaks.length))
        )

        const peakVal = Math.max(0.08, Math.min(1.0, peaks[peakIndex] || 0.1))

        // Tính toán hệ số né giọng nói Auto-Ducking với concave dip curve
        let duckFactor = 1.0
        let isDucked = false
        if (duckingRegions && duckingRegions.length > 0) {
          const leadIn = 0.3
          const rampUp = 0.5
          for (const region of duckingRegions) {
            const ratio = region.duckRatio ?? 0.35
            const regionStart = region.startSec
            const regionEnd = region.endSec

            if (timelineSec >= regionStart - leadIn && timelineSec <= regionEnd + rampUp) {
              isDucked = true
              let currentFactor = 1.0
              if (timelineSec < regionStart) {
                const p = (timelineSec - (regionStart - leadIn)) / leadIn
                currentFactor = 1.0 - (1.0 - ratio) * p
              } else if (timelineSec <= regionEnd) {
                currentFactor = ratio
              } else {
                const p = (timelineSec - regionEnd) / rampUp
                currentFactor = ratio + (1.0 - ratio) * p
              }
              duckFactor = Math.min(duckFactor, Math.max(0.1, currentFactor))
            }
          }
        }

        const barH = peakVal * maxBarH * duckFactor

        // Phân biệt trạng thái đã phát qua Playhead
        const isPlayed = x <= playheadPositionPx
        if (isDucked && duckFactor < 0.9) {
          ctx.fillStyle = isPlayed ? 'rgba(192, 132, 252, 0.75)' : 'rgba(168, 85, 247, 0.28)'
        } else {
          ctx.fillStyle = isPlayed ? activeFill : dimFill
        }

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
    duckingRegions,
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
