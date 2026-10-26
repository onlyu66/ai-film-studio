# Comprehensive Studio Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp toàn diện AI Film Studio với: (1) Xử lý song song siêu tốc cho TTS, tạo ảnh và render clip; (2) Hỗ trợ tỉ lệ khung hình 16:9 & 9:16 (Shorts/TikTok); (3) Hiệu ứng chuyển cảnh điện ảnh & BGM theo phong cách; (4) Chức năng Web UI: Reroll ảnh, Upload ảnh tùy chỉnh, Nghe thử giọng đọc; (5) Multi-pass scriptwriting cho phim dài tập.

**Architecture:**
- **Backend Concurrency:** Sử dụng `asyncio.gather` cho TTS, `concurrent.futures.ThreadPoolExecutor` cho tải ảnh và FFmpeg render video đa luồng, đảm bảo checkpoint an toàn với thread lock.
- **Aspect Ratio Pipeline:** Bổ sung cấu hình `aspect_ratio` ("16:9" và "9:16") xuyên suốt từ Config, Prompt, Kích thước tạo ảnh (1280x720 vs 720x1280) đến FFmpeg Ken Burns canvas (1920x1080 vs 1080x1920).
- **Cinematic Transitions & Auto BGM:** Bổ sung FFmpeg fade transitions giữa các cảnh và cơ chế tự động chọn bài nhạc nền phù hợp theo style kịch bản.
- **Interactive Storyboard API:** Cung cấp các endpoint FastAPI cho phép Reroll ảnh của từng shot, Upload ảnh từ máy tính, và sinh audio nghe thử giọng trực tiếp.
- **Modern Web UI:** Bổ sung các nút bấm tương tác trực quan vào `ProductionForm.tsx` và `StoryboardView.tsx`.

**Tech Stack:** Python 3.11, FastAPI, FFmpeg, Asyncio, Edge-TTS, Pollinations/Flux, React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Axios, Lucide Icons.

---

### Task 1: Song song hóa Pipeline (Parallel Concurrency for TTS, Images & FFmpeg)

**Files:**
- Modify: `studio/tts.py`
- Modify: `studio/images.py`
- Modify: `studio/motion.py`
- Modify: `tests/test_tts.py`
- Modify: `tests/test_images.py`
- Modify: `tests/test_motion.py`

- [ ] Trong `studio/tts.py`: Viết hàm async `run_tts_stage_async` sử dụng `asyncio.Semaphore(8)` và `asyncio.gather` để sinh giọng nói cho tất cả các shots đồng thời. Cập nhật `run_tts_stage` để điều phối async.
- [ ] Trong `studio/images.py`: Cập nhật `run_image_stage` sử dụng `concurrent.futures.ThreadPoolExecutor(max_workers=5)` để tải ảnh từ Pollinations song song, cập nhật `state` an toàn.
- [ ] Trong `studio/motion.py`: Cập nhật `run_motion_stage` sử dụng `concurrent.futures.ThreadPoolExecutor(max_workers=min(4, os.cpu_count() or 2))` để render video clip Ken Burns song song qua FFmpeg.
- [ ] Chạy `docker compose run --rm studio -m pytest tests/` kiểm tra tất cả unit tests vượt qua.
- [ ] Commit Task 1: "perf: parallelize TTS, image generation, and FFmpeg motion rendering".

---

### Task 2: Hỗ trợ Tỉ lệ khung hình (Aspect Ratio: 16:9 Ngang & 9:16 Dọc Shorts/TikTok)

**Files:**
- Modify: `studio/config.py`
- Modify: `studio/cli.py`
- Modify: `studio/images.py`
- Modify: `studio/motion.py`
- Modify: `studio/server.py`
- Test: `tests/test_config.py` (hoặc `tests/test_cli.py`)

- [ ] Trong `studio/config.py`: Thêm trường `aspect_ratio: str = "16:9"` vào `StudioConfig` và hàm `load_config`.
- [ ] Trong `studio/cli.py`: Thêm tùy chọn `--aspect-ratio` với `type=click.Choice(["16:9", "9:16"])`, mặc định là `"16:9"`.
- [ ] Trong `studio/images.py`: Khi `config.aspect_ratio == "9:16"`, gọi URL Pollinations với `width=720&height=1280` (thay vì `1280x720`).
- [ ] Trong `studio/motion.py`: Bổ sung tham số `aspect_ratio` vào `build_ffmpeg_command` và `run_motion_stage`: cấu hình `width=1080, height=1920` cho 9:16 (hoặc `1920x1080` cho 16:9).
- [ ] Trong `studio/server.py`: Cập nhật `ProduceRequest` để nhận `aspect_ratio: str = "16:9"`.
- [ ] Chạy tests xác minh `docker compose run --rm studio -m pytest`.
- [ ] Commit Task 2: "feat: add 16:9 and 9:16 vertical video aspect ratio support".

