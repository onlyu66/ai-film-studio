import React, { useState } from 'react'
import { Sparkles, Play, Settings2, Languages, Clock, Palette, Bot, Film, Zap, Layers, Wand2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

const PRESET_IDEAS = [
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

const STYLES = [
  { id: 'cinematic', label: 'Cinematic', desc: 'Điện ảnh 35mm, ánh sáng kịch tính', emoji: '🎬', gradient: 'from-amber-500/20 to-orange-500/10' },
  { id: 'anime', label: 'Anime', desc: 'Phong cách Makoto Shinkai rực rỡ', emoji: '🌸', gradient: 'from-pink-500/20 to-purple-500/10' },
  { id: 'noir', label: 'Film Noir', desc: 'Độ tương phản cao, bóng tối cổ điển', emoji: '🕵️', gradient: 'from-slate-700/30 to-slate-900/40' },
  { id: 'documentary', label: 'Documentary', desc: 'Ảnh tư liệu National Geographic 8K', emoji: '🌍', gradient: 'from-emerald-500/20 to-teal-500/10' },
]

export default function ProductionForm({ onSubmit, isRunning }) {
  const [topic, setTopic] = useState('Bí ẩn thành phố Atlantis chìm sâu dưới đáy đại dương và đoàn thám hiểm cổ vật')
  const [lang, setLang] = useState('vi')
  const [duration, setDuration] = useState(5)
  const [style, setStyle] = useState('cinematic')
  const [llm, setLlm] = useState('gemini')
  const [motion, setMotion] = useState('vfx')
  const [lipSync, setLipSync] = useState('none')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleApplyPreset = (p) => {
    setTopic(p.topic)
    setStyle(p.style)
  }

  const handleSubmit = (e) => {
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
        {/* Preset chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Gợi ý ý tưởng bom tấn</span>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_IDEAS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                disabled={isRunning}
                className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-amber-500/40 text-left transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">{p.emoji}</span>
                  <span className="text-xs font-bold text-slate-200 line-clamp-1">{p.title}</span>
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
          <div className="grid grid-cols-2 gap-2.5">
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
                  <p className="text-[11px] text-slate-400 line-clamp-1">{st.desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Language & Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-indigo-400" />
              <span>Ngôn ngữ thoại</span>
            </label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={isRunning}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="vi">Tiếng Việt (Nam/Nữ AI mượt mà)</option>
              <option value="en">Tiếng Anh (English US)</option>
              <option value="ja">Tiếng Nhật (Japanese)</option>
              <option value="fr">Tiếng Pháp (French)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Thời lượng phim (Phút)</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 3, 5, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  disabled={isRunning}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
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
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-400 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{showAdvanced ? 'Thu gọn cài đặt động cơ' : 'Tùy chỉnh động cơ LLM, Motion & Lip-Sync'}</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 transition-all animate-fadeIn">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Động cơ LLM
                </label>
                <select
                  value={llm}
                  onChange={(e) => setLlm(e.target.value)}
                  disabled={isRunning}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                >
                  <option value="gemini">Google Gemini (Khuyên dùng)</option>
                  <option value="groq">Groq Cloud (Llama 3.3)</option>
                  <option value="ollama">Ollama (Offline local)</option>
                  <option value="openai">OpenAI ChatGPT</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Chuyển động máy quay
                </label>
                <select
                  value={motion}
                  onChange={(e) => setMotion(e.target.value)}
                  disabled={isRunning}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                >
                  <option value="vfx">Cinematic VFX (Free - Khuyên dùng)</option>
                  <option value="kenburns">Ken Burns Zoom/Pan (Free)</option>
                  <option value="replicate">Replicate AI Video (I2V Cloud)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Cử động môi (Lip-Sync)
                </label>
                <select
                  value={lipSync}
                  onChange={(e) => setLipSync(e.target.value)}
                  disabled={isRunning}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                >
                  <option value="none">Tắt nhép môi</option>
                  <option value="cloud">Bật Cloud Lip-Sync (SadTalker)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="gradient"
            size="lg"
            disabled={isRunning || !topic.trim()}
            className="w-full py-6 text-sm tracking-wide gap-3 uppercase font-extrabold shadow-amber-500/25"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>{isRunning ? 'ĐANG SẢN XUẤT PHIM THEO YÊU CẦU...' : 'BẮT ĐẦU SẢN XUẤT PHIM'}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
