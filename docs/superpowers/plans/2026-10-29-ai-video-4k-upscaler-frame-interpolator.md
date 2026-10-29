# AI Video 4K Upscaler & 60fps Frame Interpolator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiện thực hệ thống nâng cấp chất lượng video siêu phân giải 4K (3840x2160) và nội suy chuyển động 60fps (Super-Resolution & Motion Smoothing Studio) với khả năng xử lý cho từng phân cảnh (Shot) lẫn toàn bộ phim thành phẩm (Master Movie).

**Architecture:** Tạo module backend `studio/video_enhancer.py` đóng gói các thuật toán scale Lanczos/Spline, unsharp mask, và FFmpeg `minterpolate` cùng hardware acceleration. Bổ sung các REST endpoints trong `studio/server.py`. Frontend xây dựng modal `VideoEnhancerModal.tsx` và tích hợp các nút kích hoạt trong `StoryboardView.tsx`.

**Tech Stack:** Python 3.11, FFmpeg, FastAPI, React 19, TypeScript, Tailwind CSS, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-10-29-ai-video-4k-upscaler-frame-interpolator-design.md`

## Global Constraints
- Toàn bộ 159 tests hiện tại PHẢI tiếp tục PASS 100%.
- Không làm ảnh hưởng đến file video gốc (tạo file enhanced riêng có hậu tố `_enhanced.mp4` hoặc `_4k_60fps.mp4`).
- Tự động tận dụng hardware acceleration khi có GPU, an toàn fallback CPU đa luồng.
- Frontend build Vite giữ ở mức tối ưu (< 360 kB).

## Review Focus
1. **FFmpeg Filtergraph Validity:** Đảm bảo các chuỗi filter scale, unsharp, minterpolate, eq, noise hoạt động tương thích với phiên bản FFmpeg trong Docker container.
2. **Resource Management:** Tiến trình nâng cấp không làm nghẽn CPU hoặc gây out-of-memory.
3. **No Regressions:** Tất cả 159 tests hiện tại tiếp tục pass 100%.

---

## Tasks

### Task 1: Module `studio/video_enhancer.py` & Unit Tests (`tests/test_video_enhancer.py`)
**Files:**
- Create: `studio/video_enhancer.py`
- Create: `tests/test_video_enhancer.py`

- [x] **Step 1: Viết unit tests trong `tests/test_video_enhancer.py`**
  - Test `get_enhancer_presets()` trả về danh sách preset đầy đủ.
  - Test `build_enhancer_filter()` sinh đúng chuỗi filter theo từng preset.
  - Test `enhance_video()` gọi lệnh FFmpeg chuẩn xác (mock subprocess).
  - Test `enhance_shot_video()` và `enhance_master_video()` xử lý đường dẫn đúng.
- [x] **Step 2: Chạy test xác nhận fail**
  `docker compose run --rm studio -m pytest tests/test_video_enhancer.py`.
- [x] **Step 3: Hiện thực `studio/video_enhancer.py`**
  - Định nghĩa danh mục preset (`4k_crisp`, `4k_clean`, `fps_60_smooth`, `fps_60_fast`, `ultra_master_4k_60fps`, `film_grain_enhance`).
  - Hàm `build_enhancer_filter(preset_id, ...)`.
  - Hàm `enhance_video(input_path, output_path, ...)`.
  - Hàm `enhance_shot_video(...)` và `enhance_master_video(...)`.
- [x] **Step 4: Chạy test xác nhận pass**
  `docker compose run --rm studio -m pytest tests/test_video_enhancer.py`.

---

### Task 2: REST Endpoints trong `studio/server.py` & Tests (`tests/test_server.py`)
**Files:**
- Modify: `studio/server.py`
- Modify: `tests/test_server.py`

- [x] **Step 1: Viết test server trong `tests/test_server.py`**
  - Test `GET /api/video/enhancer/presets`.
  - Test `POST /api/video/enhancer/enhance-shot`.
  - Test `POST /api/video/enhancer/enhance-master`.
- [x] **Step 2: Hiện thực endpoints trong `studio/server.py`**
  - `GET /api/video/enhancer/presets`.
  - `POST /api/video/enhancer/enhance-shot`.
  - `POST /api/video/enhancer/enhance-master`.
- [x] **Step 3: Chạy test server xác nhận pass**
  `docker compose run --rm studio -m pytest tests/test_server.py -k enhancer`.

---

### Task 3: Web API Client, Types & React Query Hooks
**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/api/studio.ts`
- Modify: `web/src/api/queries.ts`

- [x] **Step 1: Cập nhật types trong `web/src/types/index.ts`**
  - `VideoEnhancerPreset`, `EnhanceShotPayload`, `EnhanceMasterPayload`, `EnhanceVideoResponse`.
- [x] **Step 2: Thêm hàm API trong `web/src/api/studio.ts`**
  - `fetchEnhancerPresets()`, `enhanceShotVideo()`, `enhanceMasterVideo()`.
- [x] **Step 3: Thêm React Query hooks trong `web/src/api/queries.ts`**
  - `useEnhancerPresets()`, `useEnhanceShotVideo()`, `useEnhanceMasterVideo()`.

---

### Task 4: UI Component `VideoEnhancerModal.tsx` & Tích Hợp `StoryboardView.tsx`
**Files:**
- Create: `web/src/components/VideoEnhancerModal.tsx`
- Modify: `web/src/components/StoryboardView.tsx`

- [x] **Step 1: Tạo `VideoEnhancerModal.tsx`**
  - Grid danh sách preset nâng cấp với thông số độ phân giải, fps và badge phần cứng.
  - Tùy chọn nâng cấp cho Phân cảnh hoặc Toàn bộ phim.
  - Video player xem trước kết quả nâng cấp và nút tải file.
  - Thanh trạng thái tiến trình xử lý.
- [x] **Step 2: Tích hợp vào `StoryboardView.tsx`**
  - Nút "Nâng Cấp 4K / 60fps" trên thanh điều khiển Master Movie.
  - Nút "4K / 60fps" trên từng thẻ phân cảnh có video.
- [x] **Step 3: Kiểm tra biên dịch TypeScript**
  - `cd web && npx tsc --noEmit`.

---

### Task 5: Build, Khởi Động Container & Kiểm Thử Toàn Diện
**Files:**
- Build: `web/`
- Docker: Restart UI container

- [x] **Step 1: Build hoàn chỉnh frontend**
  - `cd web && npm run build`.
- [x] **Step 2: Khởi động lại UI container**
  - `docker compose restart ui`.
- [x] **Step 3: Chạy toàn bộ test suite**
  - `docker compose run --rm studio -m pytest tests/`.
  - Xác nhận 163+ tests pass 100%.
- [x] **Step 4: Cập nhật artifact và nghiệm thu cùng người dùng.**
