# Kế Hoạch Triển Khai: Subtitle Styling & Typography Điện Ảnh (Cinematic Subtitles & Ass/Srt Styler)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp hệ thống phụ đề của AI Film Studio lên chuẩn điện ảnh chuyên nghiệp: hỗ trợ định dạng Advanced SubStation Alpha (.ass) bên cạnh .srt, đa dạng phong cách typography (TikTok/Shorts Bold, Cinematic Classic, Cyberpunk Neon, Retro 80s VHS, Minimalist Clean, Karaoke Pop Highlight), tùy biến vị trí (Bottom, Center, Top), hiệu ứng nhảy từ theo nhịp điệu phát âm (word-by-word karaoke), xem trước phụ đề trực quan (Live Subtitle Preview) trên Web UI và tải xuống file .srt/.ass riêng biệt cho hậu kỳ.

**Architecture:**
1. `studio/subtitles.py`:
   - Định nghĩa `SUBTITLE_PRESETS` với các thông số typography chi tiết: font name, font size (tự động thích ứng tỉ lệ 16:9 và 9:16), màu chữ chính (`PrimaryColour`), viền (`OutlineColour`), bóng đổ (`Shadow`), độ dày viền (`Outline`), căn lề (`Alignment`), lề đứng (`MarginV`).
   - Hàm `generate_ass()` tạo file `.ass` đầy đủ chuẩn Script Info, V4+ Styles và Events, hỗ trợ tự động tính toán nhãn thời gian từng từ `{\k<centisecs>}` cho hiệu ứng Karaoke Highlight.
   - Hàm `get_subtitle_presets()` xuất danh mục presets kèm mẫu preview và mã màu HEX cho frontend.
2. `studio/assembly.py`:
   - Nâng cấp `build_hardsub_filter()` hỗ trợ cả `.ass` (qua filter `ass=...`) và `.srt` (qua filter `subtitles=...:force_style=...`), truyền vào preset và vị trí tùy chọn.
   - Trong `run_assembly_stage`: Xuất cả 2 file `movie_{timestamp}.srt` và `movie_{timestamp}.ass`, tích hợp vào lệnh mux FFmpeg khi `hardsub=True`.
3. `studio/config.py`:
   - Mở rộng `StudioConfig` với `subtitle_style: str = "tiktok_bold"`, `subtitle_position: str = "bottom"`, `subtitle_karaoke: bool = False`.
4. `studio/server.py`:
   - Đăng ký `GET /api/system/subtitle-presets`: Cung cấp danh mục presets cho giao diện.
   - Đăng ký `GET /api/projects/{project_id}/subtitles/{format}`: Endpoint cho phép người dùng tải về file phụ đề `.srt` hoặc `.ass`.
   - Cập nhật `ProduceRequest`, `AssembleMasterRequest`, và `DubbingRequest`.
5. `web/src/`:
   - Mở rộng types (`SubtitlePresetItem`, cập nhật `ProductionFormData`).
   - Thêm API queries `useSubtitlePresets()`.
   - Nâng cấp `ProductionForm.tsx`: Card tùy biến Subtitle Styling khi bật Hardsub (chọn Preset, chọn Vị trí, bật/tắt Karaoke, hiển thị Live Preview giả lập khung hình điện ảnh).
   - Nâng cấp `StoryboardView.tsx`: Thêm nút tải file `.srt` và `.ass` để tiện dựng trong Premiere / CapCut / DaVinci Resolve.

**Tech Stack:** Python 3.11, FFmpeg (libass, subtitles filter), FastAPI, React 18, TypeScript, Tailwind CSS, Pytest.

---

## Global Constraints
- Toàn bộ 110 unit/integration tests hiện tại PHẢI tiếp tục PASS 100% (không gây bất kỳ lỗi hồi quy nào).
- Luôn giữ tính tương thích ngược cho `build_hardsub_filter()` với các tham số mặc định.
- Giao diện Vite build bundle giữ ở mức tối ưu (< 210 kB).

---

## Tasks

