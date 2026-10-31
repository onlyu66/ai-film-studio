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
  camera_lens?: string
  camera_motion?: string
  location_id?: string | null
  voice_volume?: number
  sfx_volume?: number
  sfx_offset_ms?: number
  duration?: number
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
  camera_lens?: string
  camera_motion?: string
  location_id?: string | null
  voice_volume?: number
  sfx_volume?: number
  sfx_offset_ms?: number
  duration?: number
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

export interface RenderShotVideoParams {
  shotId: string
  engine?: string
  videoApiToken?: string
  videoModel?: string
}

export async function renderShotVideo(
  params: string | RenderShotVideoParams
): Promise<{ success: boolean; shot_id: string; video_url: string; duration: number }> {
  const payload = typeof params === 'string' ? { shot_id: params } : {
    shot_id: params.shotId,
    engine: params.engine,
    video_api_token: params.videoApiToken,
    video_model: params.videoModel,
  }
  const response = await apiClient.post<{ success: boolean; shot_id: string; video_url: string; duration: number }>(
    '/api/storyboard/render-shot-video',
    payload
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

export function getTimelineExportUrl(options?: {
  projectId?: string
  format?: 'fcpxml'
  aspectRatio?: string
  fps?: number
}): string {
  const format = options?.format || 'fcpxml'
  const fps = options?.fps || 25
  const aspectRatio = options?.aspectRatio || '16:9'

  if (options?.projectId) {
    return `/api/projects/${options.projectId}/export-timeline?format=${format}&aspect_ratio=${aspectRatio}&fps=${fps}`
  }
  return `/api/storyboard/export-timeline?format=${format}&aspect_ratio=${aspectRatio}&fps=${fps}`
}

export async function cancelPipeline(): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post<{ success: boolean; message: string }>('/api/pipeline/cancel')
  return response.data
}

export async function fetchHardwareInfo(): Promise<import('../types').HardwareInfo> {
  const response = await apiClient.get<import('../types').HardwareInfo>('/api/system/hardware')
  return response.data
}

export async function fetchStoryTemplates(): Promise<import('../types').StoryTemplate[]> {
  const response = await apiClient.get<import('../types').StoryTemplate[]>('/api/storyboard/templates')
  return response.data
}

export async function fetchStoryTemplate(templateId: string): Promise<import('../types').StoryTemplate> {
  const response = await apiClient.get<import('../types').StoryTemplate>(`/api/storyboard/templates/${templateId}`)
  return response.data
}

export async function fetchImageEngines(): Promise<import('../types').ImageEngineInfo[]> {
  const response = await apiClient.get<import('../types').ImageEngineInfo[]>('/api/system/image-engines')
  return response.data
}

export async function testImageEngine(engine: string, url?: string): Promise<import('../types').ImageEngineInfo> {
  const response = await apiClient.post<import('../types').ImageEngineInfo>('/api/settings/test-image-engine', {
    engine,
    url,
  })
  return response.data
}

export async function fetchVideoModels(): Promise<import('../types').VideoModelItem[]> {
  const response = await apiClient.get<import('../types').VideoModelItem[]>('/api/system/video-models')
  return response.data
}

export async function testVideoToken(token: string): Promise<{ is_valid: boolean; username?: string; message: string }> {
  const response = await apiClient.post<{ is_valid: boolean; username?: string; message: string }>(
    '/api/settings/test-video-token',
    { token }
  )
  return response.data
}

export async function fetchSubtitlePresets(): Promise<import('../types').SubtitlePresetItem[]> {
  const response = await apiClient.get<import('../types').SubtitlePresetItem[]>('/api/system/subtitle-presets')
  return response.data
}

export async function fetchBgmTracks(): Promise<import('../types').BgmTrackItem[]> {
  const response = await apiClient.get<import('../types').BgmTrackItem[]>('/api/assets/bgm')
  return response.data
}

export async function uploadCustomBgm(
  filename: string,
  audioBase64: string
): Promise<{ success: boolean; id: string; name: string; stream_url: string; message: string }> {
  const response = await apiClient.post<{ success: boolean; id: string; name: string; stream_url: string; message: string }>(
    '/api/assets/bgm/upload',
    { filename, audio_base64: audioBase64 }
  )
  return response.data
}

export async function fetchCameraPresets(): Promise<import('../types').CameraPresetsResponse> {
  const response = await apiClient.get<import('../types').CameraPresetsResponse>('/api/camera/presets')
  return response.data
}

export async function generateMultiAngleCoverage(
  shotId: string,
  angles?: string[],
  engine?: string,
  apiUrl?: string
): Promise<import('../types').MultiAngleCoverageResponse> {
  const response = await apiClient.post<import('../types').MultiAngleCoverageResponse>(
    `/api/shots/${shotId}/multi-angle`,
    { angles, engine, api_url: apiUrl }
  )
  return response.data
}

export async function applyMultiAngleShot(
  shotId: string,
  angle: string,
  reRenderMotion = false
): Promise<{ success: boolean; shot_id: string; applied_angle: string; image_url: string }> {
  const response = await apiClient.post<{ success: boolean; shot_id: string; applied_angle: string; image_url: string }>(
    `/api/shots/${shotId}/apply-angle`,
    { angle, re_render_motion: reRenderMotion }
  )
  return response.data
}

export async function fetchColorLuts(): Promise<import('../types').ColorLutItem[]> {
  const response = await apiClient.get<import('../types').ColorLutItem[]>('/api/lut/presets')
  return response.data
}

export async function fetchSceneTransitions(): Promise<import('../types').SceneTransitionItem[]> {
  const response = await apiClient.get<import('../types').SceneTransitionItem[]>('/api/transitions/presets')
  return response.data
}

export async function fetchVoiceList(): Promise<import('../types').VoiceProfileItem[]> {
  const response = await apiClient.get<import('../types').VoiceProfileItem[]>('/api/voice/list')
  return response.data
}

export async function cloneVoice(payload: import('../types').CloneVoicePayload): Promise<import('../types').VoiceProfileItem> {
  const response = await apiClient.post<import('../types').VoiceProfileItem>('/api/voice/clone', payload)
  return response.data
}

export async function previewVoiceSpeech(payload: import('../types').VoicePreviewPayload): Promise<{ success: boolean; audio_url: string }> {
  const response = await apiClient.post<{ success: boolean; audio_url: string }>('/api/voice/preview', payload)
  return response.data
}

export async function createDubbing(payload: import('../types').DubbingRequestPayload): Promise<import('../types').DubbingResultResponse> {
  const response = await apiClient.post<import('../types').DubbingResultResponse>('/api/dubbing/create', payload)
  return response.data
}

export async function fetchReframePresets(): Promise<import('../types').ReframePresetItem[]> {
  const response = await apiClient.get<import('../types').ReframePresetItem[]>('/api/reframe/presets')
  return response.data
}

export async function createAutoReframe(payload: import('../types').ReframeRequestPayload): Promise<import('../types').ReframeResultResponse> {
  const response = await apiClient.post<import('../types').ReframeResultResponse>('/api/reframe/create', payload)
  return response.data
}

export async function fetchSfxCatalog(): Promise<import('../types').SfxCatalogItem[]> {
  const response = await apiClient.get<import('../types').SfxCatalogItem[]>('/api/sfx/catalog')
  return response.data
}

export async function suggestSfx(payload: import('../types').SfxSuggestRequestPayload): Promise<import('../types').SfxSuggestResponse> {
  const response = await apiClient.post<import('../types').SfxSuggestResponse>('/api/sfx/suggest', payload)
  return response.data
}

export async function batchSuggestSfx(payload: import('../types').BatchSfxSuggestRequestPayload): Promise<import('../types').BatchSfxSuggestResponse> {
  const response = await apiClient.post<import('../types').BatchSfxSuggestResponse>('/api/sfx/batch-suggest', payload)
  return response.data
}

export async function splitShot(payload: import('../types').SplitShotRequestPayload): Promise<import('../types').SplitShotResponse> {
  const response = await apiClient.post<import('../types').SplitShotResponse>('/api/storyboard/split-shot', payload)
  return response.data
}

// --- Character Vault API ---
export async function fetchVaultCharacters(): Promise<import('../types').VaultCharacterItem[]> {
  const response = await apiClient.get<import('../types').VaultCharacterItem[]>('/api/characters/vault')
  return response.data
}

export async function saveCharacterToVault(
  payload: import('../types').SaveVaultCharacterPayload
): Promise<{ success: boolean; character: import('../types').VaultCharacterItem }> {
  const response = await apiClient.post<{ success: boolean; character: import('../types').VaultCharacterItem }>(
    '/api/characters/vault/save',
    payload
  )
  return response.data
}

export async function deleteVaultCharacter(
  charId: string
): Promise<{ success: boolean; deleted_id: string }> {
  const response = await apiClient.delete<{ success: boolean; deleted_id: string }>(
    `/api/characters/vault/${encodeURIComponent(charId)}`
  )
  return response.data
}

export async function importVaultCharacter(
  payload: import('../types').ImportVaultCharacterPayload
): Promise<{ success: boolean; character: import('../types').VaultCharacterItem }> {
  const response = await apiClient.post<{ success: boolean; character: import('../types').VaultCharacterItem }>(
    '/api/characters/vault/import',
    payload
  )
  return response.data
}

export async function generateCharacterAngles(
  payload: import('../types').GenerateAnglesPayload
): Promise<import('../types').GenerateAnglesResponse> {
  const response = await apiClient.post<import('../types').GenerateAnglesResponse>(
    '/api/characters/generate-angles',
    payload
  )
  return response.data
}

// --- Location Vault API ---
export async function fetchVaultLocations(): Promise<import('../types').VaultLocationItem[]> {
  const response = await apiClient.get<import('../types').VaultLocationItem[]>('/api/locations/vault')
  return response.data
}

export async function saveLocationToVault(
  payload: import('../types').SaveVaultLocationPayload
): Promise<{ success: boolean; location: import('../types').VaultLocationItem }> {
  const response = await apiClient.post<{ success: boolean; location: import('../types').VaultLocationItem }>(
    '/api/locations/vault/save',
    payload
  )
  return response.data
}

export async function deleteVaultLocation(
  locId: string
): Promise<{ success: boolean; deleted_id: string }> {
  const response = await apiClient.delete<{ success: boolean; deleted_id: string }>(
    `/api/locations/vault/${encodeURIComponent(locId)}`
  )
  return response.data
}

export async function importVaultLocation(
  payload: import('../types').ImportVaultLocationPayload
): Promise<{ success: boolean; location: import('../types').VaultLocationItem }> {
  const response = await apiClient.post<{ success: boolean; location: import('../types').VaultLocationItem }>(
    '/api/locations/vault/import',
    payload
  )
  return response.data
}

export async function assignLocationToShot(
  payload: import('../types').AssignLocationToShotPayload
): Promise<{ success: boolean; shot_id: string; location_id?: string | null }> {
  const response = await apiClient.post<{ success: boolean; shot_id: string; location_id?: string | null }>(
    '/api/locations/assign-to-shot',
    payload
  )
  return response.data
}

export async function generateLocationPreview(
  payload: import('../types').GenerateLocationPreviewPayload
): Promise<{ success: boolean; location_id: string; preview_url: string }> {
  const response = await apiClient.post<{ success: boolean; location_id: string; preview_url: string }>(
    '/api/locations/generate-preview',
    payload
  )
  return response.data
}

export async function uploadLocationPreview(
  payload: { location_id: string; image_base64: string }
): Promise<{ success: boolean; location_id: string; preview_url: string }> {
  const response = await apiClient.post<{ success: boolean; location_id: string; preview_url: string }>(
    '/api/locations/upload-preview',
    payload
  )
  return response.data
}

// --- Video Enhancer API ---
export async function fetchEnhancerPresets(): Promise<import('../types').VideoEnhancerPreset[]> {
  const response = await apiClient.get<import('../types').VideoEnhancerPreset[]>('/api/video/enhancer/presets')
  return response.data
}

export async function enhanceShotVideo(
  payload: import('../types').EnhanceShotPayload
): Promise<import('../types').EnhanceVideoResponse> {
  const response = await apiClient.post<import('../types').EnhanceVideoResponse>(
    '/api/video/enhancer/enhance-shot',
    payload
  )
  return response.data
}

export async function enhanceMasterVideo(
  payload: import('../types').EnhanceMasterPayload
): Promise<import('../types').EnhanceVideoResponse> {
  const response = await apiClient.post<import('../types').EnhanceVideoResponse>(
    '/api/video/enhancer/enhance-master',
    payload
  )
  return response.data
}

export async function fetchCamera3DPresets(): Promise<Record<string, import('../types').Camera3DPresetItem>> {
  const response = await apiClient.get<Record<string, import('../types').Camera3DPresetItem>>('/api/video/camera-3d/presets')
  return response.data
}

export async function previewCamera3D(
  payload: Partial<import('../types').Camera3DTrajectory> & { base_prompt?: string; duration?: number }
): Promise<import('../types').Camera3DPreviewResponse> {
  const response = await apiClient.post<import('../types').Camera3DPreviewResponse>('/api/video/camera-3d/preview', payload)
  return response.data
}

export async function renderShot3DVideo(
  payload: {
    shot_id: string
    engine?: string
    video_api_token?: string
    video_model?: string
    trajectory?: import('../types').Camera3DTrajectory
  }
): Promise<{ success: boolean; shot_id: string; video_url?: string }> {
  const response = await apiClient.post<{ success: boolean; shot_id: string; video_url?: string }>(
    '/api/video/render-shot',
    payload,
    { timeout: 240000 }
  )
  return response.data
}

export async function testProviderToken(
  provider: string,
  token: string
): Promise<{ is_valid: boolean; message: string; username?: string }> {
  const response = await apiClient.post<{ is_valid: boolean; message: string; username?: string }>('/api/video/test-token', {
    provider,
    token,
  })
  return response.data
}

export async function snapTimelineToBeat(params: {
  project_id?: string
  bgm_track?: string
  min_shot_duration?: number
  max_shot_duration?: number
  save_to_storyboard?: boolean
}): Promise<{
  success: boolean
  shots: Array<{ id: string; duration: number }>
  total_duration: number
  tempo_bpm: number
}> {
  const response = await apiClient.post('/api/audio/beat-sync/snap', params)
  return response.data
}















// ─── ComfyUI Dual Engine Hub API ──────────────────────────────────

export async function getComfyUIStatus(url?: string): Promise<import('../types').ComfyUIHealthStatus> {
  const params = url ? { url } : {}
  const response = await apiClient.get<import('../types').ComfyUIHealthStatus>('/api/comfyui/status', { params })
  return response.data
}

export async function getComfyUIModels(url?: string): Promise<import('../types').ComfyUIModels> {
  const params = url ? { url } : {}
  const response = await apiClient.get<{ success: boolean; models: import('../types').ComfyUIModels }>('/api/comfyui/models', { params })
  return response.data?.models || { checkpoints: [], loras: [], vaes: [] }
}

export async function getComfyUIWorkflows(url?: string): Promise<import('../types').ComfyUIWorkflowItem[]> {
  const params = url ? { url } : {}
  const response = await apiClient.get<{ success: boolean; workflows: import('../types').ComfyUIWorkflowItem[] }>('/api/comfyui/workflows', { params })
  return response.data?.workflows || []
}

export async function uploadComfyUIWorkflow(params: {
  name: string
  workflow_json: Record<string, unknown>
  category?: 'image' | 'video'
  description?: string
}): Promise<{ success: boolean; workflow?: { id: string; name: string; category: string }; message?: string }> {
  const response = await apiClient.post('/api/comfyui/workflows/upload', params)
  return response.data
}

export async function getComfyUIConfig(projectId?: string): Promise<import('../types').ComfyUIConfig> {
  const params = projectId ? { project_id: projectId } : {}
  const response = await apiClient.get<import('../types').ComfyUIConfig>('/api/comfyui/config', { params })
  return response.data
}

export async function saveComfyUIConfig(
  config: Partial<import('../types').ComfyUIConfig> & { save_as_global?: boolean; project_id?: string }
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post<{ success: boolean; message: string }>('/api/comfyui/config', config)
  return response.data
}

export async function testComfyUIGeneration(url?: string): Promise<{ success: boolean; message: string; output_path?: string }> {
  const params = url ? { url } : {}
  const response = await apiClient.post<{ success: boolean; message: string; output_path?: string }>(
    '/api/comfyui/test',
    {},
    { params, timeout: 120000 }
  )
  return response.data
}

export function getWebGLGpuHint(): string | undefined {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (!gl) return undefined
    const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info')
    if (!debugInfo) return undefined
    return (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || undefined
  } catch {
    return undefined
  }
}

export async function getComfyUIHardwareCheck(clientGpu?: string): Promise<{
  success: boolean
  hardware: import('../types').ComfyUIHardwareReport
  detected_gpus: Array<{ name: string; vram_gb: number; driver?: string }>
}> {
  const hint = clientGpu || getWebGLGpuHint()
  const params = hint ? { client_gpu: hint } : {}
  const response = await apiClient.get('/api/comfyui/hardware-check', { params })
  return response.data
}
