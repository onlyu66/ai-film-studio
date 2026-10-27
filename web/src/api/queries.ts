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
  fetchProjects,
  deleteProject,
  fetchProjectSeo,
  generateProjectThumbnail,
  dubProject,
  generateCharacterHeadshot,
  uploadCharacterHeadshot,
  testWebhook,
  fetchLlmModels,
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
    refetchInterval: active ? 2000 : 5000,
    staleTime: 1000,
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


