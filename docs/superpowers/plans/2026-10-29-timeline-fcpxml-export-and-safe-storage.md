# Triển Khai Xuất Timeline FCPXML (Premiere/DaVinci) & Lưu Trữ An Toàn Atomic Storage

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống xuất timeline chuyên nghiệp sang Apple Final Cut Pro / Adobe Premiere Pro / DaVinci Resolve (FCPXML 1.8) đa rãnh và cơ chế lưu trữ dữ liệu an toàn nguyên tử (Atomic File Storage & Rolling Backups) chống xung đột ghi file.

**Architecture:**
1. `studio/storage.py`: Cung cấp cơ chế `atomic_write_json`, `safe_read_json`, thread locking và auto-backup xoay vòng 3 phiên bản, thay thế toàn bộ thao tác ghi thô vào `storyboard.json` và `state.json`.
2. `studio/export_fcpxml.py`: Sử dụng thư viện chuẩn `xml.etree.ElementTree` để xây dựng cấu trúc FCPXML v1.8 tiêu chuẩn, ánh xạ toàn bộ 4 rãnh: Video clips, Voiceover TTS, Sound Effects (SFX), BGM và Text Titles.
3. `studio/server.py`: Bổ sung 2 endpoints `GET /api/storyboard/export-timeline` và `GET /api/projects/{project_id}/export-timeline`.
4. `web/src/`: Tích hợp các nút xuất timeline chuyên nghiệp trên `TimelineScrubber`, `StoryboardView`, và `ProjectLibraryModal`.

**Tech Stack:** Python 3.11, xml.etree.ElementTree, fcntl, FastAPI, React 18, TypeScript, Tailwind CSS, TanStack Query, Pytest.

---

## Global Constraints
- Tất cả 63 unit/integration tests hiện tại PHẢI tiếp tục PASS (không gây bất kỳ lỗi hồi quy nào).
- Giao diện Vite build bundle giữ ở mức tối ưu (< 200 kB).
- Tuyệt đối không xóa hoặc làm hỏng thư mục `outputs/projects/`.
- FCPXML sinh ra phải tương thích 100% với DaVinci Resolve và Adobe Premiere Pro (timecode dạng `frame/fps` hoặc `seconds`, XML schema hợp lệ).

---

## Tasks

### Task 1: Module Lưu Trữ An Toàn Nguyên Tử (`studio/storage.py`)
- [x] **Step 1: Viết test cho atomic write & safe persistence**
  Tạo `tests/test_storage.py` kiểm tra:
  - `atomic_write_json` ghi file thành công.
  - Multi-threading concurrency (10 threads ghi đồng thời) không làm corrupt file.
  - Tự động tạo backup khi ghi đè.
  - `safe_read_json` xử lý mượt mà khi file chưa tồn tại hoặc bị lỗi.
- [x] **Step 2: Chạy test để xác nhận test fail**
  Chạy `docker compose run --rm studio -m pytest tests/test_storage.py` (chưa có module -> fail).
- [x] **Step 3: Hiện thực `studio/storage.py`**
  - Hàm `atomic_write_json(file_path: Path, data: Any, backup: bool = True) -> bool` dùng temp file + `os.replace` + `threading.Lock`.
  - Hàm `safe_read_json(file_path: Path, default: Any = None) -> Any`.
  - Cơ chế xoay vòng backup `.bak1`, `.bak2`.
- [x] **Step 4: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_storage.py`.
- [x] **Step 5: Tích hợp `studio/storage.py` vào `studio/server.py`, `studio/storyboard.py`, `studio/orchestrator.py`**
  Thay thế các thao tác `with open(..., "w") as f: json.dump` bằng `atomic_write_json`.
- [x] **Step 6: Chạy toàn bộ test suite kiểm tra hồi quy**
  Chạy `docker compose run --rm studio -m pytest tests/`.

---

### Task 2: Module Xuất Timeline FCPXML Chuyên Nghiệp (`studio/export_fcpxml.py`)
- [x] **Step 1: Viết test cho FCPXML generation**
  Tạo `tests/test_export_fcpxml.py` kiểm tra:
  - Sinh XML hợp lệ parse được bằng `xml.etree.ElementTree.fromstring`.
  - Có đầy đủ `<resources>`, `<format>`, `<asset>`, `<sequence>`, `<spine>`.
  - Các clip video, audio voiceover, sfx và bgm được tính toán đúng offset timecode và duration.
  - Hỗ trợ cả tỉ lệ 16:9 và 9:16.
- [x] **Step 2: Chạy test để xác nhận test fail**
  Chạy `docker compose run --rm studio -m pytest tests/test_export_fcpxml.py`.
- [x] **Step 3: Hiện thực `studio/export_fcpxml.py`**
  - Xây dựng cấu trúc FCPXML v1.8 chuẩn công nghiệp.
  - Tính toán timecode phân cảnh dựa trên `durations` thực tế.
  - Gắn audio volume (hệ số `voice_volume`, `sfx_volume`).
  - Gắn metadata lời thoại vào subtitle/title tracks.
- [x] **Step 4: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_export_fcpxml.py`.

---

### Task 3: API Endpoints Xuất Timeline trong FastAPI (`studio/server.py`)
- [x] **Step 1: Viết test cho API endpoints**
  Bổ sung vào `tests/test_server.py`:
  - `GET /api/storyboard/export-timeline` trả về file `.fcpxml` tải xuống với status 200 và XML payload.
  - `GET /api/projects/{project_id}/export-timeline` tải timeline của project lưu trữ.
- [x] **Step 2: Chạy test để xác nhận test fail**
  Chạy `docker compose run --rm studio -m pytest tests/test_server.py -k export_timeline`.
- [x] **Step 3: Đăng ký API endpoints trong `studio/server.py`**
  - Endpoint `GET /api/storyboard/export-timeline`.
  - Endpoint `GET /api/projects/{project_id}/export-timeline`.
- [x] **Step 4: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_server.py`.

---

### Task 4: Giao Diện Người Dùng & Tích Hợp Nút Xuất Timeline
- [x] **Step 1: Cập nhật API client frontend**
  Bổ sung hàm helper tải file timeline trong `web/src/api/studio.ts`.
- [x] **Step 2: Tích hợp nút xuất timeline trên `TimelineScrubber.tsx`**
  Thêm nút `🎬 Xuất Timeline (FCPXML / Premiere)` trên thanh công cụ đa rãnh.
- [x] **Step 3: Tích hợp nút xuất timeline trên `StoryboardView.tsx`**
  Bổ sung lựa chọn xuất XML bên cạnh nút Xuất bản Master Movie.
- [x] **Step 4: Tích hợp nút xuất timeline trong `ProjectLibraryModal.tsx`**
  Cho phép người dùng tải file FCPXML của bất kỳ project cũ nào trong kho lưu trữ.
- [x] **Step 5: Kiểm tra build Frontend**
  Chạy `npm run build` trong `web/` để xác nhận 0 lỗi TypeScript và bundle tối ưu.

---

### Task 5: Kiểm Tra Toàn Diện & Hoàn Thiện
- [x] Chạy toàn bộ backend test suite (`pytest tests/`).
- [x] Khởi động lại container UI và kiểm tra file tải về.
- [x] Tổng kết và báo cáo kết quả cho người dùng.
