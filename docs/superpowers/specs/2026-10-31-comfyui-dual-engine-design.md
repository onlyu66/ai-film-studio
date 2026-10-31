# Design Specification: ComfyUI Dual Engine Hub (Image & Video)

**Document Path:** `docs/superpowers/specs/2026-10-31-comfyui-dual-engine-design.md`  
**Date:** 2026-10-31  
**Status:** Approved for Implementation Planning  
**Target Modules:**  
- Backend: `studio/comfyui/client.py`, `studio/comfyui/mapper.py`, `studio/routers/comfyui.py`, `studio/image_providers.py`, `studio/video.py`
- Frontend: `web/src/components/ComfyUIModal.tsx`, `web/src/components/StoryboardView.tsx`, `web/src/types/index.ts`

---

## 1. Intent & The Why

### Context
AI Film Studio hiện tại hỗ trợ sinh ảnh qua Pollinations Flux (Cloud API) và sinh chuyển động 2.5D qua FFmpeg Ken Burns CPU. Tuy nhiên, người dùng sở hữu card đồ họa NVIDIA chuyên dụng (RTX 3060/4070/4090/A100) mong muốn tận dụng toàn bộ sức mạnh phần cứng cục bộ thông qua **ComfyUI** để:
1. Sinh hình ảnh sắc nét, ánh sáng điện ảnh chân thực với các model mạnh nhất (Flux.1 Schnell/Dev, SDXL, LoRA tùy biến khuôn mặt/trang phục).
2. Sinh chuyển động video AI mượt mà (Image-to-Video với AnimateDiff, Wan 2.1, SVD) thay vì chỉ zoom/pan 2.5D.
3. Hoạt động độc lập 100% offline không phụ thuộc rate limit hay mạng Internet.

### Goal
Xây dựng **ComfyUI Dual Engine Hub**: Biến ComfyUI thành một động cơ xử lý song song hai vai trò độc lập (sinh ảnh phân cảnh và sinh hoạt cảnh video), hỗ trợ cả thư viện workflow tối ưu sẵn và khả năng nạp file workflow JSON tùy biến, kèm khả năng lắng nghe tiến trình lấy mẫu thời gian thực (real-time sampling progress streaming qua WebSocket).

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
* **G-1 (Independent Dual-Engine Capability)**:
  * Hỗ trợ bật/tắt độc lập giữa **Image Engine** (Stage 3) và **Video Engine** (Stage 4).
  * Ví dụ: Dùng ComfyUI Flux cho ảnh nhưng Ken Burns CPU cho video, hoặc Pollinations cho ảnh nhưng ComfyUI Wan 2.1 cho video.
* **G-2 (Built-in + Custom Workflows)**:
  * Đi kèm sẵn 4 workflow mẫu tối ưu: `flux_schnell` (ảnh nhanh), `sdxl_cinematic` (ảnh chân dung/phim), `animatediff_v3` (video chuyển động), `wan2_1_i2v` (video AI tiên tiến).
  * Cho phép người dùng kéo thả nạp file `workflow.json` tùy biến từ ComfyUI và tự động nhận diện node đầu vào/đầu ra.
* **G-3 (Live WebSocket Streaming & Serialization)**:
  * Kết nối WebSocket `/ws?clientId=...` tới ComfyUI để nhận sự kiện `progress` (step, total_steps) và `executed` (ảnh/video hoàn thành).
  * Xếp hàng tuần tự trên GPU (`concurrency = 1`) để tránh tràn VRAM (CUDA OOM).
  * Bắn tiến trình trực tiếp qua WebSocket/SSE của Studio về giao diện người dùng.
* **G-4 (Dynamic Hardware & Model Discovery)**:
  * Tự động quét API `/object_info` của ComfyUI để hiển thị danh sách Checkpoints, LoRAs, VAEs đang cài đặt trên máy người dùng.
  * Tiền kiểm tra (Pre-flight validation) các custom node cần thiết và cảnh báo trực quan nếu máy thiếu node (ví dụ: `VHS_VideoCombine`).
