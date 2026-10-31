# Design Specification: ComfyUI Dual Engine Hub (Image & Video)

**Document Path:** `docs/superpowers/specs/2026-10-31-comfyui-dual-engine-design.md`  
**Date:** 2026-10-31  
**Status:** In Review (Brainstorming Phase)  
**Target Modules:**  
- Backend: `studio/comfyui/client.py`, `studio/comfyui/mapper.py`, `studio/routers/comfyui.py`, `studio/image_providers.py`, `studio/video.py`
- Frontend: `web/src/components/ComfyUIModal.tsx`, `web/src/components/StoryboardView.tsx`, `web/src/types/index.ts`

---

## 1. Intent & The Why

### Context
AI Film Studio hiện tại hỗ trợ sinh ảnh qua Pollinations Flux (Cloud API miễn phí) và sinh chuyển động 2.5D qua FFmpeg Ken Burns CPU. Tuy nhiên, người dùng sở hữu card đồ họa NVIDIA chuyên dụng (RTX 3060/4070/4090/A100) mong muốn tận dụng toàn bộ sức mạnh phần cứng cục bộ thông qua **ComfyUI** để:
1. Sinh hình ảnh sắc nét, ánh sáng điện ảnh chân thực với các model mạnh nhất (Flux.1 Schnell/Dev, SDXL, LoRA tùy biến khuôn mặt/trang phục).
2. Sinh chuyển động video AI mượt mà (Image-to-Video với AnimateDiff, Wan 2.1, SVD) thay vì chỉ zoom/pan 2.5D.
3. Hoạt động độc lập 100% offline không phụ thuộc rate limit hay mạng Internet.

### Goal
Xây dựng **ComfyUI Dual Engine Hub**: Biến ComfyUI thành một động cơ xử lý song song hai vai trò (sinh ảnh phân cảnh và sinh chuyển động video), hỗ trợ cả thư viện workflow tối ưu sẵn và khả năng nạp file workflow JSON tùy biến, kèm khả năng lắng nghe tiến trình lấy mẫu thời gian thực (real-time sampling progress streaming qua WebSocket).

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
* **G-1 (Dual-Engine Capability)**:
  * Image Engine: Thực hiện Text-to-Image và Image-to-Image (Stage 3).
  * Video Engine: Thực hiện Image-to-Video (Stage 4) tạo video MP4 3-5s cho từng shot phân cảnh.
* **G-2 (Built-in + Custom Workflows)**:
  * Đi kèm sẵn 4 workflow mẫu tối ưu: `flux_schnell` (ảnh nhanh), `sdxl_cinematic` (ảnh chân dung/phim), `animatediff_v3` (video chuyển động), `wan2_1_i2v` (video AI tiên tiến).
  * Cho phép người dùng kéo thả nạp file `workflow.json` tùy biến từ ComfyUI và tự động nhận diện node đầu vào/đầu ra.
* **G-3 (Live WebSocket Streaming)**:
  * Kết nối WebSocket `/ws?clientId=...` tới ComfyUI để nhận sự kiện `progress` (step, total_steps) và `executed` (ảnh/video hoàn thành).
  * Bắn tiến trình trực tiếp qua WebSocket/SSE của Studio về giao diện người dùng.
* **G-4 (Dynamic Hardware & Model Discovery)**:
  * Tự động quét API `/object_info` của ComfyUI để hiển thị danh sách Checkpoints, LoRAs, VAEs đang cài đặt trên máy người dùng.
* **G-5 (Graceful Fallback & Fault Tolerance)**:
  * Nếu ComfyUI bị ngắt kết nối hoặc tràn VRAM (CUDA OOM), hệ thống tự động cảnh báo rõ ràng và cung cấp tùy chọn chuyển nhanh sang Pollinations Flux / Ken Burns để không gián đoạn tiến độ sản xuất phim.

