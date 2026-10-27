import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, X, Trash2, Download, Play, Calendar, Clock, MonitorPlay, Loader2, Share2, Clapperboard, Globe } from 'lucide-react'
import { useProjects, useDeleteProject, useDubProject } from '../api/queries'
import type { ProjectItem } from '../types'

export interface ProjectLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  onPlayMovie: (videoUrl: string, srtUrl?: string | null) => void
  onOpenSeo?: (projectId: string) => void
  onProduceNextEpisode?: (project: ProjectItem) => void
}

const DUB_LANG_OPTIONS = [
  { value: 'en', label: 'English (US)', code: 'EN' },
  { value: 'vi', label: 'Tiếng Việt', code: 'VI' },
  { value: 'ja', label: 'Japanese (日本語)', code: 'JA' },
  { value: 'fr', label: 'French (Français)', code: 'FR' },
  { value: 'es', label: 'Spanish (Español)', code: 'ES' },
]

export default function ProjectLibraryModal({
  isOpen,
  onClose,
  onPlayMovie,
  onOpenSeo,
  onProduceNextEpisode,
}: ProjectLibraryModalProps) {
  const { data: projects = [], isLoading } = useProjects()
  const deleteProjectMutation = useDeleteProject()
  const dubMutation = useDubProject()

  const [dubbingProject, setDubbingProject] = useState<ProjectItem | null>(null)
  const [dubTargetLang, setDubTargetLang] = useState('en')
  const [dubHardsub, setDubHardsub] = useState(false)

  const handleStartDub = () => {
    if (!dubbingProject) return
    dubMutation.mutate(
      {
        projectId: dubbingProject.id,
        targetLang: dubTargetLang,
        hardsub: dubHardsub,
      },
      {
        onSuccess: (data) => {
          alert(`Đã lồng tiếng thành công sang ${dubTargetLang.toUpperCase()}! Bạn có thể xem ngay phiên bản mới.`)
          setDubbingProject(null)
          onPlayMovie(data.video_url, data.srt_url)
        },
        onError: (err: any) => {
          alert(`Lỗi lồng tiếng: ${err?.message || 'Không thể lồng tiếng'}`)
        },
      }
    )
  }

  const handleDelete = (p: ProjectItem) => {
    if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn bộ phim "${p.title}" khỏi thư viện?`)) return
    deleteProjectMutation.mutate(p.id, {
      onError: (err: any) => alert(err.message || 'Lỗi khi xóa dự án'),
    })
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm cursor-pointer"
      >
        <motion.div
          initial={{ scale: 0.98, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-5xl max-h-[90vh] rounded-2xl bg-cinema-deck border border-cinema-border p-6 shadow-2xl flex flex-col text-left cursor-default overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-cinema-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cinema-card border border-cinema-border flex items-center justify-center text-cinema-amber font-bold">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <span>Thư Viện Phim Đã Sản Xuất</span>
                  <span className="text-xs px-2 py-0.5 rounded font-mono bg-cinema-card border border-cinema-border text-zinc-400">
                    {projects.length} phim
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Kho lưu trữ tất cả các bộ phim bạn đã tạo hoàn tất cùng phụ đề và phân cảnh
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto py-5 pr-1">
            {isLoading ? (
              <div className="py-20 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-cinema-amber" />
                <span className="text-xs font-medium">Đang tải thư viện phim...</span>
              </div>
            ) : projects.length === 0 ? (
              <div className="py-24 text-center">
                <div className="w-14 h-14 rounded-xl bg-cinema-card border border-cinema-border flex items-center justify-center mx-auto mb-3 text-zinc-500">
                  <Film className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-zinc-300">Thư viện hiện đang trống</h4>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Các bộ phim khi sản xuất hoàn thành sẽ tự động được lưu trữ vĩnh viễn tại đây.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((p) => {
                  const dateStr = new Date(p.created_at * 1000).toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })

                  return (
                    <motion.div
                      key={p.id}
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.15 }}
                      className="group rounded-xl bg-cinema-card border border-cinema-border overflow-hidden hover:border-cinema-border-hover transition-all flex flex-col justify-between"
                    >
                      {/* Thumbnail */}
                      <div
                        onClick={() => p.video_url && onPlayMovie(p.video_url, p.srt_url)}
                        className="relative aspect-video bg-cinema-canvas flex items-center justify-center overflow-hidden cursor-pointer"
                      >
                        {p.thumb_url ? (
                          <img
                            src={p.thumb_url}
                            alt={p.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-zinc-600">
                            <MonitorPlay className="w-8 h-8" />
                            <span className="text-[10px] font-mono">NO PREVIEW</span>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono text-zinc-300 font-bold border border-studio-border uppercase">
                          {p.style}
                        </div>

                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 text-[10px] font-mono font-bold uppercase border border-studio-border">
                          {p.aspect_ratio || '16:9'}
                        </div>

                        {p.episode && p.episode > 1 && (
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-cinema-amber text-zinc-950 text-[10px] font-mono font-bold uppercase">
                            TẬP {p.episode}
                          </div>
                        )}

                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[1px]">
                          <div className="w-10 h-10 rounded-full bg-cinema-amber text-zinc-950 flex items-center justify-center shadow-lg">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            {p.series_title && (
                              <span className="text-[10px] font-mono font-semibold text-cinema-amber uppercase tracking-wider">
                                [{p.series_title}]
                              </span>
                            )}
                            <h4 className="text-sm font-bold text-zinc-100 line-clamp-1">
                              {p.title || p.topic}
                            </h4>
                          </div>
                          <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed font-normal">
                            {p.topic}
                          </p>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-cinema-border space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-zinc-500" />
                              {dateStr}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-zinc-500" />
                              {p.duration}m ({p.shots_count} shots)
                            </span>
                          </div>

                          {/* Dubbed Versions & Actions */}
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            <span className="text-[9px] font-mono text-zinc-500 mr-1">Bản phát hành:</span>
                            <button
                              type="button"
                              onClick={() => p.video_url && onPlayMovie(p.video_url, p.srt_url)}
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer border border-zinc-700"
                              title="Bản gốc"
                            >
                              Gốc ({p.lang.toUpperCase()})
                            </button>
                            {p.dubbed_versions &&
                              Object.entries(p.dubbed_versions).map(([langKey, dub]) => (
                                <button
                                  key={langKey}
                                  type="button"
                                  onClick={() => dub.video_url && onPlayMovie(dub.video_url, dub.srt_url)}
                                  className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 cursor-pointer flex items-center gap-1"
                                  title={`Xem bản lồng tiếng ${langKey.toUpperCase()}`}
                                >
                                  <Globe className="w-2.5 h-2.5" />
                                  <span>{langKey.toUpperCase()}</span>
                                </button>
                              ))}
                          </div>

                          <div className="flex items-center gap-1.5 pt-1">
                            {p.video_url && (
                              <button
                                type="button"
                                onClick={() => onPlayMovie(p.video_url!, p.srt_url)}
                                className="flex-1 py-1.5 rounded-lg bg-cinema-amber hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Xem</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setDubbingProject(p)}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
                              title="Lồng tiếng đa quốc gia 1-Click (Auto-Dub)"
                            >
                              <Globe className="w-3.5 h-3.5" />
                            </button>

                            {onOpenSeo && (
                              <button
                                type="button"
                                onClick={() => onOpenSeo(p.id)}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
                                title="Mở trung tâm xuất bản & tối ưu SEO"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {onProduceNextEpisode && (
                              <button
                                type="button"
                                onClick={() => onProduceNextEpisode(p)}
                                className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                                title="Sản xuất Tập tiếp theo của bộ phim này"
                              >
                                <Clapperboard className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {p.video_url && (
                              <a
                                href={p.video_url}
                                download
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
                                title="Tải file video MP4"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDelete(p)}
                              disabled={deleteProjectMutation.isPending}
                              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 border border-zinc-700 transition-colors cursor-pointer"
                              title="Xóa bộ phim khỏi thư viện"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </motion.div>

        {/* Auto-Dubbing Dialog Modal */}
        {dubbingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md bg-cinema-deck border border-cinema-border rounded-xl p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-cinema-border">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-bold text-zinc-100">Lồng Tiếng Đa Quốc Gia</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setDubbingProject(null)}
                  className="p-1 rounded text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-zinc-400">
                Tự động dịch kịch bản và lồng tiếng bản địa cho phim <strong className="text-zinc-200">"{dubbingProject.title}"</strong> mà không cần re-render hình ảnh.
              </p>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-2">Chọn ngôn ngữ đích:</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {DUB_LANG_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDubTargetLang(opt.value)}
                      className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                        dubTargetLang === opt.value
                          ? 'bg-amber-500/10 border-cinema-amber text-amber-300 font-bold'
                          : 'bg-cinema-card border-cinema-border text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className="font-mono text-[10px] text-zinc-500">{opt.code}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div
                onClick={() => setDubHardsub(!dubHardsub)}
                className="p-2.5 rounded-lg bg-cinema-card border border-cinema-border flex items-center justify-between cursor-pointer"
              >
                <span className="text-xs text-zinc-300">In phụ đề Hardsub ngôn ngữ mới</span>
                <input
                  type="checkbox"
                  checked={dubHardsub}
                  onChange={(e) => setDubHardsub(e.target.checked)}
                  className="w-4 h-4 rounded text-cinema-amber bg-cinema-canvas border-cinema-border cursor-pointer"
                />
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setDubbingProject(null)}
                  disabled={dubMutation.isPending}
                  className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs cursor-pointer border border-zinc-700"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleStartDub}
                  disabled={dubMutation.isPending}
                  className="flex-1 py-2 rounded-lg bg-cinema-amber hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  {dubMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lồng tiếng...</span>
                    </>
                  ) : (
                    <span>Bắt Đầu Lồng Tiếng</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
