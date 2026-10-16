import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import Navbar from './components/Navbar'
import ProductionForm from './components/ProductionForm'
import ProgressStage from './components/ProgressStage'
import TerminalLogs from './components/TerminalLogs'
import StoryboardView from './components/StoryboardView'
import VideoPlayerModal from './components/VideoPlayerModal'
import { Button } from './components/ui/button'
import { Play, Film, CheckCircle2, Sparkles, MonitorPlay } from 'lucide-react'

export default function App() {
  const [status, setStatus] = useState({
    status: 'idle',
    stage: 0,
    stage_name: 'Sẵn sàng',
    progress: 0,
    logs: [],
    final_video: null,
    final_srt: null,
  })
  const [storyboard, setStoryboard] = useState(null)
  const [isCleaning, setIsCleaning] = useState(false)
  const [showVideoModal, setShowVideoModal] = useState(false)

  // Fetch status polling
  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/status')
      if (res.ok) {
        const data = await res.json()
        // If just transitioned to completed, trigger confetti
        if (data.status === 'completed' && status.status === 'running') {
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.5 }
          })
        }
        setStatus(data)
      }
    } catch (err) {
      // Ignore network hiccup
    }
  }

  // Fetch storyboard
  const fetchStoryboard = async () => {
    try {
      const res = await fetch('/api/storyboard')
      if (res.ok) {
        const data = await res.json()
        setStoryboard(data)
      }
    } catch (err) {
      // Ignore
    }
  }

  useEffect(() => {
    fetchStatus()
    fetchStoryboard()

    const interval = setInterval(() => {
      fetchStatus()
      fetchStoryboard()
    }, status.status === 'running' ? 2000 : 5000)

    return () => clearInterval(interval)
  }, [status.status])

  const handleStartProduction = async (formData) => {
    try {
      const res = await fetch('/api/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(err.detail || 'Không thể bắt đầu sản xuất')
        return
      }
      fetchStatus()
    } catch (err) {
      alert('Lỗi kết nối tới Studio Server')
    }
  }

  const handleClean = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa sạch toàn bộ outputs để tạo phim mới từ đầu?')) return
    setIsCleaning(true)
    try {
      const res = await fetch('/api/clean', { method: 'POST' })
      if (res.ok) {
        fetchStatus()
        setStoryboard(null)
      }
    } catch (err) {
      alert('Lỗi khi xóa outputs')
    } finally {
      setIsCleaning(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#06080F] text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-300">
      <Navbar
        status={status}
        onClean={handleClean}
        isCleaning={isCleaning}
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

        {/* Top Grid: Form & Realtime Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 xl:col-span-5">
            <ProductionForm
              onSubmit={handleStartProduction}
              isRunning={status.status === 'running'}
            />
          </div>

          <div className="lg:col-span-6 xl:col-span-7 space-y-6">
            <ProgressStage
              currentStage={status.stage}
              status={status.status}
              progress={status.progress}
            />

            <TerminalLogs logs={status.logs} />
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
        AI Film Studio &copy; 2026 — Designed with React, Vite, Tailwind CSS, shadcn/ui & FastAPI
      </footer>
    </div>
  )
}
