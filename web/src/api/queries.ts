import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchStatus,
  fetchStoryboard,
  produceMovie,
  cleanOutputs,
  updateCharacterVoice,
  continueProduction,
  updateShot,
  previewVoice,
  rerollShot,
  uploadShotImage,
  addShot,
  deleteShot,
  reorderShots,
  approveShot,
  renderShotAudio,
  renderShotVideo,
  remuxShotVideo,
  assembleMaster,
  type AssembleMasterParams,
  fetchProjects,
  deleteProject,
  fetchProjectSeo,
  generateProjectThumbnail,
  dubProject,
  generateCharacterHeadshot,
  uploadCharacterHeadshot,
  testWebhook,
  fetchLlmModels,
  cancelPipeline,
  fetchHardwareInfo,
  fetchStoryTemplates,
  fetchImageEngines,
  testImageEngine,
  fetchVideoModels,
  testVideoToken,
  fetchSubtitlePresets,
  fetchBgmTracks,
  uploadCustomBgm,
  fetchCameraPresets,
  generateMultiAngleCoverage,
  applyMultiAngleShot,
  fetchColorLuts,
  fetchSceneTransitions,
  fetchVoiceList,
  cloneVoice,
  previewVoiceSpeech,
  createDubbing,
  fetchReframePresets,
  createAutoReframe,
  fetchSfxCatalog,
  suggestSfx,
  batchSuggestSfx,
  splitShot,
  type RenderShotVideoParams,
  type UpdateShotParams,
  type AddShotParams,
  type DubProjectParams,
} from './studio'
import type { StudioStatus, StoryboardData, ProductionFormData, ProjectItem, ProjectSeoData } from '../types'

export const QUERY_KEYS = {
  status: ['studio', 'status'] as const,
  storyboard: ['studio', 'storyboard'] as const,
  projects: ['studio', 'projects'] as const,
}

export function useStudioStatus() {
  return useQuery<StudioStatus>({
    queryKey: QUERY_KEYS.status,
    queryFn: fetchStatus,
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.status === 'running' ? 2000 : 5000
    },
    staleTime: 1000,
  })
}

export function useStoryboard(active = false) {
  return useQuery<StoryboardData>({
    queryKey: QUERY_KEYS.storyboard,
    queryFn: fetchStoryboard,
    refetchInterval: active ? 2000 : false,
    staleTime: active ? 1000 : 30000,
  })
}

export function useProduceMovie() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (formData: ProductionFormData) => produceMovie(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.status })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useCleanOutputs() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: cleanOutputs,
    onSuccess: () => {
      queryClient.setQueryData(QUERY_KEYS.storyboard, null)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.status })
    },
  })
}

export function useUpdateCharacterVoice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ characterId, voice }: { characterId: string; voice: string }) =>
      updateCharacterVoice(characterId, voice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useContinueProduction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: continueProduction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.status })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useUpdateShot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: UpdateShotParams) => updateShot(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function usePreviewVoice() {
  return useMutation({
    mutationFn: ({ voice, text }: { voice: string; text?: string }) => previewVoice(voice, text),
  })
}

export function useRerollShot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (shotId: string) => rerollShot(shotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useUploadShotImage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ shotId, imageBase64 }: { shotId: string; imageBase64: string }) =>
      uploadShotImage(shotId, imageBase64),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useAddShot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: AddShotParams) => addShot(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useDeleteShot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (shotId: string) => deleteShot(shotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useReorderShots() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (shotIds: string[]) => reorderShots(shotIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useApproveShot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ shotId, approved }: { shotId: string; approved: boolean }) =>
      approveShot(shotId, approved),
    onSuccess: (_, variables) => {
      queryClient.setQueryData<StoryboardData | undefined>(QUERY_KEYS.storyboard, (old) => {
        if (!old || !old.shots) return old
        return {
          ...old,
          shots: old.shots.map((s) =>
            s.id === variables.shotId ? { ...s, is_approved: variables.approved } : s
          ),
        }
      })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useRenderShotAudio() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (shotId: string) => renderShotAudio(shotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useRenderShotVideo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: string | RenderShotVideoParams) => renderShotVideo(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useRemuxShotVideo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (shotId: string) => remuxShotVideo(shotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useAssembleMaster() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: AssembleMasterParams) => assembleMaster(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.status })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects })
    },
  })
}

export function useProjects() {
  return useQuery<ProjectItem[]>({
    queryKey: QUERY_KEYS.projects,
    queryFn: fetchProjects,
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects })
    },
  })
}

export function useProjectSeo(projectId: string | null) {
  return useQuery<ProjectSeoData>({
    queryKey: ['project-seo', projectId],
    queryFn: () => fetchProjectSeo(projectId!),
    enabled: Boolean(projectId),
  })
}

export function useGenerateThumbnail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ projectId, headline, shotId }: { projectId: string; headline?: string; shotId?: string }) =>
      generateProjectThumbnail(projectId, headline, shotId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects })
      queryClient.invalidateQueries({ queryKey: ['project-seo', variables.projectId] })
    },
  })
}

