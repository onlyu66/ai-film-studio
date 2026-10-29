import { useState, useEffect } from 'react'
import {
  Camera,
  Layers,
  Sliders,
  Sparkles,
  Check,
  Loader2,
  X,
  Aperture,
  Sun,
  Video,
  RefreshCw,
  AlertCircle,
  Eye,
} from 'lucide-react'
import type { Shot } from '../types'
import {
  useCameraPresets,
  useGenerateMultiAngle,
  useApplyMultiAngle,
  useUpdateShot,
  useRerollShot,
} from '../api/queries'

interface CameraDirectorModalProps {
  isOpen: boolean
  onClose: () => void
  shot: Shot | null
  characters?: Record<string, any>
}

export default function CameraDirectorModal({
  isOpen,
  onClose,
  shot,
  characters = {},
}: CameraDirectorModalProps) {
  const [activeTab, setActiveTab] = useState<'multi_angle' | 'visual_canvas'>('multi_angle')

  // Visual Canvas States
  const [selectedAngle, setSelectedAngle] = useState<string>('medium')
  const [selectedLens, setSelectedLens] = useState<string>('anamorphic_35mm')
  const [selectedLighting, setSelectedLighting] = useState<string>('golden_hour')
  const [selectedMotion, setSelectedMotion] = useState<string>('zoom_in')
  const [reRenderMotionOnApply, setReRenderMotionOnApply] = useState<boolean>(true)
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null)
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null)

  const { data: presets } = useCameraPresets()
  const generateMultiAngleMutation = useGenerateMultiAngle()
  const applyMultiAngleMutation = useApplyMultiAngle()
  const updateShotMutation = useUpdateShot()
  const rerollShotMutation = useRerollShot()

  useEffect(() => {
    if (shot) {
      if (shot.camera_angle) setSelectedAngle(shot.camera_angle)
      if (shot.camera_lens) setSelectedLens(shot.camera_lens)
      if (shot.lighting) setSelectedLighting(shot.lighting)
      if (shot.motion) setSelectedMotion(String(shot.motion))
    }
  }, [shot])

  if (!isOpen || !shot) return null

  const multiAngleOptions = shot.multi_angle_options || {}
  const char = shot.character_id && characters ? characters[shot.character_id] : null

  // Compose live preview prompt
  const anglesMap = presets?.angles || []
  const lensesMap = presets?.lenses || []
  const lightingsMap = presets?.lightings || []
  const motionsMap = presets?.motions || []

  const currentAngleObj = anglesMap.find((a) => a.id === selectedAngle)
  const currentLensObj = lensesMap.find((l) => l.id === selectedLens)
  const currentLightingObj = lightingsMap.find((lt) => lt.id === selectedLighting)
  const currentMotionObj = motionsMap.find((m) => m.id === selectedMotion)

  const livePromptCues: string[] = []
  if (char?.visual_anchor) livePromptCues.push(`Subject: ${char.name}, ${char.visual_anchor}`)
  if (currentAngleObj) livePromptCues.push(currentAngleObj.keywords)
  if (shot.image_prompt) livePromptCues.push(shot.image_prompt)
  if (currentLensObj) livePromptCues.push(currentLensObj.keywords)
  if (currentLightingObj) livePromptCues.push(currentLightingObj.keywords)
  if (currentMotionObj && currentMotionObj.id !== 'static') livePromptCues.push(currentMotionObj.keywords)
  const liveSynthesizedPrompt = livePromptCues.join(', ')

  const handleGenerate3Angles = () => {
    setActionSuccessMsg(null)
    setActionErrorMsg(null)
    generateMultiAngleMutation.mutate(
      {
        shotId: shot.id,
        angles: ['wide', 'medium', 'close_up'],
      },
      {
        onSuccess: () => {
          setActionSuccessMsg('Đã tạo xong 3 góc máy điện ảnh thành công! Bạn có thể chọn góc ưng ý.')
          setTimeout(() => setActionSuccessMsg(null), 4000)
        },
        onError: (err: any) => {
          setActionErrorMsg(err?.message || 'Lỗi khi tạo 3 góc máy.')
        },
      }
    )
  }

  const handleApplyAngle = (angle: string) => {
    setActionSuccessMsg(null)
    setActionErrorMsg(null)
    applyMultiAngleMutation.mutate(
      {
        shotId: shot.id,
        angle,
        reRenderMotion: reRenderMotionOnApply,
      },
      {
        onSuccess: () => {
          setActionSuccessMsg(`Đã áp dụng góc máy '${angle.toUpperCase()}' cho phân cảnh ${shot.id}!`)
          setTimeout(() => setActionSuccessMsg(null), 3000)
        },
        onError: (err: any) => {
          setActionErrorMsg(err?.message || 'Lỗi khi áp dụng góc máy.')
        },
      }
    )
  }

  const handleSaveVisualCanvas = (andReroll: boolean = false) => {
    setActionSuccessMsg(null)
    setActionErrorMsg(null)

    updateShotMutation.mutate(
      {
        shot_id: shot.id,
        camera_angle: selectedAngle,
        camera_lens: selectedLens,
        lighting: selectedLighting,
        motion: selectedMotion,
        camera_motion: selectedMotion,
      },
      {
        onSuccess: () => {
          if (andReroll) {
            rerollShotMutation.mutate(shot.id, {
              onSuccess: () => {
                setActionSuccessMsg('Đã cập nhật thông số và tạo lại hình ảnh theo Visual Canvas thành công!')
                setTimeout(() => setActionSuccessMsg(null), 3000)
              },
              onError: (err: any) => {
                setActionErrorMsg(err?.message || 'Cập nhật thành công nhưng tạo lại ảnh bị lỗi.')
              },
            })
          } else {
            setActionSuccessMsg('Đã lưu thông số Visual Canvas thành công!')
            setTimeout(() => setActionSuccessMsg(null), 3000)
          }
        },
        onError: (err: any) => {
          setActionErrorMsg(err?.message || 'Lỗi khi lưu thông số.')
        },
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-zinc-950 border border-amber-500/30 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 text-amber-400 border border-amber-500/30 shadow-inner">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                  Đạo Diễn Góc Máy & Visual Prompt Canvas
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {shot.id.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-zinc-400 truncate mt-0.5">
                {shot.dialogue ? `Thoại: "${shot.dialogue}"` : shot.image_prompt || 'Tùy chỉnh thông số điện ảnh chuyên sâu'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/40 px-4 sm:px-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('multi_angle')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'multi_angle'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Multi-Camera Coverage (3 Góc Máy Đồng Thời)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('visual_canvas')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'visual_canvas'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Visual Prompt Canvas (Ống Kính & Ánh Sáng)</span>
          </button>
        </div>

        {/* Alerts */}
        {actionSuccessMsg && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}
        {actionErrorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: Multi-Camera Coverage */}
          {activeTab === 'multi_angle' && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Quay 3 Góc Máy Song Song</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                    Hệ thống sẽ giữ nguyên nhân vật và bối cảnh (seed {char?.seed || 42}) để tạo đồng thời 3 góc máy: <strong>Toàn cảnh (Wide)</strong>, <strong>Trung cảnh (Medium)</strong>, và <strong>Cận cảnh (Close-Up)</strong>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerate3Angles}
                  disabled={generateMultiAngleMutation.isPending}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {generateMultiAngleMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang quay 3 góc máy...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      <span>Quay 3 Góc Máy Ngay</span>
                    </>
                  )}
                </button>
              </div>

              {/* 3-Angle Visual Split Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'wide', label: 'Toàn Cảnh (Wide Shot)', sub: 'Establishing / Môi trường rộng' },
                  { id: 'medium', label: 'Trung Cảnh (Medium Shot)', sub: 'Ngang lưng / Cân bằng bối cảnh' },
                  { id: 'close_up', label: 'Cận Cảnh (Close-Up)', sub: 'Biểu cảm gương mặt / Cảm xúc' },
                ].map((item) => {
                  const candidateUrl = multiAngleOptions[item.id]
                  const isCurrent = (shot.camera_angle || 'medium') === item.id
                  const isApplying = applyMultiAngleMutation.isPending

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border flex flex-col justify-between overflow-hidden transition-all ${
                        isCurrent
                          ? 'bg-amber-500/10 border-amber-500/60 ring-2 ring-amber-500/30'
                          : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      {/* Image Thumbnail */}
                      <div className="relative aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden border-b border-zinc-800/60">
                        {candidateUrl ? (
                          <img
                            src={`${candidateUrl}?t=${Date.now()}`}
                            alt={item.label}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center p-4">
                            <Camera className="w-8 h-8 text-zinc-700 mx-auto mb-2 opacity-50" />
                            <span className="text-[11px] text-zinc-500 block">Chưa quay góc máy này</span>
                          </div>
                        )}

                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-sm text-[10px] font-mono font-bold text-amber-300 border border-white/10">
                          {item.id.toUpperCase()}
                        </div>

                        {isCurrent && (
                          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-amber-500 text-zinc-950 text-[10px] font-bold flex items-center gap-1 shadow-md">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Đang dùng</span>
                          </div>
                        )}
                      </div>

                      {/* Info & Select Button */}
                      <div className="p-3.5 flex flex-col justify-between flex-1 gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-zinc-200">{item.label}</h4>
                          <p className="text-[10px] text-zinc-500 mt-0.5">{item.sub}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleApplyAngle(item.id)}
                          disabled={!candidateUrl || isApplying || isCurrent}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-zinc-800 text-zinc-400 cursor-default'
                              : candidateUrl
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                              : 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                          }`}
                        >
                          {isApplying ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isCurrent ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-amber-400" />
                              <span>Đã áp dụng</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Chọn góc này cho shot</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Motion Re-render Option */}
              <div className="p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="chk-remotion"
                  checked={reRenderMotionOnApply}
                  onChange={(e) => setReRenderMotionOnApply(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                />
                <label htmlFor="chk-remotion" className="text-xs text-zinc-300 cursor-pointer select-none">
                  Tự động render lại video chuyển động (Motion Video Clip) ngay khi áp dụng góc máy mới
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: Visual Prompt Canvas */}
          {activeTab === 'visual_canvas' && (
            <div className="space-y-6 animate-fadeIn">
              {/* 1. Camera Angle */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2.5">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Góc Máy & Khung Hình (Camera Angle)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {anglesMap.map((angle) => {
                    const isSelected = selectedAngle === angle.id
                    return (
                      <button
                        key={angle.id}
                        type="button"
                        onClick={() => setSelectedAngle(angle.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/30'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="text-xs font-semibold truncate">{angle.name}</div>
                        <div className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{angle.description}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 2. Optical Lens Presets */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2.5">
                  <Aperture className="w-3.5 h-3.5" />
                  <span>Ống Kính Điện Ảnh (Optical Lens Preset)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {lensesMap.map((lens) => {
                    const isSelected = selectedLens === lens.id
                    return (
                      <button
                        key={lens.id}
                        type="button"
                        onClick={() => setSelectedLens(lens.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/30'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="text-xs font-semibold truncate">{lens.name}</div>
                        <div className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{lens.description}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 3. Lighting Presets */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2.5">
                  <Sun className="w-3.5 h-3.5" />
                  <span>Ánh Sáng Phim Trường (Lighting Style)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {lightingsMap.map((lighting) => {
                    const isSelected = selectedLighting === lighting.id
                    return (
                      <button
                        key={lighting.id}
                        type="button"
                        onClick={() => setSelectedLighting(lighting.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/30'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="text-xs font-semibold truncate">{lighting.name}</div>
                        <div className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{lighting.description}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 4. Camera Motion */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-2.5">
                  <Video className="w-3.5 h-3.5" />
                  <span>Chuyển Động Camera (Camera Motion)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {motionsMap.map((motion) => {
                    const isSelected = selectedMotion === motion.id
                    return (
                      <button
                        key={motion.id}
                        type="button"
                        onClick={() => setSelectedMotion(motion.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/30'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="text-xs font-semibold truncate">{motion.name}</div>
                        <div className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">{motion.description}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Live Synthesized Prompt Preview */}
              <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold uppercase text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Live Prompt Synthesis (Tổng Hợp Thời Gian Thực)</span>
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {liveSynthesizedPrompt.length} ký tự
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 text-xs font-mono text-zinc-300 leading-relaxed max-h-24 overflow-y-auto">
                  {liveSynthesizedPrompt}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-zinc-800 bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 italic">
            * Các thông số góc máy, ống kính và ánh sáng sẽ được lưu vĩnh viễn trong kịch bản phân cảnh.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {activeTab === 'visual_canvas' && (
              <>
                <button
                  type="button"
                  onClick={() => handleSaveVisualCanvas(false)}
                  disabled={updateShotMutation.isPending}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-colors cursor-pointer"
                >
                  {updateShotMutation.isPending ? 'Đang lưu...' : 'Lưu Thông Số'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveVisualCanvas(true)}
                  disabled={updateShotMutation.isPending || rerollShotMutation.isPending}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {rerollShotMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang vẽ lại hình ảnh...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>Lưu & Tạo Lại Hình Ảnh</span>
                    </>
                  )}
                </button>
              </>
            )}

            {activeTab === 'multi_angle' && (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
