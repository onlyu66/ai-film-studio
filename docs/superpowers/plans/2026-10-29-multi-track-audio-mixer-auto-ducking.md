# Kế Hoạch Triển Khai: Multi-Track Audio Mixer & Auto-Ducking BGM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp hệ thống hòa âm của AI Film Studio thành một Multi-Track Audio Mixer chuyên nghiệp: thuật toán Auto-Ducking thông minh tự động hạ âm lượng nhạc nền (BGM) mượt mà khi nhân vật nói thoại và tăng trở lại khi hết câu, thư viện nhạc nền điện ảnh tích hợp kèm nghe thử trực tiếp (Audio Preview), thanh trượt chỉnh âm lượng BGM / Voice độc lập và hỗ trợ tải lên file nhạc nền MP3 riêng.

**Architecture:**
1. `studio/audio_assets.py`:
   - Định nghĩa `BGM_CATALOG` với metadata phong phú (id, name, genre, mood, bpm, description).
   - Hàm `get_bgm_catalog()` trả về danh sách nhạc nền kèm URL phát nhạc trực tuyến.
   - Hàm `resolve_bgm_track()` hỗ trợ tìm track theo id, custom upload, hoặc style preset.
2. `studio/assembly.py`:
   - Nâng cấp `build_master_audio()` với thuật toán Auto-Ducking chuẩn phát thanh:
     - Tính toán biên độ dBFS theo `bgm_volume` (0.0 đến 1.5).
     - Áp dụng độ hạ âm `ducking_level` (`none`: 0dB, `light`: -6dB, `medium`: -12dB, `heavy`: -18dB) khi phân cảnh có lời thoại.
     - Crossfade mượt mà giữa các phân đoạn BGM để tránh tiếng giật âm thanh.
3. `studio/config.py`:
   - Mở rộng `StudioConfig` với:
     - `bgm_preset: Optional[str] = "cinematic"`
     - `bgm_volume: float = 0.7`
     - `ducking_level: str = "medium"`
     - `voice_volume: float = 1.0`
4. `studio/server.py`:
   - `GET /api/assets/bgm`: Trả về danh sách BGM tracks.
   - `GET /api/assets/bgm/{file_name}`: Phát nhạc nền trực tiếp cho trình duyệt nghe thử.
   - `POST /api/assets/bgm/upload`: Tải lên file nhạc MP3 tùy chỉnh.
   - Cập nhật `ProduceRequest` và `AssembleMasterRequest`.
5. `web/src/`:
   - Mở rộng types (`BgmTrackItem`, cập nhật `ProductionFormData`, `AssembleMasterParams`).
   - Thêm query hooks `useBgmTracks()`, `useUploadBgm()`.
   - Nâng cấp `ProductionForm.tsx`: Card "Multi-Track Audio & BGM Mixer" cho phép chọn bài nhạc, bấm nút nghe thử (Play/Pause), chỉnh thanh trượt BGM volume và độ sâu Auto-Ducking.
   - Nâng cấp `StoryboardView.tsx`: Cho phép điều chỉnh BGM & Auto-Ducking khi xuất bản master movie.

**Tech Stack:** Python 3.11, pydub, FFmpeg (amix, loudnorm, crossfade), FastAPI, React 18, TypeScript, Tailwind CSS, Pytest.

---

## Global Constraints
- Toàn bộ 118 unit/integration tests hiện tại PHẢI tiếp tục PASS 100% (không gây bất kỳ lỗi hồi quy nào).
- Luôn giữ tính tương thích ngược cho `build_master_audio()` với các tham số mặc định.
- Giao diện Vite build bundle giữ ở mức tối ưu (< 225 kB).

---

## Tasks

