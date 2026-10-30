import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Mic,
  Square,
  Upload,
  Play,
  Pause,
  Sparkles,
  Cpu,
  CheckCircle2,
  Loader2,
  Key,
  Volume2,
} from 'lucide-react'
import { useCloneVoice, usePreviewVoiceSpeech } from '../api/queries'
import type { VoiceProfileItem } from '../types'

export interface VoiceCloneModalProps {
  isOpen: boolean
  onClose: () => void
  characterId?: string
  characterName?: string
  onVoiceCloned: (voice: VoiceProfileItem) => void
}

export default function VoiceCloneModal({
  isOpen,
  onClose,
  characterId: _characterId,
  characterName,
  onVoiceCloned,
}: VoiceCloneModalProps) {
  const [provider, setProvider] = useState<'elevenlabs' | 'local'>('elevenlabs')
  const [voiceName, setVoiceName] = useState(characterName ? `Giọng ${characterName}` : 'Giọng Nhân Bản Mới')
  const [gender, setGender] = useState<'male' | 'female' | 'neutral'>('neutral')
  const [lang, setLang] = useState('vi')
  const [description, setDescription] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiUrl, setApiUrl] = useState('')

  // Audio sample state
  const [audioBase64, setAudioBase64] = useState<string | null>(null)
  const [audioFileName, setAudioFileName] = useState<string>('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordDuration, setRecordDuration] = useState(0)

  // Preview state
  const [previewText, setPreviewText] = useState('Chào bạn, đây là mẫu giọng đọc AI vừa được nhân bản chuẩn điện ảnh.')
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null)
  const [isPlayingPreview, setIsPlayingPreview] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<number | null>(null)

  const cloneMutation = useCloneVoice()
  const previewMutation = usePreviewVoiceSpeech()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    const savedKey = localStorage.getItem('studio_elevenlabs_key') || ''
    setApiKey(savedKey)
  }, [])

  useEffect(() => {
    if (characterName) {
      setVoiceName(`Giọng ${characterName}`)
    }
  }, [characterName])

  // Stop recording timer on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  if (!isOpen) return null

  // File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setAudioFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = reader.result as string
      setAudioBase64(b64)
    }
    reader.readAsDataURL(file)
  }

  // Microphone Recording handler
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' })
        const reader = new FileReader()
        reader.onloadend = () => {
          setAudioBase64(reader.result as string)
          setAudioFileName(`recording_${Date.now()}.mp3`)
        }
        reader.readAsDataURL(audioBlob)

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordDuration(0)
      recordTimerRef.current = window.setInterval(() => {
        setRecordDuration((prev) => prev + 1)
      }, 1000)
    } catch (err: any) {
      alert(`Không thể truy cập microphone: ${err?.message || 'Quyền bị từ chối'}`)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current)
        recordTimerRef.current = null
      }
    }
  }

  // Live Speech Preview
  const handleTestPreview = () => {
    if (!previewText.trim()) return

    previewMutation.mutate(
      {
        text: previewText.trim(),
        voice_id: provider === 'elevenlabs' ? '21m00Tcm4TlvDq8ikWAM' : 'vi-VN-NamMinhNeural',
        provider: provider,
        lang: lang,
        api_key: apiKey.trim() || undefined,
        api_url: apiUrl.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          if (data.audio_url) {
            setPreviewAudioUrl(data.audio_url)
            const audio = new Audio(data.audio_url)
            previewAudioRef.current = audio
            setIsPlayingPreview(true)
            audio.play().catch(() => setIsPlayingPreview(false))
            audio.onended = () => setIsPlayingPreview(false)
            audio.onerror = () => setIsPlayingPreview(false)
          }
        },
        onError: (err: any) => {
          alert(`Lỗi phát thử giọng: ${err?.message || 'Không thể tạo âm thanh'}`)
        },
      }
    )
  }

  const handleTogglePlayPreview = () => {
    if (!previewAudioRef.current && previewAudioUrl) {
      const audio = new Audio(previewAudioUrl)
      previewAudioRef.current = audio
      setIsPlayingPreview(true)
      audio.play().catch(() => setIsPlayingPreview(false))
      audio.onended = () => setIsPlayingPreview(false)
      audio.onerror = () => setIsPlayingPreview(false)
      return
    }

    if (previewAudioRef.current) {
      if (isPlayingPreview) {
        previewAudioRef.current.pause()
        setIsPlayingPreview(false)
      } else {
        previewAudioRef.current.play().catch(() => setIsPlayingPreview(false))
        setIsPlayingPreview(true)
      }
    }
  }

  // Clone Submit
  const handleCloneSubmit = () => {
    if (!voiceName.trim()) {
      alert('Vui lòng nhập tên cho giọng nhân bản')
      return
    }
    if (!audioBase64) {
      alert('Vui lòng tải lên hoặc thu âm mẫu giọng nói (10s - 60s)')
      return
    }

    if (provider === 'elevenlabs' && apiKey.trim()) {
      localStorage.setItem('studio_elevenlabs_key', apiKey.trim())
    }

    cloneMutation.mutate(
      {
        name: voiceName.trim(),
        provider: provider,
        audio_base64: audioBase64,
        audio_filename: audioFileName || 'sample.mp3',
        description: description.trim() || undefined,
        api_key: apiKey.trim() || undefined,
        api_url: apiUrl.trim() || undefined,
        lang: lang,
        gender: gender,
      },
      {
        onSuccess: (clonedVoice) => {
          onVoiceCloned(clonedVoice)
          onClose()
        },
        onError: (err: any) => {
          alert(`Lỗi nhân bản giọng nói: ${err?.message || 'Không thể xử lý'}`)
        },
      }
    )
  }

  return (
    <AnimatePresence>
      <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md animate-fadeIn cursor-pointer">
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="relative w-full max-w-2xl bg-cinema-deck border border-cinema-border rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] cursor-default"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-cinema-card border-b border-cinema-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <span>Nhân Bản Giọng Nói AI (Voice Clone Studio)</span>
                  {characterName && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300">
                      {characterName}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-zinc-400">
                  Tạo chất giọng riêng biệt từ mẫu âm thanh 10s-60s hoặc thu âm trực tiếp
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

          {/* Form Body */}
          <div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
            {/* 1. Provider Choice */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Cỗ Máy Nhân Bản (Voice Engine)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setProvider('elevenlabs')}
                  className={`p-3 rounded-2xl border text-left transition-all relative ${
                    provider === 'elevenlabs'
                      ? 'bg-amber-500/15 border-amber-500/60 shadow-sm text-amber-300'
                      : 'bg-studio-card/50 border-studio-border/60 hover:bg-studio-card text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-zinc-100">ElevenLabs Cloud</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Siêu thực chuẩn Hollywood, giữ trọn ngữ điệu và cảm xúc
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setProvider('local')}
                  className={`p-3 rounded-2xl border text-left transition-all relative ${
                    provider === 'local'
                      ? 'bg-amber-500/15 border-amber-500/60 shadow-sm text-amber-300'
                      : 'bg-studio-card/50 border-studio-border/60 hover:bg-studio-card text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-zinc-100">Local / Self-Hosted</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Chạy nội bộ qua XTTS/F5-TTS hoặc giả lập âm học offline
                  </p>
                </button>
              </div>
            </div>

            {/* Provider Credential Input */}
            {provider === 'elevenlabs' && (
              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <label className="block text-xs font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  <span>ElevenLabs API Key</span>
                </label>
                <input
                  type="password"
                  placeholder="xi-api-key (Bỏ trống nếu đã cấu hình biến môi trường ELEVENLABS_API_KEY)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
            )}

            {provider === 'local' && (
              <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <label className="block text-xs font-semibold text-emerald-300 mb-1 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Local Server Endpoint (Tùy chọn)</span>
                </label>
                <input
                  type="text"
                  placeholder="http://localhost:8020/tts (Bỏ trống để dùng giả lập Edge-TTS offline)"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 focus:outline-none focus:border-emerald-400 font-mono"
                />
              </div>
            )}

            {/* 2. Voice Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Tên Giọng Đọc
                </label>
                <input
                  type="text"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  placeholder="VD: Giọng Thám Tử Vàng"
                  className="w-full px-3 py-2 rounded-xl bg-studio-deck border border-studio-border text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Giới Tính
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-studio-deck border border-studio-border text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                >
                  <option value="male">Nam (Male)</option>
                  <option value="female">Nữ (Female)</option>
                  <option value="neutral">Trung tính (Neutral)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Ngôn Ngữ Chính
                </label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-studio-deck border border-studio-border text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                >
                  <option value="vi">Tiếng Việt (VI)</option>
                  <option value="en">English (US)</option>
                  <option value="ja">Japanese (JA)</option>
                  <option value="fr">French (FR)</option>
                  <option value="es">Spanish (ES)</option>
                  <option value="zh">Chinese (ZH)</option>
                  <option value="ko">Korean (KO)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Mô Tả Giọng
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="VD: Trầm ấm, dõng dạc, điện ảnh"
                  className="w-full px-3 py-2 rounded-xl bg-studio-deck border border-studio-border text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* 3. Audio Sample: Record or Upload */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Mẫu Âm Thanh (10 - 60 giây)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Upload File Box */}
                <label className="p-4 rounded-2xl bg-studio-deck border-2 border-dashed border-studio-border hover:border-amber-400/60 transition-all flex flex-col items-center justify-center text-center cursor-pointer group">
                  <Upload className="w-6 h-6 text-zinc-400 group-hover:text-amber-400 mb-2 transition-colors" />
                  <span className="text-xs font-semibold text-zinc-200">Tải File Âm Thanh</span>
                  <span className="text-[10px] text-zinc-500 mt-0.5">MP3, WAV, M4A, OGG</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {/* Record Mic Box */}
                <div className="p-4 rounded-2xl bg-studio-deck border border-studio-border flex flex-col items-center justify-center text-center">
                  {isRecording ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-bold animate-pulse">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span>Đang ghi âm: {recordDuration}s</span>
                      </div>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="px-4 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-500/20"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Dừng Ghi Âm</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <button
                        type="button"
                        onClick={startRecording}
                        className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all mb-1.5 shadow-sm"
                      >
                        <Mic className="w-5 h-5" />
                      </button>
                      <span className="text-xs font-semibold text-zinc-200">Ghi Âm Qua Microphone</span>
                      <span className="text-[10px] text-zinc-500 mt-0.5">Đọc đoạn văn 15-30 giây</span>
                    </div>
                  )}
                </div>
              </div>

              {audioFileName && (
                <div className="mt-2.5 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span className="truncate font-medium">Đã nạp mẫu: {audioFileName}</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 shrink-0">SẴN SÀNG</span>
                </div>
              )}
            </div>

            {/* 4. Live Speech Preview */}
            <div className="p-4 rounded-2xl bg-studio-deck border border-studio-border space-y-2.5">
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                <span>Thử Giọng Đọc (Live Speech Preview)</span>
                <span className="text-[10px] font-mono text-zinc-500">Real-time Synthesizer</span>
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  placeholder="Gõ câu văn bất kỳ để nghe phát âm thử..."
                  className="flex-1 px-3 py-2 rounded-xl bg-cinema-deck border border-studio-border text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleTestPreview}
                  disabled={previewMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {previewMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>Tạo Thử</span>
                </button>
              </div>

              {previewAudioUrl && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-cinema-card border border-cinema-border">
                  <div className="flex items-center gap-2 text-xs text-zinc-300">
                    <button
                      type="button"
                      onClick={handleTogglePlayPreview}
                      className="w-7 h-7 rounded-lg bg-amber-500 text-zinc-950 flex items-center justify-center font-bold"
                    >
                      {isPlayingPreview ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    </button>
                    <span>Nghe lại đoạn audio vừa thử</span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400">MP3 PREVIEW</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-cinema-card border-t border-cinema-border flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              Hủy
            </button>

            <button
              type="button"
              onClick={handleCloneSubmit}
              disabled={cloneMutation.isPending || !audioBase64}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20 transition-all hover:scale-102 disabled:opacity-50 cursor-pointer"
            >
              {cloneMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang Nhân Bản Giọng...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Nhân Bản & Gán Vào Nhân Vật</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
