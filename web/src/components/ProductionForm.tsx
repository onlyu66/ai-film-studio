import React, { useState, useEffect } from 'react'
import { Sparkles, Play, Settings2, Languages, Clock, Palette, Wand2, Bot, Film, Mic, FileEdit, Clapperboard, X, Send, Check, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { CustomSelect } from './ui/select'
import { useTestWebhook } from '../api/queries'
import type { PresetIdea, StyleOption, SelectOption, ProductionFormData } from '../types'

const LANG_OPTIONS: SelectOption[] = [
  { value: 'vi', label: 'Tiếng Việt', subtext: 'Nam/Nữ AI mượt mà', icon: '🇻🇳' },
  { value: 'en', label: 'English (US)', subtext: 'Natural American voice', icon: '🇺🇸' },
  { value: 'ja', label: 'Japanese', subtext: 'Anime & Studio style', icon: '🇯🇵' },
  { value: 'fr', label: 'French', subtext: 'Studio narration', icon: '🇫🇷' },
]

const LLM_OPTIONS: SelectOption[] = [
  { value: 'gemini', label: 'Google Gemini', subtext: 'Khuyên dùng - Siêu tốc, 0% CPU', icon: '⚡' },
  { value: 'groq', label: 'Groq Cloud', subtext: 'Llama 3.3 70B & Mixtral', icon: '🚀' },
  { value: 'ollama', label: 'Ollama Local', subtext: '100% Offline, bảo mật', icon: '💻' },
  { value: 'openai', label: 'OpenAI ChatGPT', subtext: 'GPT-4o & tương thích', icon: '🤖' },
]

const MOTION_OPTIONS: SelectOption[] = [
  { value: 'vfx', label: 'Cinematic VFX', subtext: 'Khuyên dùng - Góc tối, film look (Free)', icon: '🌟' },
  { value: 'kenburns', label: 'Ken Burns 2.5D', subtext: 'Zoom/Pan cổ điển (Free)', icon: '🎥' },
  { value: 'replicate', label: 'Replicate AI Video', subtext: 'Image-to-Video Cloud động', icon: '🎬' },
]

const LIPSYNC_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'Tắt nhép môi', subtext: 'Render nhanh, máy nhẹ', icon: '🚫' },
  { value: 'cloud', label: 'Cloud Lip-Sync', subtext: 'SadTalker khớp khẩu hình', icon: '👄' },
]

const ASPECT_RATIO_OPTIONS: SelectOption[] = [
  { value: '16:9', label: '16:9 Ngang', subtext: 'YouTube, TV, Máy tính', icon: '🖥️' },
  { value: '9:16', label: '9:16 Dọc', subtext: 'TikTok, Shorts, Reels', icon: '📱' },
]

const PRESET_IDEAS: PresetIdea[] = [
  {
    title: "Bí ẩn Atlantis",
    topic: "Bí ẩn thành phố Atlantis chìm sâu dưới đáy đại dương và đoàn thám hiểm cổ vật",
    style: "cinematic",
    emoji: "🌊"
  },
  {
    title: "Cyberpunk Tokyo 2088",
    topic: "Một thám tử tư có mắt điều khiển học điều tra đường dây trí tuệ nhân tạo mất tích tại Tokyo",
    style: "noir",
    emoji: "🌃"
  },
  {
    title: "Chiến binh Cuối cùng",
    topic: "Robot vệ binh cổ đại tỉnh dậy giữa sa mạc cát đỏ để hoàn thành mệnh lệnh cuối cùng bảo vệ mầm cây sự sống",
    style: "anime",
    emoji: "🤖"
  },
  {
    title: "Đế chế La Mã",
    topic: "Sự trỗi dậy của các quân đoàn La Mã cổ đại và cuộc vây hãm thành cổ",
    style: "documentary",
    emoji: "🏛️"
  }
]

