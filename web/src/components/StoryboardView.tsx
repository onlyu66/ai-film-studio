import React, { useState, useRef } from 'react'
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
  Video,
  Download,
  Sliders,
  Zap,
  Palette,
  Mic,
  Languages,
  Smartphone,
  Lock,
  BookmarkPlus,
  Eye,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { CustomSelect } from './ui/select'
import TimelineScrubber from './TimelineScrubber'
import CameraDirectorModal from './CameraDirectorModal'
import ColorInspectorModal from './ColorInspectorModal'
import VoiceCloneModal from './VoiceCloneModal'
import DubbingModal from './DubbingModal'
import AutoReframeModal from './AutoReframeModal'
import SFXSoundboardModal from './SFXSoundboardModal'
import { CharacterVaultModal } from './CharacterVaultModal'
import {
  useUpdateCharacterVoice,
  useUpdateShot,
  useBatchSuggestSfx,
  useSplitShot,
  useSaveVaultCharacter,
  usePreviewVoice,
  useRerollShot,
  useUploadShotImage,
  useAddShot,
  useDeleteShot,
  useReorderShots,
  useGenerateHeadshot,
  useUploadHeadshot,
  useApproveShot,
  useRenderShotAudio,
  useRenderShotVideo,
  useRemuxShotVideo,
  useAssembleMaster,
} from '../api/queries'
import { getTimelineExportUrl } from '../api/studio'
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
  emotion?: string
  shot_size?: string
  camera_angle?: string
  lighting?: string
  voice_volume?: number
  sfx_volume?: number
  has_image?: boolean
  has_audio?: boolean
  has_video?: boolean
  is_approved?: boolean
  [key: string]: unknown
}

export interface StoryboardViewProps {
  storyboard: StoryboardData | null
  isScriptReady?: boolean
  onContinue?: () => void
}

const MOTION_OPTIONS: SelectOption[] = [
  { value: 'zoom_in', label: 'Push In / Zoom In (Tiến tới)', subtext: 'Camera phóng to dần vào cận cảnh (Ease-In-Out)' },
  { value: 'zoom_out', label: 'Pull Out / Zoom Out (Lùi xa)', subtext: 'Camera lùi dần tạo cảm giác bao quát' },
  { value: 'pan_left', label: 'Truck Left / Pan Left (Lia trái)', subtext: 'Ống kính trượt ngang mượt mà sang trái' },
  { value: 'pan_right', label: 'Truck Right / Pan Right (Lia phải)', subtext: 'Ống kính trượt ngang mượt mà sang phải' },
  { value: 'tilt_up', label: 'Pedestal Tilt Up (Quét lên)', subtext: 'Ống kính quét mượt mà từ dưới lên trên' },
  { value: 'tilt_down', label: 'Pedestal Tilt Down (Quét xuống)', subtext: 'Ống kính quét mượt mà từ trên xuống dưới' },
  { value: 'handheld', label: 'Handheld Camera Shake (Rung tay)', subtext: 'Camera cầm tay thở tự nhiên cho cảnh kịch tính' },
]

const SHOT_SIZE_OPTIONS: SelectOption[] = [
  { value: 'extreme_wide', label: 'Extreme Wide (Đại cảnh)', subtext: 'Khung cảnh vĩ đại bao quát không gian' },
  { value: 'wide', label: 'Wide Shot (Toàn cảnh)', subtext: 'Thấy toàn bộ nhân vật và bối cảnh' },
  { value: 'medium', label: 'Medium Shot (Trung cảnh)', subtext: 'Từ thắt lưng trở lên, phù hợp hội thoại' },
  { value: 'medium_close_up', label: 'Medium Close-up (Trung cận)', subtext: 'Từ ngực trở lên, tập trung biểu cảm' },
  { value: 'close_up', label: 'Close-up (Cận cảnh)', subtext: 'Khuôn mặt nhân vật lấp đầy khung hình' },
  { value: 'extreme_close_up', label: 'Extreme Close-up (Đặc tả)', subtext: 'Chi tiết đôi mắt, bàn tay, kỷ vật' },
]

const CAMERA_ANGLE_OPTIONS: SelectOption[] = [
  { value: 'eye_level', label: 'Eye Level (Ngang tầm mắt)', subtext: 'Góc nhìn tự nhiên, chân thực' },
  { value: 'low_angle', label: 'Low Angle (Góc thấp nhìn lên)', subtext: 'Tạo cảm giác quyền lực, uy nghi' },
  { value: 'high_angle', label: 'High Angle (Góc cao nhìn xuống)', subtext: 'Tạo cảm giác nhỏ bé, cô độc' },
  { value: 'dutch_angle', label: 'Dutch Angle (Góc nghiêng)', subtext: 'Tạo cảm giác bất an, hoang mang' },
  { value: 'over_the_shoulder', label: 'Over the Shoulder (Qua vai)', subtext: 'Góc máy qua vai người đối thoại' },
]

const LIGHTING_OPTIONS: SelectOption[] = [
  { value: 'chiaroscuro', label: 'Chiaroscuro (Tương phản mạnh)', subtext: 'Đổ bóng đậm phong cách điện ảnh noir' },
  { value: 'volumetric_rays', label: 'Volumetric Rays (Tia sáng thể tích)', subtext: 'Tia sáng lung linh xuyên qua bụi hoặc sương' },
  { value: 'golden_hour', label: 'Golden Hour (Ánh hoàng hôn vàng)', subtext: 'Ánh nắng chiều ấm áp, lãng mạn' },
  { value: 'neon_rim_light', label: 'Neon Rim Light (Viền Neon)', subtext: 'Ánh sáng viền sắc lạnh phong cách Cyberpunk' },
  { value: 'soft_ambient', label: 'Soft Ambient (Ánh sáng dịu)', subtext: 'Ánh sáng môi trường tự nhiên, tỏa đều' },
  { value: 'dramatic_backlit', label: 'Dramatic Backlit (Ngược sáng)', subtext: 'Bóng dáng nổi bật trên nền ánh sáng' },
]

const MOOD_OPTIONS: SelectOption[] = [
  { value: 'epic', label: 'Epic (Hào hùng, tráng lệ)', subtext: 'Âm hưởng vĩ đại, hùng tráng' },
  { value: 'mysterious', label: 'Mysterious (Bí ẩn, kỳ bí)', subtext: 'Kỳ bí, khơi gợi tò mò' },
  { value: 'dark', label: 'Dark / Tense (U tối, căng thẳng)', subtext: 'Căng thẳng, hồi hộp, kịch tính' },
  { value: 'romantic', label: 'Romantic (Lãng mạn, êm đềm)', subtext: 'Ấm áp, thơ mộng, cảm xúc' },
  { value: 'melancholic', label: 'Melancholic (U sầu, trầm mặc)', subtext: 'Lắng đọng, nuối tiếc, sâu sắc' },
  { value: 'action', label: 'Action (Hành động dồn dập)', subtext: 'Nhịp điệu nhanh, dồn dập, mạnh mẽ' },
  { value: 'hopeful', label: 'Hopeful (Hy vọng, tươi sáng)', subtext: 'Vươn lên, tràn đầy niềm tin' },
]

