import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Volume2,
  Play,
  Square,
  Sparkles,
  Search,
  Check,
  Trash2,
  Loader2,
  Clock,
  Radio,
  Sliders,
  Flame,
  CloudRain,
  Skull,
  Zap,
  Building2,
} from 'lucide-react'
import { Shot, SfxCatalogItem } from '../types'
import { useSfxCatalog, useSuggestSfx } from '../api/queries'

interface SFXSoundboardModalProps {
  isOpen: boolean
  onClose: () => void
  shot: Shot | null
  genre?: string
  onSaveSfx: (shotId: string, sfxId: string | null, volume: number, offsetMs: number) => void
}

const CATEGORY_TABS = [
  { id: 'all', label: 'Tất cả', icon: Radio },
  { id: 'action', label: 'Hành động', icon: Flame },
  { id: 'nature', label: 'Môi trường', icon: CloudRain },
  { id: 'horror', label: 'Kinh dị & Hồi hộp', icon: Skull },
  { id: 'scifi', label: 'Viễn tưởng Sci-Fi', icon: Zap },
  { id: 'urban', label: 'Đời thường', icon: Building2 },
]

export const SFXSoundboardModal: React.FC<SFXSoundboardModalProps> = ({
  isOpen,
  onClose,
  shot,
  genre = '',
  onSaveSfx,
}) => {
  const { data: catalog = [], isLoading: isCatalogLoading } = useSfxCatalog()
  const suggestMutation = useSuggestSfx()

  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedSfxId, setSelectedSfxId] = useState<string | null>(null)
  const [volume, setVolume] = useState<number>(1.0)
  const [offsetMs, setOffsetMs] = useState<number>(0)
  const [playingSfxId, setPlayingSfxId] = useState<string | null>(null)
  const [aiReasoning, setAiReasoning] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Sync state when shot changes
  useEffect(() => {
    if (shot) {
      setSelectedSfxId(shot.sfx || null)
      setVolume(shot.sfx_volume ?? 1.0)
      setOffsetMs(shot.sfx_offset_ms ?? 0)
      setAiReasoning(null)
    }
  }, [shot])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Stop audio on close
  useEffect(() => {
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setPlayingSfxId(null)
    }
  }, [isOpen])

  if (!isOpen || !shot) return null

  const handlePlayToggle = (item: SfxCatalogItem, e?: React.MouseEvent) => {
    e?.stopPropagation()

    if (playingSfxId === item.id) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setPlayingSfxId(null)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
    }

    const audio = new Audio(item.stream_url)
    audio.volume = Math.min(1.0, Math.max(0.0, volume))
    audio.onended = () => {
      setPlayingSfxId(null)
    }
    audio.onerror = () => {
      setPlayingSfxId(null)
    }

    audio.play().catch(() => setPlayingSfxId(null))
    audioRef.current = audio
    setPlayingSfxId(item.id)
  }

  const handleSelectSfx = (item: SfxCatalogItem) => {
    setSelectedSfxId(item.id)
    if (!shot.sfx || shot.sfx !== item.id) {
      setVolume(item.default_volume || 1.0)
      setOffsetMs(item.default_offset_ms || 0)
    }
  }

  const handleAiSuggest = async () => {
    if (!shot) return
    try {
      const res = await suggestMutation.mutateAsync({
        prompt: shot.image_prompt || shot.visual_description || '',
        dialogue: shot.dialogue || '',
        genre: genre,
      })
      if (res && res.sfx_id) {
        setSelectedSfxId(res.sfx_id)
        setVolume(res.volume || 1.0)
        setOffsetMs(res.offset_ms || 0)
        setAiReasoning(res.reasoning)

        // Find item and play
        const item = catalog.find((i) => i.id === res.sfx_id)
        if (item) {
          handlePlayToggle(item)
        }
      }
    } catch (e) {
      console.error('Failed to suggest SFX', e)
    }
  }

  const handleSave = () => {
    if (!shot) return
    onSaveSfx(shot.id, selectedSfxId, volume, offsetMs)
    onClose()
  }

  const handleRemoveSfx = () => {
    if (!shot) return
    onSaveSfx(shot.id, null, 1.0, 0)
    onClose()
  }

  const filteredCatalog = catalog.filter((item) => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory
    const query = searchQuery.trim().toLowerCase()
    if (!query) return matchesCat

    const matchesQuery =
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.tags?.some((t) => t.toLowerCase().includes(query))

    return matchesCat && matchesQuery
  })

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 cursor-pointer">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 cursor-default">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400">
              <Volume2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                AI Foley & Sound Effects (SFX) Studio
              </h2>
              <p className="text-xs text-slate-400">
                Gắn tiếng động môi trường & hiệu ứng âm thanh điện ảnh cho Phân cảnh #{shot.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Đóng cửa sổ"
            aria-label="Đóng"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shot Context Strip */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
          <div className="flex-1 min-w-[280px]">
            <span className="text-slate-400 font-medium">Bối cảnh phân cảnh: </span>
            <span className="text-slate-200 italic line-clamp-1">
              "{shot.image_prompt || shot.visual_description || shot.dialogue || 'Không có mô tả'}"
            </span>
          </div>
          <button
            onClick={handleAiSuggest}
            disabled={suggestMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium shadow-md shadow-violet-900/20 transition-all disabled:opacity-50"
          >
            {suggestMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            )}
            AI Gợi Ý Tiếng Động Phù Hợp
          </button>
        </div>

        {/* AI Reasoning Toast if any */}
        {aiReasoning && (
          <div className="px-6 py-2 bg-violet-950/50 border-b border-violet-800/40 text-xs text-violet-300 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{aiReasoning}</span>
          </div>
        )}

        {/* Category Tabs & Search Bar */}
        <div className="px-6 pt-3 pb-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800/60 shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeCategory === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Search */}
          <div className="relative min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm tiếng động..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Soundboard Grid (Scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 scrollbar-thin">
          {isCatalogLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
              <span className="text-xs">Đang tải thư viện âm thanh SFX...</span>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <p className="text-sm">Không tìm thấy hiệu ứng âm thanh nào phù hợp.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredCatalog.map((item) => {
                const isSelected = selectedSfxId === item.id
                const isPlaying = playingSfxId === item.id

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectSfx(item)}
                    className={`relative group p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-violet-950/40 border-violet-500 shadow-md shadow-violet-900/20'
                        : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800/80 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                          {item.name}
                        </span>
                        {isSelected && (
                          <div className="p-1 rounded-full bg-violet-600 text-white shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-auto">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700/40">
                        {item.category}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handlePlayToggle(item, e)}
                        className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-xs font-medium ${
                          isPlaying
                            ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                            : 'bg-slate-700/60 hover:bg-violet-600 hover:text-white border-slate-600/80 text-slate-200'
                        }`}
                        title={isPlaying ? 'Dừng phát' : 'Nghe thử'}
                      >
                        {isPlaying ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span className="text-[10px]">Đang phát</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" />
                            <span className="text-[10px]">Nghe thử</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sound Settings & Controls Strip (Sliders) */}
        {selectedSfxId && (
          <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs shrink-0">
            {/* Volume slider */}
            <div>
              <div className="flex items-center justify-between mb-1 text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <Sliders className="w-3.5 h-3.5 text-violet-400" />
                  Âm lượng SFX: {Math.round(volume * 100)}%
                </span>
                <span className="text-[10px] text-slate-400">Trần cân bằng loudness</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>

            {/* Timing offset slider */}
            <div>
              <div className="flex items-center justify-between mb-1 text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Thời điểm bắt đầu tiếng động: {(offsetMs / 1000).toFixed(1)}s
                </span>
                <span className="text-[10px] text-slate-400">Offset từ đầu shot</span>
              </div>
              <input
                type="range"
                min="0"
                max="5000"
                step="100"
                value={offsetMs}
                onChange={(e) => setOffsetMs(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            {shot.sfx && (
              <button
                type="button"
                onClick={handleRemoveSfx}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Gỡ bỏ SFX phân cảnh này
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs shadow-lg shadow-violet-900/30 transition-all"
            >
              <Check className="w-4 h-4" />
              Lưu & Áp Dụng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
export default SFXSoundboardModal
