import { motion, AnimatePresence } from 'framer-motion'
import { Film, X, Trash2, Download, Play, Calendar, Clock, MonitorPlay, Loader2 } from 'lucide-react'
import { useProjects, useDeleteProject } from '../api/queries'
import type { ProjectItem } from '../types'

export interface ProjectLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  onPlayMovie: (videoUrl: string, srtUrl?: string | null) => void
}

export default function ProjectLibraryModal({ isOpen, onClose, onPlayMovie }: ProjectLibraryModalProps) {
  const { data: projects = [], isLoading } = useProjects()
  const deleteProjectMutation = useDeleteProject()

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
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-5xl max-h-[90vh] rounded-3xl bg-gradient-to-b from-[#0F1628] to-[#0A0E1A] border border-slate-800 p-6 shadow-2xl flex flex-col text-left cursor-default overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-5 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 font-bold">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>Thư Viện Phim Đã Sản Xuất</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                    {projects.length} phim
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kho lưu trữ tất cả các bộ phim bạn đã tạo hoàn tất cùng phụ đề và phân cảnh
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto py-5 pr-1">
            {isLoading ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                <span className="text-xs font-semibold">Đang tải thư viện phim...</span>
              </div>
            ) : projects.length === 0 ? (
              <div className="py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-600 shadow-inner">
                  <Film className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-slate-300">Thư viện hiện đang trống</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
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
                      whileHover={{ y: -3 }}
                      className="group rounded-2xl bg-[#090D18] border border-slate-800/80 overflow-hidden hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all flex flex-col justify-between"
                    >
                      {/* Thumbnail */}
                      <div
                        onClick={() => p.video_url && onPlayMovie(p.video_url, p.srt_url)}
                        className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer"
                      >
                        {p.thumb_url ? (
                          <img
                            src={p.thumb_url}
                            alt={p.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-slate-600">
                            <MonitorPlay className="w-8 h-8" />
                            <span className="text-[10px] font-mono">NO PREVIEW</span>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-mono text-indigo-300 font-extrabold border border-white/10 uppercase">
                          {p.style}
                        </div>

                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-indigo-500 text-white text-[10px] font-mono font-bold uppercase shadow">
                          {p.aspect_ratio || '16:9'}
                        </div>

                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                          <div className="w-12 h-12 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/40">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-sm font-black text-white line-clamp-1 mb-1">
                            {p.title || p.topic}
                          </h4>
                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {p.topic}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {dateStr}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {p.duration}m ({p.shots_count} shots)
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1">
                            {p.video_url && (
                              <button
                                type="button"
                                onClick={() => onPlayMovie(p.video_url!, p.srt_url)}
                                className="flex-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Xem</span>
                              </button>
                            )}

                            {p.video_url && (
                              <a
                                href={p.video_url}
                                download
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                                title="Tải file video MP4"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDelete(p)}
                              disabled={deleteProjectMutation.isPending}
                              className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500 hover:text-white text-slate-400 transition-colors cursor-pointer"
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
      </motion.div>
    </AnimatePresence>
  )
}
