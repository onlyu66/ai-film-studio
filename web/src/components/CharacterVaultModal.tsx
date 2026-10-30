import React, { useState, useEffect } from 'react'
import {
  X,
  Users,
  Sparkles,
  Plus,
  Trash2,
  Download,
  Check,
  Search,
  Lock,
  Eye,
  Loader2,
  Volume2,
  Camera,
  RefreshCw,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { VaultCharacterItem, SaveVaultCharacterPayload } from '../types'
import {
  useVaultCharacters,
  useSaveVaultCharacter,
  useDeleteVaultCharacter,
  useImportVaultCharacter,
  useGenerateCharacterAngles,
} from '../api/queries'

interface CharacterVaultModalProps {
  isOpen: boolean
  onClose: () => void
  onCharacterImported?: (char: VaultCharacterItem) => void
  currentProjectId?: string
}

export const CharacterVaultModal: React.FC<CharacterVaultModalProps> = ({
  isOpen,
  onClose,
  onCharacterImported,
  currentProjectId = 'current',
}) => {
  const { data: vaultCharacters = [], isLoading } = useVaultCharacters()
  const saveMutation = useSaveVaultCharacter()
  const deleteMutation = useDeleteVaultCharacter()
  const importMutation = useImportVaultCharacter()
  const generateAnglesMutation = useGenerateCharacterAngles()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [selectedCharForAngles, setSelectedCharForAngles] = useState<VaultCharacterItem | null>(null)
  const [angleResults, setAngleResults] = useState<{
    prompts: { frontal: string; three_quarter: string; profile: string }
    frontal_url?: string
    three_quarter_url?: string
    profile_url?: string
  } | null>(null)
  const [importedCharId, setImportedCharId] = useState<string | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // New character form state
  const [newName, setNewName] = useState('')
  const [newAnchor, setNewAnchor] = useState('')
  const [newVoice, setNewVoice] = useState('vi-VN-NamMinhNeural')
  const [newSeed, setNewSeed] = useState(42)
  const [newTags, setNewTags] = useState('hero, protagonist')

  if (!isOpen) return null

  // Extract all unique tags
  const allTags = Array.from(
    new Set(
      vaultCharacters.flatMap((c) => c.tags || [])
    )
  )

  // Filter characters
  const filtered = vaultCharacters.filter((char) => {
    const matchesSearch =
      char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      char.visual_anchor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (char.tags && char.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())))

    const matchesTag =
      selectedTag === 'all' || (char.tags && char.tags.includes(selectedTag))

    return matchesSearch && matchesTag
  })

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newAnchor.trim()) return

    const payload: SaveVaultCharacterPayload = {
      name: newName.trim(),
      visual_anchor: newAnchor.trim(),
      voice: newVoice,
      seed: Number(newSeed) || 42,
      tags: newTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }

    saveMutation.mutate(payload, {
      onSuccess: () => {
        setIsCreatingNew(false)
        setNewName('')
        setNewAnchor('')
        setNewSeed(Math.floor(Math.random() * 100000))
      },
    })
  }

  const handleImport = (char: VaultCharacterItem) => {
    importMutation.mutate(
      {
        project_id: currentProjectId,
        vault_char_id: char.id,
      },
      {
        onSuccess: () => {
          setImportedCharId(char.id)
          if (onCharacterImported) {
            onCharacterImported(char)
          }
          setTimeout(() => setImportedCharId(null), 2500)
        },
      }
    )
  }

  const handleOpenAngles = (char: VaultCharacterItem) => {
    setSelectedCharForAngles(char)
    setAngleResults(null)
    generateAnglesMutation.mutate(
      {
        visual_anchor: char.visual_anchor,
        seed: char.seed,
        style: 'cinematic',
      },
      {
        onSuccess: (data) => {
          setAngleResults(data)
        },
      }
    )
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md">
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <Users className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-zinc-100">Kho Nhân Vật (Character Vault Pro)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" /> 3-Lock Consistency
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Quản lý kho nhân vật tái sử dụng đa kịch bản với khuôn mặt, trang phục & giọng nói bất biến
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreatingNew ? 'Đóng Form' : 'Tạo Nhân Vật Mới'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Đóng cửa sổ"
              aria-label="Đóng"
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Create New Character Collapsible Form */}
        <AnimatePresence>
          {isCreatingNew && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleCreateSubmit}
              className="border-b border-amber-500/20 bg-amber-500/5 p-5 overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Tên Nhân Vật *</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="VD: Maya Vance"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Giọng Đọc (Voice)</label>
                  <input
                    type="text"
                    value={newVoice}
                    onChange={(e) => setNewVoice(e.target.value)}
                    placeholder="vi-VN-NamMinhNeural hoặc vi-VN-HoaiMyNeural"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Seed Cố Định</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newSeed}
                      onChange={(e) => setNewSeed(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setNewSeed(Math.floor(Math.random() * 999999))}
                      title="Random Seed"
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Tags (Phân loại)</label>
                  <input
                    type="text"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="hero, sci-fi, hacker"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Mô Tả Ngoại Hình Bất Biến (Visual DNA Anchor) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={newAnchor}
                  onChange={(e) => setNewAnchor(e.target.value)}
                  placeholder="VD: Young female cyber specialist, sharp angular jawline, emerald green braided ponytail, matte obsidian combat jacket, subtle glowing neural optic implant."
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Lưu Vào Kho Vault</span>
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Filter bar: Search & Tags */}
        <div className="px-5 py-3 border-b border-zinc-800/80 bg-zinc-900/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <button
              type="button"
              onClick={() => setSelectedTag('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                selectedTag === 'all'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
              }`}
            >
              Tất cả ({vaultCharacters.length})
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer transition-colors ${
                  selectedTag === tag
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc đặc điểm..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Content Body: Character Grid or Angles Preview */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* Multi-angle Preview Section if active */}
          {selectedCharForAngles && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-900 border border-amber-500/30 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-bold text-zinc-100">
                    Mô phỏng 3 Góc Mặt (Multi-Angle Headshot) — {selectedCharForAngles.name}
                  </h4>
                  <span className="text-[10px] font-mono text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Seed: {selectedCharForAngles.seed}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCharForAngles(null)}
                  className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {generateAnglesMutation.isPending ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
                  <span className="text-xs font-mono">Đang tổng hợp Visual DNA cho 3 góc quay...</span>
                </div>
              ) : angleResults ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Frontal */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex flex-col">
                    <span className="text-xs font-bold text-amber-300 mb-1">1. Chính Diện (Frontal)</span>
                    <p className="text-[11px] text-zinc-400 italic line-clamp-3 mb-3">
                      "{angleResults.prompts.frontal}"
                    </p>
                    <div className="w-full aspect-square rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center">
                      <img
                        src={angleResults.frontal_url || selectedCharForAngles.headshot_url || '/api/outputs/characters/alex_headshot.png'}
                        alt="Frontal Angle"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* 3/4 Angle */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex flex-col">
                    <span className="text-xs font-bold text-amber-300 mb-1">2. Góc 3/4 (Three-Quarter)</span>
                    <p className="text-[11px] text-zinc-400 italic line-clamp-3 mb-3">
                      "{angleResults.prompts.three_quarter}"
                    </p>
                    <div className="w-full aspect-square rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center">
                      <img
                        src={angleResults.three_quarter_url || selectedCharForAngles.headshot_url || '/api/outputs/characters/maya_headshot.png'}
                        alt="Three-Quarter Angle"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Profile */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 flex flex-col">
                    <span className="text-xs font-bold text-amber-300 mb-1">3. Nhìn Nghiêng (Profile)</span>
                    <p className="text-[11px] text-zinc-400 italic line-clamp-3 mb-3">
                      "{angleResults.prompts.profile}"
                    </p>
                    <div className="w-full aspect-square rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center">
                      <img
                        src={angleResults.profile_url || selectedCharForAngles.headshot_url || '/api/outputs/characters/tran_headshot.png'}
                        alt="Profile Angle"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Character Grid */}
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-xs font-mono">Đang tải kho nhân vật Vault...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-zinc-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold text-zinc-400">Chưa tìm thấy nhân vật nào phù hợp</p>
              <p className="text-xs mt-1 text-zinc-600">
                Bấm nút "Tạo Nhân Vật Mới" để lưu mẫu nhân vật đầu tiên vào Vault.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((char) => {
                const isImported = importedCharId === char.id

                return (
                  <motion.div
                    key={char.id}
                    whileHover={{ y: -2 }}
                    className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 hover:border-amber-500/30 flex flex-col justify-between transition-all group relative overflow-hidden shadow-lg"
                  >
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/0 via-amber-500/40 to-amber-500/0 opacity-50 group-hover:opacity-100 transition-opacity" />

                    <div>
                      {/* Top Bar: Avatar & Title */}
                      <div className="flex items-start justify-between gap-3 mb-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700/80 overflow-hidden flex items-center justify-center shrink-0">
                            {char.headshot_url ? (
                              <img
                                src={char.headshot_url}
                                alt={char.name}
                                onError={(e) => {
                                  ;(e.target as HTMLElement).style.display = 'none'
                                }}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Camera className="w-6 h-6 text-zinc-500" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-zinc-100 leading-tight">{char.name}</h4>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[10px] font-mono text-amber-400/90 font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                Seed: {char.seed ?? 'Auto'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Bạn có chắc muốn xóa nhân vật "${char.name}" khỏi Vault?`)) {
                              deleteMutation.mutate(char.id)
                            }
                          }}
                          title="Xóa khỏi Vault"
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Tags */}
                      {char.tags && char.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {char.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[9px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-zinc-700/50"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Visual Anchor Box */}
                      <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80 mb-4">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400/90 flex items-center gap-1 mb-1">
                          <Sparkles className="w-2.5 h-2.5" /> Visual DNA Anchor
                        </span>
                        <p className="text-xs text-zinc-300 leading-relaxed font-normal line-clamp-3 group-hover:line-clamp-none transition-all">
                          {char.visual_anchor}
                        </p>
                      </div>

                      {/* Voice & Consistency Pill */}
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-4 px-1 font-mono">
                        <span className="flex items-center gap-1">
                          <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
                          <span className="truncate max-w-[130px]">{char.voice || 'Mặc định'}</span>
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400 font-sans text-[10px]">
                          <Lock className="w-3 h-3" /> Locked Face
                        </span>
                      </div>
                    </div>

                    {/* Actions: Import & View 3 Angles */}
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-800/80">
                      <button
                        type="button"
                        onClick={() => handleOpenAngles(char)}
                        className="py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>3 Góc Mặt</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleImport(char)}
                        disabled={importMutation.isPending}
                        className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isImported
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                            : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/20'
                        }`}
                      >
                        {isImported ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Đã Nhập!</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Nhập Vào Phim</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Mỗi nhân vật được bảo chứng tính nhất quán qua Seed, Visual Anchor và ảnh Headshot tham chiếu.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
