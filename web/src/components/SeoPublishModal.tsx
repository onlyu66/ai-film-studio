import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Copy,
  Check,
  Download,
  Sparkles,
  Youtube,
  Share2,
  RefreshCw,
  Hash,
  Clock,
  Image as ImageIcon
} from 'lucide-react'
import { useProjectSeo, useGenerateThumbnail } from '../api/queries'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

export interface SeoPublishModalProps {
  projectId: string | null
  isOpen: boolean
  onClose: () => void
}

export default function SeoPublishModal({ projectId, isOpen, onClose }: SeoPublishModalProps) {
  const { data: seoData, isLoading, refetch } = useProjectSeo(projectId)
  const generateThumbMutation = useGenerateThumbnail()

  const [copiedTitleIndex, setCopiedTitleIndex] = useState<number | null>(null)
  const [copiedDesc, setCopiedDesc] = useState(false)
  const [copiedHashtags, setCopiedHashtags] = useState(false)
  const [customHeadline, setCustomHeadline] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !projectId) return null

  const handleCopyTitle = (title: string, index: number) => {
    navigator.clipboard.writeText(title)
    setCopiedTitleIndex(index)
    setTimeout(() => setCopiedTitleIndex(null), 2000)
  }

  const handleCopyDesc = () => {
    if (!seoData?.description) return
    navigator.clipboard.writeText(seoData.description)
    setCopiedDesc(true)
    setTimeout(() => setCopiedDesc(false), 2000)
  }

  const handleCopyHashtags = () => {
    if (!seoData?.hashtags) return
    navigator.clipboard.writeText(seoData.hashtags)
    setCopiedHashtags(true)
    setTimeout(() => setCopiedHashtags(false), 2000)
  }

  const handleRegenerateThumb = () => {
    if (!projectId) return
    generateThumbMutation.mutate(
      {
        projectId,
        headline: customHeadline.trim() || undefined,
      },
      {
        onSuccess: () => {
          refetch()
        },
      }
    )
  }

  return (
    <AnimatePresence>
      <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm cursor-pointer">
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-cinema-deck border border-cinema-border rounded-2xl shadow-2xl overflow-hidden cursor-default"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-cinema-border bg-cinema-card flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cinema-deck border border-cinema-border flex items-center justify-center text-cinema-amber font-bold">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-zinc-100">
                    Trung tâm Xuất bản & Tối ưu SEO
                  </h3>
                  <Badge variant="secondary" className="text-[10px] font-mono bg-cinema-deck border-cinema-border text-cinema-amber">
                    YouTube / TikTok 4K
                  </Badge>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">
                  {seoData?.title || 'Tự động tạo tiêu đề giật tít, dấu mốc phân đoạn và ảnh bìa Thumbnail'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
            {isLoading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-zinc-400">
                <RefreshCw className="w-7 h-7 animate-spin text-cinema-amber" />
                <span className="text-xs font-medium">Đang tổng hợp dữ liệu SEO & Chapters...</span>
              </div>
            ) : !seoData ? (
              <div className="py-16 text-center text-zinc-500 text-xs">
                Không thể tải thông tin SEO cho dự án này.
              </div>
            ) : (
              <>
                {/* 1. Thumbnail Generator Section */}
                <div className="p-4 rounded-xl bg-cinema-card border border-cinema-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-cinema-amber" />
                      <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
                        Ảnh Bìa Thumbnail Điện Ảnh (FFmpeg Render)
                      </h4>
                    </div>
                    {seoData.thumbnail_url && (
                      <a
                        href={seoData.thumbnail_url}
                        download={`thumbnail_${projectId}.jpg`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-cinema-amber hover:bg-amber-400 text-zinc-950 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải Ảnh Bìa</span>
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-cinema-canvas border border-cinema-border flex items-center justify-center group">
                      {seoData.thumbnail_url ? (
                        <img
                          src={seoData.thumbnail_url}
                          alt="Thumbnail preview"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="text-zinc-500 text-xs flex flex-col items-center gap-1">
                          <ImageIcon className="w-6 h-6 opacity-40" />
                          <span>Chưa có ảnh thumbnail</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-semibold text-zinc-300 block uppercase tracking-wider">
                        Tùy chỉnh dòng chữ giật tít trên Thumbnail:
                      </label>
                      <input
                        type="text"
                        value={customHeadline}
                        onChange={(e) => setCustomHeadline(e.target.value)}
                        placeholder={seoData.title.toUpperCase()}
                        className="w-full px-3 py-2 rounded-lg bg-cinema-canvas border border-cinema-border text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cinema-amber font-mono font-bold uppercase tracking-wide"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleRegenerateThumb}
                        disabled={generateThumbMutation.isPending}
                        className="w-full gap-2 text-xs font-medium border-cinema-border hover:bg-zinc-800 text-zinc-200 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${generateThumbMutation.isPending ? 'animate-spin' : ''}`} />
                        <span>{generateThumbMutation.isPending ? 'Đang render bằng FFmpeg...' : 'Render Lại Thumbnail'}</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 2. CTR Title Suggestions */}
                <div className="p-4 rounded-xl bg-cinema-card border border-cinema-border space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cinema-amber" />
                    <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
                      Gợi Ý Tiêu Đề Đột Phá Lượt Xem (CTR Boost Hooks)
                    </h4>
                  </div>

                  <div className="space-y-2">
                    {seoData.titles.map((title, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-cinema-deck border border-cinema-border hover:border-cinema-border-hover flex items-center justify-between gap-3 text-xs text-zinc-200 group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded bg-zinc-800 text-zinc-400 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-zinc-100 truncate">{title}</span>
                        </div>
                        <button
                          onClick={() => handleCopyTitle(title, idx)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-studio-input hover:bg-studio-card text-zinc-300 hover:text-white flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer border border-studio-border"
                        >
                          {copiedTitleIndex === idx ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Đã sao chép</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Sao chép</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. YouTube Description & Auto Timestamps */}
                <div className="p-4 rounded-xl bg-cinema-card border border-cinema-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Youtube className="w-4 h-4 text-red-500" />
                      <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
                        Mô Tả YouTube & Dấu Mốc Phân Đoạn (Chapters)
                      </h4>
                    </div>

                    <button
                      onClick={handleCopyDesc}
                      className="px-3 py-1 rounded-md text-xs font-medium bg-studio-input hover:bg-studio-card text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer border border-studio-border"
                    >
                      {copiedDesc ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Đã sao chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép toàn bộ</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <textarea
                        readOnly
                        rows={8}
                        value={seoData.description}
                        className="w-full p-3 rounded-lg bg-cinema-canvas border border-cinema-border text-xs font-mono text-zinc-300 focus:outline-none resize-none leading-relaxed select-all"
                      />
                    </div>
                    <div className="p-3 rounded-lg bg-cinema-canvas border border-cinema-border space-y-2 overflow-y-auto max-h-[170px]">
                      <span className="text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cinema-amber" />
                        <span>Phân đoạn:</span>
                      </span>
                      {seoData.chapters.map((ch, idx) => (
                        <div key={idx} className="text-[11px] font-mono flex items-start gap-1.5 text-zinc-300">
                          <span className="text-cinema-amber font-semibold">{ch.timestamp}</span>
                          <span className="text-zinc-400 truncate">{ch.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Hashtags for TikTok & Shorts */}
                <div className="p-4 rounded-xl bg-cinema-card border border-cinema-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-xs font-bold text-zinc-100 uppercase tracking-wider font-mono">
                        Hashtags Thịnh Hành (TikTok / Reels / Shorts)
                      </h4>
                    </div>

                    <button
                      onClick={handleCopyHashtags}
                      className="px-3 py-1 rounded-md text-xs font-medium bg-studio-input hover:bg-studio-card text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer border border-studio-border"
                    >
                      {copiedHashtags ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Đã sao chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-cinema-canvas border border-cinema-border text-xs font-mono text-cyan-300 font-medium select-all">
                    {seoData.hashtags}
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {seoData.tags.map((t, idx) => (
                      <Badge key={idx} variant="secondary" className="text-[10px] font-mono bg-cinema-deck border-cinema-border text-zinc-400">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
