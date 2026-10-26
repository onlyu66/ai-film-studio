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

export interface ProductionFormData {
  topic: string
  lang: string
  duration: number
  style: string
  llm: string
  motion: string
  lip_sync: string
  aspect_ratio?: string
  hardsub?: boolean
  pause_after_script?: boolean
}

export interface StudioStatus {
  status: 'idle' | 'running' | 'script_ready' | 'completed' | 'error' | string
  stage: number
  stage_name: string
  progress: number
  logs: string[]
  final_video: string | null
  final_srt: string | null
}

export interface Character {
  name?: string
  gender?: string
  visual_dna?: string
  voice?: string
  [key: string]: unknown
}

export interface Shot {
  id: string
  character?: string
  dialogue?: string
  visual_description?: string
  image_prompt?: string
  camera?: string
  action?: string
  image_url?: string
  audio_url?: string
  video_url?: string
  sfx?: string
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

export interface ProjectItem {
  id: string
  title: string
  topic: string
  lang: string
  style: string
  duration: number
  aspect_ratio?: string
  hardsub?: boolean
  created_at: number
  video_file: string
  srt_file?: string
  thumb_file?: string
  video_url?: string
  srt_url?: string
  thumb_url?: string
  shots_count: number
}
