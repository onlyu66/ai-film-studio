import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchStatus,
  fetchStoryboard,
  produceMovie,
  cleanOutputs,
  updateCharacterVoice,
  continueProduction,
  updateShot,
  type UpdateShotParams,
} from './studio'
import type { StudioStatus, StoryboardData, ProductionFormData } from '../types'

export const QUERY_KEYS = {
  status: ['studio', 'status'] as const,
  storyboard: ['studio', 'storyboard'] as const,
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

export function useStoryboard(isRunning = false) {
  return useQuery<StoryboardData>({
    queryKey: QUERY_KEYS.storyboard,
    queryFn: fetchStoryboard,
    refetchInterval: isRunning ? 3000 : false,
    staleTime: 5000,
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