### Task 1: Module Subtitles Nâng Cao & Sinh File .ASS / Karaoke (`studio/subtitles.py`)
- [x] **Step 1: Viết test cho subtitle presets và ASS generator**
  Tạo `tests/test_subtitles.py` kiểm tra:
  - `get_subtitle_presets()` trả về đủ các preset (`tiktok_bold`, `cinematic`, `cyberpunk`, `retro_vhs`, `minimalist`, `karaoke_pop`).
  - `format_ass_timestamp()` chuyển đổi giây sang chuẩn ASS `H:MM:SS.cc` chính xác.
  - `generate_ass()` tạo file `.ass` hợp lệ với Script Info, Styles, Events.
  - `generate_ass()` với `karaoke=True` sinh ra thẻ `{\k...}` cho các từ trong thoại.
  - `generate_ass()` với `position="top" | "middle" | "bottom"` căn chỉnh Alignment chuẩn.
  - `generate_srt()` tiếp tục sinh file `.srt` chuẩn.
- [x] **Step 2: Chạy test xác nhận test fail**
  Chạy `docker compose run --rm studio -m pytest tests/test_subtitles.py`.
- [x] **Step 3: Hiện thực `SUBTITLE_PRESETS`, `format_ass_timestamp`, `generate_ass`, `get_subtitle_presets` trong `studio/subtitles.py`**
- [x] **Step 4: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_subtitles.py`.

---

### Task 2: Nâng Cấp Hardsub Filter & Assembly Pipeline (`studio/assembly.py`, `studio/config.py`)
- [x] **Step 1: Mở rộng `StudioConfig` trong `studio/config.py`**
  Thêm `subtitle_style`, `subtitle_position`, `subtitle_karaoke`.
- [x] **Step 2: Nâng cấp `build_hardsub_filter()` và `run_assembly_stage()` trong `studio/assembly.py`**
  - Hỗ trợ cả `.ass` và `.srt` với preset tùy biến.
  - Tạo đồng thời file `.srt` và `.ass` khi hoàn thiện phim.
- [x] **Step 3: Viết test bổ sung và kiểm tra tương thích ngược trong `tests/test_assembly.py`**
  Chạy `docker compose run --rm studio -m pytest tests/test_assembly.py`.

---

### Task 3: API Endpoints Danh Mục Subtitle & Tải File Phụ Đề (`studio/server.py`)
- [x] **Step 1: Viết test cho API subtitle endpoints**
  Bổ sung vào `tests/test_server.py`:
  - `test_get_subtitle_presets()`: `GET /api/system/subtitle-presets`.
  - `test_download_subtitles()`: `GET /api/projects/{project_id}/subtitles/{format}`.
- [x] **Step 2: Hiện thực API endpoints trong `studio/server.py`**
  - Đăng ký `GET /api/system/subtitle-presets`.
  - Đăng ký `GET /api/projects/{project_id}/subtitles/{format}`.
  - Cập nhật `ProduceRequest` và `AssembleMasterRequest`.
- [x] **Step 3: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_server.py -k subtitle`.

---

### Task 4: Giao Diện Người Dùng & Live Subtitle Preview (`ProductionForm.tsx` & `StoryboardView.tsx`)
- [x] **Step 1: Cập nhật types & API client frontend**
  - Thêm `SubtitlePresetItem` trong `web/src/types/index.ts`.
  - Thêm `fetchSubtitlePresets()` trong `web/src/api/studio.ts`.
  - Thêm hook `useSubtitlePresets()` trong `web/src/api/queries.ts`.
- [x] **Step 2: Thêm Subtitle Styling Card & Live Subtitle Preview trong `ProductionForm.tsx`**
  - Hiển thị khi `hardsub` được bật.
  - Lựa chọn Preset phong cách (TikTok Bold, Cinematic, Cyberpunk, Retro, Minimalist, Karaoke Pop).
  - Chọn Vị trí (Dưới chân, Giữa khung hình, Phía trên).
  - Bật/tắt Karaoke Highlight.
  - Live Subtitle Preview: Giả lập khung hình video với phông chữ, màu sắc và bóng đổ theo thời gian thực.
- [x] **Step 3: Cập nhật `StoryboardView.tsx`**
  - Thêm các nút tải file phụ đề `.srt` và `.ass` trong phần thông tin master video.
- [x] **Step 4: Build frontend kiểm tra lỗi TypeScript**
  Chạy `npm run build` trong `web/`.

---

### Task 5: Kiểm Tra Toàn Diện & Nghiệm Thu
- [x] Chạy toàn bộ backend test suite (`pytest tests/`) xác nhận 100% pass (118 passed, 0 failed).
- [x] Khởi động lại container UI và kiểm tra live endpoint `GET /api/system/subtitle-presets` & `/api/storyboard/subtitles/srt|ass`.
- [x] Báo cáo kết quả chi tiết cho người dùng.
