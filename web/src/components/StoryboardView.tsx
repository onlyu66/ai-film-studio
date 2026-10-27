import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Film,
  Volume2,
  Search,
  X,
  Maximize2,
  Loader2,
  Check,
  Edit3,
  Save,
  Sparkles,
  Upload,
  Play,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Music,
  Camera,
  FileEdit,
  User,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { CustomSelect } from './ui/select'
import TimelineScrubber from './TimelineScrubber'
import {
  useUpdateCharacterVoice,
  useUpdateShot,
  usePreviewVoice,
  useRerollShot,
  useUploadShotImage,
  useAddShot,
  useDeleteShot,
  useReorderShots,
  useGenerateHeadshot,
  useUploadHeadshot,
} from '../api/queries'
import type { StoryboardData, SelectOption } from '../types'

interface CharacterData {
  name?: string
  visual_anchor?: string | Record<string, unknown>
  voice?: string
  seed?: number | string
  headshot_url?: string
  face_dna?: string
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
  act?: number | string
  mood?: string
  [key: string]: unknown
}

export interface StoryboardViewProps {
  storyboard: StoryboardData | null
  isScriptReady?: boolean
  onContinue?: () => void
}

const MOTION_OPTIONS: SelectOption[] = [
  { value: 'zoom_in', label: 'Zoom In (Tiến tới)', subtext: 'Camera phóng to dần vào cận cảnh' },
  { value: 'zoom_out', label: 'Zoom Out (Lùi xa)', subtext: 'Camera lùi dần tạo cảm giác bao quát' },
  { value: 'pan_left', label: 'Pan Left (Lia trái)', subtext: 'Ống kính lia ngang mượt mà sang trái' },
  { value: 'pan_right', label: 'Pan Right (Lia phải)', subtext: 'Ống kính lia ngang mượt mà sang phải' },
]

const VOICE_OPTIONS_BY_LANG: Record<string, SelectOption[]> = {
  vi: [
    { value: 'vi-VN-NamMinhNeural', label: 'Nam Minh (Giọng Nam)', subtext: 'Trầm ấm, hào hùng, điện ảnh' },
    { value: 'vi-VN-HoaiMyNeural', label: 'Hoài My (Giọng Nữ)', subtext: 'Ngọt ngào, trong trẻo, truyền cảm' },
  ],
  en: [
    { value: 'en-US-GuyNeural', label: 'Guy (Giọng Nam)', subtext: 'Deep cinematic documentary narrator' },
    { value: 'en-US-ChristopherNeural', label: 'Christopher (Giọng Nam)', subtext: 'Authoritative, clear American male' },
    { value: 'en-US-JennyNeural', label: 'Jenny (Giọng Nữ)', subtext: 'Natural, warm expressive female' },
    { value: 'en-US-AriaNeural', label: 'Aria (Giọng Nữ)', subtext: 'Dramatic, vivid storytelling female' },
  ],
  ja: [
    { value: 'ja-JP-KeitaNeural', label: 'Keita (Giọng Nam)', subtext: 'Shonen & Studio anime male' },
    { value: 'ja-JP-NanamiNeural', label: 'Nanami (Giọng Nữ)', subtext: 'Gentle, expressive anime female' },
  ],
  fr: [
    { value: 'fr-FR-HenriNeural', label: 'Henri (Giọng Nam)', subtext: 'Classic French cinema male' },
    { value: 'fr-FR-DeniseNeural', label: 'Denise (Giọng Nữ)', subtext: 'Poetic French narrative female' },
  ],
}

