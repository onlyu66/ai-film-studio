import React, { useState } from 'react'
import { Users, Film, PlayCircle, Eye, Volume2, Video } from 'lucide-react'

export default function StoryboardView({ storyboard }) {
  const [activeTab, setActiveTab] = useState('shots')

  if (!storyboard || (!storyboard.shots?.length && !Object.keys(storyboard.characters || {}).length)) {
    return (
      <div className="bg-[#0F1626]/80 border border-slate-800 rounded-2xl p-8 text-center backdrop-blur-sm">
        <Film className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-300">Chưa có Kịch bản & Phân cảnh</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Khi bấm khởi tạo dự án, toàn bộ hệ thống nhân vật và danh sách phân cảnh (Storyboard) chi tiết sẽ tự động hiển thị tại đây.
        </p>
      </div>
    )
  }

  const characters = storyboard.characters || {}
  const shots = storyboard.shots || []

  return (
    <div className="bg-[#0F1626]/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>{storyboard.title || 'Kịch bản Phim'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
              {shots.length} phân cảnh
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Ngôn ngữ: {storyboard.language?.toUpperCase() || 'VI'}</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('shots')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'shots'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Phân cảnh ({shots.length})
          </button>
          <button
            onClick={() => setActiveTab('characters')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'characters'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Nhân vật ({Object.keys(characters).length})
          </button>
        </div>
      </div>

      {/* Characters Tab */}
      {activeTab === 'characters' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(characters).map(([id, char]) => (
            <div
              key={id}
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-amber-400">{char.name}</h4>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  Seed: {char.seed}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                <span className="font-semibold text-slate-400">Visual DNA: </span>
                {typeof char.visual_anchor === 'string'
                  ? char.visual_anchor
                  : JSON.stringify(char.visual_anchor)}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                <Volume2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span className="truncate">Giọng: {char.voice}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shots Tab */}
      {activeTab === 'shots' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shots.map((shot) => {
            const imgSrc = `/api/outputs/images/${shot.id}.png`
            const vidSrc = `/api/outputs/videos/${shot.id}.mp4`

            return (
              <div
                key={shot.id}
                className="group rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden hover:border-amber-500/40 transition-all flex flex-col"
              >
                {/* Visual Thumbnail */}
                <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                  <img
                    src={imgSrc}
                    alt={shot.id}
                    onError={(e) => {
                      e.target.onerror = null
                      e.target.style.display = 'none'
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-white font-bold">
                    {shot.id}
                  </div>
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-amber-500/80 backdrop-blur-sm text-[10px] text-slate-950 font-bold uppercase">
                    {shot.motion || 'zoom_in'}
                  </div>
                </div>

                {/* Content */}
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    {shot.character_id && (
                      <span className="inline-block text-[11px] font-bold text-amber-400 mb-1">
                        👤 {characters[shot.character_id]?.name || shot.character_id}
                      </span>
                    )}
                    <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                      {shot.dialogue ? `"${shot.dialogue}"` : <span className="text-slate-500 italic">(Cảnh quay tư liệu / âm nhạc)</span>}
                    </p>
                  </div>

                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-2 pt-2 border-t border-slate-800/80">
                    {typeof shot.image_prompt === 'string' ? shot.image_prompt : JSON.stringify(shot.image_prompt)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