### Task 1: Module BGM Catalog & Thuật Toán Auto-Ducking (`studio/audio_assets.py`, `studio/assembly.py`)
- [x] **Step 1: Viết test cho BGM Catalog và Auto-Ducking**
  Tạo `tests/test_audio_mixer.py` kiểm tra:
  - `get_bgm_catalog()` trả về danh sách đầy đủ BGM tracks với name, genre, mood.
  - `build_master_audio()` với các mức `ducking_level`: `none`, `light`, `medium`, `heavy`.
  - BGM hạ âm lượng khi shot có dialogue và giữ nguyên khi shot im lặng.
  - `bgm_volume` điều chỉnh âm lượng tổng thể của nhạc nền chính xác.
- [x] **Step 2: Chạy test xác nhận test fail**
  Chạy `docker compose run --rm studio -m pytest tests/test_audio_mixer.py`.
- [x] **Step 3: Hiện thực `BGM_CATALOG` và `get_bgm_catalog` trong `studio/audio_assets.py`**
- [x] **Step 4: Nâng cấp `build_master_audio()` trong `studio/assembly.py`**
- [x] **Step 5: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_audio_mixer.py`.

---

### Task 2: Cấu Hình Hệ Thống & Tương Thích Ngược (`studio/config.py`, `tests/test_assembly.py`)
- [x] **Step 1: Mở rộng `StudioConfig` trong `studio/config.py`**
  Thêm `bgm_preset`, `bgm_volume`, `ducking_level`, `voice_volume`.
- [x] **Step 2: Chạy test kiểm tra hồi quy trong `tests/test_assembly.py`**
  Chạy `docker compose run --rm studio -m pytest tests/test_assembly.py`.

---

### Task 3: API Endpoints BGM Streaming & Upload (`studio/server.py`)
- [x] **Step 1: Viết test cho API audio endpoints trong `tests/test_server.py`**
  - `test_get_bgm_catalog_endpoint()`: `GET /api/assets/bgm`.
  - `test_serve_bgm_endpoint()`: `GET /api/assets/bgm/cinematic.mp3`.
  - `test_upload_bgm_endpoint()`: `POST /api/assets/bgm/upload`.
- [x] **Step 2: Hiện thực API endpoints trong `studio/server.py`**
  - Đăng ký `GET /api/assets/bgm`.
  - Đăng ký `GET /api/assets/bgm/{file_name}`.
  - Đăng ký `POST /api/assets/bgm/upload`.
  - Cập nhật `ProduceRequest` và `AssembleMasterRequest`.
- [x] **Step 3: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_server.py -k bgm`.

---

### Task 4: Giao Diện Người Dùng & BGM Audio Player (`ProductionForm.tsx` & `StoryboardView.tsx`)
- [x] **Step 1: Cập nhật types & API client frontend**
  - Thêm `BgmTrackItem` trong `web/src/types/index.ts`.
  - Thêm `fetchBgmTracks()`, `uploadCustomBgm()` trong `web/src/api/studio.ts`.
  - Thêm hook `useBgmTracks()`, `useUploadBgm()` trong `web/src/api/queries.ts`.
- [x] **Step 2: Nâng cấp Card Âm Nhạc Trong `ProductionForm.tsx`**
  - Selector danh sách nhạc nền BGM điện ảnh kèm Play/Pause preview.
  - Slider điều chỉnh âm lượng BGM (0% - 150%).
  - Selector độ sâu Auto-Ducking: Tắt, Nhẹ (-6dB), Tiêu chuẩn (-12dB, Khuyên dùng), Sâu (-18dB).
  - Nút tải lên file MP3 tùy chỉnh.
- [x] **Step 3: Cập nhật Storyboard Master Assembly Modal**
  - Bổ sung tùy chọn tinh chỉnh BGM và Auto-Ducking khi xuất bản master phim.
- [x] **Step 4: Build frontend kiểm tra lỗi TypeScript**
  Chạy `npm run build` trong `web/`.

---

### Task 5: Kiểm Tra Toàn Diện & Nghiệm Thu
- [x] Chạy toàn bộ backend test suite (`pytest tests/`) xác nhận 100% pass (122 tests).
- [x] Khởi động lại container UI và kiểm tra live endpoint `GET /api/assets/bgm`.
- [x] Báo cáo kết quả chi tiết cho người dùng.