export default function StoryboardView({ storyboard, isScriptReady, onContinue }: StoryboardViewProps) {
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
  const generateHeadshotMutation = useGenerateHeadshot()
  const uploadHeadshotMutation = useUploadHeadshot()
  const [generatingCharId, setGeneratingCharId] = useState<string | null>(null)
  const [uploadingCharId, setUploadingCharId] = useState<string | null>(null)

  const handleGenerateHeadshot = (charId: string, char: CharacterData) => {
    setGeneratingCharId(charId)
    const anchor = typeof char.visual_anchor === 'string' ? char.visual_anchor : JSON.stringify(char.visual_anchor)
    generateHeadshotMutation.mutate(
      {
        characterId: charId,
        visualAnchor: anchor,
        seed: Number(char.seed) || 42,
      },
      {
        onSettled: () => setGeneratingCharId(null),
      }
    )
  }

  const handleUploadHeadshot = (charId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingCharId(charId)
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = reader.result as string
      uploadHeadshotMutation.mutate(
        { characterId: charId, imageBase64: b64 },
        { onSettled: () => setUploadingCharId(null) }
      )
    }
    reader.readAsDataURL(file)
  }

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
      <div id="storyboard-section" className="rounded-2xl border border-dashed border-studio-border bg-studio-deck/60 max-w-4xl mx-auto p-6 sm:p-8">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-studio-card border border-studio-border flex items-center justify-center text-amber-400 mx-auto shadow-md">
            <Film className="w-5 h-5" />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-zinc-200">Kịch bản & Phân cảnh điện ảnh 35mm</h4>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
              Sau khi bấm "Tạo Kịch Bản", toàn bộ nhân vật, visual DNA và danh sách phân cảnh sẽ hiển thị tại đây để bạn duyệt và tinh chỉnh.
            </p>
          </div>

          {/* 3-Step Flow Indicator */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 pt-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-studio-input border border-studio-border text-zinc-400 text-xs">
              <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center">1</span>
              <span>Nhập ý tưởng phim</span>
            </div>
            <span className="text-zinc-600 text-xs hidden sm:inline">›</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-studio-input border border-studio-border text-zinc-400 text-xs">
              <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center">2</span>
              <span>Chọn phong cách</span>
            </div>
            <span className="text-zinc-600 text-xs hidden sm:inline">›</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-studio-input border border-studio-border text-zinc-400 text-xs">
              <span className="w-4 h-4 rounded-full bg-amber-400/20 text-amber-300 font-mono text-[10px] font-bold flex items-center justify-center">3</span>
              <span>Bấm Tạo Kịch Bản</span>
            </div>
          </div>
        </div>
      </div>
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
    <Card id="storyboard-section" className={`border-cinema-border bg-cinema-deck shadow-xl scroll-mt-6 ${isScriptReady ? 'border-amber-500/50 shadow-amber-500/10' : ''}`}>
      {isScriptReady && (
        <div className="bg-amber-500/[0.08] border-b border-amber-500/30 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-cinema-amber shrink-0">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-cinema-amber">Chế độ Duyệt Kịch Bản</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20">
                  {shots.length} Phân cảnh
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-0.5">
                Bạn có thể bấm nút <strong>"Sửa"</strong> trên từng phân cảnh để thay đổi lời thoại/prompt/góc máy, hoặc chuyển sang tab <strong>"Nhân vật"</strong> để đổi giọng đọc.
              </p>
            </div>
          </div>
          {onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="px-3.5 py-2 rounded-lg bg-cinema-amber hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-2 shrink-0 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Duyệt & Tiếp tục sản xuất</span>
            </button>
          )}
        </div>
      )}

      <CardHeader className="pb-4 border-b border-cinema-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="default" className="text-[10px] font-mono uppercase bg-cinema-card border-cinema-border text-cinema-amber">
                {storyboard.language?.toUpperCase() || 'VI'} CINEMA
              </Badge>
              <span className="text-xs text-zinc-500 font-mono">#{shots.length} SHOTS TOTAL</span>
            </div>
            <CardTitle className="text-base font-bold text-zinc-100 flex items-center gap-2.5">
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
                  className="px-3 py-1.5 rounded-lg bg-cinema-amber hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm cảnh</span>
                </button>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm phân cảnh..."
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-cinema-card border border-cinema-border text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cinema-amber w-44 sm:w-56"
                  />
                </div>
              </>
            )}

            <div className="flex items-center p-1 bg-cinema-canvas rounded-lg border border-cinema-border">
              <button
                type="button"
                onClick={() => setActiveTab('shots')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'shots'
                    ? 'bg-cinema-amber text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Phân cảnh ({shots.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('characters')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'characters'
                    ? 'bg-cinema-amber text-zinc-950 font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Diễn viên ({Object.keys(characters).length})
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Interactive Multi-track Timeline Scrubber */}
        {shots.length > 0 && (
          <TimelineScrubber shots={shots as any} />
        )}

        {/* Characters Tab */}
        {activeTab === 'characters' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(characters).map(([id, char]) => {
              const currentVoice = char.voice || currentVoiceOptions[0]?.value || 'vi-VN-NamMinhNeural'

              return (
                <motion.div
                  key={id}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="p-4 rounded-xl bg-cinema-card border border-cinema-border hover:border-cinema-border-hover transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-cinema-border flex items-center justify-center shadow-inner overflow-hidden relative group shrink-0">
                          {char.headshot_url ? (
                            <img
                              src={char.headshot_url}
                              alt={char.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-6 h-6 text-zinc-400 stroke-[1.5]" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-zinc-100">{char.name}</h4>
                          <span className="text-[10px] font-mono text-cinema-amber">ID: {id}</span>
                        </div>
                      </div>

                      <span className="font-mono text-zinc-500 text-[10px]">Seed: {String(char.seed ?? '')}</span>
                    </div>

                    <div className="p-3 rounded-lg bg-cinema-deck border border-cinema-border mb-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
                        Visual DNA Anchor:
                      </span>
                      <p className="text-xs text-zinc-300 leading-relaxed font-normal">
                        {typeof char.visual_anchor === 'string'
                          ? char.visual_anchor
                          : JSON.stringify(char.visual_anchor)}
                      </p>
                    </div>

                    {/* Character Face Headshot Action Buttons */}
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => handleGenerateHeadshot(id, char)}
                        disabled={generatingCharId === id}
                        className="flex-1 py-1 px-2 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        {generatingCharId === id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-amber-400" />
                        )}
                        <span>Tạo Headshot AI</span>
                      </button>

                      <label className="flex-1 py-1 px-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer border border-zinc-700">
                        {uploadingCharId === id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                        ) : (
                          <Camera className="w-3 h-3 text-zinc-400" />
                        )}
                        <span>Tải Ảnh Chân Dung</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleUploadHeadshot(id, e)}
                          disabled={uploadingCharId === id}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Interactive Voice Customization */}
                  <div className="pt-3 border-t border-cinema-border space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Giọng lồng tiếng (Voice)</span>
                      </label>
                      {savingCharId === id ? (
                        <span className="text-[10px] text-cinema-amber flex items-center gap-1 font-mono font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" /> Đang lưu...
                        </span>
                      ) : savedCharId === id ? (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono font-medium">
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
                        className="p-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-xs font-medium transition-colors flex items-center justify-center cursor-pointer shrink-0"
                        title="Nghe thử giọng này"
                      >
                        {playingVoice === currentVoice ? (
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
                        ) : (
                          <Play className="w-4 h-4 text-zinc-300" />
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
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="group rounded-xl bg-cinema-card border border-cinema-border overflow-hidden hover:border-cinema-border-hover transition-all flex flex-col"
                >
                  {/* Thumbnail / Lightbox click */}
                  <div
                    onClick={() => setLightboxImage(imgSrc)}
                    className="relative aspect-video bg-cinema-canvas flex items-center justify-center overflow-hidden cursor-pointer"
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

                    {/* Film overlay & badges */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-70 group-hover:opacity-40 transition-opacity" />

                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono text-cinema-amber font-bold border border-studio-border">
                      {shot.id}
                    </div>

                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 text-[10px] font-mono uppercase tracking-wider border border-studio-border">
                      {shot.motion || 'zoom_in'}
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[1px]">
                      <div className="px-3 py-1.5 rounded-lg bg-black/80 text-white text-xs font-medium flex items-center gap-1.5 border border-studio-border-hover">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Xem ảnh HD</span>
                      </div>
                    </div>
                  </div>

                  {/* Shot details */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        {shot.character_id ? (
                          <div className="text-[11px] font-semibold text-cinema-amber flex items-center gap-1 min-w-0">
                            <User className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{characters[shot.character_id]?.name || shot.character_id}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Cảnh quay chung</span>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveShot(index, 'up')}
                            disabled={index === 0}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                            title="Di chuyển lên trước"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveShot(index, 'down')}
                            disabled={index === shots.length - 1}
                            className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                            title="Di chuyển xuống sau"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRerollShot(shot.id)}
                            disabled={rerollingShotId === shot.id}
                            className="px-1.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium flex items-center gap-1 transition-colors border border-zinc-700 cursor-pointer shrink-0"
                            title="Tạo lại ảnh ngẫu nhiên mới cho shot này"
                          >
                            {rerollingShotId === shot.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                            ) : (
                              <Sparkles className="w-3 h-3 text-amber-400" />
                            )}
                            <span className="hidden sm:inline">Reroll</span>
                          </button>

                          <label
                            className="px-1.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium flex items-center gap-1 transition-colors border border-zinc-700 cursor-pointer shrink-0"
                            title="Tải ảnh riêng thay thế"
                          >
                            {uploadingShotId === shot.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                            ) : (
                              <Upload className="w-3 h-3 text-zinc-400" />
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
                            className="px-1.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                            title="Sửa lời thoại, visual prompt hoặc góc máy"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Sửa</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteShot(shot.id)}
                            className="p-1 rounded bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 text-[10px] cursor-pointer"
                            title="Xóa phân cảnh này"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-200 leading-relaxed font-normal">
                        {shot.dialogue ? `"${shot.dialogue}"` : <span className="text-zinc-500 italic">(Cảnh quay tĩnh tư liệu & âm nhạc)</span>}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                        {shot.act && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium border border-zinc-700">
                            Hồi {shot.act}
                          </span>
                        )}
                        {shot.mood && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-purple-300 font-medium border border-zinc-700 flex items-center gap-1">
                            <Music className="w-2.5 h-2.5 text-purple-400" />
                            <span>{shot.mood}</span>
                          </span>
                        )}
                        {shot.sfx && (
                          <span className="flex items-center gap-1 text-zinc-400">
                            <Volume2 className="w-2.5 h-2.5" />
                            <span>SFX: {shot.sfx}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-cinema-border flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                      <span className="line-clamp-2 leading-tight flex-1 font-mono" title={shot.image_prompt}>
                        {shot.image_prompt}
                      </span>
                      <span className="font-mono flex-shrink-0 text-zinc-500">Ch. {shot.chapter || 1}</span>
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
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden border border-cinema-border shadow-2xl bg-cinema-canvas"
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl rounded-xl bg-cinema-deck border border-cinema-border p-6 shadow-2xl text-left cursor-default overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-cinema-border">
                <div className="flex items-center gap-2.5">
                  <div className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono text-xs font-bold border border-amber-500/20">
                    {editingShot.id}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100">Chỉnh sửa phân cảnh</h3>
                    {editingShot.character_id && (
                      <span className="text-[11px] text-zinc-400">
                        Nhân vật: <strong className="text-cinema-amber">{characters[editingShot.character_id]?.name || editingShot.character_id}</strong>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={updateShotMutation.isPending}
                  onClick={() => setEditingShot(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveShot} className="mt-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Lời thoại nhân vật (Dialogue):
                  </label>
                  <textarea
                    value={editDialogue}
                    onChange={(e) => setEditDialogue(e.target.value)}
                    rows={3}
                    placeholder="Nhập lời thoại của nhân vật trong phân cảnh này..."
                    className="w-full rounded-lg bg-cinema-canvas border border-cinema-border p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cinema-amber transition-colors font-sans leading-relaxed"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    * Khi thay đổi lời thoại, hệ thống sẽ tự động tổng hợp lại giọng nói TTS cho phân cảnh này.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Mô tả hình ảnh điện ảnh (Flux Prompt):
                  </label>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={3}
                    placeholder="Prompt tạo hình ảnh (tiếng Anh hoặc tiếng Việt)..."
                    className="w-full rounded-lg bg-cinema-canvas border border-cinema-border p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cinema-amber transition-colors font-mono leading-relaxed"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    * Khi thay đổi prompt, hình ảnh của phân cảnh này sẽ tự động được vẽ lại bằng Flux.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Góc máy & Chuyển động (Camera Motion):
                  </label>
                  <CustomSelect
                    value={editMotion}
                    onChange={setEditMotion}
                    options={MOTION_OPTIONS}
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-cinema-border">
                  <button
                    type="button"
                    disabled={updateShotMutation.isPending}
                    onClick={() => setEditingShot(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={updateShotMutation.isPending}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cinema-amber hover:bg-amber-400 text-zinc-950 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl rounded-xl bg-cinema-deck border border-cinema-border p-6 shadow-2xl text-left cursor-default overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-cinema-border">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-300 font-mono text-xs font-bold border border-amber-500/20">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100">Chèn thêm phân cảnh mới</h3>
                    <span className="text-[11px] text-zinc-400">Tạo một shot quay tùy chỉnh bổ sung vào kịch bản</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={addShotMutation.isPending}
                  onClick={() => setIsAddingShot(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateShot} className="mt-4 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Lời thoại / Giọng đọc thuyết minh:
                  </label>
                  <textarea
                    value={newShotDialogue}
                    onChange={(e) => setNewShotDialogue(e.target.value)}
                    rows={2}
                    placeholder="Nhập lời thoại hoặc lời thuyết minh..."
                    className="w-full rounded-lg bg-cinema-canvas border border-cinema-border p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cinema-amber font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Mô tả hình ảnh tạo bởi AI (Flux Prompt):
                  </label>
                  <textarea
                    value={newShotPrompt}
                    onChange={(e) => setNewShotPrompt(e.target.value)}
                    rows={2}
                    placeholder="Ví dụ: cinematic establishing shot of ancient underwater temple, volumetric light..."
                    className="w-full rounded-lg bg-cinema-canvas border border-cinema-border p-3 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cinema-amber font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Góc máy chuyển động:
                    </label>
                    <CustomSelect
                      value={newShotMotion}
                      onChange={setNewShotMotion}
                      options={MOTION_OPTIONS}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Âm thanh môi trường (SFX):
                    </label>
                    <input
                      type="text"
                      value={newShotSfx}
                      onChange={(e) => setNewShotSfx(e.target.value)}
                      placeholder="e.g. rain, thunder, wind, waves..."
                      className="w-full rounded-lg bg-cinema-canvas border border-cinema-border p-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-cinema-amber"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-cinema-border">
                  <button
                    type="button"
                    disabled={addShotMutation.isPending}
                    onClick={() => setIsAddingShot(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={addShotMutation.isPending}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cinema-amber hover:bg-amber-400 text-zinc-950 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
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
