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
