import { apiClient } from '../api/client'

export interface WaveformData {
  duration: number
  tempoBpm: number
  beatTimes: number[]
  peaks: number[]
}

export interface ShotDurationInput {
  id: string
  duration: number
  audioDuration?: number
  audio_duration?: number
  [key: string]: unknown
}

const waveformCache = new Map<string, WaveformData>()

/**
 * Lấy dữ liệu sóng âm (peaks) và phách nhịp (beat_times) cho track BGM, audio thoại phân cảnh, hoặc SFX.
 * Kết quả được cache theo bộ nhớ RAM để đảm bảo timeline tương tác mượt mà không bị delay.
 */
export async function fetchWaveformData(
  track: string = 'cinematic',
  shotId?: string,
  sfxKey?: string
): Promise<WaveformData> {
  const cacheKey = `track_${track || ''}_shot_${shotId || ''}_sfx_${sfxKey || ''}`
  if (waveformCache.has(cacheKey)) {
    return waveformCache.get(cacheKey)!
  }

  try {
    const params: Record<string, string> = {}
    if (track) params.track = track
    if (shotId) params.shot_id = shotId
    if (sfxKey) params.sfx_key = sfxKey

    const res = await apiClient.get<{
      success: boolean
      duration: number
      tempo_bpm: number
      beat_times: number[]
      peaks: number[]
    }>('/api/audio/waveform', { params })

    const data: WaveformData = {
      duration: res.data.duration || 30.0,
      tempoBpm: res.data.tempo_bpm || 120,
      beatTimes: res.data.beat_times || [],
      peaks: res.data.peaks || [],
    }

    waveformCache.set(cacheKey, data)
    return data
  } catch (error) {
    console.warn('[AudioWaveform] Không thể tải waveform từ server, dùng giả lập:', error)
    // Fallback mảng sóng âm giả định mượt mà
    const dummyPeaks: number[] = []
    for (let i = 0; i < 150; i++) {
      dummyPeaks.push(Math.round((Math.abs(Math.sin(i * 0.15)) * 0.7 + 0.15) * 100) / 100)
    }
    const dummyBeats: number[] = []
    for (let t = 0.5; t < 30.0; t += 0.5) {
      dummyBeats.push(Math.round(t * 100) / 100)
    }

    const fallbackData: WaveformData = {
      duration: 30.0,
      tempoBpm: 120,
      beatTimes: dummyBeats,
      peaks: dummyPeaks,
    }
    return fallbackData
  }
}

/**
 * Thuật toán Snap-to-Beat client-side tính toán tức thời (0ms latency).
 * Giúp giao diện co giãn clip mượt mà ngay trên Timeline trước khi đồng bộ với backend.
 * Đặc biệt: Bảo vệ độ dài thoại (Speech Protection), không bao giờ cắt cụt câu thoại của phân cảnh.
 */
export function snapShotsToBeatTimes(
  shots: ShotDurationInput[],
  beatTimes: number[],
  minDur: number = 1.5,
  maxDur: number = 12.0
): Array<{ id: string; duration: number }> {
  if (!shots.length || !beatTimes.length) {
    return shots.map((s) => ({ id: s.id, duration: Number(s.duration) || 5.0 }))
  }

  const sortedBeats = [...beatTimes].sort((a, b) => a - b)
  const result: Array<{ id: string; duration: number }> = []
  let accumulatedTime = 0.0

  for (const shot of shots) {
    const origDur = Number(shot.duration) || 5.0
    const targetEndTime = accumulatedTime + origDur
    // Speech protection: ensure clip duration never cuts off spoken dialogue audio!
    const speechDur = Math.max(0, Number(shot.audioDuration ?? shot.audio_duration ?? 0))
    const minRequired = Math.max(minDur, speechDur)
    const allowedMax = Math.max(maxDur, minRequired)

    // Tìm các phách nằm trong khoảng cho phép [accum + minRequired, accum + allowedMax]
    const candidates = sortedBeats.filter(
      (b) => b >= accumulatedTime + minRequired && b <= accumulatedTime + allowedMax
    )

    let chosenDuration: number
    if (candidates.length > 0) {
      // Chọn beat gần targetEndTime nhất
      let closest = candidates[0]
      let minDiff = Math.abs(closest - targetEndTime)
      for (const b of candidates) {
        const diff = Math.abs(b - targetEndTime)
        if (diff < minDiff) {
          minDiff = diff
          closest = b
        }
      }
      chosenDuration = Math.round((closest - accumulatedTime) * 10) / 10
      accumulatedTime = closest
    } else {
      chosenDuration = Math.max(minRequired, Math.min(allowedMax, origDur))
      accumulatedTime += chosenDuration
    }

    result.push({
      id: shot.id,
      duration: chosenDuration,
    })
  }

  return result
}
