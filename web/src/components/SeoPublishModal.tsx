import { useState } from 'react'
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0A0E1A] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-800/80 bg-gradient-to-r from-indigo-950/40 via-[#0D1322] to-amber-950/30 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Trung tâm Xuất bản & Tối ưu SEO
                  </h3>
                  <Badge variant="default" className="text-[10px] bg-rose-500/20 text-rose-300 border-rose-500/30">
                    YouTube / TikTok 4K
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                  {seoData?.title || 'Tự động tạo tiêu đề giật tít, dấu mốc phân đoạn và ảnh bìa Thumbnail'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {isLoading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
                <span className="text-sm font-semibold">Đang tổng hợp dữ liệu SEO & Chapters...</span>
              </div>
            ) : !seoData ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                Không thể tải thông tin SEO cho dự án này.
              </div>
            ) : (
              <>
                {/* 1. Thumbnail Generator Section */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#070A12] border border-slate-800/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                        Ảnh Bìa Thumbnail Điện Ảnh (FFmpeg Render)
                      </h4>
                    </div>
                    {seoData.thumbnail_url && (
                      <a
                        href={seoData.thumbnail_url}
                        download={`thumbnail_${projectId}.jpg`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải Ảnh Bìa</span>
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-black/60 border border-slate-800 flex items-center justify-center group">
                      {seoData.thumbnail_url ? (
                        <img
                          src={seoData.thumbnail_url}
                          alt="Thumbnail preview"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="text-slate-500 text-xs flex flex-col items-center gap-1">
                          <ImageIcon className="w-6 h-6 opacity-40" />
                          <span>Chưa có ảnh thumbnail</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-bold text-slate-400 block uppercase">
                        Tùy chỉnh dòng chữ giật tít trên Thumbnail:
                      </label>
                      <input
                        type="text"
                        value={customHeadline}
                        onChange={(e) => setCustomHeadline(e.target.value)}
                        placeholder={seoData.title.toUpperCase()}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-bold uppercase tracking-wide"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleRegenerateThumb}
                        disabled={generateThumbMutation.isPending}
                        className="w-full gap-2 text-xs font-bold border-amber-500/30 hover:bg-amber-500/10 text-amber-300 cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${generateThumbMutation.isPending ? 'animate-spin' : ''}`} />
                        <span>{generateThumbMutation.isPending ? 'Đang render bằng FFmpeg...' : 'Render Lại Thumbnail'}</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 2. CTR Title Suggestions */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#070A12] border border-slate-800/80 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-rose-400" />
                    <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                      Gợi Ý Tiêu Đề Đột Phá Lượt Xem (CTR Boost Hooks)
                    </h4>
                  </div>

                  <div className="space-y-2">
                    {seoData.titles.map((title, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 text-xs text-slate-200 group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-100 truncate">{title}</span>
                        </div>
                        <button
                          onClick={() => handleCopyTitle(title, idx)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
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
                <div className="p-4 sm:p-5 rounded-2xl bg-[#070A12] border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Youtube className="w-4 h-4 text-red-500" />
                      <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                        Mô Tả YouTube & Dấu Mốc Phân Đoạn (Chapters)
                      </h4>
                    </div>

                    <button
                      onClick={handleCopyDesc}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedDesc ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Đã sao chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép toàn bộ mô tả</span>
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
                        className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 focus:outline-none resize-none leading-relaxed select-all"
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 overflow-y-auto max-h-[170px]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>Danh sách phân đoạn:</span>
                      </span>
                      {seoData.chapters.map((ch, idx) => (
                        <div key={idx} className="text-[11px] font-mono flex items-start gap-1.5 text-slate-300">
                          <span className="text-amber-400 font-bold">{ch.timestamp}</span>
                          <span className="text-slate-400 truncate">{ch.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Hashtags for TikTok & Shorts */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#070A12] border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                        Hashtags Thịnh Hành (TikTok / YouTube Shorts / Reels)
                      </h4>
                    </div>

                    <button
                      onClick={handleCopyHashtags}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedHashtags ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Đã sao chép</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép Hashtags</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300 font-semibold select-all">
                    {seoData.hashtags}
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {seoData.tags.map((t, idx) => (
                      <Badge key={idx} variant="secondary" className="text-[10px] text-slate-400">
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
