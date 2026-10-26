import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, Volume2, Search, X, Maximize2, Loader2, Check, Edit3, Save, Sparkles, Upload, Play, Plus, Trash2, ArrowUp, ArrowDown, Music } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { CustomSelect } from './ui/select'
import {
  useUpdateCharacterVoice,
  useUpdateShot,
  usePreviewVoice,
  useRerollShot,
  useUploadShotImage,
  useAddShot,
  useDeleteShot,
  useReorderShots,
} from '../api/queries'
import type { StoryboardData, SelectOption } from '../types'

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
  sfx?: string
  [key: string]: unknown
}

export interface StoryboardViewProps {
  storyboard: StoryboardData | null
}

const MOTION_OPTIONS: SelectOption[] = [
  { value: 'zoom_in', label: 'Zoom In (Tiến tới)', subtext: 'Camera phóng to dần vào cận cảnh', icon: '🔍' },
  { value: 'zoom_out', label: 'Zoom Out (Lùi xa)', subtext: 'Camera lùi dần tạo cảm giác bao quát', icon: '🔭' },
  { value: 'pan_left', label: 'Pan Left (Lia trái)', subtext: 'Ống kính lia ngang mượt mà sang trái', icon: '⬅️' },
  { value: 'pan_right', label: 'Pan Right (Lia phải)', subtext: 'Ống kính lia ngang mượt mà sang phải', icon: '➡️' },
]

const VOICE_OPTIONS_BY_LANG: Record<string, SelectOption[]> = {
  vi: [
    { value: 'vi-VN-NamMinhNeural', label: 'Nam Minh (Giọng Nam)', subtext: 'Trầm ấm, hào hùng, điện ảnh', icon: '👨' },
    { value: 'vi-VN-HoaiMyNeural', label: 'Hoài My (Giọng Nữ)', subtext: 'Ngọt ngào, trong trẻo, truyền cảm', icon: '👩' },
  ],
  en: [
    { value: 'en-US-GuyNeural', label: 'Guy (Giọng Nam)', subtext: 'Deep cinematic documentary narrator', icon: '👨' },
    { value: 'en-US-ChristopherNeural', label: 'Christopher (Giọng Nam)', subtext: 'Authoritative, clear American male', icon: '👨' },
    { value: 'en-US-JennyNeural', label: 'Jenny (Giọng Nữ)', subtext: 'Natural, warm expressive female', icon: '👩' },
    { value: 'en-US-AriaNeural', label: 'Aria (Giọng Nữ)', subtext: 'Dramatic, vivid storytelling female', icon: '👩' },
  ],
  ja: [
    { value: 'ja-JP-KeitaNeural', label: 'Keita (Giọng Nam)', subtext: 'Shonen & Studio anime male', icon: '👨' },
    { value: 'ja-JP-NanamiNeural', label: 'Nanami (Giọng Nữ)', subtext: 'Gentle, expressive anime female', icon: '👩' },
  ],
  fr: [
    { value: 'fr-FR-HenriNeural', label: 'Henri (Giọng Nam)', subtext: 'Classic French cinema male', icon: '👨' },
    { value: 'fr-FR-DeniseNeural', label: 'Denise (Giọng Nữ)', subtext: 'Poetic French narrative female', icon: '👩' },
  ],
}

