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
  color_lut?: string
  transition_preset?: string
  transition_duration?: number
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
  location_id?: string | null
  dialogue?: string
  visual_description?: string
  image_prompt?: string
  camera?: string
  camera_angle?: string
  camera_lens?: string
  camera_motion?: string
  lighting?: string
  multi_angle_options?: Record<string, string>
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
  sfx_offset_ms?: number
  sfx?: string
  fade_in?: number
  fade_out?: number
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
  locations?: Record<string, VaultLocationItem>
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

export interface CameraAngleItem {
  id: string
  name: string
  category: string
  description: string
  keywords: string
}

export interface CameraMotionItem {
  id: string
  name: string
  description: string
  keywords: string
}

export interface LensPresetItem {
  id: string
  name: string
  description: string
  keywords: string
}

export interface LightingPresetItem {
  id: string
  name: string
  description: string
  keywords: string
}

export interface CameraPresetsResponse {
  angles: CameraAngleItem[]
  motions: CameraMotionItem[]
  lenses: LensPresetItem[]
  lightings: LightingPresetItem[]
}

export interface MultiAngleCoverageResponse {
  success: boolean
  shot_id: string
  angles: Record<string, string>
}

export interface ColorLutItem {
  id: string
  name: string
  description: string
  css_gradient: string
  ffmpeg_filter: string
}

export interface SceneTransitionItem {
  id: string
  name: string
  description: string
  xfade_name: string
  default_duration: number
}

export interface VoiceProfileItem {
  id: string
  name: string
  provider: 'elevenlabs' | 'local' | 'edge'
  sample_audio_path?: string
  gender: 'male' | 'female' | 'neutral'
  lang: string
  description?: string
  created_at?: string
  meta?: Record<string, any>
}

export interface CloneVoicePayload {
  name: string
  provider: 'elevenlabs' | 'local'
  audio_base64: string
  audio_filename?: string
  description?: string
  api_key?: string
  api_url?: string
  lang?: string
  gender?: 'male' | 'female' | 'neutral'
}

export interface VoicePreviewPayload {
  text: string
  voice_id: string
  provider?: 'elevenlabs' | 'local' | 'edge'
  lang?: string
  api_key?: string
  api_url?: string
}

export interface DubbingRequestPayload {
  project_id: string
  target_lang: string
  voice_mapping?: Record<string, string>
}

export interface DubbingResultResponse {
  project_id: string
  target_lang: string
  language_name: string
  status: string
  translated_shots: Array<{
    shot_id: string
    original_text: string
    translated_text: string
    voice_id: string
    audio_file: string
  }>
  subtitle_path: string
  audio_dir: string
}

export interface ReframePresetItem {
  id: string
  name: string
  description: string
}

export interface ReframeRequestPayload {
  project_id: string
  mode: string
  burn_subtitles?: boolean
  subtitle_style?: string
}

export interface ReframeResultResponse {
  success: boolean
  filename: string
  video_url: string
  mode: string
}

export interface SfxCatalogItem {
  id: string
  name: string
  category: 'action' | 'nature' | 'horror' | 'scifi' | 'urban' | string
  description: string
  stream_url: string
  default_volume: number
  default_offset_ms: number
  tags: string[]
}

export interface SfxSuggestRequestPayload {
  prompt: string
  dialogue?: string
  genre?: string
}

export interface SfxSuggestResponse {
  sfx_id: string
  name: string
  category: string
  volume: number
  offset_ms: number
  reasoning: string
}

export interface BatchSfxSuggestRequestPayload {
  project_id: string
  overwrite_existing?: boolean
}

export interface BatchSfxSuggestResponse {
  success: boolean
  assigned_count: number
  total_shots: number
  shots: Array<{
    id: string
    sfx: string | null
    sfx_volume: number
    sfx_offset_ms: number
  }>
}

export interface SplitShotRequestPayload {
  shot_id: string
  split_at_sec?: number
  project_id?: string
}

export interface SplitShotResponse {
  success: boolean
  message: string
  new_shots: Shot[]
  total_shots: number
}

