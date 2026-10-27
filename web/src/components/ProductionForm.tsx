import React, { useState, useEffect } from 'react'
import { Sparkles, Play, Settings2, Languages, Clock, Palette, Bot, Film, Mic, MicOff, Camera, Video, Cpu, Server, Clapperboard, X, Send, Check, Loader2, Key, Eye, EyeOff, RefreshCw, AlertCircle, CheckCircle2, FileEdit, Smartphone, Monitor } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { CustomSelect } from './ui/select'
import { useTestWebhook, useFetchLlmModels } from '../api/queries'
import type { PresetIdea, StyleOption, SelectOption, ProductionFormData, LLMModelItem } from '../types'

const LANG_OPTIONS: SelectOption[] = [
  { value: 'vi', label: 'Tiếng Việt', subtext: 'Giọng AI tự nhiên, truyền cảm', icon: <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">VI</span> },
  { value: 'en', label: 'English (US)', subtext: 'Natural American cinematic narration', icon: <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">EN</span> },
  { value: 'ja', label: 'Japanese', subtext: 'Studio narration & anime style', icon: <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">JA</span> },
  { value: 'fr', label: 'French', subtext: 'Classic European cinema tone', icon: <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">FR</span> },
]

const LLM_OPTIONS: SelectOption[] = [
  { value: 'gemini', label: 'Google Gemini', subtext: 'Khuyên dùng — Siêu tốc, ổn định', icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" /> },
  { value: 'groq', label: 'Groq Cloud', subtext: 'Llama 3.3 70B & Mixtral', icon: <Cpu className="w-3.5 h-3.5 text-sky-400" /> },
  { value: 'ollama', label: 'Ollama Local', subtext: '100% Offline trên máy chủ', icon: <Server className="w-3.5 h-3.5 text-emerald-400" /> },
  { value: 'openai', label: 'OpenAI ChatGPT', subtext: 'GPT-4o & tương thích', icon: <Bot className="w-3.5 h-3.5 text-purple-400" /> },
]

const MOTION_OPTIONS: SelectOption[] = [
  { value: 'vfx', label: 'Cinematic 2.5D VFX', subtext: 'Ken Burns & Dynamic Lighting', icon: <Camera className="w-3.5 h-3.5 text-amber-400" /> },
  { value: 'kenburns', label: 'Ken Burns Classic', subtext: 'Zoom & Pan camera mượt mà', icon: <Film className="w-3.5 h-3.5 text-slate-400" /> },
  { value: 'replicate', label: 'Replicate AI Video', subtext: 'Image-to-Video Cloud động', icon: <Video className="w-3.5 h-3.5 text-indigo-400" /> },
]

const LIPSYNC_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'Tắt nhép môi', subtext: 'Render nhanh, máy nhẹ', icon: <MicOff className="w-3.5 h-3.5 text-slate-400" /> },
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

const STYLES: (StyleOption & { tag: string })[] = [
  { id: 'cinematic', label: 'Cinematic 35mm', desc: 'Ánh sáng kịch tính, tỉ lệ điện ảnh cao cấp', emoji: '', gradient: '', tag: '35mm Film' },
  { id: 'anime', label: 'Anime Studio', desc: 'Màu sắc Makoto Shinkai rực rỡ, chi tiết', emoji: '', gradient: '', tag: 'Animation' },
  { id: 'noir', label: 'Film Noir', desc: 'Độ tương phản cao, bóng đổ bí ẩn kinh điển', emoji: '', gradient: '', tag: 'Classic Noir' },
  { id: 'documentary', label: 'Documentary 8K', desc: 'Ảnh tư liệu thực tế National Geographic', emoji: '', gradient: '', tag: 'Photoreal' },
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
  const [pauseAfterScript, setPauseAfterScript] = useState(false)
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
    <Card id="director-inspector" className="border-white/[0.08] bg-[#0E1119] shadow-xl">
      <CardHeader className="pb-3.5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#141824] border border-white/[0.1] flex items-center justify-center text-amber-400 shrink-0 shadow-sm">
              <Clapperboard className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>DIRECTOR INSPECTOR</span>
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-400">
                Thiết lập kịch bản, phong cách điện ảnh & động cơ AI
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono border-white/[0.08] text-slate-400">
            {aspectRatio} • {duration}M
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-5">
        {/* Series Continuation Alert Banner if active */}
        {parentProjectId && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0">
                EP{episode}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase text-amber-400 block tracking-wider">
                  Chế độ Phim Bộ (Series Mode)
                </span>
                <p className="text-xs text-slate-200 truncate">
                  Tiếp nối: <strong className="text-white">{seriesTitle || 'Tập trước'}</strong> (Kế thừa nhân vật & style)
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
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
              title="Hủy liên kết tập phim"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Preset chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Gợi ý kịch bản mẫu</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_IDEAS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                disabled={isRunning}
                className="px-2.5 py-1.5 rounded-lg bg-[#121622] hover:bg-[#1A2030] border border-white/[0.07] hover:border-amber-500/40 text-left transition-colors cursor-pointer flex items-center gap-2"
              >
                <span className="text-[10px] font-mono uppercase px-1 py-0.2 rounded bg-white/[0.05] text-amber-400/90 font-bold border border-white/[0.06]">{p.tag}</span>
                <span className="text-xs font-medium text-slate-200">{p.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Topic Input */}
        <div>
          <label className="block text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider mb-1.5">
            Ý tưởng cốt truyện / Đề tài bộ phim
          </label>
          <div className="relative">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isRunning}
              rows={3}
              placeholder="Nhập đề tài hoặc tiền đề bộ phim muốn sản xuất..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#080A10] border border-white/[0.08] text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-amber-500/80 transition-all resize-none disabled:opacity-50 font-sans leading-relaxed shadow-inner"
            />
          </div>
        </div>

        {/* Visual Style Selection */}
        <div>
          <label className="block text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            <span>Phong cách hình ảnh điện ảnh</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STYLES.map((st) => {
              const isSelected = style === st.id
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStyle(st.id)}
                  disabled={isRunning}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#181D2A] border-amber-500/80 shadow-sm'
                      : 'bg-[#10131B] border-white/[0.06] hover:border-white/[0.14]'
                  }`}
                >
                  <span className={`text-xs font-bold block mb-0.5 ${isSelected ? 'text-amber-400' : 'text-slate-200'}`}>
                    {st.label}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tight block">
                    {st.tag}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Language, Aspect Ratio & Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-slate-400" />
              <span>Ngôn ngữ thoại</span>
            </label>
            <CustomSelect
              value={lang}
              onChange={setLang}
              options={LANG_OPTIONS}
              disabled={isRunning}
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-slate-400" />
              <span>Khung hình</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-[#080A10] p-1 rounded-xl border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                disabled={isRunning}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  aspectRatio === '16:9'
                    ? 'bg-[#181D2A] text-amber-400 font-bold border border-white/[0.08]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>16:9</span>
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                disabled={isRunning}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  aspectRatio === '9:16'
                    ? 'bg-[#181D2A] text-amber-400 font-bold border border-white/[0.08]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>9:16</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Thời lượng phim</span>
            </label>
            <div className="grid grid-cols-4 gap-1 bg-[#080A10] p-1 rounded-xl border border-white/[0.08]">
              {[1, 3, 5, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  disabled={isRunning}
                  className={`py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    duration === d
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced Settings Accordion */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{showAdvanced ? 'Thu gọn cài đặt động cơ [-]' : 'Cài đặt Động cơ AI (LLM, Motion, SadTalker) [+]'}</span>
          </button>

          {showAdvanced && (
            <div className="relative z-30 mt-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3.5 transition-all animate-fadeIn">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Bot className="w-3 h-3 text-amber-400" />
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
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Film className="w-3 h-3 text-rose-400" />
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
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Mic className="w-3 h-3 text-indigo-400" />
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
              <div className="sm:col-span-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Cấu hình API Key & Chọn Model ({LLM_OPTIONS.find((o) => o.value === llm)?.label})
                    </span>
                  </div>
                  {hasEnvKey && !apiKey && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Đã kết nối qua file .env máy chủ
                    </span>
                  )}
                  {apiKey && (
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Dùng API Key tùy chỉnh (lưu cục bộ)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* API Key Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                        <span>API Key ({LLM_OPTIONS.find((o) => o.value === llm)?.label})</span>
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
                        className="w-full pl-3 pr-28 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                      <div className="absolute right-1.5 flex items-center gap-1">
                        {apiKey && (
                          <button
                            type="button"
                            onClick={() => handleApiKeyChange('')}
                            className="p-1 text-slate-400 hover:text-white text-xs"
                            title="Xóa key"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="p-1 text-slate-400 hover:text-white"
                          title={showApiKey ? 'Ẩn key' : 'Hiện key'}
                        >
                          {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => loadModelsForProvider(llm, apiKey)}
                          disabled={fetchModelsMutation.isPending || isRunning}
                          className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors border border-amber-500/30 cursor-pointer"
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
                      <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>
                          Model Kịch bản {availableModels.length > 0 && `(${availableModels.length} khả dụng)`}
                        </span>
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
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    ) : availableModels.length > 0 ? (
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        disabled={isRunning}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500 font-medium cursor-pointer"
                      >
                        {availableModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.recommended ? '⭐ ' : ''}
                            {m.name || m.id} {m.description ? `— ${m.description}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/80 border border-dashed border-slate-700 text-xs text-slate-400">
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

                {/* Error Banner if any */}
                {modelsError && (
                  <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/80 flex items-start gap-2 text-rose-300 text-xs animate-fadeIn">
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

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clapperboard className="w-3 h-3 text-amber-400" />
                  <span>Tên Series Phim (Tùy chọn)</span>
                </label>
                <input
                  type="text"
                  value={seriesTitle}
                  onChange={(e) => setSeriesTitle(e.target.value)}
                  placeholder="Để trống nếu là phim độc lập"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Tập số (Episode)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={episode}
                  onChange={(e) => setEpisode(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>

              <div className="sm:col-span-3 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Send className="w-3 h-3 text-emerald-400" />
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
                  placeholder="https://discord.com/api/webhooks/... hoặc URL nhận thông báo"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Pause for Review Switch */}
        <div
          onClick={() => setPauseAfterScript(!pauseAfterScript)}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
            pauseAfterScript
              ? 'bg-[#161B28] border-amber-500/60'
              : 'bg-[#10131B] border-white/[0.06] hover:border-white/[0.12]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                pauseAfterScript
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-white/[0.06] text-slate-400'
              }`}
            >
              <FileEdit className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className={`text-xs font-semibold block ${pauseAfterScript ? 'text-amber-400' : 'text-slate-200'}`}>
                Duyệt & Chỉnh Sửa Kịch Bản Trước Khi Render
              </span>
              <span className="text-[11px] text-slate-400 block leading-tight mt-0.5">
                Tạm dừng sau Hồi 1 để bạn duyệt phân cảnh, sửa lời thoại & đổi giọng
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={pauseAfterScript}
            onChange={(e) => setPauseAfterScript(e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-950 border-slate-700 cursor-pointer"
          />
        </div>

        {/* Hardsub Burn-in Switch */}
        <div
          onClick={() => setHardsub(!hardsub)}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
            hardsub
              ? 'bg-[#161B28] border-amber-500/60'
              : 'bg-[#10131B] border-white/[0.06] hover:border-white/[0.12]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                hardsub
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-white/[0.06] text-slate-400'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className={`text-xs font-semibold block ${hardsub ? 'text-amber-400' : 'text-slate-200'}`}>
                In phụ đề trực tiếp vào video (Hardsub)
              </span>
              <span className="text-[11px] text-slate-400 block leading-tight mt-0.5">
                Khắc phụ đề điện ảnh / karaoke viền đen sắc nét trực tiếp vào video
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={hardsub}
            onChange={(e) => setHardsub(e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-950 border-slate-700 cursor-pointer"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="submit"
            onClick={handleSubmit}
            size="lg"
            disabled={isRunning || !topic.trim()}
            className="w-full py-4 text-xs sm:text-sm tracking-wider gap-2.5 font-bold uppercase bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-400/40 shadow-sm cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>
              {isRunning
                ? pauseAfterScript
                  ? 'ĐANG SOẠN KỊCH BẢN...'
                  : 'ĐANG SẢN XUẤT PHIM THEO YÊU CẦU...'
                : pauseAfterScript
                ? 'TẠO KỊCH BẢN & CHỜ DUYỆT'
                : 'BẮT ĐẦU SẢN XUẤT PHIM'}
            </span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