export default function StoryboardView({ storyboard }: StoryboardViewProps) {
  const [activeTab, setActiveTab] = useState<'shots' | 'characters'>('shots')
  const [searchQuery, setSearchQuery] = useState('')
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [savingCharId, setSavingCharId] = useState<string | null>(null)
  const [savedCharId, setSavedCharId] = useState<string | null>(null)

  // Shot editing state
  const [editingShot, setEditingShot] = useState<ShotData | null>(null)
  const [editDialogue, setEditDialogue] = useState('')
  const [editPrompt, setEditPrompt] = useState('')
  const [editMotion, setEditMotion] = useState('zoom_in')

  const [playingVoice, setPlayingVoice] = useState<string | null>(null)
  const [rerollingShotId, setRerollingShotId] = useState<string | null>(null)
  const [uploadingShotId, setUploadingShotId] = useState<string | null>(null)
  const [cacheBuster, setCacheBuster] = useState<Record<string, number>>({})

  // Add Shot modal state
  const [isAddingShot, setIsAddingShot] = useState(false)
  const [newShotDialogue, setNewShotDialogue] = useState('')
  const [newShotPrompt, setNewShotPrompt] = useState('')
  const [newShotMotion, setNewShotMotion] = useState('zoom_in')
  const [newShotSfx, setNewShotSfx] = useState('')
  const [newShotChar, setNewShotChar] = useState('')

  const updateVoiceMutation = useUpdateCharacterVoice()
  const updateShotMutation = useUpdateShot()
  const previewVoiceMutation = usePreviewVoice()
  const rerollShotMutation = useRerollShot()
  const uploadShotImageMutation = useUploadShotImage()
  const addShotMutation = useAddShot()
  const deleteShotMutation = useDeleteShot()
  const reorderShotsMutation = useReorderShots()

  const handlePlayVoice = (voice: string) => {
    setPlayingVoice(voice)
    previewVoiceMutation.mutate(
      { voice },
      {
        onSuccess: (data) => {
          const audio = new Audio(data.audio_url)
          audio.onended = () => setPlayingVoice(null)
          audio.onerror = () => setPlayingVoice(null)
          audio.play().catch(() => setPlayingVoice(null))
        },
        onError: () => setPlayingVoice(null),
      }
    )
  }

  const handleRerollShot = (shotId: string) => {
    setRerollingShotId(shotId)
    rerollShotMutation.mutate(shotId, {
      onSettled: () => {
        setRerollingShotId(null)
        setCacheBuster((prev) => ({ ...prev, [shotId]: Date.now() }))
      },
      onError: (err: any) => {
        alert(err.message || 'Lỗi khi tạo lại ảnh cho phân cảnh')
      },
    })
  }

  const handleUploadImage = (shotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    setUploadingShotId(shotId)
    reader.onload = () => {
      const base64 = reader.result as string
      uploadShotImageMutation.mutate(
        { shotId, imageBase64: base64 },
        {
          onSettled: () => {
            setUploadingShotId(null)
            setCacheBuster((prev) => ({ ...prev, [shotId]: Date.now() }))
          },
          onError: (err: any) => {
            alert(err.message || 'Lỗi khi tải ảnh lên')
          },
        }
      )
    }
    reader.readAsDataURL(file)
  }

  const handleDeleteShot = (shotId: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa phân cảnh ${shotId}?`)) return
    deleteShotMutation.mutate(shotId, {
      onError: (err: any) => alert(err.message || 'Lỗi khi xóa phân cảnh')
    })
  }

  const handleMoveShot = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= rawShots.length) return
    const newShots = [...rawShots]
    const temp = newShots[index]
    newShots[index] = newShots[targetIndex]
    newShots[targetIndex] = temp
    reorderShotsMutation.mutate(newShots.map(s => s.id))
  }

  const handleCreateShot = (e: React.FormEvent) => {
    e.preventDefault()
    addShotMutation.mutate(
      {
        dialogue: newShotDialogue,
        image_prompt: newShotPrompt,
        motion: newShotMotion,
        sfx: newShotSfx || undefined,
        character_id: newShotChar || undefined,
      },
      {
        onSuccess: () => {
          setIsAddingShot(false)
          setNewShotDialogue('')
          setNewShotPrompt('')
          setNewShotSfx('')
          setNewShotChar('')
        },
        onError: (err: any) => alert(err.message || 'Lỗi khi thêm phân cảnh'),
      }
    )
  }

  const rawCharacters = (storyboard?.characters || {}) as Record<string, CharacterData>
  const rawShots = (storyboard?.shots || []) as ShotData[]
  const currentLang = (storyboard?.language || 'vi').toLowerCase().split('-')[0]
  const currentVoiceOptions = VOICE_OPTIONS_BY_LANG[currentLang] || VOICE_OPTIONS_BY_LANG['vi']

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

  const handleVoiceChange = (charId: string, newVoice: string) => {
    setSavingCharId(charId)
    updateVoiceMutation.mutate(
      { characterId: charId, voice: newVoice },
      {
        onSuccess: () => {
          setSavingCharId(null)
          setSavedCharId(charId)
          setTimeout(() => setSavedCharId((prev) => (prev === charId ? null : prev)), 2500)
        },
        onError: (err) => {
          setSavingCharId(null)
          alert(err.message || 'Không thể cập nhật giọng cho nhân vật')
        },
      }
    )
  }

  const handleOpenEditShot = (shot: ShotData) => {
    setEditingShot(shot)
    setEditDialogue(shot.dialogue || '')
    setEditPrompt(shot.image_prompt || '')
    setEditMotion(shot.motion || 'zoom_in')
  }

  const handleSaveShot = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingShot) return
    updateShotMutation.mutate(
      {
        shot_id: editingShot.id,
        dialogue: editDialogue,
        image_prompt: editPrompt,
        motion: editMotion,
      },
      {
        onSuccess: () => {
          setEditingShot(null)
        },
        onError: (err) => {
          alert(err.message || 'Lỗi khi cập nhật phân cảnh')
        },
      }
    )
  }

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

          {/* Controls: Search, Add Shot & Tabs */}
          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === 'shots' && (
              <>
                <button
                  type="button"
                  onClick={() => setIsAddingShot(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm cảnh</span>
                </button>

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
              </>
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
            {Object.entries(characters).map(([id, char]) => {
              const currentVoice = char.voice || currentVoiceOptions[0]?.value || 'vi-VN-NamMinhNeural'

              return (
                <motion.div
                  key={id}
                  whileHover={{ y: -3 }}
                  className="p-5 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/90 hover:border-amber-500/50 transition-all flex flex-col justify-between shadow-lg"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-500/30 flex items-center justify-center text-xl shadow-inner">
                          {currentVoice.toLowerCase().includes('female') ||
                          currentVoice.toLowerCase().includes('hoaimy') ||
                          currentVoice.toLowerCase().includes('jenny') ||
                          currentVoice.toLowerCase().includes('aria') ||
                          currentVoice.toLowerCase().includes('nanami') ||
                          currentVoice.toLowerCase().includes('denise')
                            ? '👩'
                            : '👨'}
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-white">{char.name}</h4>
                          <span className="text-[10px] font-mono text-amber-400/80">ID: {id}</span>
                        </div>
                      </div>

                      <span className="font-mono text-slate-500 text-[10px]">Seed: {String(char.seed ?? '')}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/60 mb-4">
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

                  {/* Interactive Voice Customization */}
                  <div className="pt-3 border-t border-slate-800/60 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Giọng lồng tiếng (Voice)</span>
                      </label>
                      {savingCharId === id ? (
                        <span className="text-[10px] text-amber-400 flex items-center gap-1 font-mono font-bold">
                          <Loader2 className="w-3 h-3 animate-spin" /> Đang lưu...
                        </span>
                      ) : savedCharId === id ? (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono font-bold">
                          <Check className="w-3 h-3" /> Đã lưu
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <CustomSelect
                          value={currentVoice}
                          onChange={(newVoice) => handleVoiceChange(id, newVoice)}
                          options={currentVoiceOptions}
                          disabled={savingCharId === id}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePlayVoice(currentVoice)}
                        disabled={playingVoice === currentVoice || previewVoiceMutation.isPending}
                        className="p-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all flex items-center justify-center cursor-pointer shrink-0"
                        title="Nghe thử giọng này"
                      >
                        {playingVoice === currentVoice ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        ) : (
                          <Play className="w-4 h-4 text-indigo-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Shots Tab */}
        {activeTab === 'shots' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredShots.map((shot, index) => {
              const imgSrc = `/api/outputs/images/${shot.id}.png?t=${cacheBuster[shot.id] || ''}`

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
                      <div className="flex items-center justify-between gap-1 mb-2">
                        {shot.character_id ? (
                          <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1 min-w-0">
                            <span>👤</span>
                            <span className="truncate">{characters[shot.character_id]?.name || shot.character_id}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Cảnh quay chung</span>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveShot(index, 'up')}
                            disabled={index === 0}
                            className="p-1 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                            title="Di chuyển lên trước"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveShot(index, 'down')}
                            disabled={index === shots.length - 1}
                            className="p-1 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                            title="Di chuyển xuống sau"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRerollShot(shot.id)}
                            disabled={rerollingShotId === shot.id}
                            className="px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-rose-500 hover:text-white text-slate-300 text-[10px] font-bold flex items-center gap-1 transition-all border border-slate-700/80 cursor-pointer shadow-sm shrink-0"
                            title="Tạo lại ảnh ngẫu nhiên mới cho shot này"
                          >
                            {rerollingShotId === shot.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
                            ) : (
                              <Sparkles className="w-3 h-3 text-rose-400" />
                            )}
                            <span className="hidden sm:inline">Reroll</span>
                          </button>

                          <label
                            className="px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-cyan-500 hover:text-slate-950 text-slate-300 text-[10px] font-bold flex items-center gap-1 transition-all border border-slate-700/80 cursor-pointer shadow-sm shrink-0"
                            title="Tải ảnh riêng thay thế"
                          >
                            {uploadingShotId === shot.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                            ) : (
                              <Upload className="w-3 h-3 text-cyan-400" />
                            )}
                            <span className="hidden sm:inline">Upload</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleUploadImage(shot.id, e)}
                              disabled={uploadingShotId === shot.id}
                            />
                          </label>

                          <button
                            type="button"
                            onClick={() => handleOpenEditShot(shot)}
                            className="px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-[10px] font-bold flex items-center gap-1 transition-all border border-slate-700/80 cursor-pointer shadow-sm shrink-0"
                            title="Sửa lời thoại, visual prompt hoặc góc máy"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Sửa</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteShot(shot.id)}
                            className="p-1 rounded bg-slate-800/90 hover:bg-red-500 hover:text-white text-slate-400 text-[10px] cursor-pointer"
                            title="Xóa phân cảnh này"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-200 leading-relaxed font-medium">
                        {shot.dialogue ? `"${shot.dialogue}"` : <span className="text-slate-500 italic">(Cảnh quay tĩnh tư liệu & âm nhạc)</span>}
                      </p>

                      {shot.sfx && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-cyan-400 font-mono">
                          <Music className="w-2.5 h-2.5" />
                          <span>SFX: {shot.sfx}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                      <span className="line-clamp-2 leading-tight flex-1" title={shot.image_prompt}>
                        {shot.image_prompt}
                      </span>
                      <span className="font-mono flex-shrink-0">Ch. {shot.chapter || 1}</span>
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

      {/* Shot Edit Modal */}
      <AnimatePresence>
        {editingShot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !updateShotMutation.isPending && setEditingShot(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl rounded-2xl bg-gradient-to-b from-[#0F1628] to-[#0A0E1A] border border-amber-500/40 p-6 shadow-2xl text-left cursor-default overflow-hidden"
            >
              {/* Glow accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500" />

              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-xs font-black border border-amber-500/30">
                    {editingShot.id}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Chỉnh sửa phân cảnh</h3>
                    {editingShot.character_id && (
                      <span className="text-[11px] text-slate-400">
                        Nhân vật: <strong className="text-amber-400">{characters[editingShot.character_id]?.name || editingShot.character_id}</strong>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={updateShotMutation.isPending}
                  onClick={() => setEditingShot(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveShot} className="mt-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Lời thoại nhân vật (Dialogue):
                  </label>
                  <textarea
                    value={editDialogue}
                    onChange={(e) => setEditDialogue(e.target.value)}
                    rows={3}
                    placeholder="Nhập lời thoại của nhân vật trong phân cảnh này..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all font-sans leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    * Khi thay đổi lời thoại, hệ thống sẽ tự động tổng hợp lại giọng nói TTS cho phân cảnh này.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Mô tả hình ảnh điện ảnh (Flux Prompt):
                  </label>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={3}
                    placeholder="Prompt tạo hình ảnh (tiếng Anh hoặc tiếng Việt)..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/60 focus:border-amber-500/60 transition-all font-mono leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    * Khi thay đổi prompt, hình ảnh của phân cảnh này sẽ tự động được vẽ lại bằng Flux.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Góc máy & Chuyển động (Camera Motion):
                  </label>
                  <CustomSelect
                    value={editMotion}
                    onChange={setEditMotion}
                    options={MOTION_OPTIONS}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    disabled={updateShotMutation.isPending}
                    onClick={() => setEditingShot(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={updateShotMutation.isPending}
                    className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {updateShotMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Lưu Thay Đổi</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Shot Modal */}
      <AnimatePresence>
        {isAddingShot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !addShotMutation.isPending && setIsAddingShot(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl rounded-2xl bg-gradient-to-b from-[#0F1628] to-[#0A0E1A] border border-amber-500/40 p-6 shadow-2xl text-left cursor-default overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500" />

              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-xs font-black border border-amber-500/30">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Chèn thêm phân cảnh mới</h3>
                    <span className="text-[11px] text-slate-400">Tạo một shot quay tùy chỉnh bổ sung vào kịch bản</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={addShotMutation.isPending}
                  onClick={() => setIsAddingShot(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateShot} className="mt-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Lời thoại / Giọng đọc thuyết minh:
                  </label>
                  <textarea
                    value={newShotDialogue}
                    onChange={(e) => setNewShotDialogue(e.target.value)}
                    rows={2}
                    placeholder="Nhập lời thoại hoặc lời thuyết minh..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/60 font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Mô tả hình ảnh tạo bởi AI (Flux Prompt):
                  </label>
                  <textarea
                    value={newShotPrompt}
                    onChange={(e) => setNewShotPrompt(e.target.value)}
                    rows={2}
                    placeholder="Ví dụ: cinematic establishing shot of ancient underwater temple, volumetric light..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/60 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Góc máy chuyển động:
                    </label>
                    <CustomSelect
                      value={newShotMotion}
                      onChange={setNewShotMotion}
                      options={MOTION_OPTIONS}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Âm thanh môi trường (SFX):
                    </label>
                    <input
                      type="text"
                      value={newShotSfx}
                      onChange={(e) => setNewShotSfx(e.target.value)}
                      placeholder="e.g. rain, thunder, wind, waves..."
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/60"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
                  <button
                    type="button"
                    disabled={addShotMutation.isPending}
                    onClick={() => setIsAddingShot(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={addShotMutation.isPending}
                    className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {addShotMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang thêm...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Chèn Phân Cảnh</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
