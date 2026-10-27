import React, { useState, useEffect } from 'react'
import {
  Sparkles,
  Play,
  Settings2,
  Languages,
  Clock,
  Palette,
  Bot,
  Film,
  Mic,
  MicOff,
  Camera,
  Video,
  Cpu,
  Server,
  Clapperboard,
  X,
  Send,
  Check,
  Loader2,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileEdit,
  Smartphone,
  Monitor,
} from 'lucide-react'
import { CustomSelect } from './ui/select'
import { useTestWebhook, useFetchLlmModels } from '../api/queries'
import type { PresetIdea, StyleOption, SelectOption, ProductionFormData, LLMModelItem } from '../types'

const LANG_OPTIONS: SelectOption[] = [
  { value: 'vi', label: 'Tiếng Việt', subtext: 'Giọng AI tự nhiên, truyền cảm', icon: <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-studio-card border border-studio-border text-amber-300">VI</span> },
  { value: 'en', label: 'English (US)', subtext: 'Natural American cinematic narration', icon: <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-studio-card border border-studio-border text-zinc-300">EN</span> },
  { value: 'ja', label: 'Japanese (日本語)', subtext: 'Studio narration & anime style', icon: <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-studio-card border border-studio-border text-zinc-300">JA</span> },
  { value: 'fr', label: 'French (Français)', subtext: 'Classic European cinema tone', icon: <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-studio-card border border-studio-border text-zinc-300">FR</span> },
]

const LLM_OPTIONS: SelectOption[] = [
  { value: 'gemini', label: 'Google Gemini', subtext: 'Khuyên dùng — Siêu tốc, phân cảnh thông minh', icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" /> },
  { value: 'groq', label: 'Groq Cloud', subtext: 'Llama 3.3 70B & Mixtral', icon: <Cpu className="w-3.5 h-3.5 text-sky-400" /> },
  { value: 'ollama', label: 'Ollama Local', subtext: '100% Offline trên máy chủ', icon: <Server className="w-3.5 h-3.5 text-emerald-400" /> },
  { value: 'openai', label: 'OpenAI ChatGPT', subtext: 'GPT-4o & tương thích', icon: <Bot className="w-3.5 h-3.5 text-purple-400" /> },
]

const MOTION_OPTIONS: SelectOption[] = [
  { value: 'vfx', label: 'Cinematic 2.5D VFX', subtext: 'Ken Burns & Dynamic Lighting', icon: <Camera className="w-3.5 h-3.5 text-amber-400" /> },
  { value: 'kenburns', label: 'Ken Burns Classic', subtext: 'Zoom & Pan camera mượt mà', icon: <Film className="w-3.5 h-3.5 text-zinc-400" /> },
  { value: 'replicate', label: 'Replicate AI Video', subtext: 'Image-to-Video Cloud động', icon: <Video className="w-3.5 h-3.5 text-indigo-400" /> },
]

const LIPSYNC_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'Tắt nhép môi', subtext: 'Render nhanh, máy nhẹ', icon: <MicOff className="w-3.5 h-3.5 text-zinc-400" /> },
  { value: 'cloud', label: 'SadTalker Lip-Sync', subtext: 'Khớp khẩu hình nhân vật', icon: <Mic className="w-3.5 h-3.5 text-indigo-400" /> },
]

const PRESET_IDEAS: (PresetIdea & { tag: string })[] = [
  {
    title: "Bí ẩn Atlantis",
    topic: "Bí ẩn thành phố Atlantis chìm sâu dưới đáy đại dương và đoàn thám hiểm cổ vật",
    style: "cinematic",
    emoji: "",
    tag: "Sci-Fi"
  },
  {
    title: "Cyberpunk Tokyo 2088",
    topic: "Một thám tử tư có mắt điều khiển học điều tra đường dây trí tuệ nhân tạo mất tích tại Tokyo",
    style: "noir",
    emoji: "",
    tag: "Cyberpunk"
  },
  {
    title: "Chiến binh Cuối cùng",
    topic: "Robot vệ binh cổ đại tỉnh dậy giữa sa mạc cát đỏ để hoàn thành mệnh lệnh cuối cùng bảo vệ mầm cây sự sống",
    style: "anime",
    emoji: "",
    tag: "Anime"
  },
  {
    title: "Đế chế La Mã",
    topic: "Sự trỗi dậy của các quân đoàn La Mã cổ đại và cuộc vây hãm thành cổ",
    style: "documentary",
    emoji: "",
    tag: "History"
  }
]

const STYLES: (StyleOption & { tag: string; accent: string })[] = [
  { id: 'cinematic', label: 'Cinematic 35mm', desc: 'Ánh sáng kịch tính, tỉ lệ điện ảnh cao cấp', emoji: '', gradient: '', tag: '35mm Film', accent: 'from-amber-500/20 to-orange-500/5' },
  { id: 'anime', label: 'Anime Studio', desc: 'Màu sắc Makoto Shinkai rực rỡ, chi tiết', emoji: '', gradient: '', tag: 'Animation', accent: 'from-cyan-500/20 to-blue-500/5' },
  { id: 'noir', label: 'Film Noir', desc: 'Độ tương phản cao, bóng đổ bí ẩn kinh điển', emoji: '', gradient: '', tag: 'Classic Noir', accent: 'from-zinc-500/20 to-zinc-900/10' },
  { id: 'documentary', label: 'Documentary 8K', desc: 'Ảnh tư liệu thực tế National Geographic', emoji: '', gradient: '', tag: 'Photoreal', accent: 'from-emerald-500/20 to-teal-500/5' },
]

export interface ProductionFormProps {
  onSubmit: (data: ProductionFormData) => void
  isRunning: boolean
  initialData?: Partial<ProductionFormData> | null
  onResetSeries?: () => void
}

export default function ProductionForm({ onSubmit, isRunning, initialData, onResetSeries }: ProductionFormProps) {
  const [topic, setTopic] = useState('Bí ẩn thành phố Atlantis chìm sâu dưới đáy đại dương và đoàn thám hiểm cổ vật')
  const [lang, setLang] = useState('vi')
  const [duration, setDuration] = useState(5)
  const [style, setStyle] = useState('cinematic')
  const [llm, setLlm] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [availableModels, setAvailableModels] = useState<LLMModelItem[]>([])
  const [hasEnvKey, setHasEnvKey] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [isCustomModel, setIsCustomModel] = useState(false)
  const [customModelText, setCustomModelText] = useState('')

  const fetchModelsMutation = useFetchLlmModels()

  const loadModelsForProvider = (provider: string, customKey?: string) => {
    setModelsError(null)
    const keyToUse = customKey !== undefined ? customKey : (localStorage.getItem(`studio_llm_key_${provider}`) || '')
    fetchModelsMutation.mutate(
      { provider, apiKey: keyToUse.trim() || undefined },
      {
        onSuccess: (data) => {
          if (data.success && data.models && data.models.length > 0) {
            setAvailableModels(data.models)
            setHasEnvKey(!!data.has_env_key)
            setSelectedModel((prev) => {
              const exists = data.models.some((m) => m.id === prev)
              return exists && prev ? prev : (data.default || data.models[0].id)
            })
          } else {
            setAvailableModels([])
            setHasEnvKey(!!data.has_env_key)
            if (data.error) {
              setModelsError(data.error)
            }
          }
        },
        onError: (err: any) => {
          setModelsError(err?.message || 'Không thể kết nối lấy danh sách model')
          setAvailableModels([])
        },
      }
    )
  }

  useEffect(() => {
    const savedKey = localStorage.getItem(`studio_llm_key_${llm}`) || ''
    setApiKey(savedKey)
    loadModelsForProvider(llm, savedKey)
  }, [llm])

  const handleApiKeyChange = (val: string) => {
    setApiKey(val)
    localStorage.setItem(`studio_llm_key_${llm}`, val)
  }

  const [motion, setMotion] = useState('vfx')
  const [lipSync, setLipSync] = useState('none')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [hardsub, setHardsub] = useState(false)
  const [pauseAfterScript, setPauseAfterScript] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [seriesTitle, setSeriesTitle] = useState('')
  const [episode, setEpisode] = useState(1)
  const [parentProjectId, setParentProjectId] = useState<string | undefined>(undefined)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [testWebhookSuccess, setTestWebhookSuccess] = useState(false)

  const testWebhookMutation = useTestWebhook()

  useEffect(() => {
    if (initialData) {
      if (initialData.topic) setTopic(initialData.topic)
      if (initialData.lang) setLang(initialData.lang)
      if (initialData.style) setStyle(initialData.style)
      if (initialData.duration) setDuration(initialData.duration)
      if (initialData.aspect_ratio) setAspectRatio(initialData.aspect_ratio)
      if (initialData.series_title) setSeriesTitle(initialData.series_title)
      if (initialData.episode) setEpisode(initialData.episode)
      if (initialData.parent_project_id) setParentProjectId(initialData.parent_project_id)
      if (initialData.webhook_url) setWebhookUrl(initialData.webhook_url)
    }
  }, [initialData])

  const handleApplyPreset = (p: PresetIdea) => {
    setTopic(p.topic)
    setStyle(p.style)
  }

  const handleTestWebhook = () => {
    if (!webhookUrl.trim()) return
    testWebhookMutation.mutate(webhookUrl.trim(), {
      onSuccess: () => {
        setTestWebhookSuccess(true)
        setTimeout(() => setTestWebhookSuccess(false), 3000)
      },
      onError: (err: any) => {
        alert(`Lỗi Webhook: ${err?.message || 'Không thể gửi'}`)
      },
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return
    const finalModel = isCustomModel ? customModelText.trim() : selectedModel
    onSubmit({
      topic,
      lang,
      duration: Number(duration),
      style,
      llm,
      llm_api_key: apiKey.trim() || undefined,
      llm_model: finalModel || undefined,
      motion,
      lip_sync: lipSync,
      aspect_ratio: aspectRatio,
      hardsub,
      pause_after_script: pauseAfterScript,
      series_title: seriesTitle.trim() || undefined,
      episode: Number(episode) || 1,
      parent_project_id: parentProjectId,
      webhook_url: webhookUrl.trim() || undefined,
    })
  }

  return (
    <div id="director-inspector" className="glass-panel rounded-3xl p-5 sm:p-7 shadow-2xl relative">
      {/* Series Sequel Alert */}
      {parentProjectId && (
        <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              EP{episode}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase text-amber-400 block tracking-wider">
                Chế độ Phim Bộ (Series Mode)
              </span>
              <p className="text-xs text-zinc-200 truncate">
                Tiếp nối: <strong className="text-white">{seriesTitle || 'Tập trước'}</strong> (Kế thừa nhân vật & visual DNA)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setParentProjectId(undefined)
              setSeriesTitle('')
              setEpisode(1)
              onResetSeries?.()
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
            title="Hủy liên kết tập phim"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form Area */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Prompt Studio Area */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Ý tưởng kịch bản & Đề tài bộ phim</span>
            </label>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider hidden sm:inline">
              Flux 8K • Cinematic Script
            </span>
          </div>

          {/* Prompt Textarea */}
          <div className="relative group">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isRunning}
              rows={3}
              placeholder="Mô tả ý tưởng, cốt truyện, nhân vật hoặc đề tài tài liệu mà bạn muốn AI sản xuất thành phim..."
              className="w-full px-4 py-3.5 rounded-2xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10 transition-all resize-none disabled:opacity-50 font-sans leading-relaxed shadow-inner"
            />
            {topic && !isRunning && (
              <button
                type="button"
                onClick={() => setTopic('')}
                className="absolute top-3 right-3 p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                title="Xóa nhanh prompt"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Clean Quick Inspiration Chips Below Textarea */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mr-1">Gợi ý nhanh:</span>
            {PRESET_IDEAS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                disabled={isRunning}
                className="px-2.5 py-1 rounded-lg bg-studio-card hover:bg-studio-elevated border border-studio-border hover:border-amber-400/40 text-[11px] font-medium text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-400/10 text-amber-300 font-bold">{p.tag}</span>
                <span>{p.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Visual Style Gallery Deck */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
            <Palette className="w-4 h-4 text-amber-400" />
            <span>Phong cách hình ảnh điện ảnh</span>
          </label>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {STYLES.map((st) => {
              const isSelected = style === st.id
              return (
                <div
                  key={st.id}
                  onClick={() => !isRunning && setStyle(st.id)}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                    isSelected
                      ? 'bg-gradient-to-b ' + st.accent + ' border-amber-400/70 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/40'
                      : 'bg-studio-card/70 border-studio-border hover:border-studio-border-hover hover:bg-studio-card'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                        {st.tag}
                      </span>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <h4 className={`text-xs sm:text-sm font-bold ${isSelected ? 'text-amber-300' : 'text-zinc-100'}`}>
                      {st.label}
                    </h4>
                    <p className="text-[11px] text-zinc-400 leading-snug mt-1">
                      {st.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. Core Production Specs: Aspect Ratio, Duration & Language */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          {/* Aspect Ratio */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-zinc-400" />
              <span>Tỉ lệ khung hình</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-studio-input p-1 rounded-xl border border-studio-border">
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                disabled={isRunning}
                className={`py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  aspectRatio === '16:9'
                    ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>16:9 Cinema</span>
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                disabled={isRunning}
                className={`py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  aspectRatio === '9:16'
                    ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>9:16 Shorts</span>
              </button>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Thời lượng phim</span>
            </label>
            <div className="grid grid-cols-4 gap-1 bg-studio-input p-1 rounded-xl border border-studio-border">
              {[1, 3, 5, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  disabled={isRunning}
                  className={`py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    duration === d
                      ? 'bg-amber-400 text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-studio-deck'
                  }`}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-zinc-400" />
              <span>Ngôn ngữ thuyết minh</span>
            </label>
            <CustomSelect
              value={lang}
              onChange={setLang}
              options={LANG_OPTIONS}
              disabled={isRunning}
            />
          </div>
        </div>

        {/* 4. Production Switches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Pause for Review */}
          <div
            onClick={() => setPauseAfterScript(!pauseAfterScript)}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              pauseAfterScript
                ? 'bg-amber-500/10 border-amber-400/40 shadow-sm'
                : 'bg-studio-card/70 border-studio-border hover:border-studio-border-hover hover:bg-studio-card'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                  pauseAfterScript
                    ? 'bg-amber-400 text-zinc-950 font-bold'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <FileEdit className="w-4 h-4" />
              </div>
              <div>
                <span className={`text-xs font-semibold block ${pauseAfterScript ? 'text-amber-300' : 'text-zinc-200'}`}>
                  Duyệt kịch bản trước khi render
                </span>
                <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
                  Tạm dừng sau Hồi 1 để sửa thoại & đổi giọng
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={pauseAfterScript}
              onChange={(e) => setPauseAfterScript(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-studio-input border-studio-border cursor-pointer"
            />
          </div>

          {/* Hardsub Burn-in */}
          <div
            onClick={() => setHardsub(!hardsub)}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              hardsub
                ? 'bg-amber-500/10 border-amber-400/40 shadow-sm'
                : 'bg-studio-card/70 border-studio-border hover:border-studio-border-hover hover:bg-studio-card'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                  hardsub
                    ? 'bg-amber-400 text-zinc-950 font-bold'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <Film className="w-4 h-4" />
              </div>
              <div>
                <span className={`text-xs font-semibold block ${hardsub ? 'text-amber-300' : 'text-zinc-200'}`}>
                  In phụ đề trực tiếp vào video
                </span>
                <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
                  Khắc phụ đề điện ảnh viền đen trực tiếp (Hardsub)
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={hardsub}
              onChange={(e) => setHardsub(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-studio-input border-studio-border cursor-pointer"
            />
          </div>
        </div>

        {/* 5. Advanced Engine Accordion */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <Settings2 className="w-4 h-4" />
            <span>{showAdvanced ? 'Thu gọn cài đặt động cơ [-]' : 'Cài đặt nâng cao (AI Engines, API Key, SadTalker) [+]'}</span>
          </button>

          {showAdvanced && (
            <div className="relative z-30 mt-3 p-4 sm:p-5 rounded-2xl bg-studio-deck border border-studio-border grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fadeIn">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                  <span>Động cơ LLM</span>
                </label>
                <CustomSelect
                  value={llm}
                  onChange={setLlm}
                  options={LLM_OPTIONS}
                  disabled={isRunning}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-rose-400" />
                  <span>Chuyển động máy quay</span>
                </label>
                <CustomSelect
                  value={motion}
                  onChange={setMotion}
                  options={MOTION_OPTIONS}
                  disabled={isRunning}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Cử động môi (Lip-Sync)</span>
                </label>
                <CustomSelect
                  value={lipSync}
                  onChange={setLipSync}
                  options={LIPSYNC_OPTIONS}
                  disabled={isRunning}
                />
              </div>

              {/* API Key & Dynamic Model Selection Card */}
              <div className="sm:col-span-3 p-4 rounded-xl bg-studio-card border border-studio-border space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-studio-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Cấu hình API Key & Model ({LLM_OPTIONS.find((o) => o.value === llm)?.label})
                    </span>
                  </div>
                  {hasEnvKey && !apiKey && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Nhận diện từ file .env
                    </span>
                  )}
                  {apiKey && (
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Key tùy chỉnh (lưu máy này)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* API Key Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium">
                        API Key
                      </label>
                      {llm === 'gemini' && (
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-amber-400 hover:underline"
                        >
                          Lấy key miễn phí ↗
                        </a>
                      )}
                      {llm === 'groq' && (
                        <a
                          href="https://console.groq.com/keys"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-amber-400 hover:underline"
                        >
                          Lấy key Groq ↗
                        </a>
                      )}
                      {llm === 'openai' && (
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-amber-400 hover:underline"
                        >
                          Lấy key OpenAI ↗
                        </a>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => handleApiKeyChange(e.target.value)}
                        placeholder={
                          hasEnvKey
                            ? 'Đã nhận diện key từ .env (nhập để ghi đè)'
                            : llm === 'ollama'
                            ? 'Ollama không cần API key'
                            : 'Nhập API key tại đây...'
                        }
                        disabled={isRunning || llm === 'ollama'}
                        className="w-full pl-3 pr-28 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono"
                      />
                      <div className="absolute right-1.5 flex items-center gap-1">
                        {apiKey && (
                          <button
                            type="button"
                            onClick={() => handleApiKeyChange('')}
                            className="p-1 text-zinc-400 hover:text-white text-xs cursor-pointer"
                            title="Xóa key"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                          title={showApiKey ? 'Ẩn key' : 'Hiện key'}
                        >
                          {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => loadModelsForProvider(llm, apiKey)}
                          disabled={fetchModelsMutation.isPending || isRunning}
                          className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors border border-amber-500/30 cursor-pointer"
                          title="Tải danh sách model"
                        >
                          {fetchModelsMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          <span>Tải Models</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Model Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium">
                        Model Kịch bản {availableModels.length > 0 && `(${availableModels.length} khả dụng)`}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCustomModel(!isCustomModel)}
                        className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                      >
                        {isCustomModel ? 'Chọn từ danh sách' : 'Nhập model khác'}
                      </button>
                    </div>

                    {isCustomModel ? (
                      <input
                        type="text"
                        value={customModelText}
                        onChange={(e) => setCustomModelText(e.target.value)}
                        placeholder="VD: gemini-3.5-flash, gpt-4o, llama3.2..."
                        className="w-full px-3 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    ) : availableModels.length > 0 ? (
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        disabled={isRunning}
                        className="w-full px-3 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
                      >
                        {availableModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.recommended ? '⭐ ' : ''}
                            {m.name || m.id} {m.description ? `— ${m.description}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-studio-input border border-dashed border-studio-border text-xs text-zinc-500">
                        <span>
                          {fetchModelsMutation.isPending
                            ? 'Đang tải danh sách model...'
                            : 'Chưa có model. Bấm "Tải Models" sau khi điền API Key.'}
                        </span>
                        {fetchModelsMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Banner */}
                {modelsError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-300 text-xs animate-fadeIn">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">{modelsError}</p>
                      <p className="text-[11px] text-rose-400/80 mt-0.5">
                        Hãy kiểm tra lại API Key hoặc tạo key mới tại bảng điều khiển nhà cung cấp.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Series Details */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clapperboard className="w-3 h-3 text-amber-400" />
                  <span>Tên Series Phim (Tùy chọn)</span>
                </label>
                <input
                  type="text"
                  value={seriesTitle}
                  onChange={(e) => setSeriesTitle(e.target.value)}
                  placeholder="Để trống nếu là phim độc lập"
                  className="w-full px-3 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Tập số (Episode)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={episode}
                  onChange={(e) => setEpisode(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 focus:outline-none focus:border-amber-400 font-bold"
                />
              </div>

              {/* Webhook */}
              <div className="sm:col-span-3 pt-2 border-t border-studio-border">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Webhook Tự Động Hóa (Discord / Telegram / n8n / Zapier)</span>
                  </label>
                  {webhookUrl && (
                    <button
                      type="button"
                      onClick={handleTestWebhook}
                      disabled={testWebhookMutation.isPending}
                      className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      {testWebhookMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : testWebhookSuccess ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Đã gửi thử nghiệm!</span>
                        </>
                      ) : (
                        <span>Gửi thử Webhook</span>
                      )}
                    </button>
                  )}
                </div>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/... hoặc URL webhook nhận thông báo"
                  className="w-full px-3 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* 6. Primary Action CTA Button */}
        <div className="pt-2 flex justify-center">
          <button
            type="submit"
            disabled={isRunning || !topic.trim()}
            className="w-full sm:max-w-md py-3.5 px-6 rounded-2xl font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer shadow-xl relative overflow-hidden bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-400 text-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed group glow-amber-sm hover:glow-amber-md active:scale-[0.98]"
          >
            {/* Shimmer line */}
            <div className="absolute inset-0 w-1/3 h-full bg-gradient-to-r from-transparent via-white/35 to-transparent -skew-x-12 animate-shimmer pointer-events-none" />

            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                <span>
                  {pauseAfterScript ? 'Đang soạn kịch bản & phân cảnh...' : 'Đang sản xuất toàn bộ phim...'}
                </span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {pauseAfterScript
                    ? 'Tạo Kịch Bản & Dừng Để Duyệt (Khuyên Dùng)'
                    : 'Bắt Đầu Sản Xuất Phim Tự Động'}
                </span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