const STYLES: StyleOption[] = [
  { id: 'cinematic', label: 'Cinematic', desc: 'Điện ảnh 35mm, ánh sáng kịch tính', emoji: '🎬', gradient: 'from-amber-500/20 to-orange-500/10' },
  { id: 'anime', label: 'Anime', desc: 'Phong cách Makoto Shinkai rực rỡ', emoji: '🌸', gradient: 'from-pink-500/20 to-purple-500/10' },
  { id: 'noir', label: 'Film Noir', desc: 'Độ tương phản cao, bóng tối cổ điển', emoji: '🕵️', gradient: 'from-slate-700/30 to-slate-900/40' },
  { id: 'documentary', label: 'Documentary', desc: 'Ảnh tư liệu National Geographic 8K', emoji: '🌍', gradient: 'from-emerald-500/20 to-teal-500/10' },
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
    onSubmit({
      topic,
      lang,
      duration: Number(duration),
      style,
      llm,
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
    <Card className="border-slate-800/80 bg-gradient-to-b from-[#0F1628]/95 to-[#090D18]/95 shadow-2xl">
      <CardHeader className="pb-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 font-bold">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Khởi tạo Dự án Phim</span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Studio tự động viết kịch bản, vẽ hình, lồng tiếng và làm chuyển động
              </CardDescription>
            </div>
          </div>
          <Badge variant="default" className="text-[10px] uppercase font-bold tracking-wider">
            AI Engine
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-6">
        {/* Series Continuation Alert Banner if active */}
        {parentProjectId && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-indigo-950/40 to-amber-500/10 border border-amber-500/50 flex items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/30 shrink-0">
                <Clapperboard className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-amber-300">
                    Chế độ Phim Bộ (Series Mode)
                  </span>
                  <Badge variant="default" className="text-[10px] bg-amber-400 text-slate-950 font-black">
                    TẬP {episode}
                  </Badge>
                </div>
                <p className="text-xs text-slate-200 mt-0.5">
                  Đang sản xuất tiếp nối từ: <strong className="text-white">{seriesTitle || 'Tập trước'}</strong>. Studio sẽ tự động kế thừa nhân vật, giọng đọc và hạt giống AI từ tập trước.
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
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Hủy liên kết tập phim để tạo phim độc lập"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Preset chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Gợi ý ý tưởng bom tấn</span>
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PRESET_IDEAS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                disabled={isRunning}
                className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/40 text-left transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 cursor-pointer flex items-start gap-2.5"
              >
                <span className="text-lg flex-shrink-0 mt-0.5">{p.emoji}</span>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-200 block leading-snug">{p.title}</span>
                  <span className="text-[11px] text-slate-400 block mt-0.5 leading-snug line-clamp-1">{p.topic}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Topic Input */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Nội dung / Cốt truyện của bộ phim
          </label>
          <div className="relative">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isRunning}
              rows={3}
              placeholder="Nhập đề tài hoặc tiền đề bộ phim muốn tạo..."
              className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-white placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/80 transition-all resize-none disabled:opacity-50 font-normal leading-relaxed shadow-inner"
            />
          </div>
        </div>

        {/* Visual Style Selection */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-rose-400" />
            <span>Phong cách hình ảnh nghệ thuật (Flux DNA)</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {STYLES.map((st) => {
              const isSelected = style === st.id
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStyle(st.id)}
                  disabled={isRunning}
                  className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-amber-500/15 to-rose-500/15 border-amber-500/70 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{st.emoji}</span>
                    <span className={`text-xs font-bold ${isSelected ? 'text-amber-300' : 'text-slate-200'}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{st.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Language, Aspect Ratio & Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-indigo-400" />
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
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-cyan-400" />
              <span>Tỉ lệ khung hình</span>
            </label>
            <CustomSelect
              value={aspectRatio}
              onChange={setAspectRatio}
              options={ASPECT_RATIO_OPTIONS}
              disabled={isRunning}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Thời lượng phim</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 3, 5, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  disabled={isRunning}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    duration === d
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
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
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{showAdvanced ? 'Thu gọn cài đặt động cơ' : 'Tùy chỉnh động cơ LLM, Motion & Lip-Sync'}</span>
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
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
            pauseAfterScript
              ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
              : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                pauseAfterScript
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <FileEdit className="w-4 h-4" />
            </div>
            <div>
              <span className={`text-xs font-bold block ${pauseAfterScript ? 'text-amber-300' : 'text-slate-200'}`}>
                Duyệt & Sửa Kịch Bản Trước Khi Quay
              </span>
              <span className="text-[11px] text-slate-400 block leading-tight mt-0.5">
                Studio sẽ tạm dừng sau Giai đoạn 1 để bạn xem, sửa lời thoại, đổi giọng trước khi render phim
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
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
            hardsub
              ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md shadow-cyan-500/10'
              : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                hardsub
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Film className="w-4 h-4" />
            </div>
            <div>
              <span className={`text-xs font-bold block ${hardsub ? 'text-cyan-300' : 'text-slate-200'}`}>
                In phụ đề trực tiếp vào video (Hardsub TikTok / Shorts)
              </span>
              <span className="text-[11px] text-slate-400 block leading-tight mt-0.5">
                Chữ vàng viền đen dày chạy trực tiếp trên từng khung hình, tối ưu cho video ngắn
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={hardsub}
            onChange={(e) => setHardsub(e.target.checked)}
            className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400 bg-slate-950 border-slate-700 cursor-pointer"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-1">
          <Button
            type="submit"
            onClick={handleSubmit}
            variant="gradient"
            size="lg"
            disabled={isRunning || !topic.trim()}
            className="w-full py-6 text-sm tracking-wide gap-3 uppercase font-extrabold shadow-amber-500/25"
          >
            <Play className="w-5 h-5 fill-current" />
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
