import { apiClient } from './client'
import type { StudioStatus, StoryboardData, ProductionFormData } from '../types'

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