---

### Task 3: Chuyển cảnh điện ảnh & Tự động chọn Nhạc nền (Transitions & Auto BGM)

**Files:**
- Modify: `studio/assembly.py`
- Modify: `studio/orchestrator.py`
- Modify: `tests/test_assembly.py`

- [ ] Trong `studio/assembly.py`: Bổ sung cơ chế tự động chọn bài BGM từ thư mục `assets/` dựa theo `config.style` (`cinematic`, `anime`, `noir`, `documentary`) khi không truyền file `--bgm` tùy chỉnh.
- [ ] Cải thiện bộ lọc FFmpeg ghép video: thêm fade in ở đầu phim và fade out ở cuối phim để video kết thúc êm dịu, chuyên nghiệp.
- [ ] Cập nhật tests kiểm tra logic lắp ráp video và BGM.
- [ ] Commit Task 3: "feat: add cinematic fade transitions and style-based BGM selection".

---

### Task 4: Backend Endpoints cho Web UI: Reroll Shot, Custom Image Upload, Voice Preview

**Files:**
- Modify: `studio/server.py`
- Modify: `studio/tts.py`

- [ ] Trong `studio/tts.py`: Viết hàm helper `synthesize_preview_audio(text: str, voice: str, output_path: Path)` để sinh 1 đoạn audio mẫu.
- [ ] Trong `studio/server.py`: Thêm endpoint `POST /api/tts/preview-voice` nhận `{ voice: str, text: Optional[str] }` và trả về URL file audio nghe thử.
- [ ] Trong `studio/server.py`: Thêm endpoint `POST /api/storyboard/reroll-shot` nhận `{ shot_id: str }`: sinh seed ngẫu nhiên mới, tải ảnh mới, render lại video clip tương ứng và cập nhật trạng thái.
- [ ] Trong `studio/server.py`: Thêm endpoint `POST /api/storyboard/upload-shot-image` nhận `shot_id` và file ảnh `UploadFile`: lưu đè vào `outputs/images/{shot_id}.png` và render lại clip video tương ứng.
- [ ] Viết test hoặc kiểm tra bằng curl xác nhận các endpoints hoạt động chính xác.
- [ ] Commit Task 4: "feat: add backend endpoints for shot reroll, custom image upload, and voice preview".

---

### Task 5: Frontend UI: Reroll, Upload ảnh, Nghe thử giọng & Chọn khung hình 9:16

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/api/studio.ts`
- Modify: `web/src/api/queries.ts`
- Modify: `web/src/components/ProductionForm.tsx`
- Modify: `web/src/components/StoryboardView.tsx`

- [ ] Trong `web/src/types/index.ts`: Thêm `aspect_ratio?: string` vào `ProductionFormData` và `StudioConfig`.
- [ ] Trong `web/src/api/studio.ts` & `web/src/api/queries.ts`: Khai báo các API call và React Query mutations: `rerollShot`, `uploadShotImage`, `previewVoice`.
- [ ] Trong `web/src/components/ProductionForm.tsx`: Bổ sung bộ chọn Tỉ lệ khung hình (16:9 Ngang chuẩn YouTube vs 9:16 Dọc TikTok/Shorts).
- [ ] Trong `web/src/components/StoryboardView.tsx`:
  - Thêm nút "Nghe thử" bên cạnh bộ chọn giọng đọc của từng nhân vật (phát audio trực tiếp qua HTML5 Audio).
  - Thêm nút "Tạo lại ảnh" (Reroll) và nút "Tải ảnh" (Upload custom image) trên từng thẻ phân cảnh.
- [ ] Chạy `npm run build` trong `web/` để xác nhận TypeScript không có lỗi.
- [ ] Kiểm tra toàn bộ UI trên [http://localhost:8080](http://localhost:8080).
- [ ] Commit Task 5: "feat(web): add shot reroll, image upload, voice preview, and aspect ratio selector".
