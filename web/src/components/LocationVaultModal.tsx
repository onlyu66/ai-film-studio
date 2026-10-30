import React, { useState, useEffect } from 'react'
import {
  X,
  Sparkles,
  Plus,
  Trash2,
  Download,
  Check,
  Search,
  Lock,
  Eye,
  Loader2,
  Camera,
  RefreshCw,
  Copy,
  Maximize2,
  Upload,
  AlertCircle,
  Building2,
  SunMedium,
  Palette,
  Dice5,
  Film,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { VaultLocationItem, SaveVaultLocationPayload } from '../types'
import {
  useVaultLocations,
  useSaveVaultLocation,
  useDeleteVaultLocation,
  useImportVaultLocation,
  useAssignLocationToShot,
  useGenerateLocationPreview,
  useUploadLocationPreview,
} from '../api/queries'

interface LocationVaultModalProps {
  isOpen: boolean
  onClose: () => void
  onLocationImported?: (loc: VaultLocationItem) => void
  onAssignToShot?: (locId: string) => void
  currentProjectId?: string
  assigningShotId?: string | null
}

const LOCATION_PRESETS = [
  {
    label: '⚡ Cyberpunk Neon',
    name: 'Hẻm Phố Cyberpunk 2099',
    dna: 'Narrow cyberpunk metropolis alleyway, towering brutalist skyscrapers overhead with tangled holographic cables, rain-slicked asphalt reflecting vibrant magenta and cyan neon signs, steam rising from underground grates',
    lighting: 'High-contrast chiaroscuro, sharp neon pink and electric blue rim lights, shadowy recesses',
    palette: 'Electric cyan, neon magenta, asphalt black, amber glow',
    tags: 'cyberpunk, urban, night, rain',
  },
  {
    label: '🚀 Tàu Không Gian',
    name: 'Khoang Chỉ Huy Tàu Không Gian',
    dna: 'Command deck of an interstellar dreadnought cruiser, massive panoramic curved reinforced blast-glass viewing window looking out into a spiral purple nebula with distant star clusters, ergonomic carbon-fiber operator consoles',
    lighting: 'Dim ambient command lighting with soft azure console luminescence and starfield rim glow',
    palette: 'Deep void navy, starlight white, electric azure, metallic gunmetal',
    tags: 'sci-fi, space, spaceship, interior',
  },
  {
    label: '🏛️ Hoàng Cung Cổ Trang',
    name: 'Đại Điện Hoàng Cung Cổ Trang',
    dna: 'Imperial palace grand audience throne hall, towering carved ironwood pillars lacquered in scarlet and gold with dragon motifs, polished terracotta tile floor reflecting flickering silk lanterns, gilded wooden throne elevated on marble steps',
    lighting: 'Warm flickering lantern light, golden atmospheric dust motes filtering through carved wooden lattice windows',
    palette: 'Imperial scarlet, antiqued gold, dark ironwood brown, warm amber',
    tags: 'historical, ancient, palace, asian',
  },
  {
    label: '🧪 Lab Lượng Tử',
    name: 'Phòng Thí Nghiệm Lượng Tử AI',
    dna: 'Ultra-clean subterranean quantum computing laboratory, central cylindrical chamber containing a suspended superconducting dilution refrigerator wrapped in polished copper coils, sterile white composite walls, holographic volumetric diagnostics',
    lighting: 'Pristine white clinical overhead strip lighting balanced with glowing teal liquid coolant reflections',
    palette: 'Sterile pearl white, copper bronze, glowing cyan teal, frosted glass',
    tags: 'sci-fi, tech, laboratory, indoor',
  },
  {
    label: '🎷 Quán Bar Noir',
    name: 'Quán Bar Jazz Noir Chiaroscuro',
    dna: 'Moody 1950s underground jazz lounge, smoky air catching the beam of a single vintage amber spotlight on an empty brass saxophone and baby grand piano, mahogany bar counter with crystal whiskey decanters, dark green velvet circular booths',
    lighting: 'Dramatic film noir chiaroscuro, low-key warm tungsten lamp light with heavy cinematic shadows',
    palette: 'Warm amber, deep mahogany, emerald velvet, smoky charcoal',
    tags: 'noir, bar, vintage, atmospheric',
  },
]

export const LocationVaultModal: React.FC<LocationVaultModalProps> = ({
  isOpen,
  onClose,
  onLocationImported,
  onAssignToShot,
  currentProjectId = 'current',
  assigningShotId = null,
}) => {
  const { data: vaultLocations = [], isLoading } = useVaultLocations()
  const saveMutation = useSaveVaultLocation()
  const deleteMutation = useDeleteVaultLocation()
  const importMutation = useImportVaultLocation()
  const assignMutation = useAssignLocationToShot()
  const generatePreviewMutation = useGenerateLocationPreview()
  const uploadPreviewMutation = useUploadLocationPreview()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [importedLocId, setImportedLocId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [generatingPreviewId, setGeneratingPreviewId] = useState<string | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  // Form State
  const [newName, setNewName] = useState('')
  const [newDna, setNewDna] = useState('')
  const [newLighting, setNewLighting] = useState('Cinematic chiaroscuro, atmospheric rim lighting')
  const [newPalette, setNewPalette] = useState('Deep teal, warm amber, obsidian black')
  const [newSeed, setNewSeed] = useState(42)
  const [newTags, setNewTags] = useState('cinema, interior')
  const [newPreviewBase64, setNewPreviewBase64] = useState<string | null>(null)
  const [newPreviewUrl, setNewPreviewUrl] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxImage) setLightboxImage(null)
        else onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, lightboxImage])

  const applyPreset = (preset: typeof LOCATION_PRESETS[0]) => {
    setNewName(preset.name)
    setNewDna(preset.dna)
    setNewLighting(preset.lighting)
    setNewPalette(preset.palette)
    setNewTags(preset.tags)
    setFormError(null)
  }

  const handleRandomSeed = () => {
    setNewSeed(Math.floor(Math.random() * 90000) + 1000)
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setFormError('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WebP).')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setFormError('Kích thước ảnh không được vượt quá 8MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const b64 = reader.result as string
      setNewPreviewBase64(b64)
      setNewPreviewUrl(b64)
      setFormError(null)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) {
      setFormError('Vui lòng nhập tên bối cảnh / địa điểm.')
      return
    }
    if (!newDna.trim()) {
      setFormError('Vui lòng nhập mô tả kiến trúc và môi trường (Environment DNA).')
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    try {
      const locId = `loc_${Date.now()}`
      let previewUrl = newPreviewUrl

      // If custom base64 was chosen, upload it
      if (newPreviewBase64) {
        const uploadRes = await uploadPreviewMutation.mutateAsync({
          location_id: locId,
          image_base64: newPreviewBase64,
        })
        previewUrl = uploadRes.preview_url
      }

      const tagsArray = newTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)

      const payload: SaveVaultLocationPayload = {
        id: locId,
        name: newName.trim(),
        environment_dna: newDna.trim(),
        lighting: newLighting.trim(),
        color_palette: newPalette.trim(),
        seed: newSeed,
        preview_url: previewUrl || undefined,
        tags: tagsArray.length > 0 ? tagsArray : ['custom'],
      }

      const res = await saveMutation.mutateAsync(payload)
      if (res.success) {
        // Reset form
        setNewName('')
        setNewDna('')
        setNewPreviewBase64(null)
        setNewPreviewUrl(null)
        setIsCreatingNew(false)
      }
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || 'Lỗi khi lưu bối cảnh vào kho Vault.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleImportLocation = async (loc: VaultLocationItem) => {
    try {
      await importMutation.mutateAsync({
        vault_loc_id: loc.id,
        project_id: currentProjectId,
      })
      setImportedLocId(loc.id)
      onLocationImported?.(loc)
      setTimeout(() => setImportedLocId(null), 3000)
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Không thể nhập bối cảnh vào kịch bản.')
    }
  }

  const handleAssignToActiveShot = async (locId: string) => {
    if (!assigningShotId) return
    try {
      await assignMutation.mutateAsync({
        shot_id: assigningShotId,
        location_id: locId,
        project_id: currentProjectId,
      })
      onAssignToShot?.(locId)
      onClose()
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Không thể gán bối cảnh cho phân cảnh.')
    }
  }

  const handleGeneratePreview = async (loc: VaultLocationItem) => {
    setGeneratingPreviewId(loc.id)
    try {
      await generatePreviewMutation.mutateAsync({
        location_id: loc.id,
        environment_dna: loc.environment_dna,
        lighting: loc.lighting,
        color_palette: loc.color_palette,
        seed: loc.seed || 42,
      })
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Lỗi khi sinh ảnh xem trước bối cảnh.')
    } finally {
      setGeneratingPreviewId(null)
    }
  }

  // Filter tags
  const allTags = Array.from(
    new Set(vaultLocations.flatMap((l) => l.tags || []).filter(Boolean))
  )

  const filteredLocations = vaultLocations.filter((loc) => {
    const matchesSearch =
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.environment_dna.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (loc.tags && loc.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())))

    const matchesTag = selectedTag === 'all' || (loc.tags && loc.tags.includes(selectedTag))
    return matchesSearch && matchesTag
  })

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-x-hidden animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl max-h-[90vh] bg-cinema-card border border-cinema-border/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cinema-border/60 bg-cinema-card/95 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Kho Bối Cảnh Bất Biến (Location Vault Pro)
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                  World-Building Engine
                </span>
                {assigningShotId && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse">
                    Đang chọn cho Cảnh #{assigningShotId}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Cố định kiến trúc, bầu không khí ánh sáng và màu sắc điện ảnh xuyên suốt các phân cảnh
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreatingNew((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isCreatingNew
                  ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold shadow-md shadow-cyan-500/20'
              }`}
            >
              {isCreatingNew ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Xem Danh Sách</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tạo Bối Cảnh Mới</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer"
              title="Đóng (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 p-6 overflow-hidden">
          {/* Left Column: Create / Edit Form */}
          {isCreatingNew && (
            <div className="w-full lg:w-[420px] shrink-0 max-h-full overflow-y-auto scrollbar-thin pr-2 flex flex-col bg-cinema-canvas/60 rounded-xl border border-cinema-border/40 p-4">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Thiết lập Bối Cảnh Mới
                </span>
                <span className="text-[11px] text-zinc-400">1-Click Presets:</span>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5 mb-4 shrink-0">
                {LOCATION_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="px-2 py-1 rounded-md text-[11px] bg-zinc-800/90 hover:bg-cyan-500/20 hover:text-cyan-300 border border-zinc-700/60 transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSaveLocation} className="space-y-4 flex-1">
                {formError && (
                  <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Name & Seed */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Tên Địa Điểm / Bối Cảnh <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ví dụ: Phòng Thí Nghiệm Lượng Tử AI"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900/90 border border-zinc-700/80 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                    required
                  />
                </div>

                {/* Environment DNA Anchor */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      Mô Tả Kiến Trúc & Môi Trường (Environment DNA) <span className="text-red-400">*</span>
                    </label>
                    <span className="text-[10px] text-zinc-500">{newDna.length}/600 ký tự</span>
                  </div>
                  <textarea
                    value={newDna}
                    onChange={(e) => setNewDna(e.target.value.slice(0, 600))}
                    placeholder="Mô tả cấu trúc phòng, vật liệu, cửa kính, máy móc, độ phản chiếu mặt đất..."
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900/90 border border-zinc-700/80 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors leading-relaxed resize-none"
                    required
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Environment DNA sẽ được tự động kết hợp với Visual DNA của nhân vật và hành động của phân cảnh.
                  </p>
                </div>

                {/* Lighting and Color Palette */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                      <SunMedium className="w-3.5 h-3.5 text-amber-400" /> Ánh Sáng
                    </label>
                    <input
                      type="text"
                      value={newLighting}
                      onChange={(e) => setNewLighting(e.target.value)}
                      placeholder="Chiaroscuro, neon rim light"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-700/80 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                      <Palette className="w-3.5 h-3.5 text-purple-400" /> Bảng Màu (Palette)
                    </label>
                    <input
                      type="text"
                      value={newPalette}
                      onChange={(e) => setNewPalette(e.target.value)}
                      placeholder="Cyan, magenta, dark obsidian"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-700/80 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Seed Lock & Tags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-cyan-400" /> Khóa Seed Bất Biến
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={newSeed}
                        onChange={(e) => setNewSeed(parseInt(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-700/80 text-xs text-white focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={handleRandomSeed}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
                        title="Ngẫu nhiên hóa Seed"
                      >
                        <Dice5 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Thẻ Phân Loại (Tags)
                    </label>
                    <input
                      type="text"
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                      placeholder="sci-fi, interior, lab"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-700/80 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {/* Reference Image Upload (16:9) */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                    <span>Ảnh Bối Cảnh Tham Chiếu (Tùy chọn)</span>
                    <span className="text-[10px] text-zinc-500">Tỷ lệ 16:9 chuẩn cinema</span>
                  </label>
                  {newPreviewUrl ? (
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-cyan-500/50 bg-black group">
                      <img
                        src={newPreviewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <label className="px-3 py-1.5 rounded-lg bg-cyan-500 text-zinc-950 font-bold text-xs flex items-center gap-1 cursor-pointer">
                          <Camera className="w-3.5 h-3.5" />
                          <span>Đổi ảnh</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileChange}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setNewPreviewBase64(null)
                            setNewPreviewUrl(null)
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-500/80 text-white font-bold text-xs flex items-center gap-1 hover:bg-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Gỡ</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="aspect-video rounded-xl border-2 border-dashed border-zinc-700/80 hover:border-cyan-500/60 bg-zinc-900/40 hover:bg-zinc-900/70 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all">
                      <Upload className="w-6 h-6 text-zinc-500" />
                      <span className="text-xs text-zinc-400 font-medium">
                        Tải ảnh thiết lập bối cảnh 16:9
                      </span>
                      <span className="text-[10px] text-zinc-600">PNG, JPG, WebP tối đa 8MB</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Sticky Action Buttons */}
                <div className="sticky bottom-0 bg-cinema-card/95 backdrop-blur-md pt-3 border-t border-cinema-border/40 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Lưu vào Kho Vault</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Right Column: List of Locations */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 shrink-0">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm bối cảnh theo tên, kiến trúc, thẻ hashtag..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-zinc-900/90 border border-zinc-700/80 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Tag pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setSelectedTag('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors shrink-0 cursor-pointer ${
                    selectedTag === 'all'
                      ? 'bg-cyan-500 text-zinc-950 font-bold'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
                  }`}
                >
                  Tất cả ({vaultLocations.length})
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
                      selectedTag === tag
                        ? 'bg-cyan-500 text-zinc-950 font-bold'
                        : 'bg-zinc-800/80 text-zinc-400 hover:text-white'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Location Cards Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  <span className="text-xs">Đang tải danh mục Bối Cảnh Vault...</span>
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500 gap-3 text-center">
                  <Building2 className="w-12 h-12 text-zinc-600 stroke-1" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-400">Không tìm thấy bối cảnh phù hợp</p>
                    <p className="text-xs text-zinc-500 mt-1">
                      Thử thay đổi từ khóa tìm kiếm hoặc nhấn nút "Tạo Bối Cảnh Mới" ở trên.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                  {filteredLocations.map((loc) => {
                    const isImported = importedLocId === loc.id
                    const isCopied = copiedId === loc.id
                    const isGenerating = generatingPreviewId === loc.id

                    return (
                      <motion.div
                        key={loc.id}
                        whileHover={{ y: -4 }}
                        transition={{ duration: 0.2 }}
                        className="group relative bg-cinema-card/90 hover:bg-cinema-card rounded-xl border border-cinema-border/70 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-950/20 transition-[border-color,box-shadow] overflow-hidden flex flex-col"
                      >
                        {/* Top decorative gradient glow */}
                        <div className="h-0.5 w-full bg-gradient-to-r from-cyan-500 via-blue-500 to-transparent opacity-40 group-hover:opacity-100 transition-opacity" />

                        {/* Card Image 16:9 Banner */}
                        <div className="relative aspect-video bg-black overflow-hidden shrink-0">
                          {loc.preview_url ? (
                            <img
                              src={loc.preview_url}
                              alt={loc.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2 bg-gradient-to-br from-zinc-900 to-black">
                              <Building2 className="w-8 h-8 opacity-40" />
                              <span className="text-[11px] font-medium text-zinc-500">Chưa có ảnh xem trước</span>
                            </div>
                          )}

                          {/* Quick Overlay Toolbar */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-between p-2.5">
                            <span className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] text-cyan-300 font-mono border border-cyan-500/30">
                              Seed: {loc.seed || 42}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {loc.preview_url && (
                                <button
                                  type="button"
                                  onClick={() => setLightboxImage(loc.preview_url!)}
                                  className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 transition-colors cursor-pointer"
                                  title="Phóng to ảnh"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleGeneratePreview(loc)}
                                disabled={isGenerating}
                                className="p-1.5 rounded-lg bg-black/60 hover:bg-cyan-500 hover:text-zinc-950 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                                title="Sinh ảnh AI mới cho bối cảnh"
                              >
                                {isGenerating ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                                ) : (
                                  <RefreshCw className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Card Content */}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                                {loc.name}
                              </h3>
                              <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                                #{loc.id.slice(0, 10)}
                              </span>
                            </div>

                            {/* Prompt box with fixed line-clamp-3 (no layout jump) */}
                            <div className="relative group/copy p-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 mb-3 text-left">
                              <p
                                className="text-xs text-zinc-300 leading-relaxed line-clamp-3"
                                title={loc.environment_dna}
                              >
                                {loc.environment_dna}
                              </p>

                              <button
                                type="button"
                                onClick={() => handleCopyText(loc.environment_dna, loc.id)}
                                className="absolute top-2 right-2 px-2 py-1 rounded bg-zinc-800/90 hover:bg-cyan-500 hover:text-zinc-950 text-zinc-300 text-[10px] font-bold opacity-0 group-hover/copy:opacity-100 transition-all flex items-center gap-1 shadow-md cursor-pointer"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Đã chép!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Chép Prompt</span>
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Lighting and Palette Badges */}
                            <div className="flex flex-wrap gap-1.5 mb-3 text-[10px]">
                              {loc.lighting && (
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-center gap-1">
                                  <SunMedium className="w-3 h-3" />
                                  <span className="truncate max-w-[140px]">{loc.lighting}</span>
                                </span>
                              )}
                              {loc.color_palette && (
                                <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center gap-1">
                                  <Palette className="w-3 h-3" />
                                  <span className="truncate max-w-[140px]">{loc.color_palette}</span>
                                </span>
                              )}
                            </div>

                            {/* Tags */}
                            {loc.tags && loc.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-4">
                                {loc.tags.map((t) => (
                                  <span
                                    key={t}
                                    onClick={() => setSelectedTag(t)}
                                    className="px-1.5 py-0.5 rounded bg-zinc-800/80 hover:bg-cyan-500/20 hover:text-cyan-300 text-[10px] text-zinc-400 font-mono transition-colors cursor-pointer"
                                  >
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Card Action Footer */}
                          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Bạn có chắc chắn muốn xóa bối cảnh "${loc.name}"?`)) {
                                  deleteMutation.mutate(loc.id)
                                }
                              }}
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              title="Xóa khỏi Vault"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="flex items-center gap-2">
                              {assigningShotId && (
                                <button
                                  type="button"
                                  onClick={() => handleAssignToActiveShot(loc.id)}
                                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                                >
                                  <Film className="w-3.5 h-3.5" />
                                  <span>Gán cho Cảnh #{assigningShotId}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleImportLocation(loc)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                  isImported
                                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                                    : 'bg-zinc-800 hover:bg-cyan-500 hover:text-zinc-950 text-zinc-200 border border-zinc-700/60'
                                }`}
                              >
                                {isImported ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Đã nhập vào kịch bản!</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Nhập vào kịch bản</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Viewer */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-[88vh] rounded-2xl overflow-hidden border border-white/20 shadow-2xl">
            <img
              src={lightboxImage}
              alt="Enlarged Location"
              className="w-full h-full object-contain"
            />
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/70 hover:bg-black text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
