# Smart Auto-Reframe 16:9 sang 9:16 Shorts/TikTok Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng công cụ Smart Auto-Reframe chuyển đổi tự động phim ngang 16:9 sang video dọc 9:16 chuẩn Shorts/TikTok với 2 tùy chọn chính: Ambient Glass Blur (Nền mờ nghệ thuật) và Dynamic Pan & Scan (Cắt cúp tràn viền), tích hợp phụ đề vùng an toàn và trình xem thử Smartphone.

**Architecture:** Thiết kế module `studio/reframe.py` sinh filtergraph FFmpeg 7.1 chuyên biệt cho từng phong cách reframe, kèm module gắn phụ đề chuẩn safe-zone. Ở backend cung cấp API `/api/reframe/presets` và `/api/reframe/create`. Ở frontend xây dựng modal `AutoReframeModal.tsx` hiển thị mô hình smartphone và bộ chọn phong cách trực quan.

**Tech Stack:** Python 3.11, FFmpeg 7.1 Filtergraph, FastAPI, React 19, TypeScript, Lucide Icons, Framer Motion.

**Spec:** `docs/superpowers/specs/2026-10-29-smart-auto-reframe-vertical-video-design.md`

---

## Global Constraints
- Toàn bộ 144 tests hiện tại PHẢI tiếp tục PASS 100%.
- Giữ vững chất lượng âm thanh 100% bằng cách copy audio stream (`-c:a copy` hoặc AAC 192k).
- Phụ đề khi khắc vào video dọc phải nằm trong vùng an toàn (safe zone) không bị UI TikTok/Shorts che khuất.
- Frontend build Vite giữ ở mức tối ưu (< 310 kB).

---

## Review Focus
1. **Filtergraph Syntax:** Cấu trúc FFmpeg filtergraph cho `blur_padding` (split -> scale/boxblur bg -> overlay fg) phải chạy hoàn hảo trên FFmpeg 7.1 mà không gây lỗi cú pháp.
2. **Aspect Ratio Preservation:** Không làm méo (stretch) tỉ lệ khuôn mặt diễn viên hoặc đối tượng trung tâm.
3. **Safe Zone Subtitles:** Subtitle margin phải được đẩy lên cao hơn chuẩn 16:9 (khoảng 140px - 180px từ đáy).
4. **Hardware Acceleration:** Sử dụng cấu hình encoder từ `studio/hardware.py` nếu có GPU khả dụng.
5. **Project Independence:** Tệp video 9:16 xuất ra được lưu tại `outputs/projects/{id}/master_movie_9_16_{mode}.mp4` độc lập với video 16:9 gốc.

---

## Tasks

### Task 1: Module `studio/reframe.py` & Unit Tests (`tests/test_reframe.py`)
**Files:**
- Create: `studio/reframe.py`
- Create: `tests/test_reframe.py`

- [x] **Step 1: Viết test trong `tests/test_reframe.py`**
  - Test `get_reframe_presets()` trả về danh sách presets (`blur_padding`, `pan_scan`, `fit_center`).
  - Test `build_reframe_filtergraph(mode)` tạo chuỗi filter FFmpeg chính xác cho cả 3 chế độ.
  - Test `reframe_video(...)` gọi lệnh FFmpeg với các tham số chuẩn xác.
- [x] **Step 2: Chạy test xác nhận fail**
  `docker compose run --rm studio -m pytest tests/test_reframe.py`.
- [x] **Step 3: Hiện thực `studio/reframe.py`**
  - Catalog `REFRAME_PRESETS`.
  - Hàm `build_reframe_filtergraph(mode, subtitle_path)`.
  - Hàm `reframe_video(input_path, output_path, mode, subtitle_path, hardware_accel)`.
- [x] **Step 4: Chạy test xác nhận pass**
  `docker compose run --rm studio -m pytest tests/test_reframe.py`.

---

### Task 2: REST API Endpoints trong `studio/server.py` & Test (`tests/test_server.py`)
**Files:**
- Modify: `studio/server.py`
- Modify: `tests/test_server.py`

- [x] **Step 1: Viết test cho endpoint trong `tests/test_server.py`**
  - `GET /api/reframe/presets`
  - `POST /api/reframe/create`
- [x] **Step 2: Hiện thực endpoints trong `studio/server.py`**
  - `ReframeRequest` model.
  - Endpoint `GET /api/reframe/presets`.
  - Endpoint `POST /api/reframe/create`.
- [x] **Step 3: Chạy test server xác nhận pass**
  `docker compose run --rm studio -m pytest tests/test_server.py -k reframe`.

---

### Task 3: Frontend Types, API Client & Queries
**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/api/studio.ts`
- Modify: `web/src/api/queries.ts`

- [x] **Step 1: Cập nhật types trong `web/src/types/index.ts`**
  - Thêm `ReframePresetItem`, `ReframeRequestPayload`, `ReframeResultResponse`.
- [x] **Step 2: Cập nhật API client trong `web/src/api/studio.ts`**
  - Thêm `fetchReframePresets()`, `createAutoReframe()`.
- [x] **Step 3: Cập nhật React Query hooks trong `web/src/api/queries.ts`**
  - Thêm `useReframePresets()`, `useCreateAutoReframe()`.

---

### Task 4: UI Component: `AutoReframeModal.tsx` & Tích Hợp
**Files:**
- Create: `web/src/components/AutoReframeModal.tsx`
- Modify: `web/src/components/VideoPlayerModal.tsx`
- Modify: `web/src/components/StoryboardView.tsx`

- [x] **Step 1: Tạo `AutoReframeModal.tsx`**
  - Mockup khung Smartphone 9:16 sống động.
  - Thẻ chọn phong cách: Ambient Glass Blur vs Dynamic Pan & Scan vs Fit Center.
  - Nút "Tiến Hành Chuyển Đổi 9:16" kèm trạng thái xử lý.
  - Trình phát video dọc ngay trong mockup và nút tải về tệp `.mp4`.
- [x] **Step 2: Tích hợp nút "Xuất 9:16 Shorts" vào `VideoPlayerModal.tsx`**
- [x] **Step 3: Tích hợp nút "Xuất 9:16 Shorts" vào thanh công cụ `StoryboardView.tsx`**
- [x] **Step 4: Kiểm tra biên dịch TypeScript**
  - `cd web && npx tsc --noEmit`.

---

### Task 5: Kiểm Thử Toàn Diện, Build & Khởi Động Container
**Files:**
- Build: `web/`
- Docker: Restart UI container

- [x] **Step 1: Build hoàn chỉnh frontend**
  - `cd web && npm run build`.
- [x] **Step 2: Khởi động lại UI container**
  - `docker compose restart ui`.
- [x] **Step 3: Chạy toàn bộ backend test suite**
  - `docker compose run --rm studio -m pytest tests/`.
  - Xác nhận 148+ tests pass 100%.
- [x] **Step 4: Cập nhật artifact và nghiệm thu cùng người dùng.**