### Non-Goals
* Không nhúng trình soạn thảo đồ thị node (node graph editor) vào Studio; người dùng thiết kế workflow trong giao diện web ComfyUI gốc (`http://localhost:8188`) và xuất file JSON (Save API Format).
* Không can thiệp quản lý việc cài đặt Python, CUDA hay download model của ComfyUI.

### Anti-Goals
* Không làm nghẽn tiến trình FastAPI: Mọi giao tiếp với ComfyUI (HTTP POST prompt, WebSocket stream, download binary) đều là non-blocking asynchronous (`httpx` + `websockets`).
* Không làm mất cấu trúc Storyboard: Thông tin workflow và model được lưu trữ an toàn trong `storyboard.json` và cấu hình hệ thống.

---

## 3. Technical Architecture & Component Design

### 3.1. Directory Structure

```
studio/
├── comfyui/
│   ├── __init__.py
│   ├── client.py         # Async REST & WebSocket ComfyUI Client
│   ├── mapper.py         # Smart Node Graph Parser & Input Injector
│   └── workflows/        # Built-in optimized workflow templates (JSON)
│       ├── flux_schnell.json
│       ├── sdxl_cinematic.json
│       ├── animatediff_v3.json
│       └── wan2_1_i2v.json
└── routers/
    └── comfyui.py        # REST API endpoints for frontend
```

### 3.2. Smart Node Graph Parser (`mapper.py`)

ComfyUI API Format là một dict JSON các node:
```json
{
  "3": { "class_type": "KSampler", "inputs": { "seed": 0, "steps": 20, ... } },
  "6": { "class_type": "CLIPTextEncode", "inputs": { "text": "positive prompt" } },
  "8": { "class_type": "VAEDecode", ... },
  "9": { "class_type": "SaveImage", ... }
}
```

Trình phân tích `SmartNodeMapper` tự động xác định:
1. **Positive Prompt**: Tìm node `CLIPTextEncode` nối vào `positive` input của `KSampler` (hoặc `BasicGuider`).
2. **Negative Prompt**: Tìm node `CLIPTextEncode` nối vào `negative` input của `KSampler`.
3. **Seed / Steps / CFG / Denoise**: Trích xuất từ node `KSampler` hoặc `SamplerCustomAdvanced`.
4. **Dimensions**: Node `EmptyLatentImage` (`width`, `height`).
5. **Source Image (cho Img2Img & Image-to-Video)**: Node `LoadImage`.
6. **Output Node**: Node `SaveImage` (ảnh) hoặc `VHS_VideoCombine` / `SaveAnimatedWEBP` (video).

Khi chạy, `mapper.inject_parameters(workflow, prompt, seed, width, height, image_path)` sẽ tự động thay thế giá trị tương ứng mà không làm thay đổi các node tinh chỉnh khác (như LoRA, ControlNet, IP-Adapter).

### 3.3. Async ComfyUI Client & WebSocket Listener (`client.py`)

1. **Queue Prompt**:
   - `POST {api_url}/prompt` với payload `{"prompt": workflow, "client_id": client_id}`.
   - Nhận về `prompt_id`.
2. **WebSocket Listener**:
   - Mở kết nối `ws://{host}:{port}/ws?client_id={client_id}`.
   - Lắng nghe message types:
     - `status`: Hàng đợi ComfyUI còn bao nhiêu job.
     - `executing`: Node nào đang chạy (`node_id`).
     - `progress`: `{"value": step, "max": total_steps}` $\rightarrow$ gửi SSE event về Studio UI.
     - `executed`: Kết quả đầu ra (`images` hoặc `videos` filename/subfolder).
3. **Download Result**:
   - `GET {api_url}/view?filename={filename}&subfolder={subfolder}&type={type}` tải file kết quả và ghi vào `outputs/images/` hoặc `outputs/videos/`.

### 3.4. Backend REST API Endpoints (`routers/comfyui.py`)

