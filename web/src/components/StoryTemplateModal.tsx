import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, Search, Check, Users, Ratio, Music, Film, BookOpen, ArrowRight, Loader2 } from 'lucide-react'
import { useStoryTemplates } from '../api/queries'
import type { StoryTemplate } from '../types'

export interface StoryTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTemplate: (template: StoryTemplate) => void
  currentTemplateId?: string
}

export default function StoryTemplateModal({
  isOpen,
  onClose,
  onSelectTemplate,
  currentTemplateId,
}: StoryTemplateModalProps) {
  const { data: templates = [], isLoading } = useStoryTemplates()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const categories = useMemo(() => {
    const set = new Set<string>()
    templates.forEach((t) => {
      if (t.category) set.add(t.category)
    })
    return ['all', ...Array.from(set)]
  }, [templates])

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchCat = selectedCategory === 'all' || t.category === selectedCategory
      const matchSearch =
        !searchQuery.trim() ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.default_topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase())
      return matchCat && matchSearch
    })
  }, [templates, selectedCategory, searchQuery])

  const activeTemplate = useMemo(() => {
    if (!activePreviewId && filteredTemplates.length > 0) {
      return (
        filteredTemplates.find((t) => t.id === currentTemplateId) ||
        filteredTemplates[0]
      )
    }
    return filteredTemplates.find((t) => t.id === activePreviewId) || filteredTemplates[0] || null
  }, [filteredTemplates, activePreviewId, currentTemplateId])

  const handleApply = (tmpl: StoryTemplate) => {
    onSelectTemplate(tmpl)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm cursor-pointer"
      >
        <motion.div
          initial={{ scale: 0.98, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl bg-cinema-deck border border-cinema-border shadow-2xl text-left cursor-default overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-cinema-border bg-cinema-deck/90 backdrop-blur-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cinema-amber/15 border border-cinema-amber/30 text-cinema-amber flex items-center justify-center font-bold shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-zinc-100">Thư Viện Kịch Bản & Cốt Truyện Điện Ảnh Mẫu</h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-cinema-amber/10 border border-cinema-amber/30 text-cinema-amber font-semibold">
                    {templates.length} Thể loại
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  1-Click nạp sẵn cốt truyện kinh điển, dàn nhân vật có sẵn Visual DNA, góc quay và cấu trúc 3 hồi chuẩn điện ảnh
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search & Category Tabs */}
          <div className="px-6 py-3 border-b border-cinema-border bg-cinema-card/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* Category Pill Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-cinema-amber text-black font-bold shadow-sm'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700/80 border border-zinc-700/60'
                  }`}
                >
                  {cat === 'all' ? '🎬 Tất cả thể loại' : cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Tìm kịch bản, nhân vật..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cinema-amber transition-colors"
              />
            </div>
          </div>

          {/* Main 2-Column Content */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
            {/* Left Column: Template Cards List (7 cols) */}
            <div className="lg:col-span-7 overflow-y-auto p-5 border-r border-cinema-border space-y-3.5">
              {isLoading ? (
                <div className="py-24 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-cinema-amber" />
                  <span className="text-xs font-medium">Đang tải danh mục kịch bản mẫu...</span>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="py-24 text-center text-zinc-500">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">Không tìm thấy thể loại phù hợp</p>
                  <p className="text-xs mt-1 text-zinc-600">Hãy thử từ khóa tìm kiếm khác hoặc chọn "Tất cả thể loại"</p>
                </div>
              ) : (
                filteredTemplates.map((tmpl) => {
                  const isCurrent = currentTemplateId === tmpl.id
                  const isPreviewing = activeTemplate?.id === tmpl.id

                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setActivePreviewId(tmpl.id)}
                      className={`group relative p-4 rounded-xl border transition-all cursor-pointer text-left ${
                        isPreviewing
                          ? 'bg-zinc-800/90 border-cinema-amber shadow-md ring-1 ring-cinema-amber/40'
                          : 'bg-zinc-900/70 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <span className="text-2xl p-2 rounded-xl bg-zinc-800 border border-zinc-700/80 shadow-sm shrink-0">
                            {tmpl.icon || '🎬'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h4 className="text-sm font-bold text-zinc-100 group-hover:text-cinema-amber transition-colors break-words">
                                {tmpl.name}
                              </h4>
                              {isCurrent && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
                                  <Check className="w-2.5 h-2.5" /> Đang dùng
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono text-zinc-400 mt-0.5 block line-clamp-1" title={tmpl.tagline}>
                              {tmpl.tagline}
                            </span>
                          </div>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                            {tmpl.aspect_ratio || '16:9'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-cinema-amber/10 text-cinema-amber border border-cinema-amber/20">
                            {tmpl.style}
                          </span>
                        </div>
                      </div>

                      {/* Snippet */}
                      <p className="text-xs text-zinc-300 mt-2.5 line-clamp-2 leading-relaxed bg-black/30 p-2.5 rounded-lg border border-zinc-800/60 font-sans">
                        {tmpl.default_topic}
                      </p>

                      {/* Footer tags */}
                      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-800/60 pt-2.5">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3 h-3 text-cinema-amber" />
                            {Object.keys(tmpl.characters || {}).length} Nhân vật Visual DNA
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Music className="w-3 h-3 text-purple-400" />
                            Mood: {tmpl.recommended_mood}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleApply(tmpl)
                          }}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cinema-amber/15 hover:bg-cinema-amber text-cinema-amber hover:text-black border border-cinema-amber/30 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>Áp dụng</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Right Column: Detailed Preview (5 cols) */}
            <div className="lg:col-span-5 overflow-y-auto p-5 bg-zinc-950/40 flex flex-col justify-between">
              {activeTemplate ? (
                <div className="space-y-4">
                  {/* Title & Tagline Banner */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-cinema-amber/10 via-zinc-900 to-zinc-950 border border-cinema-amber/30 shadow-inner">
                    <div className="flex items-center gap-2 text-cinema-amber font-mono text-xs font-bold uppercase tracking-wider">
                      <Film className="w-4 h-4" />
                      <span>{activeTemplate.category}</span>
                    </div>
                    <h3 className="text-lg font-black text-white mt-1 flex items-center gap-2">
                      <span>{activeTemplate.icon}</span>
                      <span>{activeTemplate.name}</span>
                    </h3>
                    <p className="text-xs text-cinema-amber/90 italic mt-1 font-serif">
                      "{activeTemplate.tagline}"
                    </p>
                  </div>

                  {/* Synopsis / Default Topic */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-cinema-amber" />
                      <span>Cốt Truyện Gợi Ý Khởi Điểm</span>
                    </h4>
                    <div className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 leading-relaxed font-sans">
                      {activeTemplate.default_topic}
                    </div>
                  </div>

                  {/* Cinematic Directives / Blueprint */}
                  {activeTemplate.genre_blueprint && (
                    <div>
                      <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Chỉ Dẫn Góc Máy & Nghệ Thuật Điện Ảnh</span>
                      </h4>
                      <p className="text-[11px] text-zinc-400 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 leading-relaxed">
                        {activeTemplate.genre_blueprint}
                      </p>
                    </div>
                  )}

                  {/* Predefined Characters & Visual DNA */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Dàn Nhân Vật & Visual Anchor DNA ({Object.keys(activeTemplate.characters || {}).length})</span>
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(activeTemplate.characters || {}).map(([cId, char]) => (
                        <div
                          key={cId}
                          className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-left"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              {char.name}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                              🎙️ {char.voice}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed font-mono line-clamp-3">
                            <span className="text-cinema-amber font-semibold">DNA:</span> {char.visual_anchor}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Technical Specs */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase block font-mono">Khung hình</span>
                      <span className="font-bold text-zinc-200 inline-flex items-center gap-1 mt-0.5">
                        <Ratio className="w-3 h-3 text-cinema-amber" />
                        {activeTemplate.aspect_ratio}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 uppercase block font-mono">Nhạc nền & Mood</span>
                      <span className="font-bold text-zinc-200 inline-flex items-center gap-1 mt-0.5">
                        <Music className="w-3 h-3 text-purple-400" />
                        {activeTemplate.recommended_mood}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="m-auto text-center text-zinc-500 py-12">
                  <p className="text-xs">Chọn một kịch bản bên trái để xem trước chi tiết</p>
                </div>
              )}

              {/* Action Button */}
              {activeTemplate && (
                <div className="pt-4 border-t border-cinema-border mt-4">
                  <button
                    type="button"
                    onClick={() => handleApply(activeTemplate)}
                    className="w-full py-3 px-4 rounded-xl text-sm font-bold bg-gradient-to-r from-cinema-amber to-amber-500 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Áp Dụng Template "{activeTemplate.name}"</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
