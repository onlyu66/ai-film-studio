import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useQueryClient } from '@tanstack/react-query'
import Navbar from './components/Navbar'
import ProductionForm from './components/ProductionForm'
import ProgressStage from './components/ProgressStage'
import TerminalLogs from './components/TerminalLogs'
import StoryboardView from './components/StoryboardView'
import VideoPlayerModal from './components/VideoPlayerModal'
import ProjectLibraryModal from './components/ProjectLibraryModal'
import SeoPublishModal from './components/SeoPublishModal'
import { Button } from './components/ui/button'
import { CheckCircle2, MonitorPlay, FileEdit, Play, Loader2, Share2 } from 'lucide-react'
import {
  useStudioStatus,
  useStoryboard,
  useProduceMovie,
  useCleanOutputs,
  useContinueProduction,
  useProjects,
} from './api/queries'
import type { StudioStatus, ProductionFormData, ProjectItem } from './types'

export default function App() {
  const queryClient = useQueryClient()
  const [showVideoModal, setShowVideoModal] = useState<boolean>(false)
  const [showLibraryModal, setShowLibraryModal] = useState<boolean>(false)
  const [showSeoModal, setShowSeoModal] = useState<boolean>(false)
  const [activeSeoProjectId, setActiveSeoProjectId] = useState<string | null>(null)
  const [seriesInitialData, setSeriesInitialData] = useState<Partial<ProductionFormData> | null>(null)
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null)
  const [activeSrtUrl, setActiveSrtUrl] = useState<string | null>(null)
  const [liveLogs, setLiveLogs] = useState<string[]>([])

  // TanStack Query hooks for real-time status & storyboard
  const { data: statusData } = useStudioStatus()
  const { data: projects = [] } = useProjects()
  const isRunning = statusData?.status === 'running'
  const { data: storyboardData } = useStoryboard(isRunning)
  const produceMutation = useProduceMovie()
  const cleanMutation = useCleanOutputs()
  const continueMutation = useContinueProduction()

  // WebSocket Live Log & Status Streaming
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/pipeline`
    let socket: WebSocket | null = null
    let pingInterval: ReturnType<typeof setInterval> | null = null

    const connectWs = () => {
      try {
        socket = new WebSocket(wsUrl)
        socket.onopen = () => {
          pingInterval = setInterval(() => {
            if (socket?.readyState === WebSocket.OPEN) {
              socket.send('ping')
            }
          }, 25000)
        }
        socket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data)
            if (payload.type === 'status') {
              queryClient.setQueryData(['studio', 'status'], payload.data)
              if (payload.data?.logs) {
                setLiveLogs(payload.data.logs)
              }
            } else if (payload.type === 'log') {
              setLiveLogs((prev) => {
                const next = [...prev, payload.data]
                return next.length > 200 ? next.slice(-200) : next
              })
            }
          } catch {
            // Ignore parse errors
          }
        }
        socket.onclose = () => {
          if (pingInterval) clearInterval(pingInterval)
          setTimeout(connectWs, 5000)
        }
        socket.onerror = () => {
          socket?.close()
        }
      } catch {
        // Fallback polling is already active
      }
    }
    connectWs()

    return () => {
      if (pingInterval) clearInterval(pingInterval)
      socket?.close()
    }
  }, [queryClient])

  const status: StudioStatus = statusData ?? {
    status: 'idle',
    stage: 0,
    stage_name: 'Sẵn sàng',
    progress: 0,
    logs: [],
    final_video: null,
    final_srt: null,
  }
  const storyboard = storyboardData ?? null
  const displayLogs = liveLogs.length > 0 ? liveLogs : status.logs

  // Trigger celebration confetti when project transitions from running to completed
  const prevStatusRef = useRef(status.status)
  useEffect(() => {
    if (status.status === 'completed' && prevStatusRef.current === 'running') {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 }
      })
    }
    prevStatusRef.current = status.status
  }, [status.status])

  const handleStartProduction = (formData: ProductionFormData) => {
    produceMutation.mutate(formData, {
      onError: (err) => {
        alert(err.message || 'Không thể bắt đầu sản xuất')
      },
    })
  }

  const handleContinue = () => {
    continueMutation.mutate(undefined, {
      onError: (err) => {
        alert(err.message || 'Không thể tiếp tục sản xuất')
      },
    })
  }

  const handleClean = () => {
    if (!window.confirm('Bạn có chắc muốn xóa sạch toàn bộ outputs để tạo phim mới từ đầu?')) return
    cleanMutation.mutate(undefined, {
      onError: (err) => {
        alert(err.message || 'Lỗi khi xóa outputs')
      },
    })
  }

  const handlePlayCurrentMovie = () => {
    if (status.final_video) {
      setActiveVideoUrl(status.final_video)
      setActiveSrtUrl(status.final_srt)
      setShowVideoModal(true)
    }
  }

  const handlePlayFromLibrary = (videoUrl: string, srtUrl?: string | null) => {
    setActiveVideoUrl(videoUrl)
    setActiveSrtUrl(srtUrl || null)
    setShowLibraryModal(false)
    setShowVideoModal(true)
  }

  const handleProduceNextEpisode = (project: ProjectItem) => {
    setShowLibraryModal(false)
    const nextEp = (project.episode || 1) + 1
    setSeriesInitialData({
      topic: `[Tập ${nextEp}] Tiếp nối cốt truyện: ${project.title}`,
      series_title: project.series_title || project.title,
      episode: nextEp,
      parent_project_id: project.id,
      lang: project.lang,
      style: project.style,
      aspect_ratio: project.aspect_ratio || '16:9',
      duration: project.duration || 5,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleOpenCurrentMovieSeo = () => {
    const targetId = projects.length > 0 ? projects[0].id : null
    if (targetId) {
      setActiveSeoProjectId(targetId)
      setShowSeoModal(true)
    } else {
      setShowLibraryModal(true)
    }
  }

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-300">
      <Navbar
        status={status}
        onClean={handleClean}
        isCleaning={cleanMutation.isPending}
        onWatchMovie={handlePlayCurrentMovie}
        onOpenLibrary={() => setShowLibraryModal(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Banner when movie completed */}
        <AnimatePresence>
          {status.status === 'completed' && status.final_video && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-950/90 via-[#0B1322] to-indigo-950/90 border border-emerald-500/50 shadow-2xl shadow-emerald-500/10 flex flex-col sm:flex-row items-center justify-between gap-5 relative overflow-hidden"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Master Production Finished</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300">100% COMPLETE</span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-0.5">Bộ phim của bạn đã sẵn sàng trình chiếu!</h3>
                  <p className="text-xs text-slate-300 mt-1">Đã hoàn tất quy trình 5 giai đoạn: Kịch bản, Audio, Hình ảnh Flux, Chuyển động & Hậu kỳ.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleOpenCurrentMovieSeo}
                  className="gap-2 font-bold text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Xuất Bản & SEO</span>
                </Button>

                <Button
                  variant="default"
                  size="lg"
                  onClick={handlePlayCurrentMovie}
                  className="gap-2.5 font-black text-sm bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 shadow-lg shadow-emerald-500/30 cursor-pointer"
                >
                  <MonitorPlay className="w-5 h-5 fill-current" />
                  <span>Xem Phim Ngay</span>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Banner when script is ready for review */}
        <AnimatePresence>
          {status.status === 'script_ready' && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-amber-950/90 via-[#181206] to-amber-950/90 border border-amber-500/50 shadow-2xl shadow-amber-500/10 flex flex-col sm:flex-row items-center justify-between gap-5 relative overflow-hidden"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
                  <FileEdit className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Review & Edit Screenplay Mode</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300">STAGE 1 HOÀN TẤT</span>
                  </div>
                  <h3 className="text-lg font-black text-white mt-0.5">Kịch bản & Phân cảnh đã sẵn sàng để bạn duyệt!</h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Hãy kiểm tra và chỉnh sửa lời thoại, visual prompt, góc máy hoặc đổi giọng nhân vật ở bảng phân cảnh bên dưới. Khi đã ưng ý, bấm nút tiếp tục để bắt đầu quay phim.
                  </p>
                </div>
              </div>

              <Button
                variant="default"
                size="lg"
                onClick={handleContinue}
                disabled={continueMutation.isPending}
                className="gap-2.5 font-black text-sm bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 shadow-lg shadow-amber-500/30 shrink-0 cursor-pointer"
              >
                {continueMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Đang kích hoạt...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>TIẾP TỤC SẢN XUẤT (STAGES 2 - 5)</span>
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top: Full-width Cinema Pipeline Progress */}
        <ProgressStage
          currentStage={status.stage}
          status={status.status}
          progress={status.progress}
        />

        {/* Middle: Balanced Production Studio Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative z-20">
          <div className="lg:col-span-7 flex flex-col">
            <ProductionForm
              onSubmit={handleStartProduction}
              isRunning={status.status === 'running' || produceMutation.isPending}
              initialData={seriesInitialData}
              onResetSeries={() => setSeriesInitialData(null)}
            />
          </div>

          <div className="lg:col-span-5 flex flex-col">
            <TerminalLogs logs={displayLogs} className="h-full" />
          </div>
        </div>

        {/* Bottom Section: Storyboard Gallery */}
        <StoryboardView storyboard={storyboard} />
      </main>

      {/* Video Modal Player */}
      {showVideoModal && activeVideoUrl && (
        <VideoPlayerModal
          videoUrl={activeVideoUrl}
          srtUrl={activeSrtUrl}
          onClose={() => {
            setShowVideoModal(false)
            setActiveVideoUrl(null)
            setActiveSrtUrl(null)
          }}
        />
      )}

      {/* Project Library Modal */}
      <ProjectLibraryModal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        onPlayMovie={handlePlayFromLibrary}
        onOpenSeo={(projId) => {
          setActiveSeoProjectId(projId)
          setShowSeoModal(true)
        }}
        onProduceNextEpisode={handleProduceNextEpisode}
      />

      {/* SEO Publishing & Thumbnail Hub Modal */}
      <SeoPublishModal
        projectId={activeSeoProjectId}
        isOpen={showSeoModal}
        onClose={() => {
          setShowSeoModal(false)
          setActiveSeoProjectId(null)
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900/90 py-6 text-center text-xs text-slate-600 font-medium">
        AI Film Studio &copy; 2026 — Built with React, TypeScript, TanStack Query, Axios, Vite & Tailwind CSS
      </footer>
    </div>
  )
}
