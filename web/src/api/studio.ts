import { apiClient } from './client'
import type { StudioStatus, StoryboardData, ProductionFormData, ProjectItem, ProjectSeoData } from '../types'

export async function fetchStatus(): Promise<StudioStatus> {
  const response = await apiClient.get<StudioStatus>('/api/status')
  return response.data
}

export async function fetchStoryboard(): Promise<StoryboardData> {
  const response = await apiClient.get<StoryboardData>('/api/storyboard')
  return response.data
}

export async function produceMovie(formData: ProductionFormData): Promise<{ success: boolean; message?: string }> {
  const response = await apiClient.post<{ success: boolean; message?: string }>('/api/produce', formData)
  return response.data
}

export async function cleanOutputs(): Promise<{ success: boolean; message?: string }> {
  const response = await apiClient.post<{ success: boolean; message?: string }>('/api/clean')
  return response.data
}

export async function updateCharacterVoice(
  characterId: string,
  voice: string
): Promise<{ success: boolean; message?: string; character_id: string; voice: string }> {
  const response = await apiClient.post<{ success: boolean; message?: string; character_id: string; voice: string }>(
    '/api/storyboard/character-voice',
    { character_id: characterId, voice }
  )
  return response.data
}

export async function continueProduction(): Promise<{ message: string; status: string }> {
  const response = await apiClient.post<{ message: string; status: string }>('/api/continue')
  return response.data
}

export interface UpdateShotParams {
  shot_id: string
  dialogue?: string
  image_prompt?: string
  motion?: string
  character_id?: string
  sfx?: string
  mood?: string
  emotion?: string
  shot_size?: string
  camera_angle?: string
  lighting?: string
  voice_volume?: number
  sfx_volume?: number
}

export async function updateShot(params: UpdateShotParams): Promise<{ success: boolean; message: string; shot: unknown }> {
  const response = await apiClient.post<{ success: boolean; message: string; shot: unknown }>(
    '/api/storyboard/update-shot',
    params
  )
  return response.data
}

export async function previewVoice(
  voice: string,
  text?: string
): Promise<{ success: boolean; voice: string; audio_url: string }> {
  const response = await apiClient.post<{ success: boolean; voice: string; audio_url: string }>(
    '/api/tts/preview-voice',
    { voice, text }
  )
  return response.data
}

export async function rerollShot(
  shotId: string
): Promise<{ success: boolean; shot_id: string; image_url: string }> {
  const response = await apiClient.post<{ success: boolean; shot_id: string; image_url: string }>(
    '/api/storyboard/reroll-shot',
    { shot_id: shotId }
  )
  return response.data
}

export async function uploadShotImage(
  shotId: string,
  imageBase64: string
): Promise<{ success: boolean; shot_id: string; image_url: string }> {
  const response = await apiClient.post<{ success: boolean; shot_id: string; image_url: string }>(
    '/api/storyboard/upload-shot-image',
    { shot_id: shotId, image_base64: imageBase64 }
  )
  return response.data
}

export interface AddShotParams {
  after_shot_id?: string
  dialogue?: string
  image_prompt?: string
  character_id?: string
  motion?: string
  sfx?: string
  mood?: string
  emotion?: string
  shot_size?: string
  camera_angle?: string
  lighting?: string
  voice_volume?: number
  sfx_volume?: number
}

export async function addShot(params: AddShotParams): Promise<{ success: boolean; message: string; shot: unknown }> {
  const response = await apiClient.post<{ success: boolean; message: string; shot: unknown }>(
    '/api/storyboard/add-shot',
    params
  )
  return response.data
}

export async function deleteShot(shotId: string): Promise<{ success: boolean; message: string; shot_id: string }> {
  const response = await apiClient.post<{ success: boolean; message: string; shot_id: string }>(
    '/api/storyboard/delete-shot',
    { shot_id: shotId }
  )
  return response.data
}

export async function reorderShots(shotIds: string[]): Promise<{ success: boolean; message: string; shots_count: number }> {
  const response = await apiClient.post<{ success: boolean; message: string; shots_count: number }>(
    '/api/storyboard/reorder-shots',
    { shot_ids: shotIds }
  )
  return response.data
}

