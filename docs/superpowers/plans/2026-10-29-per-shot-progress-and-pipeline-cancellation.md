# Kế Hoạch Triển Khai: Giám Sát Tiến Độ Phân Cảnh (Per-Shot Live Progress) & Dừng/Hủy Tác Vụ (Pipeline Cancellation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiện thực cơ chế giám sát tiến độ thời gian thực chi tiết theo từng phân cảnh qua WebSocket và cung cấp khả năng dừng/hủy an toàn tiến trình sản xuất phim đang chạy (Cancel/Stop Pipeline) từ Backend đến Giao diện Người dùng.

**Architecture:**
1. `studio/orchestrator.py`: Định nghĩa `PipelineCancelledException` và tham số `cancel_event: threading.Event`. Kiểm tra hủy trước và trong các vòng lặp xử lý phân cảnh của 5 giai đoạn.
2. `studio/tts.py`, `studio/images.py`, `studio/motion.py`: Truyền thông tin phân cảnh chi tiết (`shot_id`, `current_shot_index`, `shots_total`, `action`) vào callback tiến độ và kiểm tra `cancel_event` để dừng sớm các tác vụ song song.
3. `studio/server.py`: Quản lý `_cancel_event`, mở rộng `pipeline_state` với metadata phân cảnh đang chạy, xử lý ngoại lệ dừng an toàn và cung cấp endpoint `POST /api/pipeline/cancel`.
4. `web/src/`: Cập nhật kiểu dữ liệu `StudioStatus`, thêm API mutation `useCancelPipeline()`, hiển thị huy hiệu phân cảnh trực tiếp và nút "Dừng tiến trình" trên `ProgressStage` và `Navbar`.

**Tech Stack:** Python 3.11, FastAPI, WebSocket, threading.Event, React 18, TypeScript, Framer Motion, TanStack Query, Pytest.

---

## Global Constraints
- Toàn bộ 75 unit/integration tests hiện tại PHẢI tiếp tục PASS 100%.
- Không để xảy ra race condition hay zombie thread khi người dùng hủy tiến trình.
- Khi hủy tiến trình, trạng thái hệ thống phải trở về `idle` an toàn và giữ nguyên thư mục `outputs/projects/`.
- Giao diện Vite build bundle < 200 kB.

---

## Tasks

### Task 1: Module Hủy An Toàn & Chi Tiết Tiến Độ Trong Pipeline Core (`studio/orchestrator.py`, `studio/tts.py`, `studio/images.py`, `studio/motion.py`)
- [x] **Step 1: Viết test cho Pipeline Cancellation & Per-shot Progress**
  Tạo `tests/test_cancellation.py` kiểm tra:
  - `PipelineCancelledException` được ném ra khi `cancel_event.set()`.
  - `run_pipeline` dừng ngay lập tức khi phát hiện `cancel_event.is_set()`.
  - `run_tts_stage`, `run_image_stage`, `run_motion_stage` dừng không chạy các shot tiếp theo khi bị hủy.
  - Callback nhận đủ metadata phân cảnh: `shot_id`, `shot_idx`, `shots_total`, `action`.
- [x] **Step 2: Chạy test để xác nhận test fail**
  Chạy `docker compose run --rm studio -m pytest tests/test_cancellation.py`.
- [x] **Step 3: Hiện thực `PipelineCancelledException` và kiểm tra `cancel_event`**
  - Trong `studio/orchestrator.py`: Thêm `PipelineCancelledException`, nhận `cancel_event`, truyền xuống các stage.
  - Trong `studio/tts.py`: Thêm kiểm tra `cancel_event` trong `run_tts_stage` và truyền `shot_id`, `shot_idx`, `shots_total`, `action` vào callback.
  - Trong `studio/images.py`: Thêm kiểm tra `cancel_event` trong `run_image_stage` và truyền metadata shot.
  - Trong `studio/motion.py`: Thêm kiểm tra `cancel_event` trong `run_motion_stage` và truyền metadata shot.
- [x] **Step 4: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_cancellation.py`.

---

### Task 2: API Endpoints Dừng Tác Vụ & Mở Rộng State Trong FastAPI (`studio/server.py`)
- [x] **Step 1: Viết test cho Endpoint Cancel & Status Metadata**
  Bổ sung vào `tests/test_server.py`:
  - `POST /api/pipeline/cancel` khi không có tác vụ nào chạy -> trả về `success: False`.
  - `POST /api/pipeline/cancel` khi tác vụ đang chạy -> kích hoạt `_cancel_event.set()` và trả về `success: True`.
  - `GET /api/status` trả về đầy đủ các trường `can_cancel`, `current_shot_id`, `current_shot_index`, `shots_total`, `active_action`.
- [x] **Step 2: Chạy test xác nhận test fail**
  Chạy `docker compose run --rm studio -m pytest tests/test_server.py -k "test_cancel"`.
- [x] **Step 3: Hiện thực API và xử lý hủy trong `studio/server.py`**
  - Khai báo `_cancel_event = threading.Event()`.
  - Bổ sung `POST /api/pipeline/cancel` và alias `POST /api/cancel`.
  - Bắt `PipelineCancelledException` trong `execute_pipeline_task` để hoàn nguyên trạng thái về `idle` và broadcast WebSocket.
  - Cập nhật `get_status()` trả về các trường tiến độ chi tiết.
- [x] **Step 4: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_server.py`.

---

### Task 3: Giao Diện Người Dùng & Nút Dừng Tác Vụ Thời Gian Thực
- [x] **Step 1: Cập nhật Types & API Client**
  - Mở rộng `StudioStatus` trong `web/src/types/index.ts`.
  - Thêm `cancelPipeline()` trong `web/src/api/studio.ts`.
  - Thêm `useCancelPipeline()` trong `web/src/api/queries.ts`.
- [x] **Step 2: Cập nhật `ProgressStage.tsx`**
  - Hiển thị thông tin phân cảnh đang xử lý chi tiết (ví dụ: `Đang vẽ ảnh phân cảnh 2/5 (shot_001_002)...`).
  - Thêm nút **"Dừng tác vụ" (Cancel)** nổi bật với hiệu ứng cảnh báo và xác nhận trước khi hủy.
- [x] **Step 3: Cập nhật `Navbar.tsx`**
  - Khi pipeline `running`, hiển thị nút Dừng nhanh gọn trên thanh điều hướng.
- [x] **Step 4: Kiểm tra build Frontend**
  Chạy `npm run build` trong `web/` để xác nhận 0 lỗi TypeScript và bundle tối ưu.

---

### Task 4: Kiểm Tra Toàn Diện & Nghiệm Thu
- [x] Chạy toàn bộ backend test suite (`pytest tests/`).
- [x] Khởi động lại container UI và kiểm tra live qua curl / websocket.
- [x] Báo cáo kết quả chi tiết cho người dùng.
- [ ] Khởi động lại container UI và kiểm tra live qua curl / websocket.
- [ ] Báo cáo kết quả chi tiết cho người dùng.
