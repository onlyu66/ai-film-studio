import type { ReactNode } from 'react'

export interface SelectOption {
  value: string
  label: string
  subtext?: string
  icon?: string | ReactNode
}

export interface PresetIdea {
  title: string
  topic: string
  style: string
  emoji: string
}

export interface StyleOption {
  id: string
  label: string
  desc: string
  emoji: string
  gradient: string
}

export interface LLMModelItem {
  id: string
  name: string
  description?: string
  recommended?: boolean
}

export interface LLMModelsResponse {
  success: boolean
  provider: string
  models: LLMModelItem[]
  default?: string
  has_env_key?: boolean
  error?: string
}

export interface HardwareInfo {
  cpu_cores: number
  ram_total_gb: number
  ram_available_gb: number
  has_gpu: boolean
  available_encoders: string[]
  recommended_profile: 'eco' | 'balanced' | 'turbo'
}

export interface ProductionFormData {
  topic: string
  lang: string
  duration: number
  style: string
  llm: string
  llm_api_key?: string
  llm_model?: string
  motion: string
  lip_sync: string
  aspect_ratio?: string
  hardsub?: boolean
  pause_after_script?: boolean
  series_title?: string
  episode?: number
  parent_project_id?: string
  webhook_url?: string
  hardware_profile?: string
  hardware_accel?: string
  image_concurrency?: number
  motion_concurrency?: number
  template_id?: string
  image_engine?: string
  image_api_url?: string
  video_api_token?: string
  video_model?: string
  subtitle_style?: string
  subtitle_position?: string
  subtitle_karaoke?: boolean
  bgm_preset?: string
  bgm_volume?: number
  ducking_level?: string
  voice_volume?: number
}

export interface StudioStatus {
  status: 'idle' | 'running' | 'script_ready' | 'completed' | 'error' | string
  stage: number
  stage_name: string
  progress: number
  logs: string[]
  error?: string | null
  final_video: string | null
  final_srt: string | null
  shots_count?: number
  current_shot_id?: string | null
  current_shot_index?: number | null
  shots_total?: number | null
  active_action?: string | null
  can_cancel?: boolean
}

export interface Character {
  name?: string
  gender?: string
  visual_dna?: string
  visual_anchor?: string
  voice?: string
  seed?: number | string
  headshot_url?: string
  face_dna?: string
  [key: string]: unknown
}

export interface Shot {
  id: string
  character?: string
  character_id?: string
  dialogue?: string
  visual_description?: string
  image_prompt?: string
  camera?: string
  action?: string
  image_url?: string
  audio_url?: string
  video_url?: string
  has_image?: boolean
  has_audio?: boolean
  has_video?: boolean
  is_approved?: boolean
  voice_volume?: number
  sfx_volume?: number
  sfx?: string
  act?: number
  mood?: string
  emotion?: string
  chapter?: number | string
  duration?: number
  [key: string]: unknown
}

export interface StoryboardData {
  title?: string
  language?: string
  theme?: string
  characters?: Record<string, Character>
  shots?: Shot[]
  [key: string]: unknown
}

export interface DubbedVersion {
  video_file: string
  srt_file: string
  video_url?: string
  srt_url?: string
}

export interface ProjectItem {
  id: string
  title: string
  topic: string
  lang: string
  style: string
  duration: number
  aspect_ratio?: string
  hardsub?: boolean
  series_title?: string
  episode?: number
  parent_project_id?: string
  webhook_url?: string
  created_at: number
  video_file: string
  srt_file?: string
  thumb_file?: string
  video_url?: string
  srt_url?: string
  thumb_url?: string
  shots_count: number
  dubbed_versions?: Record<string, DubbedVersion>
}

export interface ChapterInfo {
  timestamp: string
  title: string
}

export interface ProjectSeoData {
  project_id: string
  title: string
  series_title?: string | null
  episode?: number
  titles: string[]
  description: string
  chapters: ChapterInfo[]
  tags: string[]
  hashtags: string
  thumbnail_url?: string | null
}

export interface TemplateCharacter {
  name: string
  visual_anchor: string
  voice: string
  seed: number
}

export interface StoryTemplate {
  id: string
  name: string
  tagline: string
  category: string
  icon: string
  style: string
  aspect_ratio: '16:9' | '9:16'
  recommended_mood: string
  recommended_bgm: string
  default_topic: string
  characters: Record<string, TemplateCharacter>
  genre_blueprint: string
}

export interface ImageEngineInfo {
  id: string
  name: string
  is_available: boolean
  is_local: boolean
  url: string
  models?: string[]
  devices?: string[]
  message: string
}

export interface VideoModelItem {
  id: string
  name: string
  owner: string
  resolution: string
  description: string
  is_recommended: boolean
}

export interface SubtitlePresetItem {
  id: string
  name: string
  font_name: string
  font_size_16_9: number
  font_size_9_16: number
  primary_color: string
  secondary_color?: string
  outline_color: string
  primary_color_hex: string
  outline_color_hex: string
  bold: number
  outline: number
  shadow: number
  alignment: number
  margin_v_16_9: number
  margin_v_9_16: number
  description: string
  preview_text: string
}

export interface BgmTrackItem {
  id: string
  name: string
  genre: string
  mood: string
  bpm?: number
  description: string
  stream_url: string
}



