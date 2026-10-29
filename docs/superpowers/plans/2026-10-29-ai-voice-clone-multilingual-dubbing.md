# AI Voice Clone & Multilingual Dubbing Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống nhân bản giọng nói AI (AI Voice Clone) hỗ trợ đồng thời ElevenLabs API và Local Engine, cùng xưởng lồng tiếng đa ngôn ngữ (Multilingual Dubbing Studio) tự động dịch thoại và tạo phim lồng tiếng đồng bộ phụ đề.

**Architecture:** Thiết kế module `studio/voice_clone.py` xử lý tích hợp kép (ElevenLabs Cloud REST API & Local Engine/Edge acoustic emulation), module `studio/dubbing.py` điều phối dịch thuật qua LLM và tổng hợp audio đa ngữ. Ở frontend, cung cấp `VoiceCloneModal.tsx` (thu âm mic / tải audio 10-60s) và `DubbingModal.tsx` (chọn ngôn ngữ đích và xuất bản phim lồng tiếng).

**Tech Stack:** Python 3.11, FastAPI, Requests/HTTPX, Edge-TTS, Pydub, React 19, TypeScript, Lucide Icons, Framer Motion, Web Audio API / MediaRecorder.

**Spec:** `docs/superpowers/specs/2026-10-29-ai-voice-clone-multilingual-dubbing-design.md`

---

## Global Constraints
- Toàn bộ 135 tests hiện có PHẢI tiếp tục PASS 100%.
- Hỗ trợ lưu trữ bền vững danh sách giọng nhân bản tại `outputs/voices/voices.json`.
- Khi không có ElevenLabs API Key hoặc máy chủ local, hệ thống tự động fallback êm ái sang Edge-TTS acoustic profile mà không bao giờ làm crash pipeline.
- Frontend build Vite giữ ở mức tối ưu (< 305 kB).

---

## Review Focus
1. **Mocking External APIs in Tests:** Các bài test cho ElevenLabs và Local Voice API phải được mock hoàn toàn bằng `unittest.mock` để chạy siêu tốc offline mà không cần network thật.
2. **Audio File Handling:** Hỗ trợ nhận dạng và chuyển đổi các định dạng file audio mẫu phổ biến (.mp3, .wav, .m4a, .ogg) từ Base64 hoặc multipart.
3. **Microphone Recording in Browser:** Xử lý cấp quyền microphone an toàn qua `navigator.mediaDevices.getUserMedia` với cleanup stream khi modal đóng.
4. **Translation Preservation:** LLM translation cho lồng tiếng phải giữ nguyên `shot_id`, không làm mất phân cảnh và duy trì cảm xúc kịch bản gốc.
5. **Character Voice Binding:** Giọng sau khi nhân bản phải gắn được trực tiếp vào nhân vật trong Storyboard và được sử dụng trong cả quá trình render đơn lẻ lẫn render toàn bộ phim.

---

## Tasks

### Task 1: Module `studio/voice_clone.py` & Unit Tests (`tests/test_voice_clone.py`)
**Files:**
- Create: `studio/voice_clone.py`
- Create: `tests/test_voice_clone.py`

- [x] **Step 1: Viết bài test trong `tests/test_voice_clone.py`**
  - Test `save_voice_profile` và `load_voice_profiles`.
  - Test `clone_voice_elevenlabs` (với mock HTTP response).
  - Test `clone_voice_local` (với mock local endpoint & fallback).
  - Test `synthesize_voice` với các providers khác nhau.
- [x] **Step 2: Chạy test xác nhận fail**
  `docker compose run --rm studio -m pytest tests/test_voice_clone.py`.
- [x] **Step 3: Hiện thực `studio/voice_clone.py`**
  - Định nghĩa data model `VoiceProfile`.
  - Quản lý storage file `outputs/voices/voices.json`.
  - Hàm `clone_voice(provider, name, audio_path, api_key, api_url, description)`.
  - Hàm `synthesize_speech(text, voice_id, provider, output_path, lang, api_key, api_url)`.
  - Hàm `get_all_voices()`.
- [x] **Step 4: Chạy test xác nhận pass**
  `docker compose run --rm studio -m pytest tests/test_voice_clone.py`.

---

### Task 2: Module Multilingual Dubbing (`studio/dubbing.py`) & Unit Tests (`tests/test_dubbing.py`)
**Files:**
- Create: `studio/dubbing.py`
- Create: `tests/test_dubbing.py`

- [x] **Step 1: Viết bài test trong `tests/test_dubbing.py`**
  - Test `translate_storyboard_dialogues` (với mock LLM).
  - Test `create_dubbed_audio_stage`.
  - Test `build_dubbed_subtitles`.