export async function approveShot(shotId: string, approved: boolean = true): Promise<{ success: boolean; shot_id: string; is_approved: boolean }> {
  const response = await apiClient.post<{ success: boolean; shot_id: string; is_approved: boolean }>(
    '/api/storyboard/approve-shot',
    { shot_id: shotId, approved }
  )
  return response.data
}

export async function renderShotAudio(shotId: string): Promise<{ success: boolean; shot_id: string; audio_url: string; duration: number }> {
  const response = await apiClient.post<{ success: boolean; shot_id: string; audio_url: string; duration: number }>(
    '/api/storyboard/render-shot-audio',
    { shot_id: shotId }
  )
  return response.data
}

export async function renderShotVideo(shotId: string): Promise<{ success: boolean; shot_id: string; video_url: string; duration: number }> {
  const response = await apiClient.post<{ success: boolean; shot_id: string; video_url: string; duration: number }>(
    '/api/storyboard/render-shot-video',
    { shot_id: shotId }
  )
  return response.data
}

export async function remuxShotVideo(shotId: string): Promise<{ success: boolean; shot_id: string; video_url: string }> {
  const response = await apiClient.post<{ success: boolean; shot_id: string; video_url: string }>(
    '/api/storyboard/remux-shot-video',
    { shot_id: shotId }
  )
  return response.data
}

export interface AssembleMasterParams {
  hardsub?: boolean
  aspect_ratio?: string
  style?: string
}

export async function assembleMaster(params: AssembleMasterParams = {}): Promise<{ success: boolean; video_url: string; filename: string }> {
  const response = await apiClient.post<{ success: boolean; video_url: string; filename: string }>(
    '/api/storyboard/assemble-master',
    params
  )
  return response.data
}

export async function fetchProjects(): Promise<ProjectItem[]> {
  const response = await apiClient.get<ProjectItem[]>('/api/projects')
  return response.data
}

export async function deleteProject(projectId: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(`/api/projects/${projectId}`)
  return response.data
}

export async function fetchProjectSeo(projectId: string): Promise<ProjectSeoData> {
  const response = await apiClient.get<ProjectSeoData>(`/api/projects/${projectId}/seo`)
  return response.data
}

export async function generateProjectThumbnail(
  projectId: string,
  headline?: string,
  shotId?: string
): Promise<{ success: boolean; thumbnail_url: string }> {
  const response = await apiClient.post<{ success: boolean; thumbnail_url: string }>(
    `/api/projects/${projectId}/thumbnail`,
    { headline, shot_id: shotId }
  )
  return response.data
}

export interface DubProjectParams {
  projectId: string
  targetLang: string
  voice?: string
  hardsub?: boolean
}

export async function dubProject({
  projectId,
  targetLang,
  voice,
  hardsub = false,
}: DubProjectParams): Promise<{ success: boolean; target_lang: string; video_url: string; srt_url: string }> {
  const response = await apiClient.post<{ success: boolean; target_lang: string; video_url: string; srt_url: string }>(
    `/api/projects/${projectId}/dub`,
    { target_lang: targetLang, voice, hardsub }
  )
  return response.data
}

export async function generateCharacterHeadshot(
  characterId: string,
  visualAnchor: string,
  seed = 42
): Promise<{ success: boolean; character_id: string; headshot_url: string }> {
  const response = await apiClient.post<{ success: boolean; character_id: string; headshot_url: string }>(
    '/api/characters/generate-headshot',
    { character_id: characterId, visual_anchor: visualAnchor, seed }
  )
  return response.data
}

export async function uploadCharacterHeadshot(
  characterId: string,
  imageBase64: string
): Promise<{ success: boolean; character_id: string; headshot_url: string }> {
  const response = await apiClient.post<{ success: boolean; character_id: string; headshot_url: string }>(
    '/api/characters/upload-headshot',
    { character_id: characterId, image_base64: imageBase64 }
  )
  return response.data
}

export async function testWebhook(webhookUrl: string): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post<{ success: boolean; message: string }>(
    '/api/settings/test-webhook',
    { webhook_url: webhookUrl }
  )
  return response.data
}

export async function fetchLlmModels(
  provider: string,
  apiKey?: string,
  baseUrl?: string
): Promise<import('../types').LLMModelsResponse> {
  const response = await apiClient.post<import('../types').LLMModelsResponse>(
    '/api/llm/models',
    { provider, api_key: apiKey || undefined, base_url: baseUrl || undefined }
  )
  return response.data
}