export function useDubProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: DubProjectParams) => dubProject(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects })
    },
  })
}

export function useGenerateHeadshot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      characterId,
      visualAnchor,
      seed,
    }: {
      characterId: string
      visualAnchor: string
      seed?: number
    }) => generateCharacterHeadshot(characterId, visualAnchor, seed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useUploadHeadshot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      characterId,
      imageBase64,
    }: {
      characterId: string
      imageBase64: string
    }) => uploadCharacterHeadshot(characterId, imageBase64),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: (webhookUrl: string) => testWebhook(webhookUrl),
  })
}

export function useFetchLlmModels() {
  return useMutation({
    mutationFn: ({ provider, apiKey, baseUrl }: { provider: string; apiKey?: string; baseUrl?: string }) =>
      fetchLlmModels(provider, apiKey, baseUrl),
  })
}

export function useCancelPipeline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => cancelPipeline(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.status })
    },
  })
}

export function useHardwareInfo() {
  return useQuery({
    queryKey: ['system', 'hardware'],
    queryFn: fetchHardwareInfo,
    staleTime: 60_000,
  })
}

export function useStoryTemplates() {
  return useQuery({
    queryKey: ['storyboard', 'templates'],
    queryFn: fetchStoryTemplates,
    staleTime: 5 * 60_000,
  })
}

export function useImageEngines() {
  return useQuery({
    queryKey: ['system', 'image-engines'],
    queryFn: fetchImageEngines,
    staleTime: 30_000,
  })
}

export function useTestImageEngine() {
  return useMutation({
    mutationFn: ({ engine, url }: { engine: string; url?: string }) => testImageEngine(engine, url),
  })
}

export function useVideoModels() {
  return useQuery({
    queryKey: ['system', 'video-models'],
    queryFn: fetchVideoModels,
    staleTime: 5 * 60_000,
  })
}

export function useTestVideoToken() {
  return useMutation({
    mutationFn: (token: string) => testVideoToken(token),
  })
}

export function useSubtitlePresets() {
  return useQuery({
    queryKey: ['system', 'subtitle-presets'],
    queryFn: fetchSubtitlePresets,
    staleTime: 5 * 60_000,
  })
}

export function useBgmTracks() {
  return useQuery({
    queryKey: ['system', 'bgm-tracks'],
    queryFn: fetchBgmTracks,
    staleTime: 5 * 60_000,
  })
}

export function useUploadCustomBgm() {
  return useMutation({
    mutationFn: ({ filename, audioBase64 }: { filename: string; audioBase64: string }) =>
      uploadCustomBgm(filename, audioBase64),
  })
}

export function useCameraPresets() {
  return useQuery({
    queryKey: ['system', 'camera-presets'],
    queryFn: fetchCameraPresets,
    staleTime: 10 * 60_000,
  })
}

export function useGenerateMultiAngle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      shotId,
      angles,
      engine,
      apiUrl,
    }: {
      shotId: string
      angles?: string[]
      engine?: string
      apiUrl?: string
    }) => generateMultiAngleCoverage(shotId, angles, engine, apiUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useApplyMultiAngle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      shotId,
      angle,
      reRenderMotion,
    }: {
      shotId: string
      angle: string
      reRenderMotion?: boolean
    }) => applyMultiAngleShot(shotId, angle, reRenderMotion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useColorLuts() {
  return useQuery({
    queryKey: ['system', 'color-luts'],
    queryFn: fetchColorLuts,
    staleTime: 10 * 60_000,
  })
}

export function useSceneTransitions() {
  return useQuery({
    queryKey: ['system', 'scene-transitions'],
    queryFn: fetchSceneTransitions,
    staleTime: 10 * 60_000,
  })
}

export function useVoiceList() {
  return useQuery({
    queryKey: ['system', 'voice-list'],
    queryFn: fetchVoiceList,
    staleTime: 5 * 60_000,
  })
}

export function useCloneVoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: cloneVoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system', 'voice-list'] })
    },
  })
}

export function usePreviewVoiceSpeech() {
  return useMutation({
    mutationFn: previewVoiceSpeech,
  })
}

export function useCreateDubbing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createDubbing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useReframePresets() {
  return useQuery({
    queryKey: ['system', 'reframe-presets'],
    queryFn: fetchReframePresets,
    staleTime: 10 * 60_000,
  })
}

export function useCreateAutoReframe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAutoReframe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useSfxCatalog() {
  return useQuery({
    queryKey: ['system', 'sfx-catalog'],
    queryFn: fetchSfxCatalog,
    staleTime: 10 * 60_000,
  })
}

export function useSuggestSfx() {
  return useMutation({
    mutationFn: suggestSfx,
  })
}

export function useBatchSuggestSfx() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: batchSuggestSfx,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}

export function useSplitShot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: splitShot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.storyboard })
    },
  })
}