- [x] **Step 2: Chạy test xác nhận fail**
  `docker compose run --rm studio -m pytest tests/test_dubbing.py`.
- [x] **Step 3: Hiện thực `studio/dubbing.py`**
  - Prompt điện ảnh dịch kịch bản giữ nguyên sắc thái biểu cảm.
  - Hàm `translate_dialogues(storyboard, target_lang, config)`.
  - Hàm `run_dubbing_pipeline(project_id, target_lang, voice_mapping, config, state)`.
- [x] **Step 4: Chạy test xác nhận pass**
  `docker compose run --rm studio -m pytest tests/test_dubbing.py`.

---

### Task 3: REST API Endpoints trong `studio/server.py` & Test (`tests/test_server.py`)
**Files:**
- Modify: `studio/server.py`
- Modify: `tests/test_server.py`

- [x] **Step 1: Viết test cho các endpoint mới trong `tests/test_server.py`**
  - `POST /api/voice/clone`
  - `GET /api/voice/list`
  - `POST /api/voice/preview`
  - `POST /api/dubbing/create`
- [x] **Step 2: Hiện thực endpoints trong `studio/server.py`**
  - Request models: `CloneVoiceRequest`, `VoicePreviewRequest`, `CreateDubbingRequest`.
  - Endpoints logic kết nối `studio/voice_clone.py` và `studio/dubbing.py`.
- [x] **Step 3: Chạy test server xác nhận pass**
  `docker compose run --rm studio -m pytest tests/test_server.py -k voice`.

---

### Task 4: Frontend Types, API Client & Queries
**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/api/studio.ts`
- Modify: `web/src/api/queries.ts`

- [x] **Step 1: Cập nhật types trong `web/src/types/index.ts`**
  - Thêm `VoiceProfileItem`, `CloneVoicePayload`, `VoicePreviewPayload`, `DubbingRequestPayload`, `DubbingResultResponse`.
- [x] **Step 2: Cập nhật API client trong `web/src/api/studio.ts`**
  - Thêm `cloneVoice()`, `fetchVoiceList()`, `previewVoiceSpeech()`, `createDubbing()`.
- [x] **Step 3: Cập nhật React Query hooks trong `web/src/api/queries.ts`**
  - Thêm `useVoiceList()`, `useCloneVoice()`, `usePreviewVoiceSpeech()`, `useCreateDubbing()`.

---

### Task 5: UI Components: `VoiceCloneModal.tsx`, `DubbingModal.tsx` & Storyboard Integration
**Files:**
- Create: `web/src/components/VoiceCloneModal.tsx`
- Create: `web/src/components/DubbingModal.tsx`
- Modify: `web/src/components/StoryboardView.tsx`

- [x] **Step 1: Tạo `VoiceCloneModal.tsx`**
  - Provider toggle: ElevenLabs Cloud vs Local Engine.
  - Tải file audio mẫu hoặc thu âm trực tiếp bằng Browser MediaRecorder.
  - Form: Tên giọng, nhân vật liên kết, API key/URL nếu dùng ElevenLabs/Local.
  - Thử giọng: Gõ câu văn và nghe phát âm thử tức thì.
  - Lưu và gắn giọng vào nhân vật.
- [x] **Step 2: Tạo `DubbingModal.tsx`**
  - Chọn ngôn ngữ mục tiêu (Anh, Nhật, Pháp, Hàn, Tây Ban Nha, Trung...).
  - Gán giọng lồng tiếng cho từng nhân vật.
  - Nút "Bắt đầu lồng tiếng" kèm thanh tiến trình.
- [x] **Step 3: Tích hợp vào `StoryboardView.tsx`**
  - Bổ sung nút "Nhân bản giọng (Voice Clone)" cạnh nhân vật.
  - Bổ sung nút "Lồng tiếng đa ngữ (Dubbing Studio)" trên thanh công cụ master export.
- [x] **Step 4: Kiểm tra biên dịch TypeScript**
  - `cd web && npx tsc --noEmit`.

---

### Task 6: Kiểm Thử Toàn Diện, Build & Khởi Động Container
**Files:**
- Build: `web/`
- Docker: Restart UI container

- [x] **Step 1: Build hoàn chỉnh frontend**
  - `cd web && npm run build`.
- [x] **Step 2: Khởi động lại UI container**
  - `docker compose restart ui`.
- [x] **Step 3: Chạy toàn bộ backend test suite**
  - `docker compose run --rm studio -m pytest tests/`.
  - Xác nhận 144/144 tests pass 100%.
- [x] **Step 4: Cập nhật artifact và nghiệm thu cùng người dùng.**
