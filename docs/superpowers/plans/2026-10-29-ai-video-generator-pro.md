# Kế Hoạch Triển Khai: Nâng Cấp AI Video Generator Pro (Replicate Wan 2.1 / Minimax / CogVideoX / Luma)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp toàn diện engine sinh video chuyển động AI (Image-to-Video) trong AI Film Studio bằng cơ chế polling bất đồng bộ mạnh mẽ, hỗ trợ các model video AI hàng đầu thế giới (Wan 2.1, Minimax Video-01, Kling 1.6, Stable Video Diffusion) qua Replicate API, cho phép nhập token & chọn model trực tiếp trên UI, và tự động fallback về Ken Burns 2.5D an toàn khi thiếu token hoặc gặp lỗi quota.

**Architecture:**
1. `studio/video_providers.py`: Module quản lý Image-to-Video provider (`ReplicateVideoProvider`, `BaseVideoProvider`), xử lý tạo prediction, polling bất đồng bộ (`starting` -> `processing` -> `succeeded`), tải stream video MP4 và cắt/ghép thời lượng chính xác theo `shot.duration`.
2. `studio/motion.py`: Tích hợp `ReplicateVideoProvider` vào `render_motion_clip()`, tiếp nhận `video_api_token` và `video_model`, tự động fallback về Ken Burns có tăng tốc phần cứng nếu video provider thất bại.
3. `studio/config.py`: Mở rộng `StudioConfig` với `video_api_token: Optional[str] = None` và `video_model: str = "wan-video/wan-2.1-i2v-480p"`.
4. `studio/server.py`: Đăng ký 2 endpoints:
   - `GET /api/system/video-models`: Trả về danh sách các model I2V được hỗ trợ kèm thông số kỹ thuật.
   - `POST /api/settings/test-video-token`: Xác thực token Replicate qua endpoint `/v1/account`.
   - Cập nhật `ProduceRequest` và `RenderShotVideoRequest` để hỗ trợ sinh video AI cho toàn bộ phim hoặc từng shot riêng biệt.
5. `web/src/`: Thêm card cấu hình Replicate Video trong `ProductionForm.tsx` (nhập token, chọn model, test token) và tích hợp tùy chọn render AI Video ngay trong Shot Studio Modal ([`StoryboardView.tsx`](file:///home/hieunv1/Documents/ai-film-studio/web/src/components/StoryboardView.tsx)).

**Tech Stack:** Python 3.11, requests, FFmpeg, FastAPI, React 18, TypeScript, Tailwind CSS, Pytest.

---

## Global Constraints
- Toàn bộ 103 unit/integration tests hiện tại PHẢI tiếp tục PASS 100% (không gây bất kỳ lỗi hồi quy nào).
- Luôn có cơ chế Fallback tự động: nếu API Token không hợp lệ, hết credit hoặc timeout, hệ thống lập tức fallback về Ken Burns 2.5D mượt mà để video phim luôn được render hoàn chỉnh.
- Giao diện Vite build bundle giữ ở mức tối ưu (< 200 kB).

---

## Tasks

### Task 1: Module AI Video Provider & Polling Bất Đồng Bộ (`studio/video_providers.py`)
- [x] **Step 1: Viết test cho video provider**
  Tạo `tests/test_video_providers.py` kiểm tra:
  - `ReplicateVideoProvider` khởi tạo prediction và poll trạng thái từ `processing` sang `succeeded`.
  - Tải file video MP4 từ URL trả về và ghi thành công ra đĩa.
  - Xử lý timeout và lỗi API mà không gây crash (trả về False an toàn).
  - `check_health()` xác thực token Replicate.
  - `get_available_video_models()` trả về danh sách các model hợp lệ (Wan 2.1, Minimax, Kling, SVD).
- [x] **Step 2: Chạy test xác nhận test fail**
  Chạy `docker compose run --rm studio -m pytest tests/test_video_providers.py`.
- [x] **Step 3: Hiện thực `studio/video_providers.py`**
  - Hiện thực `BaseVideoProvider`.
  - Hiện thực `ReplicateVideoProvider` với prediction creation, async polling loop, và video downloading.
  - Hiện thực `check_replicate_token()`.
  - Định nghĩa danh mục `AI_VIDEO_MODELS`.
- [x] **Step 4: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_video_providers.py`.

---

### Task 2: Tích Hợp Vào Core Motion Pipeline (`studio/config.py`, `studio/motion.py`)
- [x] **Step 1: Mở rộng `StudioConfig` trong `studio/config.py`**
  Thêm `video_api_token: Optional[str] = None` và `video_model: str = "wan-video/wan-2.1-i2v-480p"`.
- [x] **Step 2: Nâng cấp `studio/motion.py`**
  - Cập nhật `_render_replicate_i2v()` sử dụng `ReplicateVideoProvider`.
  - Truyền `video_api_token` và `video_model` từ `config`.
  - Đảm bảo fallback về Ken Burns nếu video generator thất bại.
- [x] **Step 3: Chạy test kiểm tra hồi quy**
  Chạy `docker compose run --rm studio -m pytest tests/test_motion.py`.

---

### Task 3: API Endpoints Danh Sách Model & Xác Thực Token (`studio/server.py`)
- [x] **Step 1: Viết test cho API video endpoints**
  Bổ sung vào `tests/test_server.py`:
  - `test_get_video_models()`: `GET /api/system/video-models`.
  - `test_test_video_token()`: `POST /api/settings/test-video-token`.
- [x] **Step 2: Hiện thực API endpoints trong `studio/server.py`**
  - Đăng ký `GET /api/system/video-models`.
  - Đăng ký `POST /api/settings/test-video-token`.
  - Cập nhật `ProduceRequest` nhận `video_api_token` và `video_model`.
  - Cập nhật `RenderShotVideoRequest` hỗ trợ chọn engine `replicate`.
- [x] **Step 3: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_server.py -k video`.

---

### Task 4: Giao Diện Người Dùng & Cấu Hình AI Video Trong `ProductionForm.tsx` & `StoryboardView.tsx`
- [x] **Step 1: Cập nhật types & API client frontend**
  - Thêm `VideoModelItem` trong `web/src/types/index.ts`.
  - Thêm `fetchVideoModels()`, `testVideoToken()` trong `web/src/api/studio.ts`.
  - Thêm hook `useVideoModels()`, `useTestVideoToken()` trong `web/src/api/queries.ts`.
- [x] **Step 2: Thêm card cấu hình AI Video trong `ProductionForm.tsx`**
  - Hiển thị khi chọn "Chuyển động máy quay: Replicate AI Video".
  - Input nhập Replicate API Token với chế độ ẩn/hiện và lưu vào `localStorage`.
  - Dropdown chọn Model (Wan 2.1, Minimax, Kling, SVD).
  - Nút "Kiểm tra Token" với thông báo trạng thái.
- [x] **Step 3: Cập nhật Shot Studio Modal trong `StoryboardView.tsx`**
  - Cho phép người dùng chọn render bằng Ken Burns hoặc AI Video khi bấm "Tạo Clip Video".
- [x] **Step 4: Build frontend kiểm tra lỗi TypeScript**
  Chạy `npm run build` trong `web/`.

---

### Task 5: Kiểm Tra Toàn Diện & Nghiệm Thu
- [x] Chạy toàn bộ backend test suite (`pytest tests/`) xác nhận 100% pass (110 passed, 0 failed).
- [x] Khởi động lại container UI và kiểm tra live endpoint `GET /api/system/video-models` & `POST /api/settings/test-video-token`.
- [x] Báo cáo kết quả chi tiết cho người dùng.