// --- Character Vault Types ---
export interface VaultCharacterItem {
  id: string
  name: string
  visual_anchor: string
  voice?: string
  seed?: number
  headshot_url?: string
  tags?: string[]
  created_at?: string
}

export interface SaveVaultCharacterPayload {
  id?: string
  name: string
  visual_anchor: string
  voice?: string
  seed?: number
  headshot_url?: string
  tags?: string[]
}

export interface ImportVaultCharacterPayload {
  project_id?: string
  vault_char_id: string
}

export interface GenerateAnglesPayload {
  visual_anchor: string
  seed?: number
  style?: string
}

export interface GenerateAnglesResponse {
  success: boolean
  prompts: {
    frontal: string
    three_quarter: string
    profile: string
  }
  frontal_url?: string
  three_quarter_url?: string
  profile_url?: string
}

// --- Location Vault Types ---
export interface VaultLocationItem {
  id: string
  name: string
  environment_dna: string
  lighting?: string
  color_palette?: string
  seed?: number
  preview_url?: string
  tags?: string[]
  created_at?: string | number
}

export interface SaveVaultLocationPayload {
  id?: string
  name: string
  environment_dna: string
  lighting?: string
  color_palette?: string
  seed?: number
  preview_url?: string
  tags?: string[]
}

export interface ImportVaultLocationPayload {
  project_id?: string
  vault_loc_id: string
}

export interface AssignLocationToShotPayload {
  project_id?: string
  shot_id: string
  location_id?: string | null
}

export interface GenerateLocationPreviewPayload {
  location_id: string
  environment_dna: string
  lighting?: string
  color_palette?: string
  seed?: number
}

// --- Video Enhancer Types ---
export interface VideoEnhancerPreset {
  id: string
  name: string
  description: string
  target_resolution: string
  target_fps: string
  badge?: string
  icon?: string
}

export interface EnhanceShotPayload {
  shot_id: string
  preset_id?: string
  project_id?: string
  custom_scale?: string
  custom_fps?: number
}

export interface EnhanceMasterPayload {
  preset_id?: string
  project_id?: string
  custom_scale?: string
  custom_fps?: number
}

export interface EnhanceVideoResponse {
  success: boolean
  shot_id?: string
  project_id?: string
  enhanced_url: string
  preset: string
}

export interface Camera3DTrajectory {
  trajectory_type: string
  pan: number
  tilt: number
  roll: number
  x: number
  y: number
  z: number
  zoom: number
  speed: number
}

export interface Camera3DPresetItem {
  id: string
  name: string
  description: string
  pan: number
  tilt: number
  roll: number
  x: number
  y: number
  z: number
  zoom: number
  speed: number
  luma_cue?: string
}

export interface Camera3DPreviewResponse {
  trajectory: Camera3DTrajectory
  kling_config: {
    type: string
    config: Record<string, number>
  }
  luma_prompt: string
  ffmpeg_filter: string
}

export interface VideoModelItem {
  id: string
  name: string
  owner: string
  resolution: string
  description: string
  is_recommended: boolean
}










// ─── ComfyUI Dual Engine Hub Types ──────────────────────────────────

export interface ComfyUIHealthStatus {
  connected: boolean
  device_name: string
  vram_total_gb: number
  vram_free_gb: number
  queue_remaining: number
  version: string
}

export interface ComfyUIModels {
  checkpoints: string[]
  loras: string[]
  vaes: string[]
}

export interface ComfyUIWorkflowItem {
  id: string
  name: string
  category: 'image' | 'video'
  description: string
  is_builtin: boolean
  required_nodes: string[]
  missing_nodes: string[]
  is_compatible: boolean
}

export interface ComfyUIConfig {
  is_image_enabled: boolean
  is_video_enabled: boolean
  image_workflow: string
  video_workflow: string
  checkpoint: string | null
  lora: string | null
  lora_weight: number
  steps: number
  cfg: number
  video_frames: number
  video_fps: number
}

export interface ComfyUIStatusResponse {
  connected: boolean
  health: ComfyUIHealthStatus
}

export interface ComfyUIWorkflowsResponse {
  workflows: ComfyUIWorkflowItem[]
}
