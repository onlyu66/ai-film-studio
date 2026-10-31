import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, Zap, CheckCircle2, AlertCircle, Loader2, Upload,
  Monitor, Image as ImageIcon, Video, RefreshCw,
  Cpu, HardDrive, AlertTriangle, FileJson, Check
} from 'lucide-react'
import { Button } from './ui/button'
import type {
  ComfyUIHealthStatus, ComfyUIConfig, ComfyUIWorkflowItem, ComfyUIModels
} from '../types'
import {
  getComfyUIStatus, getComfyUIModels, getComfyUIWorkflows,
  getComfyUIConfig, saveComfyUIConfig, uploadComfyUIWorkflow, testComfyUIGeneration
} from '../api/studio'

interface ComfyUIModalProps {
  isOpen: boolean
  onClose: () => void
  projectId?: string
}

type TabId = 'image' | 'video' | 'custom'

export default function ComfyUIModal({ isOpen, onClose, projectId }: ComfyUIModalProps) {
  const [health, setHealth] = useState<ComfyUIHealthStatus | null>(null)
  const [config, setConfig] = useState<ComfyUIConfig>({
    is_image_enabled: false,
    is_video_enabled: false,
    image_workflow: 'flux_schnell',
    video_workflow: 'animatediff_v3',
    checkpoint: null,
    lora: null,
    lora_weight: 0.8,
    steps: 20,
    cfg: 7.0,
    video_frames: 16,
    video_fps: 12,
  })
  const [models, setModels] = useState<ComfyUIModels>({ checkpoints: [], loras: [], vaes: [] })
  const [workflows, setWorkflows] = useState<ComfyUIWorkflowItem[]>([])
  const [customUrl, setCustomUrl] = useState('http://127.0.0.1:8188')
  const customUrlRef = useRef(customUrl)
  useEffect(() => {
    customUrlRef.current = customUrl
  }, [customUrl])

  const [activeTab, setActiveTab] = useState<TabId>('image')
  const [isChecking, setIsChecking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [saveAsGlobal, setSaveAsGlobal] = useState(true)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const fetchAll = useCallback(async (overrideUrl?: string) => {
    setIsChecking(true)
    const targetUrl = overrideUrl || customUrlRef.current
    try {
      const [statusRes, modelsRes, wfRes, cfgRes] = await Promise.allSettled([
        getComfyUIStatus(targetUrl),
        getComfyUIModels(targetUrl),
        getComfyUIWorkflows(targetUrl),
        getComfyUIConfig(projectId),
      ])

      if (statusRes.status === 'fulfilled' && statusRes.value) {
        setHealth(statusRes.value)
      }
      if (modelsRes.status === 'fulfilled' && modelsRes.value) {
        setModels({
          checkpoints: Array.isArray(modelsRes.value.checkpoints) ? modelsRes.value.checkpoints : [],
          loras: Array.isArray(modelsRes.value.loras) ? modelsRes.value.loras : [],
          vaes: Array.isArray(modelsRes.value.vaes) ? modelsRes.value.vaes : [],
        })
      }
      if (wfRes.status === 'fulfilled' && Array.isArray(wfRes.value)) {
        setWorkflows(wfRes.value)
      }
      if (cfgRes.status === 'fulfilled' && cfgRes.value) {
        setConfig((prev) => ({ ...prev, ...cfgRes.value }))
        if (cfgRes.value.api_url && !overrideUrl) {
          setCustomUrl(cfgRes.value.api_url)
        }
      }
    } catch (err) {
      console.error('[ComfyUIModal] fetchAll error:', err)
    } finally {
      setIsChecking(false)
    }
  }, [projectId])

  useEffect(() => {
    if (isOpen) {
      fetchAll()
    }
  }, [isOpen, fetchAll])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveComfyUIConfig({
        ...config,
        api_url: customUrl.trim(),
        save_as_global: saveAsGlobal,
        project_id: projectId,
      })
      onClose()
    } catch (err) {
      console.error('[ComfyUIModal] handleSave error:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await testComfyUIGeneration(customUrl.trim())
      setTestResult(res)
    } catch {
      setTestResult({ success: false, message: 'Không thể kết nối ComfyUI server' })
    } finally {
      setIsTesting(false)
    }
  }

  const processJsonFile = async (file: File) => {
    if (!file || !file.name.endsWith('.json')) {
      setUploadStatus('⚠️ Chỉ chấp nhận file định dạng .json')
      return
    }
    setUploadStatus('Đang đọc và tải lên workflow...')
    try {
      const fileText = await file.text()
      const workflowJson = JSON.parse(fileText)
      const res = await uploadComfyUIWorkflow({
        name: file.name.replace(/\.json$/i, ''),
        workflow_json: workflowJson,
        category: activeTab === 'video' ? 'video' : 'image',
        description: 'Custom uploaded workflow',
      })
      if (res.success) {
        setUploadStatus(`✅ Đã tải lên thành công: ${file.name}`)
        fetchAll()
      } else {
        setUploadStatus(`❌ ${res.message || 'Không thể lưu workflow'}`)
      }
    } catch (err: any) {
      setUploadStatus(`❌ Lỗi file JSON: ${err?.message || 'File không hợp lệ'}`)
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) processJsonFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processJsonFile(file)
    e.target.value = ''
  }

  if (!isOpen) return null

  const connected = Boolean(health?.connected)
  const vramTotal = health?.vram_total_gb ?? 0
  const vramFree = health?.vram_free_gb ?? 0
  const vramUsed = Math.max(0, vramTotal - vramFree)
  const vramPct = vramTotal > 0 ? Math.min(100, Math.round((vramUsed / vramTotal) * 100)) : 0

  const safeWorkflows = Array.isArray(workflows) ? workflows : []
  const imageWorkflows = safeWorkflows.filter((w) => w?.category === 'image')
  const videoWorkflows = safeWorkflows.filter((w) => w?.category === 'video')
  const checkpointsList = Array.isArray(models?.checkpoints) ? models.checkpoints : []
  const lorasList = Array.isArray(models?.loras) ? models.loras : []

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md cursor-pointer animate-fadeIn"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-cinema-deck border border-cinema-border rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] cursor-default text-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-cinema-card border-b border-cinema-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold shadow-md shadow-purple-500/10">
              <Zap className="w-5 h-5 text-purple-400 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-100 font-sans tracking-tight">
                  ComfyUI Studio Hub
                </h3>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-300 bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 rounded-md">
                  Dual Engine
                </span>
              </div>
              <p className="text-xs text-zinc-400 font-sans">
                Tăng tốc phần cứng GPU cục bộ cho Sinh Ảnh & Hoạt Cảnh Video
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Connection Status Card */}
          <div className="rounded-2xl border border-cinema-border bg-cinema-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                <div>
                  <div className="text-xs font-bold text-zinc-200">
                    {connected ? 'ComfyUI Server: Đã kết nối' : 'ComfyUI Server: Offline'}
                  </div>
                  <div className="text-[11px] text-zinc-400 font-mono">
                    {connected && health?.device_name
                      ? `Thiết bị: ${health.device_name}`
                      : `Đang trỏ tới: ${customUrl || 'http://127.0.0.1:8188'}`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchAll()}
                  disabled={isChecking}
                  className="h-7.5 px-3 text-xs gap-1.5 border-cinema-border bg-cinema-card hover:bg-cinema-deck text-zinc-300 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>Kiểm tra</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTest}
                  disabled={isTesting || !connected}
                  className="h-7.5 px-3 text-xs gap-1.5 border-purple-500/30 text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 cursor-pointer"
                >
                  {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  <span>Test Sinh Thử</span>
                </Button>
              </div>
            </div>

            {/* Server URL Input & Presets */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-cinema-border/60">
              <div className="flex-1 flex items-center gap-2 bg-cinema-card px-3 py-1.5 rounded-xl border border-cinema-border focus-within:border-purple-500/50">
                <Monitor className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="text-[11px] text-zinc-400 shrink-0 font-medium">Server URL:</span>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="http://127.0.0.1:8188"
                  className="bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono flex-1 min-w-0"
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const u = 'http://127.0.0.1:8188'
                    setCustomUrl(u)
                    fetchAll(u)
                  }}
                  className={`text-[10px] font-mono px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                    customUrl === 'http://127.0.0.1:8188'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-cinema-card text-zinc-400 border-cinema-border hover:text-zinc-200'
                  }`}
                  title="Dùng localhost nếu ComfyUI chạy trực tiếp trên Windows"
                >
                  Localhost
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const u = 'http://host.docker.internal:8188'
                    setCustomUrl(u)
                    fetchAll(u)
                  }}
                  className={`text-[10px] font-mono px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                    customUrl === 'http://host.docker.internal:8188'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-cinema-card text-zinc-400 border-cinema-border hover:text-zinc-200'
                  }`}
                  title="Dùng host.docker.internal nếu Studio chạy trong Docker container"
                >
                  Docker Host
                </button>
              </div>
            </div>

            {/* Helper guidance when offline */}
            {!connected && !isChecking && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2 font-semibold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>ComfyUI chưa chạy trên máy (Port 8188 offline)</span>
                </div>
                <div className="text-[11px] text-zinc-300 space-y-1 pl-6">
                  <p>
                    1. Mở thư mục cài đặt ComfyUI trên máy tính và chạy file <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-amber-300 font-bold">run_nvidia_gpu.bat</span> (hoặc <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-amber-300 font-bold">run_cpu.bat</span>).
                  </p>
                  <p>
                    2. Chờ terminal hiện <span className="font-mono text-zinc-200 bg-black/30 px-1 rounded">http://127.0.0.1:8188</span> rồi bấm nút <strong>Kiểm tra</strong> ở trên.
                  </p>
                  <p>
                    3. Nếu đang chạy AI Film Studio qua Docker, hãy chọn nút <strong>Docker Host</strong> (<code className="text-cyan-300">http://host.docker.internal:8188</code>).
                  </p>
                </div>
                <p className="text-[10px] text-zinc-400 pl-6 border-t border-amber-500/15 pt-1.5">
                  * Hệ thống luôn an toàn: Nếu ComfyUI offline, Studio sẽ tự động chuyển sang Cloud Pollinations & hiệu ứng Ken Burns mà không làm gián đoạn tiến trình.
                </p>
              </div>
            )}

            {/* GPU VRAM Progress Meter */}
            {connected && vramTotal > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-cinema-border/60">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    <span>GPU VRAM</span>
                  </span>
                  <span>
                    {vramUsed.toFixed(1)} GB / {vramTotal.toFixed(1)} GB ({vramPct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-900 overflow-hidden border border-cinema-border">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      vramPct > 85 ? 'bg-rose-500' : vramPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${vramPct}%` }}
                  />
                </div>
              </div>
            )}

            {testResult && (
              <div
                className={`flex items-center gap-2 text-xs p-2.5 rounded-xl border ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Independent Activation Toggles */}
          <div className="rounded-2xl border border-cinema-border bg-cinema-surface p-4 space-y-3">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
              KÍCH HOẠT ĐỘC LẬP
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-cinema-border bg-cinema-card cursor-pointer hover:border-purple-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={config.is_image_enabled}
                  onChange={(e) => setConfig((c) => ({ ...c, is_image_enabled: e.target.checked }))}
                  className="accent-purple-500 w-4 h-4 rounded cursor-pointer"
                />
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-200">Sinh Ảnh (Stage 3)</div>
                  <div className="text-[11px] text-zinc-400">Flux Schnell / SDXL</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-cinema-border bg-cinema-card cursor-pointer hover:border-purple-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={config.is_video_enabled}
                  onChange={(e) => setConfig((c) => ({ ...c, is_video_enabled: e.target.checked }))}
                  className="accent-purple-500 w-4 h-4 rounded cursor-pointer"
                />
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <Video className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-200">Hoạt Cảnh Video (Stage 4)</div>
                  <div className="text-[11px] text-zinc-400">AnimateDiff / Wan 2.1</div>
                </div>
              </label>
            </div>

            {/* Scope Selection */}
            <div className="flex items-center gap-5 pt-1 text-xs">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">Phạm vi:</span>
              <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer">
                <input
                  type="radio"
                  name="config_scope"
                  checked={saveAsGlobal}
                  onChange={() => setSaveAsGlobal(true)}
                  className="accent-purple-500 cursor-pointer"
                />
                <span>Mặc định toàn Studio</span>
              </label>
              <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer">
                <input
                  type="radio"
                  name="config_scope"
                  checked={!saveAsGlobal}
                  onChange={() => setSaveAsGlobal(false)}
                  className="accent-purple-500 cursor-pointer"
                />
                <span>Chỉ dự án này</span>
              </label>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-1.5 p-1 rounded-2xl bg-cinema-canvas border border-cinema-border">
            {[
              { id: 'image' as TabId, label: '📸 Ảnh Phân Cảnh' },
              { id: 'video' as TabId, label: '🎬 Hoạt Cảnh Video' },
              { id: 'custom' as TabId, label: '📁 Custom Workflows' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 text-xs font-semibold py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Image Workflow Settings */}
          {activeTab === 'image' && (
            <div className="space-y-4 rounded-2xl border border-cinema-border bg-cinema-surface p-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                  Workflow Sinh Ảnh Mẫu
                </label>
                <select
                  value={config.image_workflow}
                  onChange={(e) => setConfig((c) => ({ ...c, image_workflow: e.target.value }))}
                  className="w-full bg-cinema-canvas border border-cinema-border rounded-xl px-3 py-2 text-xs text-zinc-100 cursor-pointer focus:border-purple-500/60"
                >
                  {imageWorkflows.map((w) => (
                    <option key={w.id} value={w.id} disabled={!w.is_compatible}>
                      {w.name} {!w.is_compatible ? '⚠️ Thiếu custom node' : ''}
                    </option>
                  ))}
                  {imageWorkflows.length === 0 && (
                    <option value="flux_schnell">Flux.1 Schnell (Cinematic 4-Step)</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                    Checkpoint Model
                  </label>
                  <select
                    value={config.checkpoint || ''}
                    onChange={(e) => setConfig((c) => ({ ...c, checkpoint: e.target.value || null }))}
                    className="w-full bg-cinema-canvas border border-cinema-border rounded-xl px-3 py-2 text-xs text-zinc-100 cursor-pointer"
                  >
                    <option value="">Mặc định trong workflow</option>
                    {checkpointsList.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                    LoRA Nhân Vật
                  </label>
                  <select
                    value={config.lora || ''}
                    onChange={(e) => setConfig((c) => ({ ...c, lora: e.target.value || null }))}
                    className="w-full bg-cinema-canvas border border-cinema-border rounded-xl px-3 py-2 text-xs text-zinc-100 cursor-pointer"
                  >
                    <option value="">Không sử dụng LoRA</option>
                    {lorasList.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {config.lora && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                      LoRA Weight
                    </span>
                    <span className="font-mono text-purple-300 font-bold">
                      {config.lora_weight.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={config.lora_weight}
                    onChange={(e) => setConfig((c) => ({ ...c, lora_weight: parseFloat(e.target.value) }))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                    Số bước (Steps)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={config.steps}
                    onChange={(e) => setConfig((c) => ({ ...c, steps: parseInt(e.target.value) || 20 }))}
                    className="w-full bg-cinema-canvas border border-cinema-border rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                    CFG Scale
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="30"
                    step="0.5"
                    value={config.cfg}
                    onChange={(e) => setConfig((c) => ({ ...c, cfg: parseFloat(e.target.value) || 7.0 }))}
                    className="w-full bg-cinema-canvas border border-cinema-border rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Video Workflow Settings */}
          {activeTab === 'video' && (
            <div className="space-y-4 rounded-2xl border border-cinema-border bg-cinema-surface p-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                  Workflow Hoạt Cảnh Video
                </label>
                <select
                  value={config.video_workflow}
                  onChange={(e) => setConfig((c) => ({ ...c, video_workflow: e.target.value }))}
                  className="w-full bg-cinema-canvas border border-cinema-border rounded-xl px-3 py-2 text-xs text-zinc-100 cursor-pointer focus:border-purple-500/60"
                >
                  {videoWorkflows.map((w) => (
                    <option key={w.id} value={w.id} disabled={!w.is_compatible}>
                      {w.name} {!w.is_compatible ? '⚠️ Thiếu custom node' : ''}
                    </option>
                  ))}
                  {videoWorkflows.length === 0 && (
                    <option value="animatediff_v3">AnimateDiff v3 Motion Engine</option>
                  )}
                </select>
              </div>

              {/* Missing Node Warning Badge */}
              {videoWorkflows.find((w) => w.id === config.video_workflow)?.missing_nodes?.length ? (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
                  <div>
                    <strong className="font-bold">Cảnh báo thiếu custom node:</strong>{' '}
                    {videoWorkflows.find((w) => w.id === config.video_workflow)?.missing_nodes?.join(', ')}
                    <p className="text-zinc-400 text-[11px] mt-0.5">
                      Vui lòng cài đặt extension ComfyUI tương ứng trước khi khởi chạy render.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                    Số Frame Video
                  </label>
                  <input
                    type="number"
                    min="8"
                    max="64"
                    value={config.video_frames}
                    onChange={(e) => setConfig((c) => ({ ...c, video_frames: parseInt(e.target.value) || 16 }))}
                    className="w-full bg-cinema-canvas border border-cinema-border rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                    FPS (Tốc độ khung hình)
                  </label>
                  <input
                    type="number"
                    min="8"
                    max="30"
                    value={config.video_fps}
                    onChange={(e) => setConfig((c) => ({ ...c, video_fps: parseInt(e.target.value) || 12 }))}
                    className="w-full bg-cinema-canvas border border-cinema-border rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono"
                  />
                </div>
              </div>

              <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 pt-1 font-mono">
                <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Thời lượng clip ước tính: {(config.video_frames / Math.max(1, config.video_fps)).toFixed(1)} giây / cảnh
                </span>
              </div>
            </div>
          )}

          {/* Tab 3: Custom Workflow Dropzone & List */}
          {activeTab === 'custom' && (
            <div className="space-y-4 rounded-2xl border border-cinema-border bg-cinema-surface p-4">
              <div
                ref={dropRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => document.getElementById('comfyui-wf-file-input')?.click()}
                className="border-2 border-dashed border-cinema-border hover:border-purple-500/50 rounded-2xl p-6 text-center transition-colors cursor-pointer bg-cinema-canvas/50"
              >
                <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                <p className="text-xs font-semibold text-zinc-300">
                  Kéo thả file <code className="text-purple-300 bg-purple-500/15 px-1 py-0.5 rounded">.json</code> ComfyUI API Format vào đây
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">hoặc bấm vào để duyệt file từ máy tính</p>
                <input
                  id="comfyui-wf-file-input"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {uploadStatus && (
                <div className="text-xs p-2.5 rounded-xl bg-cinema-canvas border border-cinema-border text-zinc-200">
                  {uploadStatus}
                </div>
              )}

              {/* Workflows Catalog */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                  Danh sách Workflow đã cài đặt ({safeWorkflows.length})
                </span>
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {safeWorkflows.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-cinema-card border border-cinema-border text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileJson className="w-4 h-4 text-purple-400 shrink-0" />
                        <div className="truncate">
                          <span className="font-semibold text-zinc-200">{w.name}</span>
                          <span className="text-[10px] text-zinc-500 font-mono ml-2">
                            {w.category === 'image' ? '📸 Ảnh' : '🎬 Video'} • {w.is_builtin ? 'Built-in' : 'Custom'}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 ml-2">
                        {w.is_compatible ? (
                          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            <Check className="w-3 h-3 stroke-[3]" /> Tương thích
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-mono text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20"
                            title={`Thiếu: ${w.missing_nodes?.join(', ')}`}
                          >
                            <AlertTriangle className="w-3 h-3" /> Thiếu {w.missing_nodes?.length} node
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 bg-cinema-card border-t border-cinema-border shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-white cursor-pointer"
          >
            Đóng
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="text-xs gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 h-8 cursor-pointer shadow-lg shadow-purple-600/20"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <HardDrive className="w-3.5 h-3.5" />
            )}
            <span>Lưu Cấu Hình & Kích Hoạt</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
