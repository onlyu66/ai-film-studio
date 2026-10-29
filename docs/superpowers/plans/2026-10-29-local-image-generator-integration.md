# Kế Hoạch Triển Khai: Kết Nối Local AI Image Generator (ComfyUI & Stable Diffusion WebUI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng hệ thống sinh hình ảnh trong AI Film Studio để hỗ trợ trực tiếp các công cụ AI cục bộ chạy trên máy trạm GPU (Stable Diffusion WebUI / Forge / Automatic1111 qua port 7860 và ComfyUI qua port 8188), cho phép sinh ảnh 100% offline, riêng tư, không giới hạn tốc độ và tự động fallback về cloud khi máy không bật server.

**Architecture:**
1. `studio/image_providers.py`: Module trừu tượng hóa các provider sinh ảnh (`BaseImageProvider`, `PollinationsProvider`, `SDWebUIProvider`, `ComfyUIProvider`), cung cấp cơ chế `generate_image()`, `check_health()` và tự động quét các cổng cục bộ (`host.docker.internal` / `127.0.0.1`).
2. `studio/images.py`: Cập nhật `generate_image_for_shot()` để điều phối qua provider được chỉ định trong `StudioConfig.image_engine` và `StudioConfig.image_api_url`, giữ nguyên cơ chế fallback an toàn về cloud/placeholder nếu local server gặp sự cố.
3. `studio/config.py`: Bổ sung các trường `image_engine` ("pollinations", "sd_webui", "comfyui") và `image_api_url`.
4. `studio/server.py`: Đăng ký 2 endpoints:
   - `GET /api/system/image-engines`: Quét và trả về trạng thái trực tiếp của các engine (Cloud, SD WebUI, ComfyUI).
   - `POST /api/settings/test-image-engine`: Kiểm tra kết nối nhanh tới địa chỉ local engine do người dùng nhập.
   - Cập nhật `ProduceRequest` nhận `image_engine` và `image_api_url`.
5. `web/src/`: Thêm khu vực chọn Engine Sinh Ảnh trong `ProductionForm.tsx` kèm badge trạng thái kết nối (Live status dot), kiểm tra URL trực tiếp và lưu cấu hình vào localStorage.

**Tech Stack:** Python 3.11, requests, base64, FastAPI, React 18, TypeScript, Tailwind CSS, Pytest.

---

## Global Constraints
- Toàn bộ 95 unit/integration tests hiện tại PHẢI tiếp tục PASS 100% (không gây bất kỳ lỗi hồi quy nào).
- Luôn có cơ chế Fallback tự động: nếu local server mất kết nối hoặc trả về lỗi, tự động chuyển về cloud provider hoặc fallback photographic để quy trình sản xuất phim không bao giờ bị dừng giữa chừng.
- Giao diện Vite build bundle giữ ở mức tối ưu (< 200 kB).

---

## Tasks

### Task 1: Module Provider Sinh Ảnh & Tích Hợp Local Engines (`studio/image_providers.py`)
- [x] **Step 1: Viết test cho image providers**
  Tạo `tests/test_image_providers.py` kiểm tra:
  - `SDWebUIProvider` sinh ảnh thành công từ base64 mock payload và ghi ra file đích.
  - `ComfyUIProvider` sinh ảnh và kiểm tra health check.
  - `discover_image_engines()` trả về danh sách các engine hợp lệ (`pollinations`, `sd_webui`, `comfyui`).
  - Fallback mechanism hoạt động an toàn khi local engine bị lỗi (trả về False thay vì crash).
- [x] **Step 2: Chạy test xác nhận test fail**
  Chạy `docker compose run --rm studio -m pytest tests/test_image_providers.py`.
- [x] **Step 3: Hiện thực `studio/image_providers.py`**
  - Hiện thực `BaseImageProvider`.
  - Hiện thực `SDWebUIProvider` gọi `/sdapi/v1/txt2img` và giải mã base64.
  - Hiện thực `ComfyUIProvider` gọi `/prompt`, `/history`, và `/view`.
  - Hiện thực `discover_image_engines()`.
- [x] **Step 4: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_image_providers.py`.

---

### Task 2: Tích Hợp Local Providers Vào Core Image Pipeline (`studio/config.py`, `studio/images.py`)
- [x] **Step 1: Mở rộng `StudioConfig` trong `studio/config.py`**
  Thêm `image_engine: str = "pollinations"` và `image_api_url: Optional[str] = None`.
- [x] **Step 2: Cập nhật `generate_image_for_shot()` trong `studio/images.py`**
  - Nếu `engine` hoặc `config.image_engine` là `sd_webui` hoặc `comfyui`, gọi qua local provider tương ứng.
  - Tự động fallback về Pollinations nếu local engine không phản hồi.
- [x] **Step 3: Chạy test kiểm tra hồi quy**
  Chạy `docker compose run --rm studio -m pytest tests/test_images.py`.

---

### Task 3: API Endpoints Trạng Thái Engine & Kiểm Tra Kết Nối (`studio/server.py`)
- [x] **Step 1: Viết test cho API image engines**
  Bổ sung vào `tests/test_server.py`:
  - `test_get_image_engines()`: `GET /api/system/image-engines` trả về danh sách engine.
  - `test_test_image_engine_connection()`: `POST /api/settings/test-image-engine`.
- [x] **Step 2: Hiện thực endpoints trong `studio/server.py`**
  - Đăng ký `GET /api/system/image-engines`.
  - Đăng ký `POST /api/settings/test-image-engine`.
  - Cập nhật `ProduceRequest` và chuyển `image_engine`, `image_api_url` vào `StudioConfig`.
- [x] **Step 3: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_server.py -k image_engine`.

---

### Task 4: Giao Diện Người Dùng & Điều Khiển Engine Trong `ProductionForm.tsx`
- [x] **Step 1: Cập nhật types & API client frontend**
  - Thêm `ImageEngineInfo` trong `web/src/types/index.ts`.
  - Thêm `fetchImageEngines()`, `testImageEngine()` trong `web/src/api/studio.ts`.
  - Thêm hook `useImageEngines()`, `useTestImageEngine()` trong `web/src/api/queries.ts`.
- [x] **Step 2: Thêm bộ chọn Engine Sinh Ảnh trong `ProductionForm.tsx`**
  - Lựa chọn: "Flux Cloud (Pollinations)", "Local SD WebUI / Forge", "Local ComfyUI".
  - Hiển thị chấm trạng thái (Xanh nếu local server online, Vàng/Xám nếu offline).
  - Ô nhập URL tùy biến và nút "Kiểm tra kết nối".
- [x] **Step 3: Build frontend kiểm tra lỗi TypeScript**
  Chạy `npm run build` trong `web/`.

---

### Task 5: Kiểm Tra Toàn Diện & Nghiệm Thu
- [x] Chạy toàn bộ backend test suite (`pytest tests/`) xác nhận 100% pass (dự kiến 100+ tests).
- [x] Khởi động lại container UI và kiểm tra live endpoint `GET /api/system/image-engines`.
- [x] Báo cáo kết quả chi tiết cho người dùng.
