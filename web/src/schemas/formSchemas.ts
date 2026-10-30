import { z } from 'zod'

/**
 * Zod Schema cho biểu mẫu Khởi tạo sản xuất phim chính (ProductionForm)
 */
export const productionFormSchema = z.object({
  topic: z
    .string()
    .min(5, 'Ý tưởng kịch bản phải có ít nhất 5 ký tự')
    .max(2000, 'Ý tưởng kịch bản không được vượt quá 2000 ký tự'),
  lang: z.string(),
  duration: z.number().min(1, 'Thời lượng tối thiểu là 1 phút').max(60, 'Thời lượng tối đa là 60 phút'),
  style: z.string(),
  llm: z.string(),
  apiKey: z.string().optional(),
  selectedModel: z.string().optional(),
  customModelText: z.string().optional(),
  isCustomModel: z.boolean(),
  motion: z.string(),
  lipSync: z.string(),
  aspectRatio: z.enum(['16:9', '9:16']),
  hardsub: z.boolean(),
  pauseAfterScript: z.boolean(),
  seriesTitle: z.string().optional(),
  episode: z.number().int().min(1),
  parentProjectId: z.string().optional(),
  webhookUrl: z
    .string()
    .optional()
    .refine((val) => !val || val.startsWith('http://') || val.startsWith('https://'), {
      message: 'Webhook URL phải bắt đầu bằng http:// hoặc https://',
    }),
  hardwareProfile: z.string(),
  hardwareAccel: z.string(),
  imageEngine: z.string(),
  imageApiUrl: z.string().optional(),
  videoApiToken: z.string().optional(),
  videoModel: z.string(),
  subtitleStyle: z.string(),
  subtitlePosition: z.string(),
  subtitleKaraoke: z.boolean(),
  bgmPreset: z.string(),
  bgmVolume: z.number().min(0).max(2),
  duckingLevel: z.string(),
  colorLut: z.string(),
  transitionPreset: z.string(),
  transitionDuration: z.number().min(0).max(2),
})

export type ProductionFormValues = z.infer<typeof productionFormSchema>

/**
 * Zod Schema cho biểu mẫu Tạo Nhân Vật Mới (CharacterVaultModal)
 */
export const characterVaultSchema = z.object({
  name: z
    .string()
    .min(2, 'Tên nhân vật phải có ít nhất 2 ký tự')
    .max(60, 'Tên nhân vật không vượt quá 60 ký tự'),
  visual_anchor: z
    .string()
    .min(10, 'Mô tả ngoại hình bất biến (DNA) phải có ít nhất 10 ký tự')
    .max(1500, 'Mô tả ngoại hình không vượt quá 1500 ký tự'),
  voice: z.string().min(1, 'Vui lòng chọn giọng đọc nhân vật'),
  seed: z
    .number()
    .int('Seed phải là số nguyên')
    .min(1, 'Seed phải lớn hơn 0'),
  tags: z.string(),
})

export type CharacterVaultFormValues = z.infer<typeof characterVaultSchema>

/**
 * Zod Schema cho biểu mẫu Thiết Lập Bối Cảnh Mới (LocationVaultModal)
 */
export const locationVaultSchema = z.object({
  name: z
    .string()
    .min(2, 'Tên bối cảnh phải có ít nhất 2 ký tự')
    .max(80, 'Tên bối cảnh không vượt quá 80 ký tự'),
  environment_dna: z
    .string()
    .min(10, 'Mô tả kiến trúc & môi trường (DNA) phải có ít nhất 10 ký tự')
    .max(1500, 'Mô tả bối cảnh không vượt quá 1500 ký tự'),
  lighting: z
    .string()
    .min(3, 'Mô tả ánh sáng phải có ít nhất 3 ký tự'),
  color_palette: z
    .string()
    .min(3, 'Mô tả bảng màu sắc phải có ít nhất 3 ký tự'),
  seed: z
    .number()
    .int('Seed phải là số nguyên')
    .min(1, 'Seed phải lớn hơn 0'),
  tags: z.string(),
})

export type LocationVaultFormValues = z.infer<typeof locationVaultSchema>

/**
 * Zod Schema cho biểu mẫu Shot Studio (Chỉnh sửa phân cảnh trong StoryboardView)
 */
export const shotStudioSchema = z.object({
  dialogue: z.string(),
  character: z.string(),
  location_id: z.string().nullable().optional(),
  voice: z.string(),
  motion: z.string(),
  prompt: z.string(),
  shot_size: z.string(),
  camera_angle: z.string(),
  lighting: z.string(),
  mood: z.string(),
  emotion: z.string(),
  voice_volume: z.number().min(0).max(2),
  sfx: z.string(),
  sfx_volume: z.number().min(0).max(2),
})

export type ShotStudioFormValues = z.infer<typeof shotStudioSchema>

/**
 * Zod Schema cho biểu mẫu Thêm phân cảnh mới (Add Shot Modal trong StoryboardView)
 */
export const addShotSchema = z.object({
  dialogue: z.string(),
  prompt: z.string(),
  character: z.string(),
  motion: z.string(),
  shot_size: z.string(),
  camera_angle: z.string(),
  lighting: z.string(),
  mood: z.string(),
  emotion: z.string(),
  voice_volume: z.number().min(0).max(2),
  sfx: z.string(),
  sfx_volume: z.number().min(0).max(2),
})

export type AddShotFormValues = z.infer<typeof addShotSchema>

/**
 * Zod Schema cho biểu mẫu Nhân bản giọng nói AI (VoiceCloneModal)
 */
export const voiceCloneSchema = z.object({
  name: z
    .string()
    .min(2, 'Tên giọng nhân bản phải có ít nhất 2 ký tự')
    .max(60, 'Tên giọng nhân bản không được vượt quá 60 ký tự'),
  provider: z.enum(['elevenlabs', 'local']),
  gender: z.enum(['male', 'female', 'neutral']),
  lang: z.string(),
  description: z.string().max(200, 'Mô tả tối đa 200 ký tự').optional(),
  apiKey: z.string().optional(),
  apiUrl: z.string().optional(),
})

export type VoiceCloneFormValues = z.infer<typeof voiceCloneSchema>

