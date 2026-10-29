import React, { useState } from 'react'
import {
  X,
  Sparkles,
  Maximize2,
  Zap,
  Film,
  Award,
  Check,
  Download,
  Loader2,
  Play,
  Cpu,
  Layers,
  Gauge,
  ArrowRight,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Shot, VideoEnhancerPreset } from '../types'
import {
  useEnhancerPresets,
  useEnhanceShotVideo,
  useEnhanceMasterVideo,
} from '../api/queries'

interface VideoEnhancerModalProps {
  isOpen: boolean
  onClose: () => void
  shot?: Shot | null
  isMaster?: boolean
  sourceVideoUrl?: string
  projectId?: string
  onEnhanced?: (newUrl: string) => void
}

export const VideoEnhancerModal: React.FC<VideoEnhancerModalProps> = ({
  isOpen,
  onClose,
  shot,
  isMaster = false,
  sourceVideoUrl,
  projectId = 'current',
  onEnhanced,
}) => {
  const { data: presets = [], isLoading: isPresetsLoading } = useEnhancerPresets()
  const enhanceShotMutation = useEnhanceShotVideo()
  const enhanceMasterMutation = useEnhanceMasterVideo()

  const [selectedPresetId, setSelectedPresetId] = useState<string>('ultra_master_4k_60fps')
  const [enhancedVideoUrl, setEnhancedVideoUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const isProcessing = enhanceShotMutation.isPending || enhanceMasterMutation.isPending

  const handleStartEnhance = () => {
    setErrorMsg(null)

    if (isMaster) {
      enhanceMasterMutation.mutate(
        {
          preset_id: selectedPresetId,
          project_id: projectId,
        },
        {
          onSuccess: (data) => {
            setEnhancedVideoUrl(data.enhanced_url)
            if (onEnhanced) onEnhanced(data.enhanced_url)
          },
          onError: (err: any) => {
            setErrorMsg(err?.response?.data?.detail || err?.message || 'Lỗi khi nâng cấp video master')
          },
        }
      )
    } else if (shot) {
      enhanceShotMutation.mutate(
        {
          shot_id: shot.id,
          preset_id: selectedPresetId,
          project_id: projectId,
        },
        {
          onSuccess: (data) => {
            setEnhancedVideoUrl(data.enhanced_url)
            if (onEnhanced) onEnhanced(data.enhanced_url)
          },
          onError: (err: any) => {
            setErrorMsg(err?.response?.data?.detail || err?.message || 'Lỗi khi nâng cấp clip phân cảnh')
          },
        }
      )
    }
  }

  const getPresetIcon = (id: string) => {
    switch (id) {
      case '4k_crisp':
        return <Maximize2 className="w-5 h-5 text-amber-400" />
      case '4k_clean':
        return <Sparkles className="w-5 h-5 text-sky-400" />
      case 'fps_60_smooth':
        return <Zap className="w-5 h-5 text-emerald-400" />
      case 'fps_60_fast':
        return <Gauge className="w-5 h-5 text-purple-400" />
      case 'ultra_master_4k_60fps':
        return <Award className="w-5 h-5 text-amber-300" />
      case 'film_grain_enhance':
        return <Film className="w-5 h-5 text-rose-400" />
      default:
        return <Layers className="w-5 h-5 text-amber-400" />
    }
  }

  const currentPreviewUrl = enhancedVideoUrl || (shot?.video_url ? `/api/outputs/videos/${shot.id}.mp4` : sourceVideoUrl)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <Award className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-zinc-100">
                  AI Video 4K Upscaler & 60fps Interpolator
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Cpu className="w-2.5 h-2.5" /> Hardware Accel
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isMaster
                  ? 'Nâng cấp toàn bộ phim Master lên chuẩn 4K UHD siêu nét và nội suy chuyển động 60fps mượt mà'
                  : `Nâng cấp phân cảnh #${shot?.id || ''} lên 4K siêu nét hoặc 60fps chuyển động điện ảnh`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <X className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preset Selection Cards */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-amber-400/90 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Chọn Cấu Hình Nâng Cấp (Enhancer Presets)</span>
            </label>

            {isPresetsLoading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-zinc-400 text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                <span>Đang tải danh mục cấu hình...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {presets.map((preset: VideoEnhancerPreset) => {
                  const isSelected = selectedPresetId === preset.id

                  return (
                    <motion.div
                      key={preset.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
                          : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow-md">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/60">
                            {getPresetIcon(preset.id)}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-zinc-100 leading-tight">
                              {preset.name}
                            </h4>
                            <span className="text-[10px] font-mono text-amber-400/90 font-semibold">
                              {preset.badge || preset.target_resolution}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-zinc-400 leading-relaxed font-normal">
                          {preset.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                        <span>RES: {preset.target_resolution}</span>
                        <span>FPS: {preset.target_fps}</span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Video Preview Section */}
          <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800 flex flex-col sm:flex-row items-center gap-5">
            <div className="w-full sm:w-1/2 aspect-video rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden relative flex items-center justify-center">
              {currentPreviewUrl ? (
                <video
                  src={currentPreviewUrl}
                  controls
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-600 text-xs">
                  <Play className="w-8 h-8 opacity-30" />
                  <span>Chưa có video để phát</span>
                </div>
              )}
              {enhancedVideoUrl && (
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/90 text-white shadow-md">
                  ENHANCED READY
                </span>
              )}
            </div>

            <div className="w-full sm:w-1/2 space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                  Trạng Thái Xử Lý
                </span>
                <h4 className="text-sm font-bold text-zinc-200">
                  {enhancedVideoUrl
                    ? 'Đã nâng cấp video thành công!'
                    : isProcessing
                    ? 'Đang render siêu phân giải 4K & nội suy 60fps...'
                    : 'Sẵn sàng nâng cấp chất lượng video'}
                </h4>
                <p className="text-xs text-zinc-400">
                  {enhancedVideoUrl
                    ? 'Bạn có thể xem trước ngay trên trình phát hoặc tải file về máy tính.'
                    : 'Thuật toán Lanczos 8-tap và FFmpeg Motion-Compensated Interpolation sẽ tái tạo từng khung hình với độ trung thực cao nhất.'}
                </p>
              </div>

              {isProcessing && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-300 text-xs font-mono">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                  <span>Đang xử lý scale 4K & nội suy chuyển động (có thể mất 15-30 giây)...</span>
                </div>
              )}

              {enhancedVideoUrl && (
                <a
                  href={enhancedVideoUrl}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Video 4K 60fps (.mp4)</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">
              Tự động kích hoạt GPU NVENC/VAAPI nếu có phần cứng hỗ trợ.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleStartEnhance}
              disabled={isProcessing}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang Nâng Cấp...</span>
                </>
              ) : (
                <>
                  <Award className="w-4 h-4" />
                  <span>Bắt Đầu Nâng Cấp</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
export default VideoEnhancerModal
