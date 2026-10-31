# Kế Hoạch Triển Khai: Tích Hợp Provider Kling / Luma Video & Bộ Điều Khiển Quỹ Đạo Camera 3D (Hướng 1.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp trực tiếp hai nền tảng sinh AI Video điện ảnh hàng đầu thế giới (**Kling AI** và **Luma Dream Machine**) kết hợp **Bộ điều khiển quỹ đạo Camera 3D (3D Camera Trajectory Controller)** tương tác trực quan, cho phép đạo diễn tùy chỉnh đường bay máy quay 3D (Vertigo Dolly Zoom, Orbit 360°, Spiral Crane, Roll Dive, Bullet Time) và render video clip chân thực từ hình ảnh phân cảnh.

**Architecture:** Mở rộng kiến trúc *Video Provider Strategy Pattern* tại backend ([`studio/video_providers.py`](file:///home/hieunv1/Documents/ai-film-studio/studio/video_providers.py)) với `KlingDirectVideoProvider` và `LumaDreamMachineProvider`. Xây dựng module toán học quỹ đạo camera 3D ([`studio/camera_3d.py`](file:///home/hieunv1/Documents/ai-film-studio/studio/camera_3d.py)) biên dịch các vector chuyển động (Pan, Tilt, Roll, X, Y, Z, Focal Shift) sang format camera_control của Kling, prompt camera cues của Luma, và bộ lọc 3D perspective matrix của FFmpeg khi chạy fallback. Frontend tích hợp Canvas 3D Trajectory Controller trực quan vào [`CameraDirectorModal.tsx`](file:///home/hieunv1/Documents/ai-film-studio/web/src/components/CameraDirectorModal.tsx) và [`StoryboardView.tsx`](file:///home/hieunv1/Documents/ai-film-studio/web/src/components/StoryboardView.tsx).

**Tech Stack:** Python 3.11, FastAPI, Pydantic, Requests, Pytest, React 18, TypeScript, Tailwind CSS, HTML5 Canvas 3D Wireframe, React Hook Form, Zod, Sonner.

**Spec:** [`strategic_development_roadmap_and_execution_plan.md`](file:///home/hieunv1/.gemini/antigravity-cli/brain/edfe7aad-59b7-4f89-ac33-6efb6125efaf/strategic_development_roadmap_and_execution_plan.md) — Hướng 1.1: Tích Hợp Mô Hình AI Video Thế Hệ Mới & Camera Motion Control.

---

## Global Constraints
- Tất cả API video bên thứ ba phải có timeout an toàn và cơ chế tự động Fallback về Ken Burns / Replicate Wan 2.1 khi API lỗi hoặc hết quota.
- Phải hỗ trợ lưu token Kling (`KLING_API_KEY`) và Luma (`LUMA_API_KEY`) linh hoạt qua cả Environment Variables và LocalStorage / Header Request.
- Giữ nguyên độ tương thích 100% với 185 tests hiện tại, không làm đứt gãy schema của Storyboard hiện hữu.
- Toàn bộ giao diện người dùng, thông báo toast và commit git thực hiện bằng Tiếng Việt.

---

## Review Focus
1. **API Polling Timeout & Network Flakiness:** Render video từ Kling/Luma mất 30s-120s; polling loop phải có giới hạn thời gian (max_poll_seconds = 180s), backoff interval và không chặn luồng chính của FastAPI.
2. **Kling Token JWT / Key Format:** Kling AI OpenAPI hỗ trợ AccessKey + SecretKey (tạo JWT Bearer Token với thuật toán HS256) hoặc direct Bearer Token. Provider cần tự động giải mã hoặc ký token hợp lệ.
3. **Luma Image-to-Video URL Requirement:** Luma Dream Machine yêu cầu `frame0.url` có thể truy cập được từ internet hoặc data URI base64; provider cần chuẩn hóa ảnh đầu vào thành payload tương thích.
4. **Trajectory Boundary Clamping:** Các góc quay 3D (Pan, Tilt, Roll) và tốc độ dịch chuyển (X, Y, Z) phải được clamp trong phạm vi chuẩn điện ảnh (-180° đến 180°, -10 đến 10), tránh gây biến dạng hình ảnh (artifacting).
5. **UI Resiliency trên các Viewport:** Panel quỹ đạo Camera 3D và Canvas visualizer phải co giãn mượt mà từ màn hình laptop 720p/768p đến 1080p và 4K mà không bị cắt xén (Holy Grail pattern).

---

## Tasks

### Task 1: Module Toán Học & Biên Dịch Quỹ Đạo Camera 3D (`studio/camera_3d.py`)

**Files:**
- Create: `studio/camera_3d.py`
- Test: `tests/test_camera_3d.py`

**Interfaces:**
- Produces:
  - `class Camera3DTrajectory`: Pydantic model định nghĩa tham số quỹ đạo 3D:
    ```python
    trajectory_type: str # 'orbit_360' | 'vertigo_dolly_zoom' | 'spiral_crane' | 'bullet_time' | 'fpv_dive' | 'custom'
    pan: float # -180.0 to 180.0 (degrees)
    tilt: float # -90.0 to 90.0 (degrees)
    roll: float # -180.0 to 180.0 (degrees)
    x: float # -10.0 to 10.0 (lateral translation)
    y: float # -10.0 to 10.0 (vertical translation)
    z: float # -10.0 to 10.0 (forward/backward dolly)
    zoom: float # 0.5 to 3.0 (focal shift)
    speed: float # 0.1 to 3.0 (motion velocity)
    ```
  - `get_camera_3d_presets() -> Dict[str, Dict[str, Any]]`: Danh mục 6 preset quỹ đạo máy quay 3D điện ảnh.
  - `compile_kling_camera_control(trajectory: Camera3DTrajectory) -> Dict[str, Any]`: Biên dịch sang định dạng `camera_control` của Kling AI.
  - `compile_luma_camera_prompt(trajectory: Camera3DTrajectory, base_prompt: str) -> str`: Biên dịch tham số 3D thành visual motion cues cho Luma.
  - `compile_ffmpeg_3d_transform(trajectory: Camera3DTrajectory, duration: float) -> str`: Sinh bộ lọc FFmpeg zoompan/perspective khi chạy fallback.

- [x] **Step 1: Viết test kiểm tra module toán học và biên dịch quỹ đạo 3D trong `tests/test_camera_3d.py`**

```python
from studio.camera_3d import (
    Camera3DTrajectory,
    get_camera_3d_presets,
    compile_kling_camera_control,
    compile_luma_camera_prompt,
    compile_ffmpeg_3d_transform,
)

def test_camera_3d_presets_structure():
    presets = get_camera_3d_presets()
    assert "orbit_360" in presets
    assert "vertigo_dolly_zoom" in presets
    assert "spiral_crane" in presets
    assert presets["orbit_360"]["pan"] != 0

def test_kling_camera_control_compilation():
    traj = Camera3DTrajectory(
        trajectory_type="orbit_360",
        pan=90.0,
        tilt=15.0,
        roll=0.0,
        x=2.0,
        y=0.0,
        z=0.0,
        zoom=1.0,
        speed=1.2,
    )
    kling_ctrl = compile_kling_camera_control(traj)
    assert kling_ctrl["type"] == "simple"
    assert "config" in kling_ctrl
    assert kling_ctrl["config"]["pan"] == 90.0
    assert kling_ctrl["config"]["tilt"] == 15.0

def test_luma_camera_prompt_compilation():
    traj = Camera3DTrajectory(
        trajectory_type="vertigo_dolly_zoom",
        pan=0.0,
        tilt=0.0,
        roll=0.0,
        x=0.0,
        y=0.0,
        z=5.0,
        zoom=2.0,
        speed=1.5,
    )
    prompt = compile_luma_camera_prompt(traj, "A cyberpunk hacker typing")
    assert "A cyberpunk hacker typing" in prompt
    assert "dolly zoom" in prompt.lower() or "vertigo" in prompt.lower()
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `docker exec ai-film-studio-ui-1 pytest tests/test_camera_3d.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'studio.camera_3d'`

- [x] **Step 3: Cài đặt `studio/camera_3d.py`**
Xây dựng Pydantic model `Camera3DTrajectory`, danh mục 6 preset kinh điển, và các hàm biên dịch `compile_kling_camera_control`, `compile_luma_camera_prompt`, `compile_ffmpeg_3d_transform`.

- [x] **Step 4: Chạy test để xác nhận test thành công**

Run: `docker exec ai-film-studio-ui-1 pytest tests/test_camera_3d.py`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add studio/camera_3d.py tests/test_camera_3d.py
git commit -m "feat(video): triển khai module toán học quỹ đạo camera 3d và bộ biên dịch tham số máy quay"
```

---

### Task 2: Provider Kling AI Video OpenAPI (`studio/video_providers.py`)

**Files:**
- Modify: `studio/video_providers.py`
- Test: `tests/test_kling_provider.py`

**Interfaces:**
- Consumes: `BaseVideoProvider` từ `studio/video_providers.py`, `Camera3DTrajectory` và `compile_kling_camera_control` từ `studio/camera_3d.py`.
- Produces:
  - `class KlingDirectVideoProvider(BaseVideoProvider)`:
    ```python
    def __init__(self, api_key: Optional[str] = None, model: str = "kling-v1-6", poll_interval: float = 3.0, max_poll_seconds: float = 180.0)
    def render_shot_video(self, image_path: Path, output_path: Path, prompt: str, duration: float, aspect_ratio: str = "16:9", trajectory: Optional[Camera3DTrajectory] = None) -> bool
    ```
  - `check_kling_token(token: str) -> Dict[str, Any]`: Xác thực Kling API key / JWT qua API Kling Account / Tasks endpoint.

- [x] **Step 1: Viết unit tests giả lập (Mocking) quy trình Kling Video trong `tests/test_kling_provider.py`**

```python
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest
from studio.video_providers import KlingDirectVideoProvider, check_kling_token
from studio.camera_3d import Camera3DTrajectory

def test_check_kling_token():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"code": 0, "message": "SUCCEED"}
    with patch("requests.get", return_value=mock_resp):
        res = check_kling_token("test_kling_ak_sk")
        assert res["is_valid"] is True

def test_kling_provider_render_success(tmp_path: Path):
    dummy_img = tmp_path / "input.png"
    dummy_img.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50)
    out_file = tmp_path / "kling_clip.mp4"

    provider = KlingDirectVideoProvider(api_key="kling_secret_123", poll_interval=0.01, max_poll_seconds=5)
    traj = Camera3DTrajectory(trajectory_type="orbit_360", pan=45.0, tilt=10.0, speed=1.0)

    # 1. Post Task response
    mock_create = MagicMock()
    mock_create.status_code = 200
    mock_create.json.return_value = {"code": 0, "data": {"task_id": "kling_task_999"}}

    # 2. Poll Task response: succeeded with video url
    mock_poll = MagicMock()
    mock_poll.status_code = 200
    mock_poll.json.return_value = {
        "code": 0,
        "data": {
            "task_id": "kling_task_999",
            "task_status": "succeed",
            "task_result": {"videos": [{"url": "https://kling.api/video.mp4"}]}
        }
    }

    # 3. Download video
    mock_dl = MagicMock()
    mock_dl.status_code = 200
    mock_dl.content = b"kling_video_mp4_binary_stream"

    with patch("requests.post", return_value=mock_create), \
         patch("requests.get", side_effect=[mock_poll, mock_dl]):
        success = provider.render_shot_video(
            image_path=dummy_img,
            output_path=out_file,
            prompt="Cinematic neon warrior",
            duration=5.0,
            trajectory=traj,
        )
        assert success is True
        assert out_file.exists()
        assert out_file.read_bytes() == b"kling_video_mp4_binary_stream"
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `docker exec ai-film-studio-ui-1 pytest tests/test_kling_provider.py`
Expected: FAIL with `ImportError: cannot import name 'KlingDirectVideoProvider'`

- [x] **Step 3: Cài đặt `KlingDirectVideoProvider` và `check_kling_token` trong `studio/video_providers.py`**
Tích hợp OpenAPI của Kling AI: endpoint `https://api.klingai.com/v1/videos/image2video`, mã hóa ảnh base64, gắn camera_control JSON từ `compile_kling_camera_control`, và xử lý polling status + download stream an toàn.

- [x] **Step 4: Chạy test để xác nhận test thành công**

Run: `docker exec ai-film-studio-ui-1 pytest tests/test_kling_provider.py`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add studio/video_providers.py tests/test_kling_provider.py
git commit -m "feat(video): tích hợp provider kling ai video openapi trực tiếp với camera control 3d"
```

---

### Task 3: Provider Luma Dream Machine API (`studio/video_providers.py`)

**Files:**
- Modify: `studio/video_providers.py`
- Test: `tests/test_luma_provider.py`

**Interfaces:**
- Consumes: `BaseVideoProvider` từ `studio/video_providers.py`, `Camera3DTrajectory` và `compile_luma_camera_prompt` từ `studio/camera_3d.py`.
- Produces:
  - `class LumaDreamMachineProvider(BaseVideoProvider)`:
    ```python
    def __init__(self, api_key: Optional[str] = None, poll_interval: float = 3.0, max_poll_seconds: float = 180.0)
    def render_shot_video(self, image_path: Path, output_path: Path, prompt: str, duration: float, aspect_ratio: str = "16:9", trajectory: Optional[Camera3DTrajectory] = None) -> bool
    ```
  - `check_luma_token(token: str) -> Dict[str, Any]`: Xác thực API Key Luma Labs qua endpoint `/dream-machine/v1/generations`.

- [x] **Step 1: Viết unit tests giả lập Luma Dream Machine trong `tests/test_luma_provider.py`**

```python
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest
from studio.video_providers import LumaDreamMachineProvider, check_luma_token
from studio.camera_3d import Camera3DTrajectory

def test_check_luma_token():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = []
    with patch("requests.get", return_value=mock_resp):
        res = check_luma_token("luma-key-valid")
        assert res["is_valid"] is True

def test_luma_provider_render_success(tmp_path: Path):
    dummy_img = tmp_path / "luma_in.png"
    dummy_img.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 40)
    out_file = tmp_path / "luma_out.mp4"

    provider = LumaDreamMachineProvider(api_key="luma_key_xyz", poll_interval=0.01, max_poll_seconds=5)
    traj = Camera3DTrajectory(trajectory_type="vertigo_dolly_zoom", z=4.0, zoom=2.0)

    # 1. Post Generation
    mock_create = MagicMock()
    mock_create.status_code = 201
    mock_create.json.return_value = {"id": "luma_gen_123", "state": "dreaming"}

    # 2. Polling Generation
    mock_poll = MagicMock()
    mock_poll.status_code = 200
    mock_poll.json.return_value = {
        "id": "luma_gen_123",
        "state": "completed",
        "assets": {"video": "https://cdn.lumalabs.ai/gen_123.mp4"}
    }

    # 3. Download Video
    mock_dl = MagicMock()
    mock_dl.status_code = 200
    mock_dl.content = b"luma_video_stream_content"

    with patch("requests.post", return_value=mock_create), \
         patch("requests.get", side_effect=[mock_poll, mock_dl]):
        success = provider.render_shot_video(
            image_path=dummy_img,
            output_path=out_file,
            prompt="Spaceship passing nebula",
            duration=5.0,
            trajectory=traj,
        )
        assert success is True
        assert out_file.exists()
        assert out_file.read_bytes() == b"luma_video_stream_content"
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `docker exec ai-film-studio-ui-1 pytest tests/test_luma_provider.py`
Expected: FAIL with `ImportError: cannot import name 'LumaDreamMachineProvider'`

- [x] **Step 3: Cài đặt `LumaDreamMachineProvider` và `check_luma_token` trong `studio/video_providers.py`**
Tích hợp endpoint `https://api.lumalabs.ai/dream-machine/v1/generations`, nạp `keyframes.frame0` data URI, nhúng camera trajectory cues vào prompt, và xử lý polling status ('queued' | 'dreaming' | 'completed') + download video stream.

- [x] **Step 4: Chạy test để xác nhận test thành công**

Run: `docker exec ai-film-studio-ui-1 pytest tests/test_luma_provider.py`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add studio/video_providers.py tests/test_luma_provider.py
git commit -m "feat(video): tích hợp provider luma dream machine api với chuyển động máy quay điện ảnh"
```

---

### Task 4: Video Factory Registry & Router Endpoints (`studio/routers/video.py`)

**Files:**
- Create/Modify: `studio/routers/video.py`
- Modify: `studio/video_providers.py`
- Modify: `studio/server.py`
- Test: `tests/test_video_router_3d.py`

**Interfaces:**
- Produces API Endpoints:
  - `GET /api/video/models`: Danh sách toàn bộ model video AI (Kling 1.6 Pro, Luma Photon, Wan 2.1, Minimax, SVD).
  - `POST /api/video/test-token`: Kiểm tra tính hợp lệ của token theo provider (`kling` | `luma` | `replicate`).
  - `GET /api/video/camera-3d/presets`: Trả về 6 preset quỹ đạo camera 3D chuẩn cinema.
  - `POST /api/video/camera-3d/preview`: Nhận tham số 3D, trả về visual cues và thông số vector biên dịch sẵn.
  - `POST /api/video/render-shot`: Render video clip cho phân cảnh dựa trên `shot_id`, `provider` ('kling' | 'luma' | 'replicate' | 'kenburns') và `trajectory` (3D Camera Trajectory).

- [x] **Step 1: Viết test cho router endpoint trong `tests/test_video_router_3d.py`**

```python
from fastapi.testclient import TestClient
from studio.server import app

client = TestClient(app)

def test_api_video_models():
    resp = client.get("/api/video/models")
    assert resp.status_code == 200
    models = resp.json()
    ids = [m["id"] for m in models]
    assert any("kling" in m_id for m_id in ids)
    assert any("luma" in m_id or "photon" in m_id for m_id in ids)

def test_api_camera_3d_presets():
    resp = client.get("/api/video/camera-3d/presets")
    assert resp.status_code == 200
    presets = resp.json()
    assert "orbit_360" in presets
    assert "vertigo_dolly_zoom" in presets

def test_api_camera_3d_preview():
    payload = {
        "trajectory_type": "orbit_360",
        "pan": 90.0,
        "tilt": 10.0,
        "speed": 1.5,
        "base_prompt": "Futuristic flying car"
    }
    resp = client.post("/api/video/camera-3d/preview", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "kling_config" in data
    assert "luma_prompt" in data
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `docker exec ai-film-studio-ui-1 pytest tests/test_video_router_3d.py`
Expected: FAIL with `404 Not Found`

- [x] **Step 3: Cài đặt router endpoints trong `studio/routers/video.py` và đăng ký vào `studio/server.py`**
Cập nhật `AI_VIDEO_MODELS` bổ sung các model Kling và Luma; xây dựng Factory function `get_video_provider(provider_type, **kwargs)`; viết các endpoint `/api/video/models`, `/api/video/test-token`, `/api/video/camera-3d/presets`, `/api/video/camera-3d/preview`, `/api/video/render-shot`.

- [x] **Step 4: Chạy test để xác nhận test thành công**

Run: `docker exec ai-film-studio-ui-1 pytest tests/test_video_router_3d.py`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add studio/routers/video.py studio/video_providers.py studio/server.py tests/test_video_router_3d.py
git commit -m "feat(api): bổ sung video provider factory và api endpoints điều khiển quỹ đạo camera 3d"
```

---

### Task 5: Giao Diện Quỹ Đạo Camera 3D Tương Tác Trên Frontend (`CameraDirectorModal.tsx` & `Camera3DTrajectoryPanel.tsx`)

**Files:**
- Create: `web/src/components/Camera3DTrajectoryPanel.tsx`
- Modify: `web/src/components/CameraDirectorModal.tsx`
- Modify: `web/src/api/queries.ts`
- Modify: `web/src/types/index.ts`

**Interfaces:**
- Produces:
  - `Camera3DTrajectoryPanel`: Component Canvas 3D tương tác vẽ đường quỹ đạo camera xung quanh mô hình hộp 3D trung tâm (Wireframe Box).
  - 6 nút chọn Preset Quỹ đạo:
    - 🔄 **Orbit 360° (Quay vòng quanh chủ thể)**
    - 🎯 **Vertigo (Dolly Zoom kinh điển Hitchcock)**
    - 🌀 **Spiral Crane (Cần cẩu lượn xoắn ốc)**
    - ⏱️ **Bullet Time (Ma Trận 3D dừng thời gian)**
    - 🦅 **FPV Roll Dive (Drone nhào lượn bổ nhào)**
    - 📐 **Low-Arc Sweep (Quét vòng cung góc thấp)**
  - Các thanh trượt điều khiển: Pan Angle, Tilt Angle, Roll Angle, Focal Shift (Zoom), Tốc độ (Speed).
  - Nút chọn AI Video Engine: Kling 1.6 Pro, Luma Dream Machine, Replicate Wan 2.1, Ken Burns 3D.
  - Nút "Render Video Clip Với Quỹ Đạo 3D" kết nối trực tiếp với backend qua Sonner Toast.

- [x] **Step 1: Định nghĩa kiểu dữ liệu `Camera3DTrajectory` và queries API trong `web/src/types/index.ts` & `web/src/api/queries.ts`**
Thêm types `Camera3DTrajectory`, `Camera3DPresetItem`, `Camera3DPreviewResponse`, và React Query hooks: `useCamera3DPresets`, `useCamera3DPreview`, `useRender3DShotVideo`.

- [x] **Step 2: Xây dựng Canvas 3D Trajectory Visualizer Component tại `web/src/components/Camera3DTrajectoryPanel.tsx`**
Vẽ phối cảnh 3D Wireframe trên HTML5 Canvas với góc xoay tương tác theo các thanh trượt Pan, Tilt, Roll; hiển thị vector mũi tên đường bay camera và tia nhìn hướng vào tâm chủ thể.

- [x] **Step 3: Tích hợp Tab "Quỹ Đạo 3D (3D Trajectory Pro)" vào `web/src/components/CameraDirectorModal.tsx`**
Thêm Tab thứ ba bên cạnh "Multi-Angle Coverage" và "Visual Director Canvas"; cho phép chọn preset, điều chỉnh thanh trượt và bấm Render Video trực tiếp với toast notification từ `sonner`.

- [x] **Step 4: Chạy `npm run build` để kiểm tra biên dịch TypeScript**

Run: `cd web && npm run build`
Expected: 0 errors, build thành công

- [x] **Step 5: Commit**

```bash
git add web/src/components/Camera3DTrajectoryPanel.tsx web/src/components/CameraDirectorModal.tsx web/src/api/queries.ts web/src/types/index.ts
git commit -m "feat(ui): xây dựng bộ điều khiển quỹ đạo camera 3d trực quan với canvas tương tác và render video"
```

---

### Task 6: Tích Hợp Cấu Hình API Key Kling/Luma Vào Cài Đặt & Xác Thực Toàn Diện End-to-End

**Files:**
- Modify: `web/src/components/ProductionForm.tsx`
- Modify: `web/src/components/StoryboardView.tsx`
- Modify: `studio/video.py`
- Test: `tests/test_assembly.py`, `tests/test_storyboard.py`

**Interfaces:**
- `ProductionForm.tsx`: Bổ sung ô nhập API Key cho Kling AI và Luma Dream Machine trong phần Cài đặt nâng cao với nút kiểm tra Token.
- `StoryboardView.tsx`: Thẻ phân cảnh hiển thị huy hiệu quỹ đạo 3D (ví dụ: `🎥 Orbit 360° • Kling AI`) và cho phép bấm mở nhanh Modal Camera 3D.
- Pipeline `studio/video.py`: Khi tạo video clip cho shot, tự động nhận diện `camera_3d_trajectory` để chuyển hướng render qua Kling / Luma provider tương ứng, hoặc fallback về Ken Burns an toàn.

- [x] **Step 1: Cập nhật `ProductionForm.tsx` bổ sung cài đặt Kling & Luma API Keys**
Thêm tab/input cho Kling AI (`studio_kling_key`) và Luma Dream Machine (`studio_luma_key`) với nút test token sử dụng `toast.success` / `toast.error`.

- [x] **Step 2: Cập nhật Storyboard Shot Card hiển thị thông tin 3D Trajectory**
Nếu shot có cấu hình quỹ đạo 3D, hiển thị badge màu xanh ngọc / tím nổi bật trên thẻ phân cảnh; bấm vào sẽ mở trực tiếp Modal Quỹ Đạo 3D.

- [x] **Step 3: Cập nhật hàm `render_video_for_shot` trong `studio/video.py`**
Tự động dispatch qua `get_video_provider` khi shot được cấu hình engine Kling hoặc Luma.

- [x] **Step 4: Chạy toàn bộ test suite backend và frontend build**

Run:
1. `docker exec ai-film-studio-ui-1 pytest` -> Yêu cầu toàn bộ tests (bao gồm các test mới) PASS.
2. `cd web && npm run build` -> Yêu cầu 0 lỗi TypeScript.

- [x] **Step 5: Kiểm thử thực tế bằng Chrome CDP Browser Verification**
Viết kịch bản CDP kiểm tra mở Modal Camera Director, chuyển sang tab Quỹ Đạo 3D, thử chọn preset Vertigo / Orbit 360°, kéo thanh trượt, và bấm render thử nghiệm.

- [x] **Step 6: Commit**

```bash
git add web/src/components/ProductionForm.tsx web/src/components/StoryboardView.tsx studio/video.py
git commit -m "feat: hoàn thiện tích hợp end-to-end provider kling ai, luma và bộ điều khiển quỹ đạo camera 3d"
```

---

## Plan Review & Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-30-kling-luma-3d-camera-trajectory.md`.
Please review the plan. Which execution approach would you prefer?

- **Subagent-driven** - A fresh subagent implements each task and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough.
- **Native** - I implement every task myself in this session, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest.

For this plan I recommend **Native**, because the tasks extend existing modular Python provider classes and React component Holy Grail patterns already established in our session. Does the plan capture what you want, and which approach should we use?
