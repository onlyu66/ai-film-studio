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
  has_image?: boolean
  has_audio?: boolean
  has_video?: boolean
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
  const [editCharacterId, setEditCharacterId] = useState('')
  const [editSfx, setEditSfx] = useState('')

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

  const characterOptions = [
    { value: '', label: 'Cảnh quay chung / Thuyết minh', subtext: 'Không gán nhân vật cụ thể' },
    ...Object.entries(characters).map(([id, char]) => ({
      value: id,
      label: char.name || id,
      subtext: `ID: ${id}${char.voice ? ` • Giọng: ${char.voice}` : ''}`,
    })),
  ]

  const handleOpenEditShot = (shot: ShotData) => {
    setEditingShot(shot)
    setEditDialogue(shot.dialogue || '')
    setEditPrompt(shot.image_prompt || '')
    setEditMotion(shot.motion || 'zoom_in')
    setEditCharacterId(shot.character_id || '')
    setEditSfx(shot.sfx || '')
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
        character_id: editCharacterId || undefined,
        sfx: editSfx || undefined,
      },
      {
        onSuccess: () => {
          setEditingShot(null)
        },
        onError: (err: any) => {
          alert(err?.message || 'Lỗi khi cập nhật phân cảnh')
        },
      }
    )
  }

  return (
    <Card id="storyboard-section" className={`border-studio-border bg-studio-deck shadow-2xl scroll-mt-20 ${isScriptReady ? 'border-amber-500/60 ring-2 ring-amber-500/20 shadow-amber-500/10' : ''}`}>
      {isScriptReady && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border-b border-amber-500/30 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-zinc-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20 shrink-0">
              <FileEdit className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                  GIAI ĐOẠN 1 HOÀN TẤT — DUYỆT & CHỈNH SỬA KỊCH BẢN
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {shots.length} Phân Cảnh
                </span>
              </div>
              <p className="text-xs text-zinc-200 mt-1 leading-relaxed">
                Bấm nút <strong className="text-amber-300">"Sửa"</strong> trên từng phân cảnh dưới đây để chỉnh lời thoại, hình ảnh hoặc góc máy. Chuyển sang tab <strong className="text-amber-300">"Diễn viên"</strong> để đổi giọng đọc trước khi tiếp tục.
              </p>
            </div>
          </div>
          {onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-2 shrink-0 transition-all shadow-md shadow-amber-500/20 cursor-pointer active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Tiếp tục sản xuất (Stages 2 - 5)</span>
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
                  className="p-4 sm:p-5 rounded-2xl bg-studio-card border border-studio-border hover:border-studio-border-hover shadow-studio-sm hover:shadow-studio-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-studio-input border border-studio-border flex items-center justify-center shadow-inner overflow-hidden relative group shrink-0">
                          {char.headshot_url ? (
                            <img
                              src={char.headshot_url}
                              alt={char.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-transparent">
                              <User className="w-6 h-6 text-zinc-400 stroke-[1.5]" />
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-zinc-100">{char.name}</h4>
                          <span className="text-[10px] font-mono text-amber-400 font-semibold">ID: {id}</span>
                        </div>
                      </div>

                      <span className="font-mono text-zinc-500 text-[10px]">Seed: {String(char.seed ?? '')}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-studio-input border border-studio-border/70 mb-3.5">
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
                    <div className="flex items-center gap-2 mb-3.5">
                      <button
                        type="button"
                        onClick={() => handleGenerateHeadshot(id, char)}
                        disabled={generatingCharId === id}
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {generatingCharId === id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>Tạo Headshot AI</span>
                      </button>

                      <label className="flex-1 py-1.5 px-2.5 rounded-lg bg-studio-input hover:bg-studio-card text-zinc-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-studio-border">
                        {uploadingCharId === id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                        ) : (
                          <Camera className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        <span>Tải Chân Dung</span>
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
                  <div className="pt-3 border-t border-studio-border space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Giọng lồng tiếng (Voice)</span>
                      </label>
                      {savingCharId === id ? (
                        <span className="text-[10px] text-amber-400 flex items-center gap-1 font-mono font-medium">
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
                        className="p-2.5 rounded-xl bg-studio-input hover:bg-studio-card text-zinc-300 hover:text-white border border-studio-border text-xs font-medium transition-colors flex items-center justify-center cursor-pointer shrink-0"
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
              const hasImage = Boolean(shot.has_image || cacheBuster[shot.id])
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
                    onClick={() => hasImage && setLightboxImage(imgSrc)}
                    className={`relative aspect-video bg-studio-input flex items-center justify-center overflow-hidden ${hasImage ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {/* Fallback background when image doesn't exist */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-zinc-600 bg-studio-deck">
                      <Film className="w-5 h-5 text-zinc-700 stroke-[1.5]" />
                      <span className="text-[9px] font-mono tracking-wider text-zinc-600">CHƯA TẠO ẢNH</span>
                    </div>

                    {hasImage && (
                      <img
                        src={imgSrc}
                        alt={shot.id}
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          const target = e.currentTarget
                          target.style.display = 'none'
                        }}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 z-10"
                      />
                    )}

                    {/* Film overlay & badges */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-70 group-hover:opacity-40 transition-opacity z-20 pointer-events-none" />

                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono text-cinema-amber font-bold border border-studio-border z-20">
                      {shot.id}
                    </div>

                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 text-[10px] font-mono uppercase tracking-wider border border-studio-border z-20">
                      {shot.motion || 'zoom_in'}
                    </div>

                    {hasImage && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[1px] z-20">
                        <div className="px-3 py-1.5 rounded-lg bg-black/80 text-white text-xs font-medium flex items-center gap-1.5 border border-studio-border-hover">
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Xem ảnh HD</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Shot details */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      {/* Character & Act Header Bar */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-studio-border/60">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                            <User className="w-3 h-3" />
                          </div>
                          <span className="text-xs font-bold text-amber-300 truncate">
                            {shot.character_id ? (characters[shot.character_id]?.name || shot.character_id) : 'Cảnh quay chung'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                          {shot.act && (
                            <span className="px-1.5 py-0.5 rounded bg-studio-input text-zinc-400 border border-studio-border font-medium">
                              Hồi {shot.act}
                            </span>
                          )}
                          <span className="text-zinc-600">Ch.{shot.chapter || 1}</span>
                        </div>
                      </div>

                      {/* Dialogue Section */}
                      <div className="mt-2.5 min-h-[38px]">
                        <p className="text-xs text-zinc-100 font-normal leading-relaxed line-clamp-3">
                          {shot.dialogue ? (
                            <span className="italic">"{shot.dialogue}"</span>
                          ) : (
                            <span className="text-zinc-500 italic text-[11px]">(Cảnh quay tĩnh tư liệu & âm nhạc)</span>
                          )}
                        </p>
                      </div>

                      {/* Visual Prompt Snippet */}
                      {shot.image_prompt && (
                        <div className="mt-2 p-2 rounded-lg bg-studio-input/80 border border-studio-border/50 text-[10px] text-zinc-400 font-mono line-clamp-2 leading-relaxed" title={shot.image_prompt}>
                          <span className="text-zinc-500 font-semibold uppercase mr-1">PROMPT:</span>
                          {shot.image_prompt}
                        </div>
                      )}

                      {/* Audio & Mood Chips */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                        {shot.mood && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                            <Music className="w-2.5 h-2.5 text-purple-400" />
                            <span>{shot.mood}</span>
                          </span>
                        )}
                        {shot.sfx && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 flex items-center gap-1">
                            <Volume2 className="w-2.5 h-2.5 text-sky-400" />
                            <span>{shot.sfx}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dedicated Action Toolbar */}
                    <div className="pt-2.5 border-t border-studio-border flex items-center justify-between gap-1.5">
                      {/* Left: Reorder Up/Down */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveShot(index, 'up')}
                          disabled={index === 0}
                          className="p-1.5 rounded-lg bg-studio-input hover:bg-studio-card text-zinc-400 hover:text-white disabled:opacity-20 disabled:pointer-events-none border border-studio-border transition-colors cursor-pointer"
                          title="Đưa lên trước"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveShot(index, 'down')}
                          disabled={index === shots.length - 1}
                          className="p-1.5 rounded-lg bg-studio-input hover:bg-studio-card text-zinc-400 hover:text-white disabled:opacity-20 disabled:pointer-events-none border border-studio-border transition-colors cursor-pointer"
                          title="Đưa xuống sau"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Center: Reroll & Upload Icon Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleRerollShot(shot.id)}
                          disabled={rerollingShotId === shot.id}
                          className="p-1.5 rounded-lg bg-studio-input hover:bg-studio-card text-zinc-300 hover:text-amber-400 border border-studio-border hover:border-amber-400/40 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                          title="Tạo lại ảnh mới bằng AI (Reroll)"
                        >
                          {rerollingShotId === shot.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </button>

                        <label
                          className="p-1.5 rounded-lg bg-studio-input hover:bg-studio-card text-zinc-300 hover:text-white border border-studio-border hover:border-studio-border-hover transition-colors cursor-pointer flex items-center justify-center shrink-0"
                          title="Tải ảnh tùy chỉnh từ máy tính"
                        >
                          <Upload className="w-3.5 h-3.5 text-zinc-400" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleUploadImage(shot.id, e)}
                            disabled={uploadingShotId === shot.id}
                          />
                        </label>
                      </div>

                      {/* Right: Primary Sửa (Edit) & Delete */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditShot(shot)}
                          className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-[0.98] whitespace-nowrap"
                          title="Sửa lời thoại, nhân vật, visual prompt và góc máy"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteShot(shot.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors cursor-pointer shrink-0"
                          title="Xóa phân cảnh"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl bg-studio-deck border border-studio-border p-5 sm:p-6 shadow-2xl text-left cursor-default overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-studio-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-10 rounded-lg overflow-hidden bg-studio-input border border-studio-border shrink-0 flex items-center justify-center">
                    {(editingShot.has_image || cacheBuster[editingShot.id]) ? (
                      <img
                        src={`/api/outputs/images/${editingShot.id}.png?t=${cacheBuster[editingShot.id] || ''}`}
                        alt={editingShot.id}
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          e.currentTarget.style.display = 'none'
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-0.5 text-zinc-500">
                        <Film className="w-3.5 h-3.5 text-zinc-600" />
                        <span className="text-[7px] font-mono tracking-wider text-zinc-500">CHƯA ẢNH</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono text-xs font-bold border border-amber-500/20">
                        {editingShot.id}
                      </span>
                      <h3 className="text-sm font-bold text-zinc-100">Chỉnh sửa phân cảnh</h3>
                    </div>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      Tùy chỉnh lời thoại, nhân vật phát ngôn và mô tả hình ảnh AI
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={updateShotMutation.isPending}
                  onClick={() => setEditingShot(null)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-studio-card transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveShot} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Lời thoại nhân vật (Dialogue):
                  </label>
                  <textarea
                    value={editDialogue}
                    onChange={(e) => setEditDialogue(e.target.value)}
                    rows={3}
                    placeholder="Nhập lời thoại của nhân vật trong phân cảnh này..."
                    className="w-full rounded-xl bg-studio-input border border-studio-border p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors font-sans leading-relaxed"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
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
                    className="w-full rounded-xl bg-studio-input border border-studio-border p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors font-mono leading-relaxed"
                  />
                  <p className="text-[10px] text-zinc-400 mt-1">
                    * Khi thay đổi prompt, hình ảnh của phân cảnh này sẽ tự động được vẽ lại bằng Flux.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Nhân vật phát ngôn:
                    </label>
                    <CustomSelect
                      value={editCharacterId}
                      onChange={setEditCharacterId}
                      options={characterOptions}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Góc máy & Chuyển động:
                    </label>
                    <CustomSelect
                      value={editMotion}
                      onChange={setEditMotion}
                      options={MOTION_OPTIONS}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Âm thanh môi trường (SFX):
                  </label>
                  <input
                    type="text"
                    value={editSfx}
                    onChange={(e) => setEditSfx(e.target.value)}
                    placeholder="e.g. rain, thunder, wind, waves..."
                    className="w-full rounded-xl bg-studio-input border border-studio-border p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-studio-border">
                  <button
                    type="button"
                    disabled={updateShotMutation.isPending}
                    onClick={() => setEditingShot(null)}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-studio-card transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={updateShotMutation.isPending}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-md shadow-amber-500/20 active:scale-[0.98]"
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
              initial={{ scale: 0.98, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl bg-studio-deck border border-studio-border p-5 sm:p-6 shadow-2xl text-left cursor-default overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-studio-border shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-300 font-mono text-xs font-bold border border-amber-500/20">
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
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-studio-card transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateShot} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    Lời thoại / Giọng đọc thuyết minh:
                  </label>
                  <textarea
                    value={newShotDialogue}
                    onChange={(e) => setNewShotDialogue(e.target.value)}
                    rows={2}
                    placeholder="Nhập lời thoại hoặc lời thuyết minh..."
                    className="w-full rounded-xl bg-studio-input border border-studio-border p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-sans leading-relaxed"
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
                    className="w-full rounded-xl bg-studio-input border border-studio-border p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Nhân vật phát ngôn:
                    </label>
                    <CustomSelect
                      value={newShotChar}
                      onChange={setNewShotChar}
                      options={characterOptions}
                    />
                  </div>

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
                    className="w-full rounded-xl bg-studio-input border border-studio-border p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-studio-border">
                  <button
                    type="button"
                    disabled={addShotMutation.isPending}
                    onClick={() => setIsAddingShot(false)}
                    className="px-3.5 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-studio-card transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={addShotMutation.isPending}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-md shadow-amber-500/20 active:scale-[0.98]"
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
