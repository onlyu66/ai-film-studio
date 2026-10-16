import React, { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import ProductionForm from './components/ProductionForm'
import ProgressStage from './components/ProgressStage'
import TerminalLogs from './components/TerminalLogs'
import StoryboardView from './components/StoryboardView'
import VideoPlayerModal from './components/VideoPlayerModal'
import { Play, Film, CheckCircle2 } from 'lucide-react'

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
    <div className="min-h-screen bg-[#080B11] text-slate-100 flex flex-col">
      <Navbar status={status} onClean={handleClean} isCleaning={isCleaning} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Banner when movie completed */}
        {status.status === 'completed' && status.final_video && (
          <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-indigo-950/80 border border-emerald-500/40 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Bộ phim của bạn đã sẵn sàng!</h3>
                <p className="text-xs text-slate-300">Hoàn tất quy trình 5 giai đoạn: Kịch bản, Audio, Hình ảnh, Chuyển động & Hậu kỳ.</p>
              </div>
            </div>

            <button
              onClick={() => setShowVideoModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Xem Phim Ngay</span>
            </button>
          </div>
        )}

        {/* Top Grid: Form & Realtime Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 xl:col-span-5">
            <ProductionForm
              onSubmit={handleStartProduction}
              isRunning={status.status === 'running'}
            />
          </div>

          <div className="lg:col-span-6 xl:col-span-7 space-y-6 flex flex-col justify-between">
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
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        AI Film Studio &copy; 2026 — Thiết kế với React, Vite, Tailwind CSS & FastAPI
      </footer>
    </div>
  )
}