* **G-5 (Graceful Fallback & Fault Tolerance)**:
  * Nếu ComfyUI bị ngắt kết nối hoặc tràn VRAM (CUDA OOM) trong quá trình render tự động cả phim (`/api/produce`), hệ thống tự động chuyển tiếp (fail-over) sang Pollinations Flux / Ken Burns kèm thông báo cảnh báo để không làm dừng bộ phim.
* **G-6 (Dual-Layer Configuration Persistence)**:
  * Hỗ trợ lưu cấu hình làm **Mặc định toàn Studio** (áp dụng cho mọi dự án) HOẶC **Lưu riêng theo từng Dự án** trong `storyboard.json`.

### Non-Goals
* Không nhúng trình soạn thảo đồ thị node (node graph editor) vào Studio; người dùng thiết kế workflow trong giao diện web ComfyUI gốc (`http://localhost:8188`) và xuất file JSON (Save API Format).
* Không can thiệp quản lý việc cài đặt Python, CUDA hay download model của ComfyUI.

### Anti-Goals
* Không làm nghẽn tiến trình FastAPI: Mọi giao tiếp với ComfyUI (HTTP POST prompt, WebSocket stream, download binary) đều là non-blocking asynchronous (`httpx` + `websockets`).
* Không tự ý ghép nối dây node phức tạp ngoài luồng (DAG graph splicing): Áp dụng cơ chế **In-place Mutation** an toàn để đảm bảo tương thích 100% với mọi custom workflow.

---

## 3. Technical Architecture & Component Design

### 3.1. Directory Structure

```
studio/
├── comfyui/
│   ├── __init__.py
│   ├── client.py         # Async REST & WebSocket ComfyUI Client + Progress Listener
│   ├── mapper.py         # In-place Node Graph Parser & Parameter Injector
│   └── workflows/        # Built-in optimized workflow templates (JSON)
│       ├── flux_schnell.json
│       ├── sdxl_cinematic.json
│       ├── animatediff_v3.json
│       └── wan2_1_i2v.json
└── routers/
    └── comfyui.py        # REST API endpoints for frontend
```

### 3.2. In-Place Parameter Mutation (`mapper.py`)

ComfyUI API Format là một dict JSON các node:
```json
{
  "3": { "class_type": "KSampler", "inputs": { "seed": 0, "steps": 20, ... } },
  "6": { "class_type": "CLIPTextEncode", "inputs": { "text": "positive prompt" } },
  "8": { "class_type": "VAEDecode", ... },
  "9": { "class_type": "SaveImage", ... }
}
```

Trình phân tích `SmartNodeMapper` áp dụng cơ chế **In-place Parameter Mutation**:
1. **Positive Prompt**: Tìm node `CLIPTextEncode` nối vào `positive` input của `KSampler` (hoặc `BasicGuider`).
2. **Negative Prompt**: Tìm node `CLIPTextEncode` nối vào `negative` input của `KSampler`.
3. **Seed / Steps / CFG / Denoise**: Trích xuất từ node `KSampler` hoặc `SamplerCustomAdvanced`.
4. **Dimensions**: Node `EmptyLatentImage` (`width`, `height`).
5. **Checkpoint / LoRA**: Nếu workflow có node `CheckpointLoaderSimple` hoặc `LoraLoader`, cập nhật tên model và weight trực tiếp. Nếu không có, giao diện sẽ ẩn/làm mờ tùy chọn tương ứng.
6. **Source Image (cho Img2Img & Image-to-Video)**: Node `LoadImage`.
7. **Output Node**: Node `SaveImage` (ảnh) hoặc `VHS_VideoCombine` / `SaveAnimatedWEBP` (video).

### 3.3. Async ComfyUI Client & Centralized Demultiplexer (`client.py`)

1. **Queue Prompt**:
   - `POST {api_url}/prompt` với payload `{"prompt": workflow, "client_id": client_id}`.
   - Nhận về `prompt_id`.