* `GET /api/comfyui/status`: Kiểm tra kết nối tới ComfyUI, trả về trạng thái GPU (VRAM used/free), phiên bản ComfyUI, số job đang đợi.
* `GET /api/comfyui/models`: Trả về danh sách checkpoints, LoRAs, VAEs đang có trong thư mục `models/` của ComfyUI.
* `GET /api/comfyui/workflows`: Lấy danh sách workflow có sẵn (built-in và custom đã nạp).
* `POST /api/comfyui/workflows/upload`: Tải lên file JSON workflow mới, tự động validate và lưu vào thư mục lưu trữ custom.
* `POST /api/comfyui/test`: Thực hiện một bài test sinh thử nghiệm (smoke test) với prompt ngắn để xác nhận toàn bộ đường truyền hoạt động trơn tru.

### 3.5. Frontend UI Hub (`ComfyUIModal.tsx`)

* **Header**: Đèn trạng thái kết nối (🟢 Đang kết nối / 🔴 Không phản hồi), địa chỉ URL ComfyUI (mặc định `http://127.0.0.1:8188`), nút **Kiểm tra kết nối**.
* **Tab 1: Sinh Ảnh (Image Engine)**:
  - Chọn Workflow: Flux Schnell / SDXL Cinematic / Custom JSON.
  - Chọn Checkpoint & LoRA từ dropdown danh sách quét tự động.
  - Điều chỉnh Steps (15 - 30) & Denoise.
* **Tab 2: Sinh Video (Video Motion Engine)**:
  - Chọn Workflow: AnimateDiff / Wan 2.1 / SVD.
  - Điều chỉnh số frame (16 - 64 frames), FPS (8 - 24 FPS) và cường độ chuyển động (Motion Scale).
* **Tab 3: Quản Lý Workflow Tùy Biến**:
  - Kéo thả file `workflow.json`.
  - Bảng kiểm tra các node được nhận diện (Prompt node, Seed node, Image Input node, Output node).
* **Hiển thị trên StoryboardView**:
  - Khi một cảnh đang được sinh qua ComfyUI, thẻ phân cảnh hiển thị thanh tiến trình trực tiếp `Step 14/20 (70%)` kèm nhãn `ComfyUI Flux`.

---

## 4. Architectural Calls Settled (Reviewer Check Calls)

1. **Giao tiếp WebSocket Client-Side vs Backend-Side**:
   - Backend Python đóng vai trò là WebSocket client kết nối với ComfyUI và chuyển tiếp (relay) qua SSE / WebSocket của Studio tới trình duyệt. Điều này giải quyết triệt để vấn đề CORS, xác thực mạng LAN và đảm bảo tiến trình render không bị ngắt quãng nếu người dùng lỡ refresh trang web.
2. **Khả năng tương thích Custom Workflow**:
   - Sử dụng thuật toán heuristic thông minh dựa trên `class_type` để tự động gán tham số. Nếu workflow có cấu trúc quá đặc biệt không thể tự nhận diện, giao diện cung cấp màn hình gán node trực quan (Node Selector Mapping) để người dùng tự chỉ định node Prompt và node Output một lần duy nhất.
3. **Hỗ trợ video định dạng ComfyUI**:
   - Hỗ trợ cả node chuẩn `SaveImage` (chuỗi frame PNG) lẫn custom node phổ biến `VHS_VideoCombine` (Video Helper Suite - xuất trực tiếp file MP4/WebM).

---

## 5. UI/UX ASCII Layout

```
+---------------------------------------------------------------------------------------+
|  ⚡ ComfyUI Studio Hub                                                          [✕]   |
+---------------------------------------------------------------------------------------+
|  Địa chỉ ComfyUI: [ http://127.0.0.1:8188            ]  [⚡ Kiểm tra]  🟢 Sẵn sàng    |
|  GPU: NVIDIA GeForce RTX 4070 (8.2 GB / 12.0 GB VRAM Free)                            |
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
