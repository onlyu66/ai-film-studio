import React, { useState, useEffect, lazy, Suspense } from 'react'
import {
  Sparkles,
  Settings2,
  Languages,
  Clock,
  Palette,
  Bot,
  Film,
  Mic,
  MicOff,
  Camera,
  Video,
  Cpu,
  Server,
  Clapperboard,
  X,
  Send,
  Check,
  Loader2,
  Key,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileEdit,
  Smartphone,
  Monitor,
  Zap,
  Type,
  Music,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Upload,
  Sliders,
} from 'lucide-react'
import { CustomSelect } from './ui/select'
import {
  useTestWebhook,
  useFetchLlmModels,
  useHardwareInfo,
  useImageEngines,
  useTestImageEngine,
  useVideoModels,
  useTestVideoToken,
  useSubtitlePresets,
  useBgmTracks,
  useUploadCustomBgm,
} from '../api/queries'
import type {
  PresetIdea,
  StyleOption,
  SelectOption,
  ProductionFormData,
  LLMModelItem,
  StoryTemplate,
  ImageEngineInfo,
  SubtitlePresetItem,
  BgmTrackItem,
} from '../types'

const StoryTemplateModal = lazy(() => import('./StoryTemplateModal'))

const IMAGE_ENGINE_OPTIONS: SelectOption[] = [
  { value: 'pollinations', label: 'Flux Cloud (Pollinations)', subtext: 'Mặc định — Nhanh, không cần cài đặt', icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" /> },
  { value: 'sd_webui', label: 'Local SD WebUI / Forge', subtext: 'A1111 REST API (Port 7860)', icon: <Cpu className="w-3.5 h-3.5 text-emerald-400" /> },
  { value: 'comfyui', label: 'Local ComfyUI', subtext: 'Graph Workflow API (Port 8188)', icon: <Server className="w-3.5 h-3.5 text-sky-400" /> },
]

const DEFAULT_SUBTITLE_PRESETS: SubtitlePresetItem[] = [
  {
    id: 'tiktok_bold',
    name: 'TikTok / Reels Bold',
    font_name: 'Montserrat',
    font_size_16_9: 22,
    font_size_9_16: 20,
    primary_color: '&H0000FFFF',
    outline_color: '&H00000000',
    primary_color_hex: '#ffff00',
    outline_color_hex: '#000000',
    bold: 1,
    outline: 3.0,
    shadow: 1.5,
    alignment: 2,
    margin_v_16_9: 40,
    margin_v_9_16: 120,
    description: 'Chữ vàng viền đen dày nổi bật, chuẩn video ngắn Shorts & TikTok',
    preview_text: 'Phim điện ảnh siêu thực đỉnh cao',
  },
  {
    id: 'cinematic',
    name: 'Cinematic Classic',
    font_name: 'Cinzel',
    font_size_16_9: 20,
    font_size_9_16: 17,
    primary_color: '&H00E8FFFF',
    outline_color: '&H00101010',
    primary_color_hex: '#ffffe8',
    outline_color_hex: '#101010',
    bold: 1,
    outline: 1.5,
    shadow: 1.0,
    alignment: 2,
    margin_v_16_9: 40,
    margin_v_9_16: 80,
    description: 'Phông chữ trang nhã viền thanh mảnh chuẩn phim chiếu rạp',
    preview_text: 'Bí mật ngàn năm dưới đáy đại dương',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    font_name: 'Courier New',
    font_size_16_9: 22,
    font_size_9_16: 18,
    primary_color: '&H00FFFF00',
    outline_color: '&H00000000',
    primary_color_hex: '#00ffff',
    outline_color_hex: '#000000',
    bold: 1,
    outline: 2.8,
    shadow: 2.0,
    alignment: 2,
    margin_v_16_9: 40,
    margin_v_9_16: 90,
    description: 'Sắc màu Cyan viền đen phong cách khoa học viễn tưởng tương lai',
    preview_text: 'Hệ thống AI Cyberpunk 2088',
  },
  {
    id: 'retro_vhs',
    name: 'Retro 80s VHS',
    font_name: 'Trebuchet MS',
    font_size_16_9: 21,
    font_size_9_16: 18,
    primary_color: '&H0033E0FF',
    outline_color: '&H00000000',
    primary_color_hex: '#ffe033',
    outline_color_hex: '#000000',
    bold: 1,
    outline: 2.2,
    shadow: 0.0,
    alignment: 2,
    margin_v_16_9: 45,
    margin_v_9_16: 95,
    description: 'Màu vàng cổ điển với nền tối vintage hoài niệm thập niên 80',
    preview_text: 'Bản ghi hình lưu trữ năm 1984',
  },
  {
    id: 'minimalist',
    name: 'Minimalist Clean',
    font_name: 'Arial',
    font_size_16_9: 19,
    font_size_9_16: 16,
    primary_color: '&H00FFFFFF',
    outline_color: '&H00202020',
    primary_color_hex: '#ffffff',
    outline_color_hex: '#202020',
    bold: 0,
    outline: 1.2,
    shadow: 0.8,
    alignment: 2,
    margin_v_16_9: 35,
    margin_v_9_16: 70,
    description: 'Tối giản, tinh tế, không viền nặng, tập trung vào hình ảnh',
    preview_text: 'Khoảnh khắc bình minh tĩnh lặng',
  },
  {
    id: 'karaoke_pop',
    name: 'Karaoke Pop Highlight',
    font_name: 'Montserrat',
    font_size_16_9: 23,
    font_size_9_16: 20,
    primary_color: '&H0000FFFF',
    outline_color: '&H00000000',
    primary_color_hex: '#ffff00',
    outline_color_hex: '#000000',
    bold: 1,
    outline: 3.0,
    shadow: 1.5,
    alignment: 2,
    margin_v_16_9: 50,
    margin_v_9_16: 130,
    description: 'Hiệu ứng nhảy sáng từ ngữ theo nhịp điệu phát âm cuốn hút',
    preview_text: 'Từng câu thoại bừng sáng sống động',
  },
]

const DEFAULT_BGM_TRACKS: BgmTrackItem[] = [
  {
    id: 'cinematic',
    name: 'Cinematic Epic Orchestral',
    genre: 'Orchestral / Soundtrack',
    mood: 'Hùng tráng, cao trào điện ảnh, kịch tính',
    bpm: 120,
    description: 'Dàn nhạc giao hưởng hùng tráng, bộ gõ mạnh mẽ, phù hợp cao trào và trailer',
    stream_url: '/api/assets/bgm/cinematic.mp3',
  },
  {
    id: 'action',
    name: 'Intense Action & Hybrid Drums',
    genre: 'Action / Hybrid Drums',
    mood: 'Dồn dập, hồi hộp, hành động rượt đuổi',
    bpm: 135,
    description: 'Tiết tấu nhanh, trống điện tử dồn dập, căng thẳng nghẹt thở',
    stream_url: '/api/assets/bgm/action.mp3',
  },
  {
    id: 'dramatic',
    name: 'Deep Dramatic Piano & Strings',
    genre: 'Emotional Drama',
    mood: 'Sâu lắng, bi tráng, cảm xúc dâng trào',
    bpm: 85,
    description: 'Đàn piano solo phối hợp dàn dây du dương xúc động',
    stream_url: '/api/assets/bgm/dramatic.mp3',
  },
  {
    id: 'calm',
    name: 'Peaceful Ambient Atmosphere',
    genre: 'Ambient / Chillout',
    mood: 'Thanh bình, êm đềm, suy tư thư thái',
    bpm: 75,
    description: 'Không gian tĩnh mịch, giai điệu nhẹ nhàng sâu lắng',
    stream_url: '/api/assets/bgm/calm.mp3',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Synthwave 2077',
    genre: 'Synthwave / Electronic',
    mood: 'Tương lai viễn tưởng, neon rực rỡ, sci-fi',
    bpm: 125,
    description: 'Bass analog synthesizer dày dặn, phong cách viễn tưởng tương lai',
    stream_url: '/api/assets/bgm/cyberpunk.mp3',
  },
  {
    id: 'mysterious',
    name: 'Dark Mystery & Suspense',
    genre: 'Mystery / Thriller',
    mood: 'Bí ẩn, ma mị, rùng rợn, giật gân',
    bpm: 90,
    description: 'Âm hưởng u tối, huyền bí, thôi miên khám phá bí mật cổ xưa',
    stream_url: '/api/assets/bgm/mysterious.mp3',
  },
  {
    id: 'noir',
    name: 'Vintage Film Noir & Jazz',
    genre: 'Jazz / Noir Blues',
    mood: 'Hoài niệm, mưa đêm phố cổ, trinh thám cổ điển',
    bpm: 80,
    description: 'Saxophone quyến rũ, jazz u buồn kiểu phim trinh thám thập niên 50',
    stream_url: '/api/assets/bgm/noir.mp3',
  },
  {
    id: 'anime',
    name: 'Emotional Anime & Fantasy',
    genre: 'Anime / Fantasy',
    mood: 'Trong trẻo, hy vọng, hành trình phiêu lưu kỳ thú',
    bpm: 110,
    description: 'Giai điệu anime mộng mơ, cảm xúc phiêu lưu tươi sáng',
    stream_url: '/api/assets/bgm/anime.mp3',
  },
  {
    id: 'documentary',
    name: 'Discovery Horizon & Nature',
    genre: 'Documentary / World',
    mood: 'Khám phá tri thức, vĩ đại, thiên nhiên hùng vĩ',
    bpm: 100,
    description: 'Phim tài liệu khoa học, địa lý, trang trọng và truyền cảm hứng',
    stream_url: '/api/assets/bgm/documentary.mp3',
  },
]

const LANG_OPTIONS: SelectOption[] = [
  { value: 'vi', label: 'Tiếng Việt', subtext: 'Giọng AI tự nhiên, truyền cảm', icon: <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-studio-card border border-studio-border text-amber-300">VI</span> },
  { value: 'en', label: 'English (US)', subtext: 'Natural American cinematic narration', icon: <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-studio-card border border-studio-border text-zinc-300">EN</span> },
  { value: 'ja', label: 'Japanese (日本語)', subtext: 'Studio narration & anime style', icon: <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-studio-card border border-studio-border text-zinc-300">JA</span> },
  { value: 'fr', label: 'French (Français)', subtext: 'Classic European cinema tone', icon: <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-studio-card border border-studio-border text-zinc-300">FR</span> },
]

const LLM_OPTIONS: SelectOption[] = [
  { value: 'gemini', label: 'Google Gemini', subtext: 'Khuyên dùng — Siêu tốc, phân cảnh thông minh', icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" /> },
  { value: 'groq', label: 'Groq Cloud', subtext: 'Llama 3.3 70B & Mixtral', icon: <Cpu className="w-3.5 h-3.5 text-sky-400" /> },
  { value: 'ollama', label: 'Ollama Local', subtext: '100% Offline trên máy chủ', icon: <Server className="w-3.5 h-3.5 text-emerald-400" /> },
  { value: 'openai', label: 'OpenAI ChatGPT', subtext: 'GPT-4o & tương thích', icon: <Bot className="w-3.5 h-3.5 text-purple-400" /> },
]

const MOTION_OPTIONS: SelectOption[] = [
  { value: 'vfx', label: 'Cinematic 2.5D VFX', subtext: 'Ken Burns & Dynamic Lighting', icon: <Camera className="w-3.5 h-3.5 text-amber-400" /> },
  { value: 'kenburns', label: 'Ken Burns Classic', subtext: 'Zoom & Pan camera mượt mà', icon: <Film className="w-3.5 h-3.5 text-zinc-400" /> },
  { value: 'replicate', label: 'Replicate AI Video', subtext: 'Image-to-Video Cloud động', icon: <Video className="w-3.5 h-3.5 text-indigo-400" /> },
]

const LIPSYNC_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'Tắt nhép môi', subtext: 'Render nhanh, máy nhẹ', icon: <MicOff className="w-3.5 h-3.5 text-zinc-400" /> },
  { value: 'cloud', label: 'SadTalker Lip-Sync', subtext: 'Khớp khẩu hình nhân vật', icon: <Mic className="w-3.5 h-3.5 text-indigo-400" /> },
]

const PRESET_IDEAS: (PresetIdea & { tag: string })[] = [
  {
    title: "Bí ẩn Atlantis",
    topic: "Bí ẩn thành phố Atlantis chìm sâu dưới đáy đại dương và đoàn thám hiểm cổ vật",
    style: "cinematic",
    emoji: "",
    tag: "Sci-Fi"
  },
  {
    title: "Cyberpunk Tokyo 2088",
    topic: "Một thám tử tư có mắt điều khiển học điều tra đường dây trí tuệ nhân tạo mất tích tại Tokyo",
    style: "noir",
    emoji: "",
    tag: "Cyberpunk"
  },
  {
    title: "Chiến binh Cuối cùng",
    topic: "Robot vệ binh cổ đại tỉnh dậy giữa sa mạc cát đỏ để hoàn thành mệnh lệnh cuối cùng bảo vệ mầm cây sự sống",
    style: "anime",
    emoji: "",
    tag: "Anime"
  },
  {
    title: "Đế chế La Mã",
    topic: "Sự trỗi dậy của các quân đoàn La Mã cổ đại và cuộc vây hãm thành cổ",
    style: "documentary",
    emoji: "",
    tag: "History"
  }
]

const STYLES: (StyleOption & { tag: string; accent: string; gradient: string })[] = [
  { id: 'cinematic', label: 'Cinematic 35mm', desc: 'Ánh sáng kịch tính, tỉ lệ điện ảnh cao cấp', emoji: '', gradient: 'from-amber-400 via-amber-500 to-orange-500', tag: '35mm Film', accent: 'from-amber-500/15 to-orange-500/5' },
  { id: 'anime', label: 'Anime Studio', desc: 'Màu sắc Makoto Shinkai rực rỡ, chi tiết', emoji: '', gradient: 'from-pink-400 via-purple-400 to-indigo-500', tag: 'Animation', accent: 'from-pink-500/15 to-indigo-500/5' },
  { id: 'noir', label: 'Film Noir', desc: 'Độ tương phản cao, bóng đổ bí ẩn kinh điển', emoji: '', gradient: 'from-zinc-400 via-zinc-500 to-zinc-600', tag: 'Classic Noir', accent: 'from-zinc-500/15 to-zinc-800/10' },
  { id: 'documentary', label: 'Documentary 8K', desc: 'Ảnh tư liệu thực tế National Geographic', emoji: '', gradient: 'from-emerald-400 via-teal-400 to-cyan-500', tag: 'Photoreal', accent: 'from-emerald-500/15 to-teal-500/5' },
]

export interface ProductionFormProps {
  onSubmit: (data: ProductionFormData) => void
  isRunning: boolean
  initialData?: Partial<ProductionFormData> | null
  onResetSeries?: () => void
}

export default function ProductionForm({ onSubmit, isRunning, initialData, onResetSeries }: ProductionFormProps) {
  const [topic, setTopic] = useState('Bí ẩn thành phố Atlantis chìm sâu dưới đáy đại dương và đoàn thám hiểm cổ vật')
  const [lang, setLang] = useState('vi')
  const [duration, setDuration] = useState(5)
  const [style, setStyle] = useState('cinematic')
  const [llm, setLlm] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [availableModels, setAvailableModels] = useState<LLMModelItem[]>([])
  const [hasEnvKey, setHasEnvKey] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [isCustomModel, setIsCustomModel] = useState(false)
  const [customModelText, setCustomModelText] = useState('')

  const fetchModelsMutation = useFetchLlmModels()

  const loadModelsForProvider = (provider: string, customKey?: string) => {
    setModelsError(null)
    const keyToUse = customKey !== undefined ? customKey : (localStorage.getItem(`studio_llm_key_${provider}`) || '')
    fetchModelsMutation.mutate(
      { provider, apiKey: keyToUse.trim() || undefined },
      {
        onSuccess: (data) => {
          if (data.success && data.models && data.models.length > 0) {
            setAvailableModels(data.models)
            setHasEnvKey(!!data.has_env_key)
            setSelectedModel((prev) => {
              const exists = data.models.some((m) => m.id === prev)
              return exists && prev ? prev : (data.default || data.models[0].id)
            })
          } else {
            setAvailableModels([])
            setHasEnvKey(!!data.has_env_key)
            if (data.error) {
              setModelsError(data.error)
            }
          }
        },
        onError: (err: any) => {
          setModelsError(err?.message || 'Không thể kết nối lấy danh sách model')
          setAvailableModels([])
        },
      }
    )
  }

  useEffect(() => {
    const savedKey = localStorage.getItem(`studio_llm_key_${llm}`) || ''
    setApiKey(savedKey)
    loadModelsForProvider(llm, savedKey)
  }, [llm])

  const handleApiKeyChange = (val: string) => {
    setApiKey(val)
    localStorage.setItem(`studio_llm_key_${llm}`, val)
  }

  const [motion, setMotion] = useState('vfx')
  const [lipSync, setLipSync] = useState('none')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [hardsub, setHardsub] = useState(false)
  const [pauseAfterScript, setPauseAfterScript] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [seriesTitle, setSeriesTitle] = useState('')
  const [episode, setEpisode] = useState(1)
  const [parentProjectId, setParentProjectId] = useState<string | undefined>(undefined)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [testWebhookSuccess, setTestWebhookSuccess] = useState(false)
  const [hardwareProfile, setHardwareProfile] = useState('auto')
  const [hardwareAccel, setHardwareAccel] = useState('auto')
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplate | null>(null)

  const handleSelectTemplate = (tmpl: StoryTemplate) => {
    setSelectedTemplate(tmpl)
    setTopic(tmpl.default_topic)
    if (tmpl.style) setStyle(tmpl.style)
    if (tmpl.aspect_ratio) setAspectRatio(tmpl.aspect_ratio)
  }

  const { data: hardwareInfo } = useHardwareInfo()
  const testWebhookMutation = useTestWebhook()

  const [imageEngine, setImageEngine] = useState('pollinations')
  const [imageApiUrl, setImageApiUrl] = useState('')
  const [testImageEngineStatus, setTestImageEngineStatus] = useState<ImageEngineInfo | null>(null)

  const { data: imageEngines = [] } = useImageEngines()
  const testImageEngineMutation = useTestImageEngine()

  useEffect(() => {
    const savedEngine = localStorage.getItem('studio_image_engine') || 'pollinations'
    const savedUrl = localStorage.getItem('studio_image_api_url') || ''
    setImageEngine(savedEngine)
    setImageApiUrl(savedUrl)
  }, [])

  const handleImageEngineChange = (val: string) => {
    setImageEngine(val)
    localStorage.setItem('studio_image_engine', val)
    setTestImageEngineStatus(null)
  }

  const handleImageApiUrlChange = (val: string) => {
    setImageApiUrl(val)
    localStorage.setItem('studio_image_api_url', val)
  }

  const handleTestImageEngine = () => {
    testImageEngineMutation.mutate(
      {
        engine: imageEngine,
        url: imageApiUrl.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          setTestImageEngineStatus(data)
        },
        onError: (err: any) => {
          setTestImageEngineStatus({
            id: imageEngine,
            name: imageEngine,
            is_available: false,
            is_local: true,
            url: imageApiUrl,
            message: err?.message || 'Lỗi kết nối tới engine',
          })
        },
      }
    )
  }

  const [videoApiToken, setVideoApiToken] = useState('')
  const [showVideoToken, setShowVideoToken] = useState(false)
  const [videoModel, setVideoModel] = useState('wan-video/wan-2.1-i2v-480p')
  const [testVideoTokenStatus, setTestVideoTokenStatus] = useState<{ is_valid: boolean; username?: string; message: string } | null>(null)

  const { data: videoModels = [] } = useVideoModels()
  const testVideoTokenMutation = useTestVideoToken()

  useEffect(() => {
    const savedToken = localStorage.getItem('studio_replicate_token') || ''
    const savedModel = localStorage.getItem('studio_replicate_model') || 'wan-video/wan-2.1-i2v-480p'
    setVideoApiToken(savedToken)
    setVideoModel(savedModel)
  }, [])

  const handleVideoTokenChange = (val: string) => {
    setVideoApiToken(val)
    localStorage.setItem('studio_replicate_token', val)
    setTestVideoTokenStatus(null)
  }

  const handleVideoModelChange = (val: string) => {
    setVideoModel(val)
    localStorage.setItem('studio_replicate_model', val)
  }

  const handleTestVideoToken = () => {
    if (!videoApiToken.trim()) return
    testVideoTokenMutation.mutate(videoApiToken.trim(), {
      onSuccess: (data) => setTestVideoTokenStatus(data),
      onError: (err: any) => setTestVideoTokenStatus({ is_valid: false, message: err?.message || 'Lỗi kết nối' }),
    })
  }

  const [subtitleStyle, setSubtitleStyle] = useState('tiktok_bold')
  const [subtitlePosition, setSubtitlePosition] = useState('bottom')
  const [subtitleKaraoke, setSubtitleKaraoke] = useState(false)

  const { data: subtitlePresets = [] } = useSubtitlePresets()

  useEffect(() => {
    const savedSubStyle = localStorage.getItem('studio_subtitle_style') || 'tiktok_bold'
    const savedSubPos = localStorage.getItem('studio_subtitle_position') || 'bottom'
    const savedSubKaraoke = localStorage.getItem('studio_subtitle_karaoke') === 'true'
    setSubtitleStyle(savedSubStyle)
    setSubtitlePosition(savedSubPos)
    setSubtitleKaraoke(savedSubKaraoke)
  }, [])

  const handleSubtitleStyleChange = (val: string) => {
    setSubtitleStyle(val)
    localStorage.setItem('studio_subtitle_style', val)
  }

  const handleSubtitlePositionChange = (val: string) => {
    setSubtitlePosition(val)
    localStorage.setItem('studio_subtitle_position', val)
  }

  const handleSubtitleKaraokeChange = (val: boolean) => {
    setSubtitleKaraoke(val)
    localStorage.setItem('studio_subtitle_karaoke', val ? 'true' : 'false')
  }

  const [bgmPreset, setBgmPreset] = useState('cinematic')
  const [bgmVolume, setBgmVolume] = useState(0.7)
  const [duckingLevel, setDuckingLevel] = useState<'none' | 'light' | 'medium' | 'heavy'>('medium')
  const [playingBgmId, setPlayingBgmId] = useState<string | null>(null)
  const [bgmAudioElement, setBgmAudioElement] = useState<HTMLAudioElement | null>(null)
  const [uploadBgmError, setUploadBgmError] = useState<string | null>(null)

  const { data: bgmTracks = DEFAULT_BGM_TRACKS } = useBgmTracks()
  const uploadBgmMutation = useUploadCustomBgm()

  useEffect(() => {
    const savedBgmPreset = localStorage.getItem('studio_bgm_preset') || 'cinematic'
    const savedBgmVolume = localStorage.getItem('studio_bgm_volume')
    const savedDuckingLevel = (localStorage.getItem('studio_ducking_level') as any) || 'medium'
    setBgmPreset(savedBgmPreset)
    if (savedBgmVolume) setBgmVolume(parseFloat(savedBgmVolume))
    if (['none', 'light', 'medium', 'heavy'].includes(savedDuckingLevel)) setDuckingLevel(savedDuckingLevel)
  }, [])

  const handleBgmPresetChange = (val: string) => {
    setBgmPreset(val)
    localStorage.setItem('studio_bgm_preset', val)
  }

  const handleBgmVolumeChange = (val: number) => {
    setBgmVolume(val)
    localStorage.setItem('studio_bgm_volume', val.toString())
  }

  const handleDuckingLevelChange = (val: 'none' | 'light' | 'medium' | 'heavy') => {
    setDuckingLevel(val)
    localStorage.setItem('studio_ducking_level', val)
  }

  const handleTogglePlayBgm = (track: BgmTrackItem) => {
    if (playingBgmId === track.id) {
      if (bgmAudioElement) {
        bgmAudioElement.pause()
        setBgmAudioElement(null)
      }
      setPlayingBgmId(null)
      return
    }

    if (bgmAudioElement) {
      bgmAudioElement.pause()
    }

    if (!track.stream_url) return

    const audio = new Audio(track.stream_url)
    audio.volume = Math.min(Math.max(bgmVolume, 0.05), 1.0)
    audio.play().catch((err) => {
      console.warn('Audio preview playback error:', err)
    })
    audio.onended = () => {
      setPlayingBgmId(null)
      setBgmAudioElement(null)
    }
    setBgmAudioElement(audio)
    setPlayingBgmId(track.id)
  }

  useEffect(() => {
    return () => {
      if (bgmAudioElement) {
        bgmAudioElement.pause()
      }
    }
  }, [bgmAudioElement])

  const handleBgmFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadBgmError(null)

    if (file.size > 25 * 1024 * 1024) {
      setUploadBgmError('Tệp âm thanh quá lớn (vui lòng chọn tệp dưới 25MB)')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      uploadBgmMutation.mutate(
        { filename: file.name, audioBase64: base64 },
        {
          onSuccess: (res) => {
            if (res.id) {
              handleBgmPresetChange(res.id)
            }
          },
          onError: (err: any) => {
            setUploadBgmError(err?.message || 'Tải nhạc thất bại')
          },
        }
      )
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    if (initialData) {
      if (initialData.topic) setTopic(initialData.topic)
      if (initialData.lang) setLang(initialData.lang)
      if (initialData.style) setStyle(initialData.style)
      if (initialData.duration) setDuration(initialData.duration)
      if (initialData.aspect_ratio) setAspectRatio(initialData.aspect_ratio)
      if (initialData.series_title) setSeriesTitle(initialData.series_title)
      if (initialData.episode) setEpisode(initialData.episode)
      if (initialData.parent_project_id) setParentProjectId(initialData.parent_project_id)
      if (initialData.webhook_url) setWebhookUrl(initialData.webhook_url)
    }
  }, [initialData])

  const handleApplyPreset = (p: PresetIdea) => {
    setTopic(p.topic)
    setStyle(p.style)
  }

  const handleTestWebhook = () => {
    if (!webhookUrl.trim()) return
    testWebhookMutation.mutate(webhookUrl.trim(), {
      onSuccess: () => {
        setTestWebhookSuccess(true)
        setTimeout(() => setTestWebhookSuccess(false), 3000)
      },
      onError: (err: any) => {
        alert(`Lỗi Webhook: ${err?.message || 'Không thể gửi'}`)
      },
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return
    const finalModel = isCustomModel ? customModelText.trim() : selectedModel
    onSubmit({
      topic,
      lang,
      duration: Number(duration),
      style,
      llm,
      llm_api_key: apiKey.trim() || undefined,
      llm_model: finalModel || undefined,
      motion,
      lip_sync: lipSync,
      aspect_ratio: aspectRatio,
      hardsub,
      pause_after_script: pauseAfterScript,
      series_title: seriesTitle.trim() || undefined,
      episode: Number(episode) || 1,
      parent_project_id: parentProjectId,
      webhook_url: webhookUrl.trim() || undefined,
      hardware_profile: hardwareProfile === 'auto' ? undefined : hardwareProfile,
      hardware_accel: hardwareAccel,
      template_id: selectedTemplate?.id || undefined,
      image_engine: imageEngine,
      image_api_url: (imageEngine !== 'pollinations' && imageApiUrl.trim()) ? imageApiUrl.trim() : undefined,
      video_api_token: motion === 'replicate' && videoApiToken.trim() ? videoApiToken.trim() : undefined,
      video_model: motion === 'replicate' ? videoModel : undefined,
      subtitle_style: hardsub ? subtitleStyle : undefined,
      subtitle_position: hardsub ? subtitlePosition : undefined,
      subtitle_karaoke: hardsub ? subtitleKaraoke : undefined,
      bgm_preset: bgmPreset,
      bgm_volume: bgmVolume,
      ducking_level: duckingLevel,
    })
  }

  return (
    <div id="director-inspector" className="glass-panel rounded-3xl p-5 sm:p-7 shadow-2xl relative">
      {/* Series Sequel Alert */}
      {parentProjectId && (
        <div className="mb-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              EP{episode}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono font-bold uppercase text-amber-400 block tracking-wider">
                Chế độ Phim Bộ (Series Mode)
              </span>
              <p className="text-xs text-zinc-200 truncate">
                Tiếp nối: <strong className="text-white">{seriesTitle || 'Tập trước'}</strong> (Kế thừa nhân vật & visual DNA)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setParentProjectId(undefined)
              setSeriesTitle('')
              setEpisode(1)
              onResetSeries?.()
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
            title="Hủy liên kết tập phim"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form Area */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Prompt Studio Area */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Ý tưởng kịch bản & Đề tài bộ phim</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(true)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                title="Mở thư viện kịch bản điện ảnh mẫu"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>✨ Kịch Bản Mẫu (Templates)</span>
              </button>
            </div>
          </div>

          {/* Active Template Banner (if selected) */}
          {selectedTemplate && (
            <div className="flex items-center justify-between p-2.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-zinc-900 to-zinc-900 border border-amber-500/30 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-lg shrink-0">{selectedTemplate.icon || '🎬'}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-300 truncate">{selectedTemplate.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                      {selectedTemplate.aspect_ratio}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 block truncate">
                    Thể loại: {selectedTemplate.category} • Style: {selectedTemplate.style} • Đã nạp {Object.keys(selectedTemplate.characters || {}).length} nhân vật Visual DNA
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="p-1 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 ml-2"
                title="Bỏ dùng template này"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Prompt Textarea */}
          <div className="relative group">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isRunning}
              rows={3}
              placeholder="Mô tả ý tưởng, cốt truyện, nhân vật hoặc đề tài tài liệu mà bạn muốn AI sản xuất thành phim..."
              className="w-full px-4 py-3.5 rounded-2xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-zinc-100 placeholder-zinc-500 text-sm focus:outline-none focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/15 transition-all resize-none disabled:opacity-50 font-sans leading-relaxed shadow-inner"
            />
            <div className="absolute bottom-2.5 right-3 flex items-center gap-2 pointer-events-none">
              <span className="text-[10px] font-mono text-zinc-500 bg-studio-deck/80 px-2 py-0.5 rounded-md border border-studio-border/50">
                {topic.length} ký tự
              </span>
            </div>
            {topic && !isRunning && (
              <button
                type="button"
                onClick={() => setTopic('')}
                className="absolute top-3 right-3 p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                title="Xóa nhanh prompt"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Clean Quick Inspiration Chips Below Textarea */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mr-1">Ý tưởng mẫu:</span>
            {PRESET_IDEAS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                disabled={isRunning}
                className="px-2.5 py-1 rounded-xl bg-studio-card hover:bg-studio-elevated border border-studio-border hover:border-amber-400/50 text-[11px] font-medium text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
              >
                <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold ${
                  p.tag === 'Sci-Fi' ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' :
                  p.tag === 'Cyberpunk' ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30' :
                  p.tag === 'Anime' ? 'bg-pink-500/15 text-pink-300 border border-pink-500/30' :
                  'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {p.tag}
                </span>
                <span>{p.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Visual Style Gallery Deck */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-400" />
              <span>Phong cách hình ảnh & Màu sắc điện ảnh</span>
            </label>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider hidden sm:inline">
              Flux LoRA • Cinematic Color Grade
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {STYLES.map((st) => {
              const isSelected = style === st.id
              return (
                <div
                  key={st.id}
                  onClick={() => !isRunning && setStyle(st.id)}
                  className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between group active:scale-[0.98] ${
                    isSelected
                      ? 'bg-gradient-to-b ' + st.accent + ' border-amber-400/80 shadow-xl shadow-amber-500/15 ring-2 ring-amber-400/30'
                      : 'bg-studio-card/80 border-studio-border hover:border-studio-border-hover hover:bg-studio-elevated/70'
                  }`}
                >
                  {/* Subtle Top Accent Gradient Bar */}
                  <div
                    className={`absolute top-0 left-0 right-0 h-1 transition-opacity bg-gradient-to-r ${st.gradient} ${
                      isSelected ? 'opacity-100' : 'opacity-30 group-hover:opacity-80'
                    }`}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/90 font-bold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                        {st.tag}
                      </span>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow-sm">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                    <h4 className={`text-sm font-bold tracking-tight ${isSelected ? 'text-amber-300' : 'text-zinc-100'}`}>
                      {st.label}
                    </h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                      {st.desc}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. Core Production Specs: Aspect Ratio, Duration & Language */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          {/* Aspect Ratio */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-zinc-400" />
              <span>Tỉ lệ khung hình</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-studio-input p-1 rounded-xl border border-studio-border">
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                disabled={isRunning}
                className={`py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  aspectRatio === '16:9'
                    ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>16:9 Cinema</span>
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                disabled={isRunning}
                className={`py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  aspectRatio === '9:16'
                    ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>9:16 Shorts</span>
              </button>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>Thời lượng phim</span>
            </label>
            <div className="grid grid-cols-4 gap-1 bg-studio-input p-1 rounded-xl border border-studio-border">
              {[1, 3, 5, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  disabled={isRunning}
                  className={`py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    duration === d
                      ? 'bg-amber-400 text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-studio-deck'
                  }`}
                >
                  {d}m
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-zinc-400" />
              <span>Ngôn ngữ thuyết minh</span>
            </label>
            <CustomSelect
              value={lang}
              onChange={setLang}
              options={LANG_OPTIONS}
              disabled={isRunning}
            />
          </div>
        </div>

        {/* 4. Production Switches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Pause for Review */}
          <div
            onClick={() => setPauseAfterScript(!pauseAfterScript)}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              pauseAfterScript
                ? 'bg-amber-500/10 border-amber-400/40 shadow-sm'
                : 'bg-studio-card/70 border-studio-border hover:border-studio-border-hover hover:bg-studio-card'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                  pauseAfterScript
                    ? 'bg-amber-400 text-zinc-950 font-bold'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <FileEdit className="w-4 h-4" />
              </div>
              <div>
                <span className={`text-xs font-semibold block ${pauseAfterScript ? 'text-amber-300' : 'text-zinc-200'}`}>
                  Duyệt kịch bản trước khi render
                </span>
                <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
                  Tạm dừng sau Hồi 1 để sửa thoại & đổi giọng
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={pauseAfterScript}
              onChange={(e) => setPauseAfterScript(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-studio-input border-studio-border cursor-pointer"
            />
          </div>

          {/* Hardsub Burn-in */}
          <div
            onClick={() => setHardsub(!hardsub)}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
              hardsub
                ? 'bg-amber-500/10 border-amber-400/40 shadow-sm'
                : 'bg-studio-card/70 border-studio-border hover:border-studio-border-hover hover:bg-studio-card'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                  hardsub
                    ? 'bg-amber-400 text-zinc-950 font-bold'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                <Film className="w-4 h-4" />
              </div>
              <div>
                <span className={`text-xs font-semibold block ${hardsub ? 'text-amber-300' : 'text-zinc-200'}`}>
                  In phụ đề trực tiếp vào video
                </span>
                <span className="text-[11px] text-zinc-400 block leading-tight mt-0.5">
                  Khắc phụ đề điện ảnh viền đen trực tiếp (Hardsub)
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={hardsub}
              onChange={(e) => setHardsub(e.target.checked)}
              className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-studio-input border-studio-border cursor-pointer"
            />
          </div>
        </div>

        {/* Subtitle Typography & Live Preview Card */}
        {hardsub && (
          <div className="p-4 sm:p-5 rounded-2xl bg-studio-card/90 border border-amber-500/30 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-studio-border pb-3">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
                  Tùy Biến Typography & Phụ Đề Điện Ảnh (ASS / SRT)
                </span>
              </div>
              <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-amber-400" />
                Hardsub Burn-in Bật
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {/* Left Column: Preset, Position & Karaoke Toggle */}
              <div className="lg:col-span-7 space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Phong cách Typography</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(subtitlePresets.length > 0 ? subtitlePresets : DEFAULT_SUBTITLE_PRESETS).map((p) => {
                      const isSelected = p.id === subtitleStyle
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSubtitleStyleChange(p.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-400/50 shadow-sm'
                              : 'bg-studio-input/70 border-studio-border hover:border-studio-border-hover'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="w-3 h-3 rounded-full border border-black/40 shrink-0"
                              style={{ backgroundColor: p.primary_color_hex }}
                            />
                            {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                          </div>
                          <div>
                            <span className={`text-xs font-bold block truncate ${isSelected ? 'text-amber-300' : 'text-zinc-200'}`}>
                              {p.name}
                            </span>
                            <span className="text-[10px] text-zinc-400 block truncate">
                              Font: {p.font_name}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Position Segmented Control */}
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-400 font-medium mb-1.5">
                      Vị trí phụ đề
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-studio-input p-1 rounded-xl border border-studio-border">
                      {[
                        { id: 'bottom', label: 'Dưới' },
                        { id: 'middle', label: 'Giữa' },
                        { id: 'top', label: 'Trên' },
                      ].map((pos) => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => handleSubtitlePositionChange(pos.id)}
                          className={`py-1 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                            subtitlePosition === pos.id
                              ? 'bg-amber-400 text-zinc-950 shadow-sm'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Karaoke Highlight Toggle */}
                  <div className="flex flex-col justify-end">
                    <label
                      onClick={() => handleSubtitleKaraokeChange(!subtitleKaraoke)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        subtitleKaraoke
                          ? 'bg-amber-500/10 border-amber-400/40'
                          : 'bg-studio-input/70 border-studio-border hover:border-studio-border-hover'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className={`text-xs font-semibold block leading-tight truncate ${subtitleKaraoke ? 'text-amber-300' : 'text-zinc-300'}`}>
                          Karaoke Highlight
                        </span>
                        <span className="text-[10px] text-zinc-500 block truncate leading-tight mt-0.5">
                          Nhảy sáng từng từ ({'\\'}k)
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={subtitleKaraoke}
                        onChange={(e) => handleSubtitleKaraokeChange(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-400 bg-studio-input border-studio-border cursor-pointer shrink-0"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Subtitle Preview */}
              <div className="lg:col-span-5 flex flex-col justify-between p-3.5 rounded-xl bg-zinc-950/80 border border-studio-border/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Subtitle Preview</span>
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {aspectRatio === '9:16' ? '9:16 Shorts' : '16:9 Cinema'}
                  </span>
                </div>

                {/* Simulated Cinema Screen */}
                {(() => {
                  const effectivePresets = subtitlePresets.length > 0 ? subtitlePresets : DEFAULT_SUBTITLE_PRESETS
                  const p = effectivePresets.find((x) => x.id === subtitleStyle) || effectivePresets[0]
                  const textShadowStyle = `-1px -1px 0 ${p.outline_color_hex || '#000'}, 1px -1px 0 ${p.outline_color_hex || '#000'}, -1px 1px 0 ${p.outline_color_hex || '#000'}, 1px 1px 0 ${p.outline_color_hex || '#000'}, 0 2px 4px rgba(0,0,0,0.8)`

                  return (
                    <div className="relative aspect-video w-full rounded-lg bg-zinc-900 overflow-hidden border border-zinc-800 flex flex-col justify-between p-3 shadow-inner">
                      {/* Cinema vignette & rule-of-thirds grid line */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none" />
                      <div className="absolute inset-0 opacity-10 border border-dashed border-white pointer-events-none m-2" />

                      {/* Top Header Placeholder */}
                      <div className="text-[9px] font-mono text-zinc-500 z-10 select-none">
                        REC [00:01:24:18]
                      </div>

                      {/* Centered / Positioned Subtitle Text */}
                      <div className={`z-10 w-full text-center px-2 flex flex-col justify-center ${
                        subtitlePosition === 'top'
                          ? 'items-center pt-1'
                          : subtitlePosition === 'middle'
                          ? 'items-center my-auto'
                          : 'items-center pb-1'
                      }`}>
                        <div
                          style={{
                            fontFamily: p.font_name || 'Montserrat',
                            color: p.primary_color_hex || '#ffff00',
                            textShadow: textShadowStyle,
                            fontWeight: p.bold ? 700 : 400,
                          }}
                          className={`text-xs sm:text-sm leading-snug tracking-wide transition-all ${
                            subtitleKaraoke ? 'animate-pulse' : ''
                          }`}
                        >
                          {p.preview_text || 'Phim điện ảnh siêu thực đỉnh cao'}
                        </div>
                      </div>

                      <div className="text-[9px] font-mono text-zinc-600 text-right z-10 select-none">
                        {p.font_name} • {subtitlePosition.toUpperCase()}
                      </div>
                    </div>
                  )
                })()}

                <p className="text-[10px] text-zinc-500 italic mt-2 text-center">
                  * Tự động điều chỉnh kích cỡ font và lề đứng theo tỉ lệ khung hình {aspectRatio}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Multi-Track Audio Mixer & Auto-Ducking BGM Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-studio-deck border border-studio-border/80 shadow-inner relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Music className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                  Phối Âm Đa Kênh & Nhạc Nền (Multi-Track Audio Mixer)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Auto-Ducking Pro
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">
                Tự động hạ âm lượng nhạc nền (ducking) mượt mà khi nhân vật cất tiếng thoại, chuyển cảnh crossfade tự nhiên.
              </p>
            </div>

            {/* Custom Upload Button */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="relative cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-studio-card hover:bg-studio-card/80 border border-studio-border text-zinc-300 hover:text-white transition-all shadow-sm">
                {uploadBgmMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>{uploadBgmMutation.isPending ? 'Đang tải lên...' : 'Tải MP3 riêng'}</span>
                <input
                  type="file"
                  accept="audio/mp3,audio/wav,audio/m4a,audio/*"
                  className="hidden"
                  onChange={handleBgmFileUpload}
                  disabled={uploadBgmMutation.isPending}
                />
              </label>
            </div>
          </div>

          {uploadBgmError && (
            <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadBgmError}</span>
            </div>
          )}

          {/* BGM Preset Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-4">
            {bgmTracks.map((track) => {
              const isSelected = bgmPreset === track.id
              const isPlaying = playingBgmId === track.id
              return (
                <div
                  key={track.id}
                  onClick={() => handleBgmPresetChange(track.id)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 select-none relative ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-sm ring-1 ring-amber-500/30'
                      : 'bg-studio-card/40 border-studio-border/60 hover:bg-studio-card hover:border-studio-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-zinc-200 truncate">
                          {track.name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono block">
                        {track.genre} {track.bpm ? `• ${track.bpm} BPM` : ''}
                      </span>
                    </div>

                    {/* Preview Play/Pause Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTogglePlayBgm(track)
                      }}
                      title={isPlaying ? 'Dừng phát' : 'Nghe thử track'}
                      className={`p-2 rounded-lg transition-colors shrink-0 ${
                        isPlaying
                          ? 'bg-amber-500 text-zinc-950 shadow-md'
                          : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white'
                      }`}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    </button>
                  </div>

                  <p className="text-[10px] text-zinc-400 line-clamp-1">
                    {track.description}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Mixing Controls: BGM Volume & Auto-Ducking Level */}
          <div className="pt-3 border-t border-studio-border/60 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BGM Volume Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Âm Lượng Nhạc Nền (BGM Level)</span>
                </label>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {Math.round(bgmVolume * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <VolumeX className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={bgmVolume}
                  onChange={(e) => handleBgmVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg appearance-none"
                />
                <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              </div>
              <p className="text-[10px] text-zinc-500 mt-1 italic">
                * Khuyên dùng 50% - 80% để nhạc hòa quyện mà không lấn át lời thoại.
              </p>
            </div>

            {/* Auto-Ducking Level */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mức Độ Hạ Âm (Auto-Ducking Khi Có Lời Thoại)</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'none', label: 'Tắt', sub: '0 dB' },
                  { id: 'light', label: 'Nhẹ', sub: '-6 dB' },
                  { id: 'medium', label: 'Tiêu chuẩn', sub: '-12 dB' },
                  { id: 'heavy', label: 'Sâu', sub: '-18 dB' },
                ].map((item) => {
                  const isActive = duckingLevel === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleDuckingLevelChange(item.id as any)}
                      className={`px-2 py-1.5 rounded-xl border text-center transition-all ${
                        isActive
                          ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 shadow-sm'
                          : 'bg-studio-card/40 border-studio-border/60 text-zinc-400 hover:text-zinc-200 hover:bg-studio-card'
                      }`}
                    >
                      <div className="text-[11px] font-semibold leading-tight">{item.label}</div>
                      <div className="text-[9px] font-mono text-zinc-500 leading-tight">{item.sub}</div>
                    </button>
                  )
                })}
              </div>
              <p className="text-[10px] text-zinc-500 mt-1 italic">
                * Nhạc nền sẽ tự động giảm {duckingLevel === 'heavy' ? '-18 dB' : duckingLevel === 'medium' ? '-12 dB' : duckingLevel === 'light' ? '-6 dB' : '0 dB'} và crossfade mượt mà trong đoạn có thoại.
              </p>
            </div>
          </div>
        </div>

        {/* 5. Advanced Engine Accordion */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <Settings2 className="w-4 h-4" />
            <span>{showAdvanced ? 'Thu gọn cài đặt động cơ [-]' : 'Cài đặt nâng cao (AI Engines, API Key, SadTalker) [+]'}</span>
          </button>

          {showAdvanced && (
            <div className="relative z-30 mt-3 p-4 sm:p-5 rounded-2xl bg-studio-deck border border-studio-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                  <span>Động cơ LLM</span>
                </label>
                <CustomSelect
                  value={llm}
                  onChange={setLlm}
                  options={LLM_OPTIONS}
                  disabled={isRunning}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cỗ máy sinh ảnh</span>
                </label>
                <CustomSelect
                  value={imageEngine}
                  onChange={handleImageEngineChange}
                  options={IMAGE_ENGINE_OPTIONS}
                  disabled={isRunning}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-rose-400" />
                  <span>Chuyển động máy quay</span>
                </label>
                <CustomSelect
                  value={motion}
                  onChange={setMotion}
                  options={MOTION_OPTIONS}
                  disabled={isRunning}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Cử động môi (Lip-Sync)</span>
                </label>
                <CustomSelect
                  value={lipSync}
                  onChange={setLipSync}
                  options={LIPSYNC_OPTIONS}
                  disabled={isRunning}
                />
              </div>

              {/* Local Image Engine URL & Live Status Card */}
              {imageEngine !== 'pollinations' && (
                <div className="sm:col-span-2 lg:col-span-4 p-4 rounded-xl bg-studio-card border border-studio-border space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-studio-border pb-2.5">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                        Cấu hình {imageEngine === 'sd_webui' ? 'Stable Diffusion WebUI / Forge (A1111)' : 'ComfyUI Local'}
                      </span>
                    </div>

                    {/* Live Status indicator */}
                    {(() => {
                      const discovered = imageEngines.find((e) => e.id === imageEngine)
                      const isOnline = testImageEngineStatus ? testImageEngineStatus.is_available : discovered?.is_available
                      return (
                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                          isOnline
                            ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                            : 'text-zinc-400 bg-zinc-800 border border-zinc-700'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                          <span>{isOnline ? 'Máy chủ Online (Sẵn sàng)' : 'Offline / Chưa kết nối'}</span>
                        </span>
                      )
                    })()}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={imageApiUrl}
                        onChange={(e) => handleImageApiUrlChange(e.target.value)}
                        placeholder={imageEngine === 'sd_webui' ? 'http://127.0.0.1:7860 (hoặc URL máy trạm của bạn)' : 'http://127.0.0.1:8188 (hoặc URL ComfyUI)'}
                        className="w-full px-3 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-400 font-mono"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={testImageEngineMutation.isPending}
                      onClick={handleTestImageEngine}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {testImageEngineMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Kiểm tra kết nối</span>
                    </button>
                  </div>

                  {testImageEngineStatus && (
                    <p className={`text-[11px] font-mono flex items-center gap-1.5 ${testImageEngineStatus.is_available ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {testImageEngineStatus.is_available ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      <span>{testImageEngineStatus.message}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Replicate AI Video Configuration Card */}
              {motion === 'replicate' && (
                <div className="sm:col-span-2 lg:col-span-4 p-4 rounded-xl bg-studio-card border border-studio-border space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-studio-border pb-2.5">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                        Cấu hình Replicate AI Video (Image-to-Video Cloud)
                      </span>
                    </div>

                    {testVideoTokenStatus && (
                      <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                        testVideoTokenStatus.is_valid
                          ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/30'
                          : 'text-rose-400 bg-rose-500/10 border border-rose-500/30'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${testVideoTokenStatus.is_valid ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                        <span>{testVideoTokenStatus.is_valid ? `Hợp lệ (${testVideoTokenStatus.username || 'Replicate Account'})` : 'Token không hợp lệ'}</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium flex items-center gap-1">
                          <Key className="w-3 h-3 text-indigo-400" />
                          <span>Replicate API Token</span>
                        </label>
                        <a
                          href="https://replicate.com/account/api-tokens"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-indigo-400 hover:underline"
                        >
                          Lấy token ↗
                        </a>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showVideoToken ? 'text' : 'password'}
                            value={videoApiToken}
                            onChange={(e) => handleVideoTokenChange(e.target.value)}
                            placeholder="r8_..."
                            className="w-full pl-3 pr-8 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-400 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setShowVideoToken(!showVideoToken)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                          >
                            {showVideoToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={!videoApiToken.trim() || testVideoTokenMutation.isPending}
                          onClick={handleTestVideoToken}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                        >
                          {testVideoTokenMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          <span>Kiểm tra</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium block mb-1.5 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        <span>AI Video Model</span>
                      </label>
                      <CustomSelect
                        value={videoModel}
                        onChange={handleVideoModelChange}
                        options={
                          videoModels.length > 0
                            ? videoModels.map((m) => ({
                                value: m.id,
                                label: m.name + (m.is_recommended ? ' (Khuyên dùng)' : ''),
                                subtext: `${m.description} • ${m.resolution}`,
                                icon: <Video className="w-3.5 h-3.5 text-indigo-400" />,
                              }))
                            : [
                                { value: 'wan-video/wan-2.1-i2v-480p', label: 'Wan 2.1 I2V (480p) (Khuyên dùng)', subtext: 'Alibaba Wan 2.1 — Cân bằng tốc độ & chất lượng • Tiết kiệm', icon: <Video className="w-3.5 h-3.5 text-indigo-400" /> },
                                { value: 'wan-video/wan-2.1-i2v-720p', label: 'Wan 2.1 I2V (720p HD)', subtext: 'Alibaba Wan 2.1 — Độ nét cao 720p cinematic • Trung bình', icon: <Video className="w-3.5 h-3.5 text-indigo-400" /> },
                                { value: 'minimax/video-01', label: 'Minimax Video-01', subtext: 'Hailuo AI — Chuyển động người chân thực, vật lý mượt mà • Cao cấp', icon: <Video className="w-3.5 h-3.5 text-indigo-400" /> },
                                { value: 'kwaivgi/kling-v1.6-standard', label: 'Kling 1.6 Standard', subtext: 'Kuaishou Kling AI — Chuyển động dynamic mạnh mẽ • Cao cấp', icon: <Video className="w-3.5 h-3.5 text-indigo-400" /> },
                                { value: 'stability-ai/stable-video-diffusion', label: 'Stable Video Diffusion (SVD)', subtext: 'Stability AI — Render nhanh cảnh quay ngắn 2.5s • Tiết kiệm', icon: <Video className="w-3.5 h-3.5 text-indigo-400" /> },
                              ]
                        }
                      />
                    </div>
                  </div>

                  {testVideoTokenStatus && (
                    <p className={`text-[11px] font-mono flex items-center gap-1.5 ${testVideoTokenStatus.is_valid ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {testVideoTokenStatus.is_valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      <span>{testVideoTokenStatus.message}</span>
                    </p>
                  )}

                  <p className="text-[11px] text-zinc-500 italic">
                    * Ghi chú: Nếu Replicate API hết hạn hoặc quá tải, hệ thống sẽ tự động fallback sang Ken Burns 2.5D mượt mà để tiến trình làm phim không bị gián đoạn.
                  </p>
                </div>
              )}

              {/* API Key & Dynamic Model Selection Card */}
              <div className="sm:col-span-2 lg:col-span-4 p-4 rounded-xl bg-studio-card border border-studio-border space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-studio-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Cấu hình API Key & Model ({LLM_OPTIONS.find((o) => o.value === llm)?.label})
                    </span>
                  </div>
                  {hasEnvKey && !apiKey && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Nhận diện từ file .env
                    </span>
                  )}
                  {apiKey && (
                    <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Key tùy chỉnh (lưu máy này)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* API Key Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium">
                        API Key
                      </label>
                      {llm === 'gemini' && (
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-amber-400 hover:underline"
                        >
                          Lấy key miễn phí ↗
                        </a>
                      )}
                      {llm === 'groq' && (
                        <a
                          href="https://console.groq.com/keys"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-amber-400 hover:underline"
                        >
                          Lấy key Groq ↗
                        </a>
                      )}
                      {llm === 'openai' && (
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-amber-400 hover:underline"
                        >
                          Lấy key OpenAI ↗
                        </a>
                      )}
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => handleApiKeyChange(e.target.value)}
                        placeholder={
                          hasEnvKey
                            ? 'Đã nhận diện key từ .env (nhập để ghi đè)'
                            : llm === 'ollama'
                            ? 'Ollama không cần API key'
                            : 'Nhập API key tại đây...'
                        }
                        disabled={isRunning || llm === 'ollama'}
                        className="w-full pl-3 pr-28 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono"
                      />
                      <div className="absolute right-1.5 flex items-center gap-1">
                        {apiKey && (
                          <button
                            type="button"
                            onClick={() => handleApiKeyChange('')}
                            className="p-1 text-zinc-400 hover:text-white text-xs cursor-pointer"
                            title="Xóa key"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                          title={showApiKey ? 'Ẩn key' : 'Hiện key'}
                        >
                          {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => loadModelsForProvider(llm, apiKey)}
                          disabled={fetchModelsMutation.isPending || isRunning}
                          className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors border border-amber-500/30 cursor-pointer"
                          title="Tải danh sách model"
                        >
                          {fetchModelsMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          <span>Tải Models</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Model Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-mono uppercase text-zinc-400 font-medium">
                        Model Kịch bản {availableModels.length > 0 && `(${availableModels.length} khả dụng)`}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCustomModel(!isCustomModel)}
                        className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                      >
                        {isCustomModel ? 'Chọn từ danh sách' : 'Nhập model khác'}
                      </button>
                    </div>

                    {isCustomModel ? (
                      <input
                        type="text"
                        value={customModelText}
                        onChange={(e) => setCustomModelText(e.target.value)}
                        placeholder="VD: gemini-3.5-flash, gpt-4o, llama3.2..."
                        className="w-full px-3 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono"
                      />
                    ) : availableModels.length > 0 ? (
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        disabled={isRunning}
                        className="w-full px-3 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
                      >
                        {availableModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.recommended ? '⭐ ' : ''}
                            {m.name || m.id} {m.description ? `— ${m.description}` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-studio-input border border-dashed border-studio-border text-xs text-zinc-500">
                        <span>
                          {fetchModelsMutation.isPending
                            ? 'Đang tải danh sách model...'
                            : 'Chưa có model. Bấm "Tải Models" sau khi điền API Key.'}
                        </span>
                        {fetchModelsMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Banner */}
                {modelsError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2 text-rose-300 text-xs animate-fadeIn">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold">{modelsError}</p>
                      <p className="text-[11px] text-rose-400/80 mt-0.5">
                        Hãy kiểm tra lại API Key hoặc tạo key mới tại bảng điều khiển nhà cung cấp.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Series Details */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clapperboard className="w-3 h-3 text-amber-400" />
                  <span>Tên Series Phim (Tùy chọn)</span>
                </label>
                <input
                  type="text"
                  value={seriesTitle}
                  onChange={(e) => setSeriesTitle(e.target.value)}
                  placeholder="Để trống nếu là phim độc lập"
                  className="w-full px-3 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Tập số (Episode)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={episode}
                  onChange={(e) => setEpisode(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 focus:outline-none focus:border-amber-400 font-bold"
                />
              </div>

              {/* Hardware & Concurrency Settings */}
              <div className="sm:col-span-3 pt-3 border-t border-studio-border">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Tối Ưu Hóa Render & Luồng Xử Lý (Hardware & Concurrency)</span>
                  </label>
                  {hardwareInfo && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {hardwareInfo.cpu_cores} Cores • {hardwareInfo.ram_available_gb}/{hardwareInfo.ram_total_gb} GB RAM {hardwareInfo.has_gpu ? '• GPU NVENC' : '• CPU libx264'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-studio-card/80 p-3 rounded-xl border border-studio-border">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                      Cấu hình tải (Profile đa luồng)
                    </label>
                    <select
                      value={hardwareProfile}
                      onChange={(e) => setHardwareProfile(e.target.value)}
                      disabled={isRunning}
                      className="w-full px-3 py-1.5 rounded-lg bg-studio-input border border-studio-border text-xs text-zinc-200 focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
                    >
                      <option value="auto">⚡ Tự động tối ưu (Khuyến nghị: {hardwareInfo?.recommended_profile?.toUpperCase() || 'BALANCED'})</option>
                      <option value="eco">🌱 Tiết kiệm RAM (1-2 luồng, máy nhẹ / VPS)</option>
                      <option value="balanced">⚖️ Cân bằng điện ảnh (3-4 luồng, ổn định)</option>
                      <option value="turbo">🚀 Turbo Max (6-8 luồng, tận dụng đa nhân)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                      Tăng tốc phần cứng (Video Encoder)
                    </label>
                    <select
                      value={hardwareAccel}
                      onChange={(e) => setHardwareAccel(e.target.value)}
                      disabled={isRunning}
                      className="w-full px-3 py-1.5 rounded-lg bg-studio-input border border-studio-border text-xs text-zinc-200 focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
                    >
                      <option value="auto">Tự động phát hiện (Auto)</option>
                      <option value="cpu">CPU phần mềm (libx264)</option>
                      <option value="nvenc">NVIDIA GPU NVENC</option>
                      <option value="vaapi">Linux VAAPI</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Webhook */}
              <div className="sm:col-span-3 pt-2 border-t border-studio-border">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Webhook Tự Động Hóa (Discord / Telegram / n8n / Zapier)</span>
                  </label>
                  {webhookUrl && (
                    <button
                      type="button"
                      onClick={handleTestWebhook}
                      disabled={testWebhookMutation.isPending}
                      className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      {testWebhookMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : testWebhookSuccess ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Đã gửi thử nghiệm!</span>
                        </>
                      ) : (
                        <span>Gửi thử Webhook</span>
                      )}
                    </button>
                  )}
                </div>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/... hoặc URL webhook nhận thông báo"
                  className="w-full px-3 py-2 rounded-xl bg-studio-input border border-studio-border hover:border-studio-border-hover text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* 6. Primary Action CTA Button */}
        <div className="pt-4 flex justify-center">
          <button
            type="submit"
            disabled={isRunning || !topic.trim()}
            className="w-full sm:w-auto min-w-[300px] px-10 py-3.5 rounded-2xl font-black text-sm tracking-wider uppercase flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer shadow-xl shadow-amber-500/25 relative overflow-hidden bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed group active:scale-[0.98] glow-amber-sm hover:glow-amber-md"
          >
            {/* Shimmer line */}
            <div className="absolute inset-0 w-1/3 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 animate-shimmer pointer-events-none" />

            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950 stroke-[3]" />
                <span className="font-extrabold tracking-wide">Đang bấm máy sản xuất...</span>
              </>
            ) : (
              <>
                <Clapperboard className="w-4 h-4 text-zinc-950 stroke-[2.5]" />
                <span className="font-extrabold tracking-wide">{pauseAfterScript ? 'Khởi Tạo Kịch Bản & Phân Cảnh' : 'Bắt Đầu Sản Xuất Phim Chiếu Rạp'}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {isTemplateModalOpen && (
        <Suspense fallback={null}>
          <StoryTemplateModal
            isOpen={isTemplateModalOpen}
            onClose={() => setIsTemplateModalOpen(false)}
            onSelectTemplate={handleSelectTemplate}
            currentTemplateId={selectedTemplate?.id}
          />
        </Suspense>
      )}
    </div>
  )
}
