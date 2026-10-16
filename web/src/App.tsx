import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import Navbar from './components/Navbar'
import ProductionForm from './components/ProductionForm'
import ProgressStage from './components/ProgressStage'
import TerminalLogs from './components/TerminalLogs'
import StoryboardView from './components/StoryboardView'
import VideoPlayerModal from './components/VideoPlayerModal'
import { Button } from './components/ui/button'
import { CheckCircle2, MonitorPlay } from 'lucide-react'
import { useStudioStatus, useStoryboard, useProduceMovie, useCleanOutputs } from './api/queries'
import type { StudioStatus, ProductionFormData } from './types'

export default function App() {
  const [showVideoModal, setShowVideoModal] = useState<boolean>(false)

  // TanStack Query hooks for real-time status & storyboard
  const { data: statusData } = useStudioStatus()
  const isRunning = statusData?.status === 'running'
  const { data: storyboardData } = useStoryboard(isRunning)
  const produceMutation = useProduceMovie()
  const cleanMutation = useCleanOutputs()

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

  const handleClean = () => {
    if (!window.confirm('Bạn có chắc muốn xóa sạch toàn bộ outputs để tạo phim mới từ đầu?')) return
    cleanMutation.mutate(undefined, {
      onError: (err) => {
        alert(err.message || 'Lỗi khi xóa outputs')
      },
    })
  }

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-300">
      <Navbar
        status={status}
        onClean={handleClean}
        isCleaning={cleanMutation.isPending}
        onWatchMovie={() => setShowVideoModal(true)}
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

              <Button
                variant="default"
                size="lg"
                onClick={() => setShowVideoModal(true)}
                className="gap-2.5 font-black text-sm bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 shadow-lg shadow-emerald-500/30"
              >
                <MonitorPlay className="w-5 h-5 fill-current" />
                <span>Xem Phim Ngay</span>
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
            />
          </div>

          <div className="lg:col-span-5 flex flex-col">
            <TerminalLogs logs={status.logs} className="h-full" />
          </div>
        </div>

        {/* Bottom Section: Storyboard Gallery */}
        <StoryboardView storyboard={storyboard} />
      </main>

      {/* Video Modal Player */}
      {showVideoModal && status.final_video && (
        <VideoPlayerModal
          videoUrl={status.final_video}
          srtUrl={status.final_srt}
          onClose={() => setShowVideoModal(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900/90 py-6 text-center text-xs text-slate-600 font-medium">
        AI Film Studio &copy; 2026 — Built with React, TypeScript, TanStack Query, Axios, Vite & Tailwind CSS
      </footer>
    </div>
  )
}
