import React, { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  useCamera3DPresets,
  useCamera3DPreview,
  useRender3DShotVideo,
} from '../api/queries'
import type { Camera3DTrajectory, Camera3DPresetItem } from '../types'

interface Camera3DTrajectoryPanelProps {
  shotId: string
  initialPrompt?: string
  duration?: number
  onSuccess?: () => void
}

const DEFAULT_TRAJECTORY: Camera3DTrajectory = {
  trajectory_type: 'orbit_360',
  pan: 180,
  tilt: 10,
  roll: 0,
  x: 0,
  y: 0,
  z: 0,
  zoom: 1.0,
  speed: 1.0,
}

export const Camera3DTrajectoryPanel: React.FC<Camera3DTrajectoryPanelProps> = ({
  shotId,
  initialPrompt = '',
  duration = 5,
  onSuccess,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [trajectory, setTrajectory] = useState<Camera3DTrajectory>(DEFAULT_TRAJECTORY)
  const [selectedEngine, setSelectedEngine] = useState<string>('kling')
  const [customPrompt, setCustomPrompt] = useState<string>(initialPrompt)

  const { data: presetsData, isLoading: isLoadingPresets } = useCamera3DPresets()
  const previewMutation = useCamera3DPreview()
  const renderShot3DMutation = useRender3DShotVideo()

  // Apply a preset
  const handleSelectPreset = (presetKey: string, preset: Camera3DPresetItem) => {
    const updated: Camera3DTrajectory = {
      trajectory_type: presetKey,
      pan: preset.pan,
      tilt: preset.tilt,
      roll: preset.roll,
      x: preset.x,
      y: preset.y,
      z: preset.z,
      zoom: preset.zoom,
      speed: preset.speed,
    }
    setTrajectory(updated)
    previewMutation.mutate({
      ...updated,
      base_prompt: customPrompt,
      duration,
    })
    toast.success(`Đã chọn preset "${preset.name}"`)
  }

  // Update a single trajectory parameter
  const handleChangeParam = (field: keyof Camera3DTrajectory, val: number) => {
    const updated: Camera3DTrajectory = {
      ...trajectory,
      trajectory_type: 'custom',
      [field]: val,
    }
    setTrajectory(updated)
  }

  // Auto trigger preview on trajectory or prompt change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      previewMutation.mutate({
        ...trajectory,
        base_prompt: customPrompt,
        duration,
      })
    }, 350)
    return () => clearTimeout(timer)
  }, [trajectory, customPrompt, duration])

  // Canvas 3D Wireframe Rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let tick = 0

    const render3D = () => {
      tick += 0.02 * trajectory.speed
      const w = canvas.width
      const h = canvas.height
      const cx = w / 2
      const cy = h / 2

      ctx.clearRect(0, 0, w, h)

      // Background grid & stars
      ctx.fillStyle = '#0a0d14'
      ctx.fillRect(0, 0, w, h)

      // Perspective projection helper
      const project = (px: number, py: number, pz: number) => {
        // Apply camera rotation based on trajectory Pan/Tilt
        const radPan = ((trajectory.pan + 45) * Math.PI) / 180
        const radTilt = ((trajectory.tilt + 20) * Math.PI) / 180

        // Y-axis rotation (Pan)
        let x1 = px * Math.cos(radPan) - pz * Math.sin(radPan)
        let z1 = px * Math.sin(radPan) + pz * Math.cos(radPan)

        // X-axis rotation (Tilt)
        let y2 = py * Math.cos(radTilt) - z1 * Math.sin(radTilt)
        let z2 = py * Math.sin(radTilt) + z1 * Math.cos(radTilt)

        const fov = 260
        const distance = 300 + trajectory.z * 15
        const scale = (fov / (distance + z2)) * trajectory.zoom
        return {
          x: cx + (x1 + trajectory.x * 10) * scale,
          y: cy - (y2 + trajectory.y * 10) * scale,
          z: z2,
        }
      }

      // Draw Ground Grid (XZ plane)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)'
      ctx.lineWidth = 1
      const gridSize = 120
      const gridStep = 30
      for (let gx = -gridSize; gx <= gridSize; gx += gridStep) {
        const p1 = project(gx, -40, -gridSize)
        const p2 = project(gx, -40, gridSize)
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }
      for (let gz = -gridSize; gz <= gridSize; gz += gridStep) {
        const p1 = project(-gridSize, -40, gz)
        const p2 = project(gridSize, -40, gz)
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }

      // Center Subject: 3D Wireframe Cube (Representing actor / focus target)
      const cubeSize = 25
      const vertices = [
        [-cubeSize, -cubeSize, -cubeSize],
        [cubeSize, -cubeSize, -cubeSize],
        [cubeSize, cubeSize, -cubeSize],
        [-cubeSize, cubeSize, -cubeSize],
        [-cubeSize, -cubeSize, cubeSize],
        [cubeSize, -cubeSize, cubeSize],
        [cubeSize, cubeSize, cubeSize],
        [-cubeSize, cubeSize, cubeSize],
      ]
      const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0], // front
        [4, 5], [5, 6], [6, 7], [7, 4], // back
        [0, 4], [1, 5], [2, 6], [3, 7], // connectors
      ]

      ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)'
      ctx.lineWidth = 1.5
      edges.forEach(([i, j]) => {
        const p1 = project(vertices[i][0], vertices[i][1], vertices[i][2])
        const p2 = project(vertices[j][0], vertices[j][1], vertices[j][2])
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      })

      // Subject Center Marker
      const centerProj = project(0, 0, 0)
      ctx.fillStyle = '#eab308'
      ctx.beginPath()
      ctx.arc(centerProj.x, centerProj.y, 4, 0, Math.PI * 2)
      ctx.fill()

      // Draw Trajectory Curve (e.g. Orbital arc or Spiral path)
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 2
      ctx.setLineDash([4, 4])
      ctx.beginPath()

      const pathSteps = 40
      const radius = 80
      let camPoint = { x: 0, y: 0 }

      for (let i = 0; i <= pathSteps; i++) {
        const progress = i / pathSteps
        const theta = progress * (Math.PI * 2) * (trajectory.pan / 180)
        let px = radius * Math.cos(theta)
        let py = trajectory.tilt * 0.5 * (progress - 0.5) * 2
        let pz = radius * Math.sin(theta)

        if (trajectory.trajectory_type === 'vertigo_dolly_zoom') {
          px = 0
          py = 0
          pz = -radius + progress * radius * 2
        } else if (trajectory.trajectory_type === 'spiral_crane') {
          px = (radius * (1 - progress * 0.4)) * Math.cos(theta * 1.5)
          py = -40 + progress * 80
          pz = (radius * (1 - progress * 0.4)) * Math.sin(theta * 1.5)
        }

        const proj = project(px, py, pz)
        if (i === 0) ctx.moveTo(proj.x, proj.y)
        else ctx.lineTo(proj.x, proj.y)

        // Camera position at current animation tick
        const animProgress = (Math.sin(tick) + 1) / 2
        if (Math.abs(progress - animProgress) < 1 / pathSteps) {
          camPoint = proj
        }
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Draw Animated Camera Icon & Sightlines
      if (camPoint.x !== 0) {
        // Frustum sightlines towards subject center
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(camPoint.x, camPoint.y)
        ctx.lineTo(centerProj.x, centerProj.y)
        ctx.stroke()

        // Camera Body
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(camPoint.x, camPoint.y, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Camera Label
        ctx.fillStyle = '#ffffff'
        ctx.font = '10px monospace'
        ctx.fillText('CAM', camPoint.x + 10, camPoint.y - 6)
      }

      // Compass / Horizon Indicators
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.font = '11px sans-serif'
      ctx.fillText(`Pan: ${trajectory.pan}° | Tilt: ${trajectory.tilt}° | Roll: ${trajectory.roll}°`, 12, 22)
      ctx.fillText(`Focal: ${trajectory.zoom.toFixed(1)}x | Speed: ${trajectory.speed.toFixed(1)}x`, 12, 38)

      animId = requestAnimationFrame(render3D)
    }

    render3D()

    return () => {
      cancelAnimationFrame(animId)
    }
  }, [trajectory])

  // Handle Render Shot Video
  const handleRenderShot = async () => {
    try {
      const token = selectedEngine === 'kling'
        ? localStorage.getItem('studio_kling_key') || undefined
        : selectedEngine === 'luma'
        ? localStorage.getItem('studio_luma_key') || undefined
        : localStorage.getItem('studio_replicate_token') || undefined

      const result = await renderShot3DMutation.mutateAsync({
        shot_id: shotId,
        engine: selectedEngine,
        video_api_token: token,
        trajectory,
      })
      if (result.success) {
        toast.success(`Đã kích hoạt render Video 3D cho phân cảnh ${shotId}!`)
        if (onSuccess) onSuccess()
      } else {
        toast.error('Không thể hoàn tất render video 3D.')
      }
    } catch (err: any) {
      toast.error(`Lỗi render video 3D: ${err?.message || 'Lỗi kết nối'}`)
    }
  }

  const presets = presetsData || {}

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-slate-200">
      {/* Left: 3D Canvas Visualizer & Preset Selector */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-900 shadow-inner">
          <canvas
            ref={canvasRef}
            width={520}
            height={320}
            className="w-full h-[280px] sm:h-[320px] object-contain block cursor-crosshair"
          />
          <div className="absolute top-2 right-2 px-2.5 py-1 bg-slate-950/80 backdrop-blur rounded text-xs font-mono text-cyan-400 border border-cyan-800/40">
            3D TRAJECTORY PREVIEW
          </div>
        </div>

        {/* Preset Buttons Grid */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Cinematic Presets (Đường Bay Máy Quay Chuẩn Điện Ảnh)
            {isLoadingPresets && <span className="ml-2 text-cyan-400 animate-pulse text-[10px]">Đang tải...</span>}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(presets).map(([key, p]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectPreset(key, p)}
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col gap-1 ${
                  trajectory.trajectory_type === key
                    ? 'border-cyan-500 bg-cyan-950/40 text-cyan-200 shadow-sm shadow-cyan-900/50'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 text-slate-300'
                }`}
              >
                <span className="text-xs font-bold truncate">{p.name}</span>
                <span className="text-[10px] text-slate-400 line-clamp-1">{p.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-400">
            Prompt Hướng Dẫn Thị Giác (Visual Context):
          </label>
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Mô tả bối cảnh và diễn biến phân cảnh..."
            className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Right: Sliders & Compilation Parameters */}
      <div className="w-full lg:w-[380px] flex flex-col gap-4">
        {/* Sliders Grid */}
        <div className="space-y-3 bg-slate-900/70 p-3.5 rounded-lg border border-slate-800">
          <div className="text-xs font-bold text-slate-300 flex justify-between items-center">
            <span>THAM SỐ QUỸ ĐẠO 3D</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              {trajectory.trajectory_type}
            </span>
          </div>

          {/* Pan Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Pan (Xoay Ngang):</span>
              <span className="font-mono text-cyan-400">{trajectory.pan}°</span>
            </div>
            <input
              type="range"
              min={-180}
              max={180}
              step={5}
              value={trajectory.pan}
              onChange={(e) => handleChangeParam('pan', parseFloat(e.target.value))}
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Tilt Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Tilt (Nghiêng Dọc):</span>
              <span className="font-mono text-cyan-400">{trajectory.tilt}°</span>
            </div>
            <input
              type="range"
              min={-90}
              max={90}
              step={5}
              value={trajectory.tilt}
              onChange={(e) => handleChangeParam('tilt', parseFloat(e.target.value))}
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Roll Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Roll (Nghiêng Trục Z):</span>
              <span className="font-mono text-cyan-400">{trajectory.roll}°</span>
            </div>
            <input
              type="range"
              min={-180}
              max={180}
              step={5}
              value={trajectory.roll}
              onChange={(e) => handleChangeParam('roll', parseFloat(e.target.value))}
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Focal / Zoom Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Focal Shift (Zoom):</span>
              <span className="font-mono text-amber-400">{trajectory.zoom.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={3.0}
              step={0.1}
              value={trajectory.zoom}
              onChange={(e) => handleChangeParam('zoom', parseFloat(e.target.value))}
              className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Speed Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Tốc Độ Di Chuyển:</span>
              <span className="font-mono text-emerald-400">{trajectory.speed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={3.0}
              step={0.1}
              value={trajectory.speed}
              onChange={(e) => handleChangeParam('speed', parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Engine Selection & Render Action */}
        <div className="space-y-3 bg-slate-900/70 p-3.5 rounded-lg border border-slate-800">
          <label className="text-xs font-bold text-slate-300 block">AI VIDEO ENGINE</label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSelectedEngine('kling')}
              className={`p-2 rounded border font-medium ${
                selectedEngine === 'kling'
                  ? 'border-indigo-500 bg-indigo-950/60 text-indigo-300'
                  : 'border-slate-800 bg-slate-950 text-slate-400'
              }`}
            >
              ⚡ Kling 1.6 OpenAPI
            </button>
            <button
              type="button"
              onClick={() => setSelectedEngine('luma')}
              className={`p-2 rounded border font-medium ${
                selectedEngine === 'luma'
                  ? 'border-indigo-500 bg-indigo-950/60 text-indigo-300'
                  : 'border-slate-800 bg-slate-950 text-slate-400'
              }`}
            >
              ✨ Luma Dream Machine
            </button>
            <button
              type="button"
              onClick={() => setSelectedEngine('replicate')}
              className={`p-2 rounded border font-medium ${
                selectedEngine === 'replicate'
                  ? 'border-indigo-500 bg-indigo-950/60 text-indigo-300'
                  : 'border-slate-800 bg-slate-950 text-slate-400'
              }`}
            >
              🌊 Wan 2.1 Video
            </button>
            <button
              type="button"
              onClick={() => setSelectedEngine('kenburns')}
              className={`p-2 rounded border font-medium ${
                selectedEngine === 'kenburns'
                  ? 'border-indigo-500 bg-indigo-950/60 text-indigo-300'
                  : 'border-slate-800 bg-slate-950 text-slate-400'
              }`}
            >
              🎞️ FFmpeg 3D Zoompan
            </button>
          </div>

          {/* Compiled Output Preview Snippet */}
          {previewMutation.data && (
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80 text-[11px] font-mono space-y-1">
              <div className="text-slate-400">Luma Prompt Cue:</div>
              <div className="text-cyan-300 text-[10px] break-words line-clamp-2">
                "{previewMutation.data.luma_prompt}"
              </div>
            </div>
          )}

          {/* Render Action Button */}
          <button
            type="button"
            onClick={handleRenderShot}
            disabled={renderShot3DMutation.isPending}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-all shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2"
          >
            {renderShot3DMutation.isPending ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Đang Render Video 3D Clip...</span>
              </>
            ) : (
              <>
                <span>🚀 Render Video Clip Với Quỹ Đạo 3D</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