2. **WebSocket Listener**:
   - Duy trì WebSocket tập trung `ws://{host}:{port}/ws?client_id={client_id}`.
   - Lắng nghe message types:
     - `status`: Hàng đợi ComfyUI còn bao nhiêu job.
     - `executing`: Node nào đang chạy (`node_id`).
     - `progress`: `{"value": step, "max": total_steps}` $\rightarrow$ định tuyến theo `prompt_id` sang `shot_id` và gửi event về UI.
     - `executed`: Kết quả đầu ra (`images` hoặc `videos` filename/subfolder).
3. **GPU Concurrency**:
   - Khi ComfyUI được kích hoạt, batch render chạy tuần tự (`max_workers = 1`) để bảo vệ VRAM.

### 3.4. Backend REST API Endpoints (`routers/comfyui.py`)

* `GET /api/comfyui/status`: Kiểm tra kết nối tới ComfyUI, trả về trạng thái GPU (VRAM used/free), phiên bản ComfyUI, số job đang đợi.
* `GET /api/comfyui/models`: Trả về danh sách checkpoints, LoRAs, VAEs đang có trong thư mục `models/` của ComfyUI.
* `GET /api/comfyui/workflows`: Lấy danh sách workflow có sẵn kèm trạng thái tương thích (compatibility check đối với custom node).
* `POST /api/comfyui/workflows/upload`: Tải lên file JSON workflow mới, tự động validate và lưu vào thư mục lưu trữ custom.
* `GET /api/comfyui/config`: Lấy cấu hình ComfyUI hiện tại (global và active project).
* `POST /api/comfyui/config`: Lưu cấu hình ComfyUI (`is_image_enabled`, `is_video_enabled`, `image_workflow`, `video_workflow`, `save_as_global`).
* `POST /api/comfyui/test`: Thực hiện bài test sinh thử nghiệm (smoke test) với prompt ngắn để xác nhận toàn bộ đường truyền.

### 3.5. Frontend UI Hub (`ComfyUIModal.tsx`)

* **Header**: Đèn trạng thái kết nối (🟢 Đang kết nối / 🔴 Không phản hồi), địa chỉ URL ComfyUI (mặc định `http://127.0.0.1:8188`), nút **Kiểm tra kết nối**.
* **Công tắc kích hoạt độc lập**:
  - `[x] Kích hoạt ComfyUI cho Sinh Ảnh (Image Engine)`
  - `[x] Kích hoạt ComfyUI cho Hoạt Cảnh Video (Video Engine)`
* **Tùy chọn phạm vi lưu trữ**:
  - `( ) Áp dụng riêng cho Dự án này`
  - `( ) Lưu làm Cấu hình Mặc định cho toàn Studio`
* **Tab 1: Sinh Ảnh (Image Engine)**:
  - Chọn Workflow: Flux Schnell / SDXL Cinematic / Custom JSON.
  - Chọn Checkpoint & LoRA từ dropdown danh sách quét tự động.
* **Tab 2: Sinh Video (Video Motion Engine)**:
  - Chọn Workflow: AnimateDiff / Wan 2.1 / SVD.
  - Điều chỉnh số frame (16 - 64 frames), FPS (8 - 24 FPS) và cường độ chuyển động.
* **Tab 3: Quản Lý Workflow Tùy Biến**:
  - Kéo thả file `workflow.json`.
  - Bảng kiểm tra các node được nhận diện và cảnh báo nếu thiếu custom node trên máy.
* **Hiển thị trên StoryboardView**:
  - Khi một cảnh đang được sinh qua ComfyUI, thẻ phân cảnh hiển thị thanh tiến trình trực tiếp `Step 14/20 (70%)` kèm nhãn `ComfyUI Flux` hoặc `ComfyUI Video`.

---

## 4. Architectural Calls Settled (Reviewer & User Calls)

