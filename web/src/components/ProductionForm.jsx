import React, { useState } from 'react'
import { Sparkles, Sliders, Play, Settings2, Languages, Clock, Palette, Bot, Film } from 'lucide-react'

const PROMPT_SUGGESTIONS = [
  "Bí ẩn thành phố Atlantis dưới đáy đại dương",
  "Hành trình của robot cuối cùng tìm lại ký ức loài người",
  "Sự trỗi dậy và sụp đổ của Đế chế La Mã cổ đại",
  "Thám tử tư điều tra vụ án mất tích tại Tokyo năm 2088",
]

const STYLES = [
  { id: 'cinematic', label: 'Điện ảnh (Cinematic)', emoji: '🎬' },
  { id: 'anime', label: 'Hoạt hình Anime', emoji: '🌸' },
  { id: 'noir', label: 'Phim đen (Film Noir)', emoji: '🕵️' },
  { id: 'documentary', label: 'Phóng sự tài liệu', emoji: '🌍' },
]

export default function ProductionForm({ onSubmit, isRunning }) {
  const [topic, setTopic] = useState('Bí ẩn thành phố Atlantis dưới đáy đại dương')
  const [lang, setLang] = useState('vi')
  const [duration, setDuration] = useState(5)
  const [style, setStyle] = useState('cinematic')
  const [llm, setLlm] = useState('gemini')
  const [motion, setMotion] = useState('vfx')
  const [lipSync, setLipSync] = useState('none')
  const [showAdvanced, setShowAdvanced] = useState(false)

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
    <form onSubmit={handleSubmit} className="bg-[#0F1626]/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Khởi tạo Dự án Phim mới</h2>
            <p className="text-xs text-slate-400">Cung cấp ý tưởng cốt truyện để Studio tự động hoàn thành phim</p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Topic Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Ý tưởng / Cốt truyện của phim
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={isRunning}
            rows={3}
            placeholder="Nhập chủ đề phim, ví dụ: Bí ẩn thành phố Atlantis dưới đáy đại dương..."
            className="w-full px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all resize-none disabled:opacity-50"
          />

          {/* Quick suggestions */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[11px] text-slate-500 flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Gợi ý:
            </span>
            {PROMPT_SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setTopic(s)}
                disabled={isRunning}
                className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Basic Parameters: Language & Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              <Languages className="w-3.5 h-3.5 text-indigo-400" />
              Ngôn ngữ kịch bản & lồng tiếng
            </label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={isRunning}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="vi">Tiếng Việt (Nam/Nữ AI giọng chuẩn)</option>
              <option value="en">Tiếng Anh (English US)</option>
              <option value="ja">Tiếng Nhật (Japanese)</option>
              <option value="fr">Tiếng Pháp (French)</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Thời lượng mục tiêu (Phút)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 5, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  disabled={isRunning}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    duration === d
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-900/80 border-slate-700/70 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Visual Style Selection */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">
            <Palette className="w-3.5 h-3.5 text-rose-400" />
            Phong cách hình ảnh nghệ thuật
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStyle(st.id)}
                disabled={isRunning}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                  style === st.id
                    ? 'bg-gradient-to-r from-amber-500/10 to-rose-500/10 border-amber-500/60 ring-1 ring-amber-500/40 text-white'
                    : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <span className="text-lg">{st.emoji}</span>
                <span className="text-xs font-medium leading-tight">{st.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Accordion Toggle */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{showAdvanced ? 'Ẩn cài đặt nâng cao' : 'Hiện cài đặt động cơ AI (LLM, Motion, Lip-Sync)'}</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadeIn">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Nhà cung cấp LLM
                </label>
                <select
                  value={llm}
                  onChange={(e) => setLlm(e.target.value)}
                  disabled={isRunning}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
                >
                  <option value="gemini">Google Gemini (Nhanh nhất)</option>
                  <option value="groq">Groq Cloud (Llama 3.3)</option>
                  <option value="ollama">Ollama (Offline 100%)</option>
                  <option value="openai">OpenAI ChatGPT</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Chuyển động (Motion)
                </label>
                <select
                  value={motion}
                  onChange={(e) => setMotion(e.target.value)}
                  disabled={isRunning}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
                >
                  <option value="vfx">Cinematic VFX (Khuyên dùng - Free)</option>
                  <option value="kenburns">Ken Burns Zoom/Pan (Free)</option>
                  <option value="replicate">Replicate AI Video (I2V Cloud)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Cử động môi (Lip-Sync)
                </label>
                <select
                  value={lipSync}
                  onChange={(e) => setLipSync(e.target.value)}
                  disabled={isRunning}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white"
                >
                  <option value="none">Tắt (Mặc định)</option>
                  <option value="cloud">Bật Cloud Lip-Sync (SadTalker)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isRunning || !topic.trim()}
            className="w-full py-4 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isRunning ? 'HỆ THỐNG ĐANG SẢN XUẤT PHIM...' : 'BẮT ĐẦU SẢN XUẤT PHIM'}</span>
          </button>
        </div>
      </div>
    </form>
  )
}
