import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Languages,
  CheckCircle2,
  Loader2,
  FileText,
  Sparkles,
  Play,
  Pause,
} from 'lucide-react'
import { useCreateDubbing, useVoiceList } from '../api/queries'
import type { DubbingResultResponse } from '../types'

export interface DubbingModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  characters?: Record<string, any>
}

const SUPPORTED_DUB_LANGS = [
  { code: 'en', name: 'English (Tiếng Anh)', flag: '🇺🇸' },
  { code: 'ja', name: 'Japanese (Tiếng Nhật)', flag: '🇯🇵' },
  { code: 'vi', name: 'Vietnamese (Tiếng Việt)', flag: '🇻🇳' },
  { code: 'fr', name: 'French (Tiếng Pháp)', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish (Tây Ban Nha)', flag: '🇪🇸' },
  { code: 'zh', name: 'Chinese (Tiếng Trung)', flag: '🇨🇳' },
  { code: 'ko', name: 'Korean (Tiếng Hàn)', flag: '🇰🇷' },
  { code: 'de', name: 'German (Tiếng Đức)', flag: '🇩🇪' },
]

export default function DubbingModal({
  isOpen,
  onClose,
  projectId,
  characters = {},
}: DubbingModalProps) {
  const [targetLang, setTargetLang] = useState('en')
  const [voiceMapping, setVoiceMapping] = useState<Record<string, string>>({})
  const [dubResult, setDubResult] = useState<DubbingResultResponse | null>(null)
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const { data: voices = [] } = useVoiceList()
  const dubbingMutation = useCreateDubbing()

  if (!isOpen) return null

  const handleVoiceChange = (charId: string, voiceId: string) => {
    setVoiceMapping((prev) => ({ ...prev, [charId]: voiceId }))
  }

  const handleStartDubbing = () => {
    dubbingMutation.mutate(
      {
        project_id: projectId,
        target_lang: targetLang,
        voice_mapping: voiceMapping,
      },
      {
        onSuccess: (data) => {
          setDubResult(data)
        },
        onError: (err: any) => {
          alert(`Lỗi lồng tiếng: ${err?.message || 'Không thể xử lý'}`)
        },
      }
    )
  }

  const handleTogglePlayAudio = (url: string) => {
    if (playingAudioUrl === url) {
      if (audioElement) {
        audioElement.pause()
        setAudioElement(null)
      }
      setPlayingAudioUrl(null)
      return
    }

    if (audioElement) {
      audioElement.pause()
    }

    const audio = new Audio(url)
    audio.play().catch(() => setPlayingAudioUrl(null))
    audio.onended = () => {
      setPlayingAudioUrl(null)
      setAudioElement(null)
    }
    setAudioElement(audio)
    setPlayingAudioUrl(url)
  }

  const filteredVoices = voices.filter(
    (v) => v.lang === targetLang || v.provider === 'elevenlabs' || v.provider === 'local'
  )

  return (
    <AnimatePresence>
      <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-fadeIn cursor-pointer">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-cinema-deck border border-cinema-border rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] cursor-default"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-cinema-card border-b border-cinema-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                <Languages className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <span>Xưởng Lồng Tiếng Đa Ngôn Ngữ (Dubbing Studio)</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Dịch thoại điện ảnh bằng LLM & tạo phiên bản lồng tiếng chuẩn xác
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              title="Đóng cửa sổ"
              aria-label="Đóng"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
            {/* 1. Target Language */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Ngôn Ngữ Lồng Tiếng Mục Tiêu
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SUPPORTED_DUB_LANGS.map((item) => {
                  const isActive = targetLang === item.code
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setTargetLang(item.code)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isActive
                          ? 'bg-cyan-500/15 border-cyan-500/60 shadow-sm text-cyan-200'
                          : 'bg-studio-card/50 border-studio-border/60 hover:bg-studio-card text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="text-base mb-1">{item.flag}</div>
                      <div className="text-xs font-bold truncate">{item.name}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Character Voice Mapping */}
            {Object.keys(characters).length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Gán Giọng Cho Nhân Vật ({targetLang.toUpperCase()})</span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {Object.keys(characters).length} nhân vật
                  </span>
                </label>

                <div className="space-y-2">
                  {Object.entries(characters).map(([charId, char]) => (
                    <div
                      key={charId}
                      className="p-3 rounded-xl bg-studio-deck border border-studio-border flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-200 truncate">{char.name}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{char.visual_anchor}</div>
                      </div>

                      <select
                        value={voiceMapping[charId] || ''}
                        onChange={(e) => handleVoiceChange(charId, e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-cinema-card border border-cinema-border text-xs text-zinc-100 focus:outline-none focus:border-cyan-400 font-medium max-w-[220px]"
                      >
                        <option value="">Giọng mặc định ({targetLang.toUpperCase()})</option>
                        {filteredVoices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.provider.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Dubbing Results */}
            {dubResult && (
              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 space-y-3">
                <div className="flex items-center gap-2 text-cyan-300 text-sm font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Lồng tiếng thành công sang {dubResult.language_name}!</span>
                </div>

                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                  {dubResult.translated_shots.map((shot, idx) => (
                    <div
                      key={shot.shot_id}
                      className="p-2.5 rounded-xl bg-black/40 border border-cyan-500/20 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-mono text-zinc-400">Shot #{idx + 1}</div>
                        <div className="text-zinc-200 font-medium line-clamp-1">{shot.translated_text}</div>
                        <div className="text-[10px] text-zinc-500 line-clamp-1 italic">Gốc: {shot.original_text}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTogglePlayAudio(`/api/outputs/${shot.audio_file.replace(/^outputs\//, '')}`)}
                        className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-zinc-950 flex items-center justify-center transition-colors shrink-0"
                      >
                        {playingAudioUrl?.includes(shot.shot_id) ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                {dubResult.subtitle_path && (
                  <div className="pt-2 flex justify-end">
                    <a
                      href={`/api/outputs/${dubResult.subtitle_path.replace(/^outputs\//, '')}`}
                      download
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Tải Phụ Đề Lồng Tiếng (.srt)</span>
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-cinema-card border-t border-cinema-border flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleStartDubbing}
              disabled={dubbingMutation.isPending}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-zinc-950 shadow-lg shadow-cyan-500/20 transition-all hover:scale-102 disabled:opacity-50 cursor-pointer"
            >
              {dubbingMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang Dịch & Lồng Tiếng...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Tiến Hành Lồng Tiếng</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