1. **In-place Parameter Mutation**: Chỉ sửa đổi giá trị các node có sẵn trong workflow JSON thay vì tự động tạo thêm dây nối mới (dynamic rewiring). Các điều khiển không tương thích sẽ tự động mờ đi.
2. **GPU Concurrency = 1**: Toàn bộ tiến trình gọi ComfyUI chạy tuần tự để tối ưu VRAM và triệt tiêu nguy cơ CUDA Out-of-Memory.
3. **Tự động Fallback trong Batch Run**: Nếu ComfyUI gặp sự cố khi chạy tự động cả phim, hệ thống tự động chuyển sang Pollinations / Ken Burns và gửi thông báo cảnh báo để không làm gián đoạn bộ phim.
4. **Pre-flight Validation qua `/object_info`**: Kiểm tra trước danh sách node mở rộng và gắn nhãn cảnh báo nếu máy người dùng thiếu node như `VHS_VideoCombine`.
5. **Kích hoạt độc lập Ảnh vs Video**: Người dùng có thể bật ComfyUI cho một trong hai hoặc cả hai động cơ tùy theo cấu hình phần cứng.
6. **Cấu hình 2 tầng (Dual-layer Persistence)**: Cung cấp tùy chọn lưu vào `config.json` (toàn Studio) hoặc lưu vào `storyboard.json` (riêng từng dự án).

---

## 5. UI/UX ASCII Layout

```
+---------------------------------------------------------------------------------------+
|  ⚡ ComfyUI Studio Hub                                                          [✕]   |
+---------------------------------------------------------------------------------------+
|  Địa chỉ ComfyUI: [ http://127.0.0.1:8188            ]  [⚡ Kiểm tra]  🟢 Sẵn sàng    |
|  GPU: NVIDIA GeForce RTX 4070 (8.2 GB / 12.0 GB VRAM Free)                            |
+---------------------------------------------------------------------------------------+
|  KÍCH HOẠT ĐỘC LẬP:                                                                   |
|  [✓] Dùng ComfyUI cho Sinh Ảnh (Stage 3)   [✓] Dùng ComfyUI cho Sinh Video (Stage 4)   |
|                                                                                       |
|  PHẠM VI CẤU HÌNH:                                                                    |
|  (•) Lưu làm mặc định toàn Studio           ( ) Chỉ áp dụng cho Dự án hiện tại        |
+---------------------------------------------------------------------------------------+
|  [ 📸 Ảnh Phân Cảnh ]    [ 🎬 Hoạt Cảnh Video ]    [ 📁 Quản Lý Custom Workflows ]     |
+---------------------------------------------------------------------------------------+
|  Workflow Mẫu:       [ Flux.1 Schnell (Cinematic 4-Step)                           ▼] |
|  Checkpoint Model:   [ flux1-schnell.safetensors                                   ▼] |
|  LoRA Nhân Vật:      [ film_noir_v2.safetensors (Weight: 0.8)                      ▼] |
|  Số bước (Steps):    [ 4  ]      CFG Scale: [ 1.0 ]      Sampler: [ euler          ▼] |
+---------------------------------------------------------------------------------------+
|  Kéo thả file workflow tùy biến (.json ComfyUI API Format):                           |
|  +---------------------------------------------------------------------------------+  |
|  |   📄 Kéo thả file workflow.json vào đây hoặc [Duyệt file trên máy]              |  |
|  +---------------------------------------------------------------------------------+  |
|  Node đã nhận diện:                                                                   |
|  - Node 6 (CLIPTextEncode) -> [Positive Prompt]  ✅ Tự động                            |
|  - Node 3 (KSampler)       -> [Seed & Steps]     ✅ Tự động                            |
|  - Node 9 (SaveImage)      -> [Output Image]     ✅ Tự động                            |
+---------------------------------------------------------------------------------------+
|  [ Huỷ bỏ ]                                               [ Lưu Cấu Hình & Kích Hoạt ] |
+---------------------------------------------------------------------------------------+
```
