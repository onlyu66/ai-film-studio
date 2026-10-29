# Kế Hoạch Triển Khai: Tối Ưu Hóa Render Đa Luồng Linh Hoạt (Dynamic Concurrency) & Tăng Tốc Phần Cứng Thông Minh (Hardware Acceleration)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống điều phối tài nguyên thông minh (Resource & Concurrency Manager) tự động phát hiện phần cứng (CPU cores, RAM, GPU NVENC/VAAPI), tối ưu hóa số lượng worker song song cho từng giai đoạn và cho phép tùy biến trực tiếp từ giao diện để tăng tốc độ render lên 2x - 3x mà không gây quá tải/OOM.

**Architecture:**
1. `studio/hardware.py`: Module tự động phát hiện năng lực phần cứng (CPU cores, RAM khả dụng, NVIDIA GPU NVENC, Intel QSV, VAAPI) và tính toán số worker tối ưu cho từng stage.
2. `studio/config.py`: Mở rộng `StudioConfig` với các tham số `image_concurrency`, `motion_concurrency`, `tts_concurrency`, `hardware_accel`.
3. `studio/images.py` & `studio/motion.py`: Sử dụng bộ điều phối worker động và hỗ trợ bộ mã hóa GPU (`h264_nvenc`) khi có card đồ họa.
4. `studio/server.py`: Endpoint `GET /api/system/hardware` trả về thông số phần cứng & gợi ý tối ưu; nhận cấu hình concurrency trong `ProduceRequest`.
5. `web/src/`: Thêm bảng cài đặt tài nguyên & phần cứng trong `ProductionForm.tsx` (chọn cấu hình Hiệu năng: Tiết kiệm, Cân bằng, Turbo, hoặc Tự động).

**Tech Stack:** Python 3.11, subprocess, os, FFmpeg encoders (`libx264`, `h264_nvenc`), FastAPI, React 18, TypeScript, Tailwind CSS, Pytest.

---

## Global Constraints
- Toàn bộ 83 unit/integration tests hiện tại PHẢI tiếp tục PASS 100%.
- Tự động fallback về CPU `libx264` một cách an toàn nếu máy không có GPU hoặc driver NVENC không tương thích.
- Giao diện Vite build bundle < 200 kB.

---

## Tasks

### Task 1: Module Tự Động Nhận Diện Phần Cứng & Điều Phối Luồng (`studio/hardware.py`)
- [x] **Step 1: Viết test cho Hardware & Concurrency Manager**
  Tạo `tests/test_hardware.py` kiểm tra:
  - `detect_hardware()` phát hiện đúng số CPU cores, RAM, và kiểm tra encoder khả dụng của FFmpeg.
  - `get_optimal_concurrency()` tính toán số worker hợp lý theo cấu hình và tài nguyên (không vượt quá ngưỡng an toàn).
  - `get_ffmpeg_video_encoder()` trả về đúng encoder theo thiết lập (`libx264` hoặc `h264_nvenc`).
- [x] **Step 2: Chạy test xác nhận test fail**
  Chạy `docker compose run --rm studio -m pytest tests/test_hardware.py`.
- [x] **Step 3: Hiện thực `studio/hardware.py`**
  - Hàm `detect_hardware() -> Dict[str, Any]` (CPU, RAM, FFmpeg encoders).
  - Hàm `get_optimal_concurrency(stage: str, config: Optional[StudioConfig] = None) -> int`.
  - Hàm `get_ffmpeg_video_encoder(accel: str = "auto") -> Tuple[str, List[str]]`.
- [x] **Step 4: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_hardware.py`.

---

### Task 2: Tích Hợp Concurrency & GPU Accel Vào Pipeline Core (`studio/config.py`, `studio/images.py`, `studio/motion.py`)
- [x] **Step 1: Mở rộng `StudioConfig` trong `studio/config.py`**
  Thêm các trường `image_concurrency`, `motion_concurrency`, `tts_concurrency`, `hardware_accel`.
- [x] **Step 2: Cập nhật `studio/images.py`**
  Áp dụng số worker từ config hoặc `get_optimal_concurrency("image", config)`.
- [x] **Step 3: Cập nhật `studio/motion.py`**
  Áp dụng số worker từ config hoặc `get_optimal_concurrency("motion", config)` và áp dụng video encoder từ `get_ffmpeg_video_encoder()`.
- [x] **Step 4: Chạy toàn bộ test suite kiểm tra hồi quy**
  Chạy `docker compose run --rm studio -m pytest tests/`.

---

### Task 3: API Endpoint Phần Cứng & Tiếp Nhận Cấu Hình (`studio/server.py`)
- [x] **Step 1: Viết test cho API Hardware trong `tests/test_server.py`**
  - Test `GET /api/system/hardware` trả về status 200, thông tin CPU, RAM, GPU và presets khuyến nghị.
- [x] **Step 2: Hiện thực endpoint trong `studio/server.py`**
  - Đăng ký `GET /api/system/hardware`.
  - Cập nhật `ProduceRequest` nhận `image_concurrency`, `motion_concurrency`, `hardware_accel`.
- [x] **Step 3: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_server.py`.

---

### Task 4: Giao Diện Người Dùng & Điều Chỉnh Tài Nguyên (`ProductionForm.tsx`)
- [x] **Step 1: Cập nhật API client & types frontend**
  Thêm `fetchHardwareInfo()` trong `web/src/api/studio.ts` và hook `useHardwareInfo()` trong `web/src/api/queries.ts`.
- [x] **Step 2: Thêm khu vực Cấu hình Phần cứng & Tốc độ Render trong `ProductionForm.tsx`**
  - Preset trực quan: "Tự động tối ưu", "Tiết kiệm RAM", "Cân bằng điện ảnh", "Turbo Max".
  - Hiển thị badge phần cứng hiện tại (CPU cores, RAM khả dụng, GPU).
- [x] **Step 3: Build frontend kiểm tra lỗi TypeScript**
  Chạy `npm run build` trong `web/`.

---

### Task 5: Kiểm Tra Toàn Diện & Nghiệm Thu
- [x] Chạy toàn bộ backend test suite (`pytest tests/`).
- [x] Khởi động lại container UI và kiểm tra live.
- [x] Báo cáo kết quả chi tiết cho người dùng.