const EMOTION_OPTIONS: SelectOption[] = [
  { value: 'neutral', label: 'Bình thản / Neutral', subtext: 'Trạng thái cân bằng, tự nhiên' },
  { value: 'tense', label: 'Căng thẳng / Tense', subtext: 'Cảnh giác, hồi hộp cao độ' },
  { value: 'joyful', label: 'Hân hoan / Joyful', subtext: 'Vui vẻ, phấn khích, rạng rỡ' },
  { value: 'angry', label: 'Phẫn nộ / Angry', subtext: 'Tức giận, quyết liệt, gay gắt' },
  { value: 'sorrowful', label: 'Đau buồn / Sorrowful', subtext: 'Đau khổ, xót xa, buồn bã' },
  { value: 'determined', label: 'Kiên định / Determined', subtext: 'Quyết tâm, kiên cường, dứt khoát' },
  { value: 'terrified', label: 'Kinh hãi / Terrified', subtext: 'Sợ hãi, hoảng loạn' },
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

const SFX_PRESETS = [
  { key: 'rain', label: '🌧️ Mưa (Rain)' },
  { key: 'wind', label: '💨 Gió (Wind)' },
  { key: 'thunder', label: '⚡ Sấm sét (Thunder)' },
  { key: 'waves', label: '🌊 Sóng biển (Waves)' },
  { key: 'campfire', label: '🔥 Lửa trại (Campfire)' },
  { key: 'birds', label: '🐦 Chim hót (Birds)' },
  { key: 'city', label: '🏙️ Phố xá (City)' },
  { key: 'traffic', label: '🚗 Giao thông (Traffic)' },
  { key: 'cyberpunk', label: '🚀 Sci-Fi / Cyber' },
] as const

export default function StoryboardView({ storyboard, isScriptReady, onContinue }: StoryboardViewProps) {
  const [activeTab, setActiveTab] = useState<'shots' | 'characters'>('shots')
  const [searchQuery, setSearchQuery] = useState('')
  const [shotFilter, setShotFilter] = useState<'all' | 'approved' | 'pending' | 'has_video'>('all')
  const [actFilter, setActFilter] = useState<string>('all')
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
  const [editVoiceVolume, setEditVoiceVolume] = useState<number>(1.0)
  const [editSfxVolume, setEditSfxVolume] = useState<number>(1.0)
  const [editShotSize, setEditShotSize] = useState('medium')
  const [editCameraAngle, setEditCameraAngle] = useState('eye_level')
  const [editLighting, setEditLighting] = useState('chiaroscuro')
  const [editMood, setEditMood] = useState('epic')
  const [editEmotion, setEditEmotion] = useState('neutral')
  const [activeMediaTab, setActiveMediaTab] = useState<'video' | 'image'>('video')
  const [playingShotAudio, setPlayingShotAudio] = useState<string | null>(null)
  const shotAudioRef = useRef<HTMLAudioElement | null>(null)

  const [playingVoice, setPlayingVoice] = useState<string | null>(null)
  const [rerollingShotId, setRerollingShotId] = useState<string | null>(null)
  const [uploadingShotId, setUploadingShotId] = useState<string | null>(null)
  const [remuxingShotId, setRemuxingShotId] = useState<string | null>(null)
  const [cacheBuster, setCacheBuster] = useState<Record<string, number>>({})

  // Add Shot modal state
  const [isAddingShot, setIsAddingShot] = useState(false)
  const [newShotDialogue, setNewShotDialogue] = useState('')
  const [newShotPrompt, setNewShotPrompt] = useState('')
  const [newShotMotion, setNewShotMotion] = useState('zoom_in')
  const [newShotSfx, setNewShotSfx] = useState('')
  const [newShotVoiceVolume, setNewShotVoiceVolume] = useState<number>(1.0)
  const [newShotSfxVolume, setNewShotSfxVolume] = useState<number>(1.0)
  const [newShotChar, setNewShotChar] = useState('')
  const [newShotSize, setNewShotSize] = useState('medium')
  const [newShotAngle, setNewShotAngle] = useState('eye_level')
  const [newShotLighting, setNewShotLighting] = useState('chiaroscuro')
  const [newShotMood, setNewShotMood] = useState('epic')
  const [newShotEmotion, setNewShotEmotion] = useState('neutral')

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
  const approveShotMutation = useApproveShot()
  const renderShotAudioMutation = useRenderShotAudio()
  const renderShotVideoMutation = useRenderShotVideo()
  const remuxShotVideoMutation = useRemuxShotVideo()
  const assembleMasterMutation = useAssembleMaster()

  const [generatingCharId, setGeneratingCharId] = useState<string | null>(null)
  const [uploadingCharId, setUploadingCharId] = useState<string | null>(null)
  const [renderingAudioShotId, setRenderingAudioShotId] = useState<string | null>(null)
  const [renderingVideoShotId, setRenderingVideoShotId] = useState<string | null>(null)
  const [approvingShotId, setApprovingShotId] = useState<string | null>(null)
  const [directorModalShot, setDirectorModalShot] = useState<any | null>(null)
  const [colorInspectorShot, setColorInspectorShot] = useState<{ shot: any; index: number } | null>(null)
  const [isVoiceCloneOpen, setIsVoiceCloneOpen] = useState(false)
  const [selectedCharForVoice, setSelectedCharForVoice] = useState<{ id: string; name: string } | null>(null)
  const [isDubbingOpen, setIsDubbingOpen] = useState(false)
  const [isReframeOpen, setIsReframeOpen] = useState(false)
  const [sfxModalShot, setSfxModalShot] = useState<any | null>(null)
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false)
  const [savingToVaultCharId, setSavingToVaultCharId] = useState<string | null>(null)
  const [savedToVaultCharId, setSavedToVaultCharId] = useState<string | null>(null)
  const batchSfxMutation = useBatchSuggestSfx()
  const splitShotMutation = useSplitShot()
  const saveVaultMutation = useSaveVaultCharacter()

  const handleSaveToVault = (id: string, char: CharacterData) => {
    setSavingToVaultCharId(id)
    const anchor = typeof char.visual_anchor === 'string' ? char.visual_anchor : JSON.stringify(char.visual_anchor || '')
    saveVaultMutation.mutate(
      {
        id,
        name: char.name || id,
        visual_anchor: anchor,
        voice: char.voice,
        seed: typeof char.seed === 'number' ? char.seed : 42,
        headshot_url: char.headshot_url,
        tags: ['storyboard'],
      },
      {
        onSuccess: () => {
          setSavingToVaultCharId(null)
          setSavedToVaultCharId(id)
          setTimeout(() => setSavedToVaultCharId(null), 3000)
        },
        onError: (err: any) => {
          setSavingToVaultCharId(null)
          alert(err?.message || 'Lỗi khi lưu vào Vault')
        },
      }
    )
  }

  const handleSaveShotSfx = (shotId: string, sfxId: string | null, volume: number, offsetMs: number) => {
    updateShotMutation.mutate({
      shot_id: shotId,
      sfx: sfxId || undefined,
      sfx_volume: volume,
      sfx_offset_ms: offsetMs,
    })
    if (editingShot && editingShot.id === shotId) {
      setEditSfx(sfxId || '')
      setEditSfxVolume(volume)
    }
  }

  const handleBatchSuggestSfx = async () => {
    try {
      await batchSfxMutation.mutateAsync({
        project_id: 'current',
        overwrite_existing: true,
      })
    } catch (err) {
      console.error('Batch SFX suggestion failed', err)
    }
  }

  const handleApplyLutToProject = (lutId: string) => {
    localStorage.setItem('studio_color_lut', lutId)
  }
  const [previewVideo, setPreviewVideo] = useState<{ url: string; title: string; shotId?: string } | null>(null)
  const [videoError, setVideoError] = useState<boolean>(false)
  const [playingSfx, setPlayingSfx] = useState<string | null>(null)
  const sfxAudioRef = useRef<HTMLAudioElement | null>(null)

  const handlePlaySfx = (sfxKey?: string | null) => {
    if (!sfxKey) return
    if (playingSfx === sfxKey) {
      if (sfxAudioRef.current) {
        sfxAudioRef.current.pause()
        sfxAudioRef.current.currentTime = 0
      }
      setPlayingSfx(null)
      return
    }
    if (sfxAudioRef.current) {
      sfxAudioRef.current.pause()
    }
    const cleanKey = sfxKey.toLowerCase().trim().replace(/\s+/g, '_')
    const audio = new Audio(`/api/assets/sfx/${cleanKey}.mp3`)
    sfxAudioRef.current = audio
    setPlayingSfx(sfxKey)
    audio.play().catch(() => setPlayingSfx(null))
    audio.onended = () => setPlayingSfx(null)
    audio.onerror = () => setPlayingSfx(null)
  }

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

  const handleToggleApprove = (shotId: string, currentApproved: boolean) => {
    setApprovingShotId(shotId)
    approveShotMutation.mutate(
      { shotId, approved: !currentApproved },
      {
        onSettled: () => setApprovingShotId(null),
        onError: (err: any) => alert(err?.message || 'Lỗi khi cập nhật trạng thái duyệt'),
      }
    )
  }

  const handleRenderAudio = (shotId: string) => {
    setRenderingAudioShotId(shotId)
    renderShotAudioMutation.mutate(shotId, {
      onSettled: () => {
        setRenderingAudioShotId(null)
        setCacheBuster((prev) => ({ ...prev, [shotId]: Date.now() }))
      },
      onError: (err: any) => alert(err?.message || 'Lỗi khi tạo giọng đọc phân cảnh'),
    })
  }

  const handleRenderVideo = (shotId: string, engine?: string) => {
    setRenderingVideoShotId(shotId)
    const token = localStorage.getItem('studio_replicate_token') || undefined
    const model = localStorage.getItem('studio_replicate_model') || undefined
    const params = engine
      ? {
          shotId,
          engine,
          videoApiToken: engine === 'replicate' ? token : undefined,
          videoModel: engine === 'replicate' ? model : undefined,
        }
      : shotId

    renderShotVideoMutation.mutate(params, {
      onSettled: () => {
        setRenderingVideoShotId(null)
        setCacheBuster((prev) => ({ ...prev, [shotId]: Date.now() }))
      },
      onError: (err: any) => alert(err?.message || 'Lỗi khi render video clip phân cảnh'),
    })
  }

  const handleRemuxVideo = (shotId: string) => {
    setRemuxingShotId(shotId)
    remuxShotVideoMutation.mutate(shotId, {
      onSettled: () => {
        setRemuxingShotId(null)
        setCacheBuster((prev) => ({ ...prev, [shotId]: Date.now() }))
      },
      onError: (err: any) => alert(err?.message || 'Lỗi khi ghép lại âm thanh vào video clip'),
    })
  }

  const handlePlayShotAudio = (shotId: string) => {
    if (playingShotAudio === shotId) {
      shotAudioRef.current?.pause()
      setPlayingShotAudio(null)
      return
    }
    shotAudioRef.current?.pause()
    const audio = new Audio(`/api/outputs/audio/${shotId}.mp3?t=${cacheBuster[shotId] || Date.now()}`)
    shotAudioRef.current = audio
    setPlayingShotAudio(shotId)
    audio.play().catch(() => setPlayingShotAudio(null))
    audio.onended = () => setPlayingShotAudio(null)
    audio.onerror = () => setPlayingShotAudio(null)
  }

  const handleAssembleMaster = () => {
    const bgm_preset = localStorage.getItem('studio_bgm_preset') || undefined
    const bgmVolStr = localStorage.getItem('studio_bgm_volume')
    const bgm_volume = bgmVolStr ? parseFloat(bgmVolStr) : undefined
    const ducking_level = localStorage.getItem('studio_ducking_level') || undefined
    const color_lut = localStorage.getItem('studio_color_lut') || undefined
    const transition_preset = localStorage.getItem('studio_transition_preset') || undefined
    const transDurStr = localStorage.getItem('studio_transition_duration')
    const transition_duration = transDurStr ? parseFloat(transDurStr) : undefined

    assembleMasterMutation.mutate(
      {
        bgm_preset,
        bgm_volume,
        ducking_level,
        color_lut,
        transition_preset,
        transition_duration,
      },
      {
        onSuccess: (data) => {
          alert(`🎉 Xuất bản video thành công! File: ${data.filename}`)
          if (onContinue) onContinue()
        },
        onError: (err: any) => alert(err?.message || 'Lỗi khi xuất bản video hoàn chỉnh'),
      }
    )
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
        voice_volume: newShotVoiceVolume,
        sfx_volume: newShotSfxVolume,
        character_id: newShotChar || undefined,
        shot_size: newShotSize || undefined,
        camera_angle: newShotAngle || undefined,
        lighting: newShotLighting || undefined,
        mood: newShotMood || undefined,
        emotion: newShotEmotion || undefined,
      },
      {
        onSuccess: () => {
          setIsAddingShot(false)
          setNewShotDialogue('')
          setNewShotPrompt('')
          setNewShotSfx('')
          setNewShotVoiceVolume(1.0)
          setNewShotSfxVolume(1.0)
          setNewShotChar('')
          setNewShotSize('medium')
          setNewShotAngle('eye_level')
          setNewShotLighting('chiaroscuro')
          setNewShotMood('epic')
          setNewShotEmotion('neutral')
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
    if (shotFilter === 'approved' && !s.is_approved) return false
    if (shotFilter === 'pending' && s.is_approved) return false
    if (shotFilter === 'has_video' && !s.has_video) return false
    if (actFilter !== 'all' && String(s.act) !== actFilter) return false

    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      s.id.toLowerCase().includes(q) ||
      (s.dialogue && s.dialogue.toLowerCase().includes(q)) ||
      (s.image_prompt && s.image_prompt.toLowerCase().includes(q))
    )
  })

  const totalShots = shots.length
  const readyImages = shots.filter((s) => s.has_image || cacheBuster[s.id]).length
  const readyAudios = shots.filter((s) => s.has_audio).length
  const readyClips = shots.filter((s) => s.has_video).length
  const approvedShots = shots.filter((s) => s.is_approved).length

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
    setEditVoiceVolume(typeof shot.voice_volume === 'number' ? shot.voice_volume : 1.0)
    setEditSfxVolume(typeof shot.sfx_volume === 'number' ? shot.sfx_volume : 1.0)
    setEditShotSize((shot.shot_size as string) || 'medium')
    setEditCameraAngle((shot.camera_angle as string) || 'eye_level')
    setEditLighting((shot.lighting as string) || 'chiaroscuro')
    setEditMood((shot.mood as string) || 'epic')
    setEditEmotion((shot.emotion as string) || 'neutral')
    setActiveMediaTab(shot.has_video ? 'video' : 'image')
  }

  const handleSaveShot = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!editingShot) return
    updateShotMutation.mutate(
      {
        shot_id: editingShot.id,
        dialogue: editDialogue,
        image_prompt: editPrompt,
        motion: editMotion,
        character_id: editCharacterId || undefined,
        sfx: editSfx || undefined,
        voice_volume: editVoiceVolume,
        sfx_volume: editSfxVolume,
        shot_size: editShotSize || undefined,
        camera_angle: editCameraAngle || undefined,
        lighting: editLighting || undefined,
        mood: editMood || undefined,
        emotion: editEmotion || undefined,
      },
      {
        onSuccess: () => {
          setEditingShot(null)
          setCacheBuster((prev) => ({ ...prev, [editingShot.id]: Date.now() }))
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

            {activeTab === 'characters' && (
              <button
                type="button"
                onClick={() => setIsVaultModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Mở Kho Nhân Vật Nhất Quán để duyệt và nhập nhân vật"
              >
                <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
                <span>Kho Nhân Vật (Vault)</span>
              </button>
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
          <TimelineScrubber
            shots={shots as any}
            onSelectShot={(shotId) => {
              const s = shots.find((x) => x.id === shotId)
              if (s) handleOpenEditShot(s)
            }}
            onUpdateShotDuration={(shotId, duration) => {
              updateShotMutation.mutate({ shot_id: shotId, duration })
            }}
            onReorderShots={(newIds) => {
              reorderShotsMutation.mutate(newIds)
            }}
            onSplitShot={(shotId, splitAtSec) => {
              splitShotMutation.mutate({
                shot_id: shotId,
                split_at_sec: splitAtSec,
                project_id: 'current',
              })
            }}
          />
        )}

        {/* Characters Tab */}
        {activeTab === 'characters' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.entries(characters).map(([id, char]) => {
              const currentVoice = char.voice || currentVoiceOptions[0]?.value || 'vi-VN-NamMinhNeural'

              return (
                <motion.div
                  key={id}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.15 }}
                  className="p-5 rounded-2xl bg-cinema-card border border-cinema-border hover:border-cinema-border-hover shadow-xl transition-all flex flex-col justify-between relative overflow-hidden group"
                >
                  {/* Subtle top accent gradient */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-amber-500/0 opacity-60 group-hover:opacity-100 transition-opacity" />

                  <div>
                    {/* Header: Avatar, Name, ID, Seed */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3.5">
                        <div
                          onClick={() => char.headshot_url && setLightboxImage(char.headshot_url)}
                          className={`w-14 h-14 rounded-2xl bg-cinema-deck border border-cinema-border ring-1 ring-amber-500/20 flex items-center justify-center overflow-hidden relative group/avatar shrink-0 ${
                            char.headshot_url ? 'cursor-pointer hover:ring-amber-400/50 transition-all' : ''
                          }`}
                          title={char.headshot_url ? 'Bấm để phóng to ảnh chân dung' : 'Chưa có ảnh chân dung'}
                        >
                          {char.headshot_url ? (
                            <>
                              <img
                                src={char.headshot_url}
                                alt={char.name}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-cover group-hover/avatar:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                                <Maximize2 className="w-4 h-4 text-white" />
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-500/10 to-transparent">
                              <User className="w-7 h-7 text-zinc-500 stroke-[1.5]" />
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="text-base font-bold text-zinc-100 leading-tight">{char.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-mono text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                              ID: {id}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        <div>
                          <span className="font-mono text-zinc-500 text-[10px] block">SEED</span>
                          <span className="font-mono text-zinc-300 text-xs font-semibold">{String(char.seed ?? 'Auto')}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Lock className="w-2.5 h-2.5" /> 3-Lock
                        </span>
                      </div>
                    </div>

                    {/* Visual DNA Anchor Box */}
                    <div className="p-3.5 rounded-xl bg-cinema-canvas/80 border border-cinema-border mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          Visual DNA Anchor
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed font-normal line-clamp-4 hover:line-clamp-none transition-all">
                        {typeof char.visual_anchor === 'string'
                          ? char.visual_anchor
                          : JSON.stringify(char.visual_anchor)}
                      </p>
                    </div>

                    {/* Character Face Headshot Action Buttons */}
                    <div className="flex items-center gap-2 mb-2.5">
                      <button
                        type="button"
                        onClick={() => handleGenerateHeadshot(id, char)}
                        disabled={generatingCharId === id}
                        className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        {generatingCharId === id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>Tạo Headshot AI</span>
                      </button>

                      <label className="flex-1 py-2 px-3 rounded-xl bg-cinema-deck hover:bg-cinema-surface text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-cinema-border active:scale-95">
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

                    {/* Vault Actions: Save to Vault & Browse Vault */}
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => handleSaveToVault(id, char)}
                        disabled={savingToVaultCharId === id}
                        className="flex-1 py-1.5 px-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-zinc-700/50"
                        title="Lưu nhân vật này vào Kho Vault để dùng cho các phim khác"
                      >
                        {savingToVaultCharId === id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                        ) : savedToVaultCharId === id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <BookmarkPlus className="w-3 h-3 text-amber-400" />
                        )}
                        <span>{savedToVaultCharId === id ? 'Đã lưu Vault!' : 'Lưu vào Vault'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsVaultModalOpen(true)}
                        className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-amber-500/20"
                        title="Mở kho nhân vật để duyệt 3 góc mặt và nhân vật mẫu"
                      >
                        <Eye className="w-3 h-3 text-amber-400" />
                        <span>Kho Vault / Góc Mặt</span>
                      </button>
                    </div>
                  </div>

                  {/* Interactive Voice Customization */}
                  <div className="pt-3.5 border-t border-cinema-border space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-amber-400/80" />
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
                        className="p-2.5 rounded-xl bg-cinema-deck hover:bg-amber-500/15 text-zinc-300 hover:text-amber-300 border border-cinema-border hover:border-amber-500/30 text-xs font-medium transition-all flex items-center justify-center cursor-pointer shrink-0 active:scale-95"
                        title="Nghe thử giọng này"
                      >
                        {playingVoice === currentVoice ? (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCharForVoice({ id, name: char.name || id })
                          setIsVoiceCloneOpen(true)
                        }}
                        className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition-all flex items-center justify-center cursor-pointer shrink-0 active:scale-95"
                        title="Nhân bản giọng AI (Tải audio hoặc thu âm mic trực tiếp)"
                      >
                        <Mic className="w-4 h-4" />
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
          <>
            {/* Quick Status & Act Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-studio-input/70 border border-studio-border text-xs mb-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mr-1">Bộ lọc:</span>
                <button
                  type="button"
                  onClick={() => setShotFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    shotFilter === 'all'
                      ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-studio-card'
                  }`}
                >
                  Tất cả ({totalShots})
                </button>
                <button
                  type="button"
                  onClick={() => setShotFilter('approved')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    shotFilter === 'approved'
                      ? 'bg-emerald-500 text-white font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-emerald-300 hover:bg-studio-card'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Đã duyệt ({approvedShots})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShotFilter('pending')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    shotFilter === 'pending'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-amber-300 hover:bg-studio-card'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>Chờ duyệt ({totalShots - approvedShots})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShotFilter('has_video')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    shotFilter === 'has_video'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 font-bold shadow-sm'
                      : 'text-zinc-400 hover:text-cyan-300 hover:bg-studio-card'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Đã có Clip ({readyClips})</span>
                </button>
              </div>

              {/* Right: Quick Act Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mr-1">Hồi:</span>
                {(['all', '1', '2', '3'] as const).map((actVal) => (
                  <button
                    key={actVal}
                    type="button"
                    onClick={() => setActFilter(actVal)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                      actFilter === actVal
                        ? 'bg-studio-elevated text-amber-300 border border-amber-400/40 font-bold'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-studio-card'
                    }`}
                  >
                    {actVal === 'all' ? 'Tất cả' : `Hồi ${actVal}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
            {filteredShots.map((shot, index) => {
              const hasImage = Boolean(shot.has_image || cacheBuster[shot.id])
              const imgSrc = `/api/outputs/images/${shot.id}.png?t=${cacheBuster[shot.id] || ''}`

              return (
                <motion.div
                  key={shot.id}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.18 }}
                  className="group rounded-2xl bg-cinema-card border border-cinema-border overflow-hidden hover:border-amber-500/30 shadow-lg hover:shadow-2xl hover:shadow-black/50 transition-all flex flex-col"
                >
                  {/* Top Bar: Sequence Number, Act/Scene, Up/Down Reorder & Approval Toggle */}
                  <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-cinema-border/70 bg-cinema-deck/60">
                    {/* Left: Shot ID & Act/Scene */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-xs text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md shadow-sm shrink-0">
                        #{String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400 truncate">
                        {shot.act ? `Hồi ${shot.act}` : ''} {shot.chapter ? `• Cảnh ${shot.chapter}` : ''}
                      </span>
                    </div>

                    {/* Right: Quick Reorder & Approval */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Reorder Buttons */}
                      <div className="flex items-center bg-cinema-canvas/90 rounded-lg border border-cinema-border/80 p-0.5">
                        <button
                          type="button"
                          onClick={() => handleMoveShot(index, 'up')}
                          disabled={index === 0}
                          className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-20 disabled:pointer-events-none rounded hover:bg-cinema-deck transition-colors cursor-pointer"
                          title="Di chuyển phân cảnh lên trước"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveShot(index, 'down')}
                          disabled={index === shots.length - 1}
                          className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-20 disabled:pointer-events-none rounded hover:bg-cinema-deck transition-colors cursor-pointer"
                          title="Di chuyển phân cảnh xuống sau"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Approval Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleApprove(shot.id, Boolean(shot.is_approved))}
                        disabled={approvingShotId === shot.id}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 whitespace-nowrap ${
                          shot.is_approved
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/25 hover:bg-amber-500/20'
                        }`}
                        title={shot.is_approved ? 'ĐÃ DUYỆT (Bấm để hủy duyệt)' : 'CHỜ DUYỆT (Bấm để duyệt phân cảnh này)'}
                      >
                        {approvingShotId === shot.id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                        ) : shot.is_approved ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400 stroke-[2.5]" />
                            <span className="whitespace-nowrap">ĐÃ DUYỆT</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span className="whitespace-nowrap">CHỜ DUYỆT</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Cinema 16:9 Thumbnail Canvas */}
                  <div
                    onClick={() => {
                      if (shot.has_video) {
                        setVideoError(false)
                        setPreviewVideo({
                          url: `/api/outputs/videos/${shot.id}.mp4?t=${cacheBuster[shot.id] || Date.now()}`,
                          title: `Phân cảnh ${shot.id} ${shot.dialogue ? `• "${shot.dialogue}"` : ''}`,
                          shotId: shot.id,
                        })
                      } else if (hasImage) {
                        setLightboxImage(imgSrc)
                      }
                    }}
                    className={`relative aspect-video bg-cinema-canvas flex items-center justify-center overflow-hidden group/thumb ${
                      shot.has_video || hasImage ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    title={
                      shot.has_video
                        ? 'Bấm để xem video clip phân cảnh này'
                        : hasImage
                        ? 'Bấm để phóng to ảnh phân cảnh'
                        : ''
                    }
                  >
                    {/* Placeholder when no image exists */}
                    {!hasImage && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-zinc-600 bg-cinema-deck/80">
                        <Film className="w-6 h-6 text-zinc-700 stroke-[1.5]" />
                        <span className="text-[10px] font-mono tracking-wider text-zinc-500 uppercase">CHƯA TẠO ẢNH</span>
                      </div>
                    )}

                    {hasImage && (
                      <img
                        src={imgSrc}
                        alt={shot.id}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                        className="absolute inset-0 w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-500"
                      />
                    )}

                    {/* Gradient cinematic vignette */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent pointer-events-none" />

                    {/* Center Video Play Badge if Video exists */}
                    {shot.has_video && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-black/60 border border-emerald-400/50 flex items-center justify-center text-white shadow-2xl backdrop-blur-sm group-hover/thumb:scale-110 group-hover/thumb:bg-emerald-600 group-hover/thumb:border-emerald-300 transition-all duration-300">
                          <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                        </div>
                      </div>
                    )}

                    {/* Bottom Bar on Thumbnail: Motion on left, Media Readiness on right */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none z-10">
                      <span className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-zinc-300 text-[9px] font-mono uppercase tracking-wider border border-white/10">
                        🎥 {String(shot.motion || 'zoom_in').replace('_', ' ')}
                      </span>

                      <div className="flex items-center gap-1">
                        {shot.has_audio && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/80 backdrop-blur-md text-white text-[9px] font-mono font-bold flex items-center gap-1 shadow-sm">
                            <Volume2 className="w-2.5 h-2.5" />
                            <span>TTS</span>
                          </span>
                        )}
                        {shot.has_video && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-600 backdrop-blur-md text-white text-[9px] font-mono font-bold flex items-center gap-1 shadow-sm">
                            <Film className="w-2.5 h-2.5" />
                            <span>CLIP</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hover Actions Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-black/75 backdrop-blur-sm p-3 z-20">
                      {shot.has_video ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setVideoError(false)
                            setPreviewVideo({
                              url: `/api/outputs/videos/${shot.id}.mp4?t=${cacheBuster[shot.id] || Date.now()}`,
                              title: `Phân cảnh ${shot.id} ${shot.dialogue ? `• "${shot.dialogue}"` : ''}`,
                              shotId: shot.id,
                            })
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xl border border-emerald-400/50 transition-all active:scale-95 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-white" />
                          <span>Xem Clip</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRenderVideo(shot.id)
                          }}
                          disabled={renderingVideoShotId === shot.id}
                          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 shadow-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                          {renderingVideoShotId === shot.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" />
                          ) : (
                            <Video className="w-3.5 h-3.5 text-zinc-950" />
                          )}
                          <span>{renderingVideoShotId === shot.id ? 'Đang tạo...' : 'Tạo Clip'}</span>
                        </button>
                      )}

                      {hasImage && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setLightboxImage(imgSrc)
                          }}
                          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors cursor-pointer"
                          title="Xem ảnh gốc HD"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Shot Details Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3.5">
                    <div className="space-y-3">
                      {/* Character & Voice Banner */}
                      <div className="flex items-center justify-between text-xs pb-2 border-b border-cinema-border/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 rounded-md bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
                            <User className="w-3 h-3" />
                          </div>
                          <span className="font-bold text-zinc-200 text-xs truncate">
                            {shot.character_id ? (characters[shot.character_id]?.name || shot.character_id) : 'Cảnh quay chung / Thuyết minh'}
                          </span>
                        </div>

                        {shot.character_id && characters[shot.character_id]?.voice && (
                          <span className="text-[10px] font-mono text-zinc-400 shrink-0 bg-cinema-deck/80 px-2 py-0.5 rounded border border-cinema-border">
                            🎙️ {characters[shot.character_id]?.voice?.split('-')[2]?.replace('Neural', '') || 'Voice'}
                          </span>
                        )}
                      </div>

                      {/* Dialogue Section with amber accent quote line */}
                      <div
                        onClick={() => handleOpenEditShot(shot)}
                        className="cursor-pointer hover:bg-cinema-canvas/60 p-2.5 -mx-1 rounded-lg transition-colors border-l-2 border-amber-500/50 group/text"
                        title="Bấm để mở Shot Studio và chỉnh sửa phân cảnh này"
                      >
                        <p className="text-xs text-zinc-100 group-hover/text:text-amber-200 font-normal leading-relaxed line-clamp-3">
                          {shot.dialogue ? (
                            <span className="italic">"{shot.dialogue}"</span>
                          ) : (
                            <span className="text-zinc-500 italic text-[11px]">(Cảnh quay tĩnh tư liệu & âm nhạc điện ảnh)</span>
                          )}
                        </p>
                      </div>

                      {/* Visual Prompt Snippet */}
                      {shot.image_prompt && (
                        <div
                          onClick={() => handleOpenEditShot(shot)}
                          className="p-2 rounded-lg bg-cinema-canvas/80 hover:bg-cinema-canvas border border-cinema-border hover:border-amber-500/30 text-[10px] text-zinc-400 hover:text-zinc-300 font-mono line-clamp-2 leading-relaxed cursor-pointer transition-colors"
                          title="Bấm để mở Shot Studio và chỉnh sửa Prompt"
                        >
                          <span className="text-zinc-500 font-semibold uppercase mr-1">PROMPT:</span>
                          {shot.image_prompt}
                        </div>
                      )}

                      {/* Cinematography & Audio Specs — Modern 2-Row Structured Grid */}
                      <div className="p-2.5 rounded-xl bg-cinema-canvas/60 border border-cinema-border/70 text-[10px] font-mono space-y-2">
                        {/* Row 1: Camera Angle, Shot Size, Lighting, Lens */}
                        <div className="flex flex-wrap items-center justify-between gap-1 text-zinc-400">
                          <button
                            type="button"
                            onClick={() => setDirectorModalShot(shot as any)}
                            className="flex items-center gap-1.5 text-amber-300/90 hover:text-amber-300 font-medium cursor-pointer group/cam"
                            title="Bấm để mở Đạo Diễn Góc Máy (3 góc máy & Visual Canvas)"
                          >
                            <Camera className="w-3 h-3 text-amber-400 shrink-0 group-hover/cam:scale-110 transition-transform" />
                            <span>{String(shot.shot_size || 'medium').replace('_', ' ')}</span>
                            <span className="text-zinc-600">•</span>
                            <span className="underline decoration-dotted underline-offset-2">{String(shot.camera_angle || 'medium').replace('_', ' ')}</span>
                            {Boolean(shot.camera_lens) && (
                              <>
                                <span className="text-zinc-600">•</span>
                                <span className="text-sky-300">{String(shot.camera_lens).replace('_', ' ')}</span>
                              </>
                            )}
                          </button>

                          <div className="flex items-center gap-2">
                            {shot.lighting && (
                              <span className="text-zinc-400">
                                💡 {String(shot.lighting).replace('_', ' ')}
                              </span>
                            )}
                            {shot.mood && (
                              <span className="flex items-center gap-1 text-purple-300">
                                <Music className="w-2.5 h-2.5 text-purple-400" />
                                <span>{shot.mood}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Row 2: Volumes & SFX with soundboard button */}
                        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-cinema-border/50 text-zinc-400">
                          <div className="flex items-center gap-2">
                            <span>Thoại: <strong className="text-amber-300 font-bold">{Math.round((shot.voice_volume ?? 1.0) * 100)}%</strong></span>
                            <span>SFX: <strong className="text-sky-300 font-bold">{Math.round((shot.sfx_volume ?? 1.0) * 100)}%</strong></span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSfxModalShot(shot)
                            }}
                            className={`px-2 py-0.5 rounded border flex items-center gap-1 cursor-pointer transition-all ${
                              shot.sfx
                                ? 'bg-violet-500/20 text-violet-300 border-violet-500/40 hover:bg-violet-500/30'
                                : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/60 hover:text-zinc-200 hover:bg-zinc-800'
                            }`}
                            title="Mở thư viện SFX Soundboard để chọn hoặc đổi hiệu ứng âm thanh"
                          >
                            <Volume2 className="w-2.5 h-2.5 text-violet-400" />
                            <span className="truncate max-w-[100px]">{shot.sfx ? shot.sfx : '+ SFX'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Bar: Fast Production Tools & Primary Sửa Button */}
                    <div className="pt-3 border-t border-cinema-border/70 flex items-center justify-between gap-2 mt-auto">
                      {/* Left: Quick Production Tools */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Audio TTS */}
                        <button
                          type="button"
                          onClick={() => handleRenderAudio(shot.id)}
                          disabled={renderingAudioShotId === shot.id}
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                            shot.has_audio
                              ? 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border-sky-500/40 shadow-sm'
                              : 'bg-cinema-canvas hover:bg-cinema-deck text-zinc-400 hover:text-sky-300 border-cinema-border'
                          }`}
                          title={shot.has_audio ? 'Tạo lại giọng đọc TTS (Đã có audio)' : 'Tạo giọng đọc TTS cho shot này'}
                        >
                          {renderingAudioShotId === shot.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Video Clip Render */}
                        <button
                          type="button"
                          onClick={() => handleRenderVideo(shot.id)}
                          disabled={renderingVideoShotId === shot.id}
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                            shot.has_video
                              ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40 shadow-sm'
                              : 'bg-cinema-canvas hover:bg-cinema-deck text-zinc-400 hover:text-emerald-300 border-cinema-border'
                          }`}
                          title={shot.has_video ? 'Render lại clip video (Đã có clip)' : 'Render video clip Ken Burns cho shot này'}
                        >
                          {renderingVideoShotId === shot.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                          ) : (
                            <Video className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* AI Image Reroll */}
                        <button
                          type="button"
                          onClick={() => handleRerollShot(shot.id)}
                          disabled={rerollingShotId === shot.id}
                          className="w-7 h-7 rounded-lg bg-cinema-canvas hover:bg-cinema-deck text-zinc-300 hover:text-amber-400 border border-cinema-border hover:border-amber-400/40 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                          title="Tạo lại ảnh bằng AI (Reroll)"
                        >
                          {rerollingShotId === shot.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </button>

                        {/* Custom Image Upload */}
                        <label
                          className="w-7 h-7 rounded-lg bg-cinema-canvas hover:bg-cinema-deck text-zinc-400 hover:text-zinc-200 border border-cinema-border hover:border-cinema-border-hover flex items-center justify-center transition-all cursor-pointer active:scale-95"
                          title="Tải ảnh tùy chỉnh từ máy tính"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleUploadImage(shot.id, e)}
                            disabled={uploadingShotId === shot.id}
                          />
                        </label>

                        {/* Camera Director & Multi-Camera */}
                        <button
                          type="button"
                          onClick={() => setDirectorModalShot(shot as any)}
                          className="w-7 h-7 rounded-lg bg-cinema-canvas hover:bg-amber-500/20 text-zinc-300 hover:text-amber-400 border border-cinema-border hover:border-amber-400/50 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                          title="Đạo diễn góc máy & Visual Prompt Canvas (3 góc máy Wide/Medium/Close-up, ống kính & ánh sáng)"
                        >
                          <Camera className="w-3.5 h-3.5 text-amber-400" />
                        </button>

                        {/* Color Grading A/B Inspector */}
                        <button
                          type="button"
                          onClick={() => setColorInspectorShot({ shot, index })}
                          className="w-7 h-7 rounded-lg bg-cinema-canvas hover:bg-rose-500/20 text-zinc-300 hover:text-rose-400 border border-cinema-border hover:border-rose-400/50 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                          title="So màu A/B & Color Grading Inspector (Thanh trượt chia đôi 60 FPS)"
                        >
                          <Palette className="w-3.5 h-3.5 text-rose-400" />
                        </button>
                      </div>

                      {/* Right: Primary Sửa Shot & Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditShot(shot)}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 via-amber-500/25 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 text-amber-300 border border-amber-500/40 hover:border-amber-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap"
                          title="Mở Shot Studio để chỉnh sửa lời thoại, visual prompt, âm lượng, SFX..."
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="whitespace-nowrap font-bold">Sửa Shot</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteShot(shot.id)}
                          className="w-7 h-7 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95"
                          title="Xóa phân cảnh này"
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

          {/* Master Assembly & Quality Assurance Dashboard */}
          <div className="mt-8 rounded-2xl bg-gradient-to-b from-cinema-deck/95 via-cinema-card/90 to-cinema-deck/95 border border-cinema-border p-5 sm:p-6 shadow-2xl relative overflow-hidden">
            {/* Top Amber glow accent line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500/60 to-transparent" />

            {/* Header: Title, Description & Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-cinema-border/70">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5 sm:mt-0">
                  <Film className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-zinc-100 break-words">
                      Bảng điều khiển & Xuất bản Master Movie
                    </h3>
                    <span className="text-[10px] whitespace-nowrap font-mono px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                      Quy trình duyệt tỉ mỉ
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Kiểm duyệt từng phân cảnh, xuất từng clip riêng lẻ và ghép nối hoàn thiện phim chiếu rạp
                  </p>
                </div>
              </div>

              {/* Status pill on header right */}
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center font-mono text-xs">
                {readyClips === totalShots && totalShots > 0 ? (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5 shadow-sm">
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Đủ {totalShots}/{totalShots} Clips</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Tiến độ: {readyClips}/{totalShots} Clips</span>
                  </span>
                )}
              </div>
            </div>

            {/* Visual Progress Gauges: Responsive 4-column Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4">
              {/* Gauge 1: Images */}
              <div className="p-3 rounded-xl bg-cinema-canvas/80 border border-cinema-border flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs gap-1">
                  <span className="text-zinc-400 font-medium truncate">Ảnh minh họa (Flux)</span>
                  <span className={`font-mono font-bold shrink-0 ${readyImages === totalShots ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {readyImages}/{totalShots}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-cinema-deck overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${readyImages === totalShots ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${totalShots ? (readyImages / totalShots) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>Tiến độ</span>
                  <span>{totalShots ? Math.round((readyImages / totalShots) * 100) : 0}%</span>
                </div>
              </div>

              {/* Gauge 2: Audio TTS */}
              <div className="p-3 rounded-xl bg-cinema-canvas/80 border border-cinema-border flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs gap-1">
                  <span className="text-zinc-400 font-medium truncate">Giọng đọc (TTS + SFX)</span>
                  <span className={`font-mono font-bold shrink-0 ${readyAudios === totalShots ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {readyAudios}/{totalShots}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-cinema-deck overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${readyAudios === totalShots ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${totalShots ? (readyAudios / totalShots) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>Tiến độ</span>
                  <span>{totalShots ? Math.round((readyAudios / totalShots) * 100) : 0}%</span>
                </div>
              </div>

              {/* Gauge 3: Video Clips */}
              <div className="p-3 rounded-xl bg-cinema-canvas/80 border border-cinema-border flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs gap-1">
                  <span className="text-zinc-400 font-medium truncate">Video Clips (MP4)</span>
                  <span className={`font-mono font-bold shrink-0 ${readyClips === totalShots ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {readyClips}/{totalShots}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-cinema-deck overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${readyClips === totalShots ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${totalShots ? (readyClips / totalShots) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>Tiến độ</span>
                  <span>{totalShots ? Math.round((readyClips / totalShots) * 100) : 0}%</span>
                </div>
              </div>

              {/* Gauge 4: Approval Status */}
              <div className="p-3 rounded-xl bg-cinema-canvas/80 border border-cinema-border flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs gap-1">
                  <span className="text-zinc-400 font-medium truncate">Phê duyệt phân cảnh</span>
                  <span className={`font-mono font-bold shrink-0 ${approvedShots === totalShots ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {approvedShots}/{totalShots}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-cinema-deck overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${approvedShots === totalShots ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${totalShots ? (approvedShots / totalShots) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                  <span>Tiến độ</span>
                  <span>{totalShots ? Math.round((approvedShots / totalShots) * 100) : 0}%</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3.5 border-t border-cinema-border/70">
              <div className="text-xs text-zinc-400 flex items-center gap-2">
                {readyClips === totalShots ? (
                  <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Toàn bộ {totalShots} phân cảnh đã sẵn sàng để ghép thành phim hoàn chỉnh!</span>
                  </span>
                ) : (
                  <span className="text-zinc-400">
                    Sẵn sàng ghép phim: <strong className="text-amber-300 font-mono">{readyClips}/{totalShots}</strong> clips
                  </span>
                )}
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                {/* Approve all button if not all approved */}
                {approvedShots < totalShots && (
                  <button
                    type="button"
                    onClick={async () => {
                      for (const s of shots) {
                        if (!s.is_approved) {
                          await approveShotMutation.mutateAsync({ shotId: s.id, approved: true })
                        }
                      }
                    }}
                    disabled={approveShotMutation.isPending}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-cinema-card hover:bg-cinema-deck text-zinc-200 hover:text-white border border-cinema-border hover:border-emerald-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap"
                    title="Xác nhận duyệt toàn bộ các phân cảnh hiện tại"
                  >
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Duyệt tất cả ({totalShots - approvedShots} còn lại)</span>
                  </button>
                )}

                {/* Export FCPXML for NLE */}
                <a
                  href={getTimelineExportUrl()}
                  download
                  className="flex-1 sm:flex-initial px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-semibold text-xs sm:text-sm border border-amber-500/30 hover:border-amber-400/50 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] whitespace-nowrap"
                  title="Xuất timeline FCPXML đa rãnh sang DaVinci Resolve hoặc Adobe Premiere Pro"
                >
                  <Download className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Xuất Premiere / DaVinci XML</span>
                </a>

                {/* Download Subtitles SRT & ASS */}
                <div className="flex items-center gap-1.5">
                  <a
                    href="/api/storyboard/subtitles/srt"
                    download
                    className="px-3 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-emerald-300 font-semibold text-xs sm:text-sm border border-emerald-500/30 hover:border-emerald-400/50 shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] whitespace-nowrap"
                    title="Tải file phụ đề chuẩn .SRT (Closed Captions)"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Tải SRT</span>
                  </a>
                  <a
                    href="/api/storyboard/subtitles/ass"
                    download
                    className="px-3 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-indigo-300 font-semibold text-xs sm:text-sm border border-indigo-500/30 hover:border-indigo-400/50 shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.98] whitespace-nowrap"
                    title="Tải file phụ đề điện ảnh .ASS (Typography & Karaoke)"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>Tải ASS</span>
                  </a>
                </div>

                {/* Multilingual Dubbing Studio CTA */}
                <button
                  type="button"
                  onClick={() => setIsDubbingOpen(true)}
                  className="px-4 py-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400/50 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98] whitespace-nowrap"
                  title="Mở xưởng lồng tiếng đa ngôn ngữ (English, Japanese, French, Spanish, Chinese...)"
                >
                  <Languages className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Lồng Tiếng Đa Ngữ</span>
                </button>

                {/* AI Foley & SFX Auto-cue CTA */}
                <button
                  type="button"
                  onClick={handleBatchSuggestSfx}
                  disabled={batchSfxMutation.isPending}
                  className="px-4 py-3 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:border-violet-400/50 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98] whitespace-nowrap"
                  title="Tự động phân tích kịch bản và gán toàn bộ tiếng động SFX (Foley) cho toàn bộ các phân cảnh"
                >
                  {batchSfxMutation.isPending ? (
                    <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                  )}
                  <span>AI Gợi Ý SFX</span>
                </button>

                {/* Smart Auto-Reframe 9:16 Shorts CTA */}
                <button
                  type="button"
                  onClick={() => setIsReframeOpen(true)}
                  className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-rose-500/10 hover:from-amber-500/20 hover:to-rose-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-400/50 text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.98] whitespace-nowrap"
                  title="Tự động reframe sang video dọc 9:16 (Shorts/TikTok/Reels)"
                >
                  <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Xuất 9:16 Shorts</span>
                </button>

                {/* Primary Master Assembly CTA */}
                <button
                  type="button"
                  onClick={handleAssembleMaster}
                  disabled={assembleMasterMutation.isPending || readyClips === 0}
                  className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-bold text-xs sm:text-sm tracking-wide shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] whitespace-nowrap"
                >
                  {assembleMasterMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-zinc-950 shrink-0" />
                      <span>Đang ghép nối & mix nhạc điện ảnh...</span>
                    </>
                  ) : (
                    <>
                      <Film className="w-4 h-4 text-zinc-950 stroke-[2.5] shrink-0" />
                      <span>Xuất bản Master Movie ({readyClips}/{totalShots} Clips)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick status notice if clips missing */}
            {readyClips < totalShots && (
              <div className="mt-3.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 flex items-start gap-2.5 leading-relaxed">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0 mt-1" />
                <span className="break-words">
                  Lưu ý: Đang có <strong>{totalShots - readyClips}</strong> phân cảnh chưa render video clip. Bạn có thể bấm nút tạo clip trên từng thẻ cảnh hoặc bấm xuất bản video để hệ thống tự động sinh các clip còn thiếu.
                </span>
              </div>
            )}
          </div>
        </>
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

      {/* Video Clip Preview Modal */}
      <AnimatePresence>
        {previewVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setPreviewVideo(null)
              setVideoError(false)
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-4xl rounded-2xl overflow-hidden border border-cinema-border shadow-2xl bg-zinc-950 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-studio-border bg-studio-deck">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100">{previewVideo.title}</h3>
                    <span className="text-[11px] text-zinc-400">Xem trước video clip phân cảnh độc lập</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewVideo(null)
                    setVideoError(false)
                  }}
                  className="p-1.5 rounded-lg bg-studio-input hover:bg-studio-card text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative flex items-center justify-center bg-black min-h-[320px] max-h-[75vh] w-full overflow-hidden p-2">
                {videoError ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                    <Video className="w-10 h-10 text-rose-400 opacity-80" />
                    <p className="text-sm font-semibold text-zinc-200">Không thể phát video clip này</p>
                    <p className="text-xs text-zinc-400 max-w-sm">File video chưa được tạo xong hoặc định dạng chưa tương thích.</p>
                    {previewVideo.shotId && (
                      <button
                        type="button"
                        onClick={() => {
                          handleRenderVideo(previewVideo.shotId!)
                          setPreviewVideo(null)
                        }}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                      >
                        Render lại clip này
                      </button>
                    )}
                  </div>
                ) : (
                  <video
                    key={previewVideo.url}
                    src={previewVideo.url}
                    controls
                    autoPlay
                    playsInline
                    onError={() => setVideoError(true)}
                    className="max-h-[72vh] max-w-full rounded-lg object-contain shadow-2xl"
                  />
                )}
              </div>

              <div className="px-5 py-3 border-t border-studio-border bg-studio-deck/60 flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-3">
                  <a
                    href={previewVideo.url}
                    download
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-amber-400 transition-colors"
                    title="Tải clip video MP4 về máy tính"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải clip MP4</span>
                  </a>
                  {previewVideo.shotId && (
                    <button
                      type="button"
                      onClick={() => {
                        handleRenderVideo(previewVideo.shotId!)
                        setPreviewVideo(null)
                      }}
                      className="flex items-center gap-1.5 text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer"
                      title="Render lại clip cho phân cảnh này"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Render lại</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewVideo(null)
                    setVideoError(false)
                  }}
                  className="px-3 py-1 rounded-lg bg-studio-input hover:bg-studio-card text-zinc-300 hover:text-white border border-studio-border transition-colors cursor-pointer font-medium"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Shot Studio Inspector Modal */}
      <AnimatePresence>
        {editingShot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !updateShotMutation.isPending && setEditingShot(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-5xl max-h-[94vh] flex flex-col rounded-2xl bg-studio-deck border border-studio-border shadow-2xl text-left cursor-default overflow-hidden"
            >
              {/* TOP HEADER */}
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-studio-border bg-studio-deck/95 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shrink-0">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono text-xs font-bold border border-amber-500/20">
                        {editingShot.id}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        Hồi {editingShot.act || 1}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono">
                        ⏱️ {editingShot.duration ? Number(editingShot.duration).toFixed(1) + 's' : '5.0s'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleApprove(editingShot.id, Boolean(editingShot.is_approved))}
                        disabled={approvingShotId === editingShot.id}
                        className={`text-xs px-2.5 py-0.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          editingShot.is_approved
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                            : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white border-zinc-700'
                        }`}
                        title="Bấm để bật/tắt duyệt phân cảnh này"
                      >
                        {approvingShotId === editingShot.id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                        ) : (
                          <Check className={`w-3 h-3 ${editingShot.is_approved ? 'text-emerald-400' : 'text-zinc-500'}`} />
                        )}
                        <span>{editingShot.is_approved ? 'Đã duyệt' : 'Chưa duyệt'}</span>
                      </button>
                    </div>
                    <span className="text-[11px] text-zinc-400 mt-0.5 block">
                      Shot Studio • Xem trước Live Media, tinh chỉnh lời thoại, giọng đọc, âm thanh môi trường và thông số máy quay
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={updateShotMutation.isPending}
                  onClick={() => setEditingShot(null)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-studio-card transition-colors cursor-pointer"
                  title="Đóng cửa sổ"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* MAIN CONTENT: 2-COLUMN GRID */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* LEFT COLUMN: LIVE MEDIA & AUDIO MIXER (lg:col-span-5) */}
                <div className="lg:col-span-5 flex flex-col gap-3.5">
                  {/* Media Switcher & Player */}
                  <div className="bg-studio-card/60 rounded-2xl border border-studio-border p-3 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-amber-400" />
                        Live Media Preview
                      </span>
                      <div className="flex items-center gap-1 bg-studio-input p-0.5 rounded-lg border border-studio-border text-xs">
                        <button
                          type="button"
                          onClick={() => setActiveMediaTab('video')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                            activeMediaTab === 'video'
                              ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <Video className="w-3 h-3" />
                          <span>Video Clip</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveMediaTab('image')}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                            activeMediaTab === 'image'
                              ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <Camera className="w-3 h-3" />
                          <span>Ảnh tĩnh</span>
                        </button>
                      </div>
                    </div>

                    {/* 16:9 Live Preview Box */}
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-black/90 border border-studio-border flex items-center justify-center group shadow-inner">
                      {activeMediaTab === 'video' ? (
                        editingShot.has_video ? (
                          <video
                            key={`modal-vid-${editingShot.id}-${cacheBuster[editingShot.id] || ''}`}
                            controls
                            playsInline
                            className="w-full h-full object-contain"
                            src={`/api/outputs/videos/${editingShot.id}.mp4?t=${cacheBuster[editingShot.id] || Date.now()}`}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-4 text-center gap-2">
                            <Video className="w-8 h-8 text-zinc-600" />
                            <p className="text-xs text-zinc-400">Chưa render video clip cho phân cảnh này.</p>
                            <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => handleRenderVideo(editingShot.id, 'kenburns')}
                                disabled={renderingVideoShotId === editingShot.id}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                              >
                                {renderingVideoShotId === editingShot.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Film className="w-3.5 h-3.5" />
                                )}
                                <span>Render Ken Burns 2.5D</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRenderVideo(editingShot.id, 'replicate')}
                                disabled={renderingVideoShotId === editingShot.id}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                              >
                                {renderingVideoShotId === editingShot.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Video className="w-3.5 h-3.5" />
                                )}
                                <span>Render AI Video Pro</span>
                              </button>
                            </div>
                          </div>
                        )
                      ) : (
                        editingShot.has_image || cacheBuster[editingShot.id] ? (
                          <img
                            key={`modal-img-${editingShot.id}-${cacheBuster[editingShot.id] || ''}`}
                            src={`/api/outputs/images/${editingShot.id}.png?t=${cacheBuster[editingShot.id] || Date.now()}`}
                            alt={editingShot.id}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-4 text-center gap-2">
                            <Film className="w-8 h-8 text-zinc-600" />
                            <p className="text-xs text-zinc-400">Chưa có ảnh phân cảnh.</p>
                            <button
                              type="button"
                              onClick={() => handleRerollShot(editingShot.id)}
                              disabled={rerollingShotId === editingShot.id}
                              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Vẽ ảnh AI bằng Flux</span>
                            </button>
                          </div>
                        )
                      )}
                    </div>

                    {/* Media Actions Toolbar */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleRerollShot(editingShot.id)}
                        disabled={rerollingShotId === editingShot.id}
                        className="px-2.5 py-1.5 rounded-lg bg-studio-input hover:bg-studio-card text-zinc-300 hover:text-amber-400 border border-studio-border text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Tạo lại hình ảnh AI cho phân cảnh này"
                      >
                        {rerollingShotId === editingShot.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span>Tạo lại ảnh</span>
                      </button>

                      <label
                        className="px-2.5 py-1.5 rounded-lg bg-studio-input hover:bg-studio-card text-zinc-300 hover:text-white border border-studio-border text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Tải ảnh tùy chỉnh từ máy tính"
                      >
                        <Upload className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Tải ảnh lên</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleUploadImage(editingShot.id, e)}
                          disabled={uploadingShotId === editingShot.id}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setDirectorModalShot(editingShot as any)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Đạo diễn 3 góc máy & Visual Prompt Canvas"
                      >
                        <Camera className="w-3.5 h-3.5 text-amber-400" />
                        <span>Đạo diễn góc máy</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRenderVideo(editingShot.id, 'kenburns')}
                        disabled={renderingVideoShotId === editingShot.id}
                        className="px-2.5 py-1.5 rounded-lg bg-studio-input hover:bg-studio-card text-zinc-300 hover:text-emerald-400 border border-studio-border text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Tạo video chuyển động (Ken Burns 2.5D VFX)"
                      >
                        {renderingVideoShotId === editingShot.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        ) : (
                          <Film className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        <span>Ken Burns 2.5D</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRenderVideo(editingShot.id, 'replicate')}
                        disabled={renderingVideoShotId === editingShot.id}
                        className="px-2.5 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Tạo video chuyển động bằng AI (Replicate Wan 2.1 / Minimax / Kling)"
                      >
                        {renderingVideoShotId === editingShot.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        ) : (
                          <Video className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                        <span>AI Video Pro</span>
                      </button>

                      {editingShot.has_video && (
                        <button
                          type="button"
                          onClick={() => handleRemuxVideo(editingShot.id)}
                          disabled={remuxingShotId === editingShot.id}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Ghép ngay âm thanh mới vào video đã render mà không phải render lại hình ảnh (chỉ 0.1s)"
                        >
                          {remuxingShotId === editingShot.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 text-sky-400" />
                          )}
                          <span>Ghép lại Audio (Fast Remux)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Audio Mixing Rack (Phòng Thu Âm & Hòa Âm) */}
                  <div className="bg-gradient-to-br from-studio-card to-studio-deck rounded-2xl border border-studio-border p-3.5 flex flex-col gap-3 shadow-lg">
                    <div className="flex items-center justify-between pb-1.5 border-b border-studio-border">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Volume2 className="w-4 h-4 text-amber-400" />
                        Phòng Hòa Âm & Trộn Âm Lượng (Audio Mixer)
                      </span>
                      {editingShot.has_audio && (
                        <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono">
                          Audio Sẵn Sàng
                        </span>
                      )}
                    </div>

                    {/* Track 1: Voice / Speech Audio */}
                    <div className="bg-studio-input/80 rounded-xl border border-studio-border p-2.5 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                          <span>🗣️ Giọng đọc thoại</span>
                          <span className="text-[10px] font-mono text-amber-400">({Math.round(editVoiceVolume * 100)}%)</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRenderAudio(editingShot.id)}
                            disabled={renderingAudioShotId === editingShot.id}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Tạo giọng đọc TTS trực tiếp"
                          >
                            {renderingAudioShotId === editingShot.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                            ) : (
                              <Volume2 className="w-3 h-3" />
                            )}
                            <span>Tạo TTS</span>
                          </button>
                        </div>
                      </div>

                      {/* Voice Volume Slider */}
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] text-zinc-400 font-mono w-9">
                          {editVoiceVolume <= 0.01 ? 'Tắt' : `${Math.round(editVoiceVolume * 100)}%`}
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.05"
                          value={editVoiceVolume}
                          onChange={(e) => setEditVoiceVolume(parseFloat(e.target.value))}
                          className="flex-1 accent-amber-400 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditVoiceVolume(1.0)}
                            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                              Math.abs(editVoiceVolume - 1.0) < 0.01
                                ? 'bg-amber-400 text-zinc-950 font-bold border-amber-400'
                                : 'bg-studio-card text-zinc-400 hover:text-white border-studio-border'
                            }`}
                            title="Đặt về chuẩn 100%"
                          >
                            100%
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditVoiceVolume(1.5)}
                            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                              Math.abs(editVoiceVolume - 1.5) < 0.01
                                ? 'bg-amber-400 text-zinc-950 font-bold border-amber-400'
                                : 'bg-studio-card text-zinc-400 hover:text-white border-studio-border'
                            }`}
                            title="Tăng âm lượng 150%"
                          >
                            150%
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Track 2: Ambient SFX Audio */}
                    <div className="bg-studio-input/80 rounded-xl border border-studio-border p-2.5 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                          <span>🍃 Âm thanh môi trường & SFX</span>
                          <span className="text-[10px] font-mono text-violet-400">({Math.round(editSfxVolume * 100)}%)</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSfxModalShot(editingShot)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-violet-600/20 text-violet-300 border border-violet-500/30 hover:bg-violet-600/30 flex items-center gap-1 transition-colors cursor-pointer"
                            title="Mở thư viện Soundboard 25+ âm thanh & gợi ý AI"
                          >
                            <Sparkles className="w-3 h-3 text-amber-300" />
                            <span>Mở SFX Studio</span>
                          </button>
                          {editSfx && (
                            <button
                              type="button"
                              onClick={() => handlePlaySfx(editSfx)}
                              className={`text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                                playingSfx === editSfx
                                  ? 'bg-sky-500/30 text-sky-200 border border-sky-400'
                                  : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20'
                              }`}
                              title="Nghe thử âm thanh SFX"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>{playingSfx === editSfx ? 'Dừng' : 'Nghe'}</span>
                            </button>
                          )}
                          {editSfx && (
                            <button
                              type="button"
                              onClick={() => setEditSfx('')}
                              className="text-[10px] px-1.5 py-0.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Tắt âm thanh môi trường"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      <input
                        type="text"
                        value={editSfx}
                        onChange={(e) => setEditSfx(e.target.value)}
                        placeholder="Chọn preset bên dưới hoặc nhập SFX (rain, wind, thunder, waves...)"
                        className="w-full rounded-xl bg-studio-deck border border-studio-border p-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono"
                      />

                      {/* Preset Chips */}
                      <div className="flex flex-wrap gap-1">
                        {SFX_PRESETS.map((preset) => (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => setEditSfx(preset.key)}
                            className={`text-[10px] px-1.5 py-0.5 rounded-md border transition-all cursor-pointer flex items-center gap-1 ${
                              editSfx.toLowerCase().trim() === preset.key
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                                : 'bg-studio-deck hover:bg-studio-card text-zinc-400 hover:text-zinc-200 border-studio-border'
                            }`}
                          >
                            <span>{preset.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* SFX Volume Slider */}
                      <div className="flex items-center gap-2.5 pt-0.5">
                        <span className="text-[10px] text-zinc-400 font-mono w-9">
                          {editSfxVolume <= 0.01 ? 'Tắt' : `${Math.round(editSfxVolume * 100)}%`}
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.05"
                          value={editSfxVolume}
                          onChange={(e) => setEditSfxVolume(parseFloat(e.target.value))}
                          className="flex-1 accent-sky-400 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditSfxVolume(0.5)}
                            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                              Math.abs(editSfxVolume - 0.5) < 0.01
                                ? 'bg-sky-400 text-zinc-950 font-bold border-sky-400'
                                : 'bg-studio-card text-zinc-400 hover:text-white border-studio-border'
                            }`}
                            title="Âm lượng nền 50%"
                          >
                            50%
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditSfxVolume(1.0)}
                            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                              Math.abs(editSfxVolume - 1.0) < 0.01
                                ? 'bg-sky-400 text-zinc-950 font-bold border-sky-400'
                                : 'bg-studio-card text-zinc-400 hover:text-white border-studio-border'
                            }`}
                            title="Chuẩn 100%"
                          >
                            100%
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Master Mixed Audio Player */}
                    <div className="flex items-center justify-between pt-1 border-t border-studio-border/60">
                      <span className="text-[11px] font-semibold text-zinc-300">
                        🎵 Nghe Audio tổng hợp:
                      </span>
                      <button
                        type="button"
                        onClick={() => handlePlayShotAudio(editingShot.id)}
                        className={`text-xs px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          playingShotAudio === editingShot.id
                            ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-md font-bold'
                            : 'bg-studio-input hover:bg-studio-card text-zinc-200 border-studio-border'
                        }`}
                      >
                        <Play className={`w-3 h-3 ${playingShotAudio === editingShot.id ? 'fill-zinc-950' : 'fill-current'}`} />
                        <span>{playingShotAudio === editingShot.id ? 'Dừng phát' : 'Nghe Audio Shot'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: SCRIPT & CINEMATOGRAPHY (lg:col-span-7) */}
                <form onSubmit={handleSaveShot} className="lg:col-span-7 flex flex-col gap-3.5">
                  {/* Dialogue */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                        Lời thoại nhân vật (Dialogue):
                      </label>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {editDialogue.length} ký tự
                      </span>
                    </div>
                    <textarea
                      value={editDialogue}
                      onChange={(e) => setEditDialogue(e.target.value)}
                      rows={3}
                      placeholder="Nhập lời thoại của nhân vật trong phân cảnh này..."
                      className="w-full rounded-xl bg-studio-input border border-studio-border p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors font-sans leading-relaxed"
                    />
                  </div>

                  {/* Character & Motion */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                        Nhân vật phát ngôn:
                      </label>
                      <CustomSelect
                        value={editCharacterId}
                        onChange={setEditCharacterId}
                        options={characterOptions}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                        Chuyển động Camera (Ease-In-Out):
                      </label>
                      <CustomSelect
                        value={editMotion}
                        onChange={setEditMotion}
                        options={MOTION_OPTIONS}
                      />
                    </div>
                  </div>

                  {/* Visual Prompt */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                      Mô tả hình ảnh điện ảnh (Flux Prompt):
                    </label>
                    <textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      rows={3}
                      placeholder="Mô tả bối cảnh, ánh sáng, góc chụp chi tiết cho AI (tiếng Anh hoặc tiếng Việt)..."
                      className="w-full rounded-xl bg-studio-input border border-studio-border p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 transition-colors font-mono leading-relaxed"
                    />
                  </div>

                  {/* Cinematography Parameters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                        Khung hình (Shot Size):
                      </label>
                      <CustomSelect
                        value={editShotSize}
                        onChange={setEditShotSize}
                        options={SHOT_SIZE_OPTIONS}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                        Góc máy (Angle):
                      </label>
                      <CustomSelect
                        value={editCameraAngle}
                        onChange={setEditCameraAngle}
                        options={CAMERA_ANGLE_OPTIONS}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                        Ánh sáng (Lighting):
                      </label>
                      <CustomSelect
                        value={editLighting}
                        onChange={setEditLighting}
                        options={LIGHTING_OPTIONS}
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                        Cảm xúc phân cảnh (Mood):
                      </label>
                      <CustomSelect
                        value={editMood}
                        onChange={setEditMood}
                        options={MOOD_OPTIONS}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1">
                        Tâm lý nhân vật (Emotion):
                      </label>
                      <CustomSelect
                        value={editEmotion}
                        onChange={setEditEmotion}
                        options={EMOTION_OPTIONS}
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-studio-input/40 border border-studio-border/60 text-[11px] text-zinc-400 flex items-start gap-2 mt-auto">
                    <span className="text-amber-400 text-sm leading-none shrink-0">💡</span>
                    <span>
                      <strong>Bảo toàn video:</strong> Khi đổi lời thoại, giọng đọc, âm thanh môi trường hoặc âm lượng, hệ thống sẽ tự động hòa âm và ghép lại vào video clip chỉ trong 0.1s mà không phải render lại khung hình video!
                    </span>
                  </div>

                  {/* Modal Footer Actions */}
                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-studio-border">
                    <button
                      type="button"
                      disabled={updateShotMutation.isPending}
                      onClick={() => setEditingShot(null)}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-studio-card transition-colors cursor-pointer"
                    >
                      Đóng
                    </button>
                    <button
                      type="submit"
                      disabled={updateShotMutation.isPending}
                      className="px-6 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all shadow-md shadow-amber-500/20 active:scale-[0.98]"
                    >
                      {updateShotMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang lưu & hòa âm...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Lưu Thay Đổi (Save Changes)</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
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
                      Chuyển động Camera (Ease-In-Out):
                    </label>
                    <CustomSelect
                      value={newShotMotion}
                      onChange={setNewShotMotion}
                      options={MOTION_OPTIONS}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Khung hình (Shot Size):
                    </label>
                    <CustomSelect
                      value={newShotSize}
                      onChange={setNewShotSize}
                      options={SHOT_SIZE_OPTIONS}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Góc máy (Angle):
                    </label>
                    <CustomSelect
                      value={newShotAngle}
                      onChange={setNewShotAngle}
                      options={CAMERA_ANGLE_OPTIONS}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Ánh sáng (Lighting):
                    </label>
                    <CustomSelect
                      value={newShotLighting}
                      onChange={setNewShotLighting}
                      options={LIGHTING_OPTIONS}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Cảm xúc (Mood):
                    </label>
                    <CustomSelect
                      value={newShotMood}
                      onChange={setNewShotMood}
                      options={MOOD_OPTIONS}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                      Tâm lý nhân vật (Emotion):
                    </label>
                    <CustomSelect
                      value={newShotEmotion}
                      onChange={setNewShotEmotion}
                      options={EMOTION_OPTIONS}
                    />
                  </div>
                </div>

                {/* Volumes in Add Shot */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-studio-input/50 rounded-xl border border-studio-border">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-zinc-300">Âm lượng giọng đọc:</span>
                      <span className="text-[10px] font-mono text-amber-400">{Math.round(newShotVoiceVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      value={newShotVoiceVolume}
                      onChange={(e) => setNewShotVoiceVolume(parseFloat(e.target.value))}
                      className="w-full accent-amber-400 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-zinc-300">Âm lượng SFX:</span>
                      <span className="text-[10px] font-mono text-sky-400">{Math.round(newShotSfxVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      value={newShotSfxVolume}
                      onChange={(e) => setNewShotSfxVolume(parseFloat(e.target.value))}
                      className="w-full accent-sky-400 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
                      Âm thanh môi trường (SFX):
                    </label>
                    {newShotSfx && (
                      <button
                        type="button"
                        onClick={() => handlePlaySfx(newShotSfx)}
                        className={`text-[11px] px-2 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer ${
                          playingSfx === newShotSfx
                            ? 'bg-sky-500/30 text-sky-200 border border-sky-400'
                            : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20'
                        }`}
                        title="Nghe thử âm thanh hiện tại"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>{playingSfx === newShotSfx ? 'Dừng phát' : 'Nghe thử'}</span>
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={newShotSfx}
                    onChange={(e) => setNewShotSfx(e.target.value)}
                    placeholder="e.g. rain, thunder, wind, waves..."
                    className="w-full rounded-xl bg-studio-input border border-studio-border p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono"
                  />
                  {/* Preset chips */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {SFX_PRESETS.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => setNewShotSfx(preset.key)}
                        className={`text-[10px] px-2 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                          newShotSfx.toLowerCase().trim() === preset.key
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-medium'
                            : 'bg-studio-input hover:bg-studio-card text-zinc-400 hover:text-zinc-200 border-studio-border'
                        }`}
                      >
                        <span>{preset.label}</span>
                      </button>
                    ))}
                    {newShotSfx && (
                      <button
                        type="button"
                        onClick={() => setNewShotSfx('')}
                        className="text-[10px] px-2 py-1 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-300 transition-colors cursor-pointer"
                        title="Xóa âm thanh ngoại cảnh"
                      >
                        ✕ Xóa SFX
                      </button>
                    )}
                  </div>
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

      {/* Camera Director & Multi-Camera Modal */}
      <CameraDirectorModal
        isOpen={!!directorModalShot}
        onClose={() => setDirectorModalShot(null)}
        shot={directorModalShot}
        characters={characters}
      />

      {/* Color Grading A/B Inspector Modal */}
      {colorInspectorShot && (
        <ColorInspectorModal
          shot={colorInspectorShot.shot}
          shotIndex={colorInspectorShot.index}
          onClose={() => setColorInspectorShot(null)}
          onApplyLutToProject={handleApplyLutToProject}
          currentProjectLut={localStorage.getItem('studio_color_lut') || 'none'}
        />
      )}

      {/* AI Voice Clone Modal */}
      <VoiceCloneModal
        isOpen={isVoiceCloneOpen}
        onClose={() => {
          setIsVoiceCloneOpen(false)
          setSelectedCharForVoice(null)
        }}
        characterId={selectedCharForVoice?.id}
        characterName={selectedCharForVoice?.name}
        onVoiceCloned={(clonedVoice) => {
          if (selectedCharForVoice?.id) {
            handleVoiceChange(selectedCharForVoice.id, clonedVoice.id)
          }
        }}
      />

      {/* Multilingual Dubbing Studio Modal */}
      <DubbingModal
        isOpen={isDubbingOpen}
        onClose={() => setIsDubbingOpen(false)}
        projectId="current"
        characters={characters}
      />

      {/* Smart Auto-Reframe 9:16 Shorts Modal */}
      <AutoReframeModal
        isOpen={isReframeOpen}
        onClose={() => setIsReframeOpen(false)}
        projectId="current"
        sourceVideoUrl="/api/outputs/master_movie.mp4"
      />

      {/* AI Foley & SFX Soundboard Modal */}
      <SFXSoundboardModal
        isOpen={!!sfxModalShot}
        onClose={() => setSfxModalShot(null)}
        shot={sfxModalShot}
        genre={typeof (storyboard as any)?.genre === 'string' ? (storyboard as any).genre : ''}
        onSaveSfx={handleSaveShotSfx}
      />

      {/* Character Vault Consistency Engine Pro Modal */}
      <CharacterVaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        currentProjectId="current"
      />
    </Card>
  )
}
