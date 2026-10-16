import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, Volume2, Search, X, Maximize2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import type { StoryboardData } from '../types'

interface CharacterData {
  name?: string
  visual_anchor?: string | Record<string, unknown>
  voice?: string
  seed?: number | string
  [key: string]: unknown
}

interface ShotData {
  id: string
  character_id?: string
  dialogue?: string
  image_prompt?: string
  motion?: string
  chapter?: number | string
  [key: string]: unknown
}

export interface StoryboardViewProps {
  storyboard: StoryboardData | null
}

export default function StoryboardView({ storyboard }: StoryboardViewProps) {
  const [activeTab, setActiveTab] = useState<'shots' | 'characters'>('shots')
  const [searchQuery, setSearchQuery] = useState('')
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const rawCharacters = (storyboard?.characters || {}) as Record<string, CharacterData>
  const rawShots = (storyboard?.shots || []) as ShotData[]

  if (!storyboard || (!rawShots.length && !Object.keys(rawCharacters).length)) {
    return (
      <Card className="border-slate-800/80 bg-[#0A0E1A]/80 p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-600 shadow-inner">
          <Film className="w-8 h-8" />
        </div>
        <h3 className="text-base font-bold text-slate-300">Chưa có Kịch bản & Phân cảnh</h3>
        <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
          Toàn bộ danh sách nhân vật, mô tả Visual DNA và bảng phân cảnh 35mm sẽ xuất hiện tại đây ngay khi bạn bấm sản xuất phim.
        </p>
      </Card>
    )
  }

  const characters = rawCharacters
  const shots = rawShots

  const filteredShots = shots.filter((s) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      s.id.toLowerCase().includes(q) ||
      (s.dialogue && s.dialogue.toLowerCase().includes(q)) ||
      (s.image_prompt && s.image_prompt.toLowerCase().includes(q))
    )
  })

  return (
    <Card className="border-slate-800/80 bg-gradient-to-b from-[#0F1628]/95 to-[#090D18]/95 shadow-2xl">
      <CardHeader className="pb-4 border-b border-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="default" className="text-[10px] font-mono uppercase">
                {storyboard.language?.toUpperCase() || 'VI'} CINEMA
              </Badge>
              <span className="text-xs text-slate-500 font-mono">#{shots.length} SHOTS TOTAL</span>
            </div>
            <CardTitle className="text-lg font-black text-white flex items-center gap-2.5">
              <span>{storyboard.title || 'Kịch bản Sản Xuất Phim'}</span>
            </CardTitle>
          </div>

          {/* Controls: Search & Tabs */}
          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === 'shots' && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm phân cảnh..."
                  className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50 w-44 sm:w-56"
                />
              </div>
            )}

            <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-slate-800/80">
              <button
                type="button"
                onClick={() => setActiveTab('shots')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'shots'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Phân cảnh ({shots.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('characters')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'characters'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Diễn viên ({Object.keys(characters).length})
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* Characters Tab */}
        {activeTab === 'characters' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(characters).map(([id, char]) => (
              <motion.div
                key={id}
                whileHover={{ y: -3 }}
                className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/90 hover:border-amber-500/50 transition-all flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-inner">
                      👤
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-white">{char.name}</h4>
                      <span className="text-[10px] font-mono text-amber-400/80">ID: {id}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Visual DNA Anchor:
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed font-normal">
                      {typeof char.visual_anchor === 'string'
                        ? char.visual_anchor
                        : JSON.stringify(char.visual_anchor)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <Volume2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="truncate">{char.voice}</span>
                  </div>
                  <span className="font-mono text-slate-500 text-[10px]">Seed: {String(char.seed ?? '')}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Shots Tab */}
        {activeTab === 'shots' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredShots.map((shot) => {
              const imgSrc = `/api/outputs/images/${shot.id}.png`

              return (
                <motion.div
                  key={shot.id}
                  whileHover={{ y: -3 }}
                  className="group rounded-2xl bg-[#090D18] border border-slate-800/80 overflow-hidden hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition-all flex flex-col"
                >
                  {/* Thumbnail / Lightbox click */}
                  <div
                    onClick={() => setLightboxImage(imgSrc)}
                    className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                    <img
                      src={imgSrc}
                      alt={shot.id}
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        const target = e.currentTarget
                        target.style.display = 'none'
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Film grain overlay & badges */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-70 group-hover:opacity-40 transition-opacity" />

                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono text-amber-400 font-extrabold border border-white/10">
                      {shot.id}
                    </div>

                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider shadow">
                      {shot.motion || 'zoom_in'}
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-[2px]">
                      <div className="px-3 py-1.5 rounded-lg bg-black/80 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg border border-white/20">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Xem ảnh HD</span>
                      </div>
                    </div>
                  </div>

                  {/* Shot details */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      {shot.character_id && (
                        <div className="text-[11px] font-bold text-amber-400 mb-1 flex items-center gap-1">
                          <span>👤</span>
                          <span className="truncate">{characters[shot.character_id]?.name || shot.character_id}</span>
                        </div>
                      )}
                      <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed font-medium">
                        {shot.dialogue ? `"${shot.dialogue}"` : <span className="text-slate-500 italic">(Cảnh quay tĩnh tư liệu & âm nhạc)</span>}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                      <span className="truncate max-w-[150px]">{shot.image_prompt}</span>
                      <span className="font-mono">Ch. {shot.chapter || 1}</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxImage(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={lightboxImage} alt="Expanded" className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/70 hover:bg-black text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
