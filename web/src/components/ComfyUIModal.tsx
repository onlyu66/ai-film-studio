import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X, Zap, CheckCircle2, AlertCircle, Loader2, Upload,
  Monitor, Image as ImageIcon, Video, Settings, RefreshCw,
  Cpu, HardDrive, AlertTriangle, FileJson
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
  const [activeTab, setActiveTab] = useState<TabId>('image')
  const [isChecking, setIsChecking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [saveAsGlobal, setSaveAsGlobal] = useState(true)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const fetchAll = useCallback(async () => {
    setIsChecking(true)
    try {
      const [statusRes, modelsRes, wfRes, cfgRes] = await Promise.allSettled([
        getComfyUIStatus(),
        getComfyUIModels(),
        getComfyUIWorkflows(),
        getComfyUIConfig(projectId),
      ])
      if (statusRes.status === 'fulfilled') setHealth(statusRes.value.health)
      if (modelsRes.status === 'fulfilled') setModels(modelsRes.value)
      if (wfRes.status === 'fulfilled') setWorkflows(wfRes.value.workflows || [])
      if (cfgRes.status === 'fulfilled') setConfig(cfgRes.value)
    } catch { /* swallow */ }
    setIsChecking(false)
  }, [projectId])

  useEffect(() => {
    if (isOpen) fetchAll()
  }, [isOpen, fetchAll])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveComfyUIConfig({ ...config, save_as_global: saveAsGlobal, project_id: projectId })
    } catch { /* swallow */ }
    setIsSaving(false)
    onClose()
  }

  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await testComfyUIGeneration()
      setTestResult(res)
    } catch {
      setTestResult({ success: false, message: 'Không thể kết nối ComfyUI' })
    }
    setIsTesting(false)
  }

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file || !file.name.endsWith('.json')) {
      setUploadStatus('Chỉ chấp nhận file .json')
      return
    }
    setUploadStatus('Đang tải lên...')
    try {
      const res = await uploadComfyUIWorkflow(file)
      setUploadStatus(res.success ? `✅ ${res.message}` : `❌ ${res.message}`)
      if (res.success) fetchAll()
    } catch {
      setUploadStatus('❌ Lỗi khi tải lên')
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus('Đang tải lên...')
    try {
      const res = await uploadComfyUIWorkflow(file)
      setUploadStatus(res.success ? `✅ ${res.message}` : `❌ ${res.message}`)
      if (res.success) fetchAll()
    } catch {
      setUploadStatus('❌ Lỗi khi tải lên')
    }
    e.target.value = ''
  }

  if (!isOpen) return null

  const connected = health?.connected ?? false
  const vramPct = health && health.vram_total_gb > 0
    ? Math.round(((health.vram_total_gb - health.vram_free_gb) / health.vram_total_gb) * 100)
    : 0

  const imageWorkflows = workflows.filter(w => w.category === 'image')
  const videoWorkflows = workflows.filter(w => w.category === 'video')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-studio-panel border border-studio-border shadow-2xl mx-4">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 bg-studio-panel/95 backdrop-blur-md border-b border-studio-border rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-100">ComfyUI Studio Hub</h2>
              <p className="text-[10px] text-zinc-500 font-mono">Dual Engine · Image & Video</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-studio-card transition-colors cursor-pointer">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Connection Status */}
          <div className="rounded-xl border border-studio-border bg-studio-card/50 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-400'} ${connected ? 'animate-pulse' : ''}`} />
                <span className="text-xs font-semibold text-zinc-200">
                  {connected ? 'Đã kết nối' : 'Không kết nối'}
                </span>
                {health && connected && (
                  <span className="text-[10px] text-zinc-500 font-mono">{health.device_name}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchAll}
                  disabled={isChecking}
                  className="h-7 px-2.5 text-[11px] gap-1 border-studio-border cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
                  Kiểm tra
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleTest}
                  disabled={isTesting || !connected}
                  className="h-7 px-2.5 text-[11px] gap-1 border-purple-500/30 text-purple-300 hover:bg-purple-500/10 cursor-pointer"
                >
                  {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  Test
                </Button>
              </div>
            </div>

            {/* GPU VRAM Bar */}
            {connected && health && health.vram_total_gb > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> GPU VRAM</span>
                  <span>{(health.vram_total_gb - health.vram_free_gb).toFixed(1)} / {health.vram_total_gb.toFixed(1)} GB</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${vramPct > 85 ? 'bg-rose-500' : vramPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${vramPct}%` }}
                  />
                </div>
              </div>
            )}

            {testResult && (
              <div className={`flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg ${testResult.success ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                {testResult.success ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                {testResult.message}
              </div>
            )}
          </div>

          {/* Activation Toggles */}
          <div className="rounded-xl border border-studio-border bg-studio-card/50 p-3.5 space-y-3">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Kích Hoạt Độc Lập</span>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-studio-border bg-studio-input/50 cursor-pointer hover:border-purple-500/30 transition-colors">
                <input
                  type="checkbox"
                  checked={config.is_image_enabled}
                  onChange={e => setConfig(c => ({ ...c, is_image_enabled: e.target.checked }))}
                  className="accent-purple-500 w-3.5 h-3.5 cursor-pointer"
                />
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-xs font-semibold text-zinc-200">Sinh Ảnh</div>
                  <div className="text-[10px] text-zinc-500">Stage 3 · Image Engine</div>
                </div>
              </label>
              <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-studio-border bg-studio-input/50 cursor-pointer hover:border-purple-500/30 transition-colors">
                <input
                  type="checkbox"
                  checked={config.is_video_enabled}
                  onChange={e => setConfig(c => ({ ...c, is_video_enabled: e.target.checked }))}
                  className="accent-purple-500 w-3.5 h-3.5 cursor-pointer"
                />
                <Video className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="text-xs font-semibold text-zinc-200">Hoạt Cảnh Video</div>
                  <div className="text-[10px] text-zinc-500">Stage 4 · Video Engine</div>
                </div>
              </label>
            </div>

            {/* Config Scope */}
            <div className="flex items-center gap-4 pt-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Phạm Vi:</span>
              <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                <input type="radio" checked={saveAsGlobal} onChange={() => setSaveAsGlobal(true)} className="accent-purple-500 cursor-pointer" />
                Mặc định toàn Studio
              </label>
              <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                <input type="radio" checked={!saveAsGlobal} onChange={() => setSaveAsGlobal(false)} className="accent-purple-500 cursor-pointer" />
                Chỉ dự án này
              </label>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-studio-input/60 border border-studio-border">
            {([
              { id: 'image' as TabId, label: '📸 Ảnh Phân Cảnh', icon: ImageIcon },
              { id: 'video' as TabId, label: '🎬 Hoạt Cảnh Video', icon: Video },
              { id: 'custom' as TabId, label: '📁 Custom Workflows', icon: Settings },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 text-xs font-medium py-2 rounded-lg transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Image Workflow */}
          {activeTab === 'image' && (
            <div className="space-y-3 rounded-xl border border-studio-border bg-studio-card/30 p-3.5">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Workflow Mẫu</label>
                <select
                  value={config.image_workflow}
                  onChange={e => setConfig(c => ({ ...c, image_workflow: e.target.value }))}
                  className="w-full bg-studio-input border border-studio-border rounded-lg px-3 py-2 text-xs text-zinc-200 cursor-pointer"
                >
                  {imageWorkflows.map(w => (
                    <option key={w.id} value={w.id} disabled={!w.is_compatible}>
                      {w.name} {!w.is_compatible ? '⚠️ Thiếu node' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Checkpoint Model</label>
                  <select
                    value={config.checkpoint || ''}
                    onChange={e => setConfig(c => ({ ...c, checkpoint: e.target.value || null }))}
                    className="w-full bg-studio-input border border-studio-border rounded-lg px-3 py-2 text-xs text-zinc-200 cursor-pointer"
                  >
                    <option value="">Mặc định workflow</option>
                    {models.checkpoints.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">LoRA Nhân Vật</label>
                  <select
                    value={config.lora || ''}
                    onChange={e => setConfig(c => ({ ...c, lora: e.target.value || null }))}
                    className="w-full bg-studio-input border border-studio-border rounded-lg px-3 py-2 text-xs text-zinc-200 cursor-pointer"
                  >
                    <option value="">Không dùng LoRA</option>
                    {models.loras.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {config.lora && (
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">LoRA Weight: {config.lora_weight.toFixed(1)}</label>
                  <input
                    type="range" min="0" max="1" step="0.1"
                    value={config.lora_weight}
                    onChange={e => setConfig(c => ({ ...c, lora_weight: parseFloat(e.target.value) }))}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Steps</label>
                  <input
                    type="number" min="1" max="100"
                    value={config.steps}
                    onChange={e => setConfig(c => ({ ...c, steps: parseInt(e.target.value) || 20 }))}
                    className="w-full bg-studio-input border border-studio-border rounded-lg px-3 py-2 text-xs text-zinc-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">CFG Scale</label>
                  <input
                    type="number" min="0.1" max="30" step="0.5"
                    value={config.cfg}
                    onChange={e => setConfig(c => ({ ...c, cfg: parseFloat(e.target.value) || 7.0 }))}
                    className="w-full bg-studio-input border border-studio-border rounded-lg px-3 py-2 text-xs text-zinc-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Sampler</label>
                  <select className="w-full bg-studio-input border border-studio-border rounded-lg px-3 py-2 text-xs text-zinc-200 cursor-pointer">
                    <option>euler</option>
                    <option>euler_ancestral</option>
                    <option>dpmpp_2m</option>
                    <option>dpmpp_sde</option>
                    <option>uni_pc</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Video Workflow */}
          {activeTab === 'video' && (
            <div className="space-y-3 rounded-xl border border-studio-border bg-studio-card/30 p-3.5">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Video Workflow</label>
                <select
                  value={config.video_workflow}
                  onChange={e => setConfig(c => ({ ...c, video_workflow: e.target.value }))}
                  className="w-full bg-studio-input border border-studio-border rounded-lg px-3 py-2 text-xs text-zinc-200 cursor-pointer"
                >
                  {videoWorkflows.map(w => (
                    <option key={w.id} value={w.id} disabled={!w.is_compatible}>
                      {w.name} {!w.is_compatible ? '⚠️ Thiếu node' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Missing Node Warnings */}
              {videoWorkflows.find(w => w.id === config.video_workflow)?.missing_nodes?.length ? (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <div>
                    <strong>Thiếu custom node:</strong>{' '}
                    {videoWorkflows.find(w => w.id === config.video_workflow)?.missing_nodes?.join(', ')}
                    <br />
                    <span className="text-zinc-400">Cài đặt extension trong ComfyUI Manager trước khi sử dụng.</span>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Số Frame</label>
                  <input
                    type="number" min="8" max="64"
                    value={config.video_frames}
                    onChange={e => setConfig(c => ({ ...c, video_frames: parseInt(e.target.value) || 16 }))}
                    className="w-full bg-studio-input border border-studio-border rounded-lg px-3 py-2 text-xs text-zinc-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">FPS</label>
                  <input
                    type="number" min="8" max="30"
                    value={config.video_fps}
                    onChange={e => setConfig(c => ({ ...c, video_fps: parseInt(e.target.value) || 12 }))}
                    className="w-full bg-studio-input border border-studio-border rounded-lg px-3 py-2 text-xs text-zinc-200"
                  />
                </div>
              </div>

              <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                <Monitor className="w-3 h-3" />
                Thời lượng ước tính: {(config.video_frames / config.video_fps).toFixed(1)}s mỗi cảnh
              </div>
            </div>
          )}

          {/* Tab: Custom Workflows */}
          {activeTab === 'custom' && (
            <div className="space-y-3 rounded-xl border border-studio-border bg-studio-card/30 p-3.5">
              {/* Dropzone */}
              <div
                ref={dropRef}
                onDragOver={e => e.preventDefault()}
                onDrop={handleFileDrop}
                className="border-2 border-dashed border-studio-border rounded-xl p-6 text-center hover:border-purple-500/40 transition-colors cursor-pointer"
                onClick={() => document.getElementById('comfyui-wf-upload')?.click()}
              >
                <Upload className="w-6 h-6 text-zinc-500 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">
                  Kéo thả file <code className="text-purple-300">.json</code> ComfyUI API Format vào đây
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">hoặc bấm để duyệt file</p>
                <input
                  id="comfyui-wf-upload"
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {uploadStatus && (
                <p className="text-[11px] text-zinc-300">{uploadStatus}</p>
              )}

              {/* Workflow List */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Workflow đã cài đặt</span>
                {workflows.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">Chưa có workflow nào</p>
                ) : (
                  <div className="space-y-1">
                    {workflows.map(w => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-studio-input/40 border border-studio-border text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <FileJson className="w-3.5 h-3.5 text-zinc-400" />
                          <div>
                            <span className="text-zinc-200 font-medium">{w.name}</span>
                            <span className="text-[10px] text-zinc-500 ml-2">
                              {w.category === 'image' ? '📸' : '🎬'} {w.is_builtin ? 'Built-in' : 'Custom'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {w.is_compatible ? (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Tương thích
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-400 flex items-center gap-0.5" title={`Thiếu: ${w.missing_nodes.join(', ')}`}>
                              <AlertTriangle className="w-3 h-3" /> Thiếu {w.missing_nodes.length} node
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer">
              Huỷ bỏ
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="text-xs gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <HardDrive className="w-3 h-3" />}
              Lưu Cấu Hình & Kích Hoạt
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
