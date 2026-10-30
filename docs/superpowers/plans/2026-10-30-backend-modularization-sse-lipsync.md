# Backend Modularization, Realtime SSE Progress & AI Lip-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the 3,160+ line FastAPI backend into modular domain routers, add real-time Server-Sent Events (SSE) progress streaming for 4K video enhancement & master assembly with UI progress bars, and configure an NVIDIA GPU Docker profile for local AI Lip-Sync (SadTalker/Wav2Lip).

**Architecture:**
- **Modular Routers:** Split `studio/server.py` into five domain routers (`storyboard`, `vault`, `audio`, `video`, `projects`) mounted via FastAPI `APIRouter`, maintaining 100% backward compatibility for all API endpoints and monkeypatched test hooks.
- **Realtime SSE:** Implement an async event pub/sub broadcaster (`studio/events.py`) streaming progress events via `GET /api/events/progress`. FFmpeg processes in `video_enhancer.py` and `assembly.py` stream progress via `-progress pipe:1` to push realtime percentages to the frontend `useProgressSSE` hook.
- **AI Lip-Sync Profile:** Add a `sadtalker` service with NVIDIA GPU reservations under Compose profiles `["gpu", "sadtalker"]`, update `studio/lipsync.py` to communicate with the local service with graceful Ken Burns fallback, and expose `GET /api/system/lipsync-status`.

**Tech Stack:** FastAPI, Python 3.11, Server-Sent Events (Starlette StreamingResponse), FFmpeg, Docker Compose (NVIDIA Container Toolkit), React 18, Vite, Tailwind CSS, Pytest.

**Spec:** User technical improvement request:
1. Modularize `studio/server.py` into specialized routers (`routers/storyboard.py`, `routers/vault.py`, `routers/video.py`, `routers/audio.py`, `routers/projects.py`).
2. Real-time Server-Sent Events (SSE) for 4K render and FFmpeg Master Assembly progress bars.
3. Docker Profile for local AI Lip-Sync (SadTalker/Wav2Lip) with NVIDIA GPU pass-through.

---

## Global Constraints

- Preserve 100% of all existing 52 HTTP and WebSocket endpoints and payload models without breaking frontend contract.
- Preserve 100% of the 164 passing tests in `tests/test_*.py`, specifically retaining `studio.server.Path` patching compatibility.
- Zero extra heavy dependencies for SSE (use native FastAPI/Starlette `StreamingResponse` and standard library `asyncio.Queue`).
- Local Lip-Sync must never crash the pipeline: if GPU is absent or SadTalker container is offline, it must gracefully fallback to Ken Burns camera motion.
- Docker profile `gpu` must remain optional; standard CPU/macOS/headless docker compose startup (`run.sh web`) must work out of the box without requiring NVIDIA drivers.

---

## Review Focus

1. **Test Monkeypatching Integrity:** Existing tests monkeypatch `studio.server.Path`. Routers accessing filesystem paths must resolve through `studio.server.Path` or reference shared helpers so that `test_server.py` tests continue to intercept path resolution.
2. **SSE Connection Drop & Reconnection:** If client network disconnects during 4K render, SSE generator must handle `asyncio.CancelledError` cleanly without leaking subscriber queues or killing the background FFmpeg process.
3. **FFmpeg Output Parsing Robustness:** FFmpeg `-progress pipe:1` output format variations across versions (e.g. `out_time_us=N/A` or dropped frames) must not throw UnboundLocalError or ValueError.
4. **Local Lip-Sync Timeout & Non-Zero Return:** If SadTalker service times out (>120s) or returns 500 error, pipeline must log the error and seamlessly fallback to motion engine rather than halting the movie generation.
5. **SSE Task Scoping:** Multiple users or concurrent renders must only receive/filter progress for their matching `task_id` without cross-session progress bar contamination.

---

### Task 1: Backend Router Modularization (`studio/routers/`)

**Files:**
- Create: `studio/routers/__init__.py`
- Create: `studio/routers/storyboard.py`
- Create: `studio/routers/vault.py`
- Create: `studio/routers/audio.py`
- Create: `studio/routers/video.py`
- Create: `studio/routers/projects.py`
- Modify: `studio/server.py:1-3161`
- Test: `tests/test_routers.py`

**Interfaces:**
- Consumes: `studio.server.pipeline_state`, `studio.server.broadcast_ws`, `studio.server.log_message`, `studio.server.last_produce_request`, `studio.server.Path`
- Produces: `storyboard.router`, `vault.router`, `audio.router`, `video.router`, `projects.router` mounted on `studio.server.app`.

- [ ] **Step 1: Write the failing test for routers**

Create `tests/test_routers.py`:
```python
import pytest
from fastapi.testclient import TestClient
from studio.server import app

client = TestClient(app)

def test_router_modules_exist():
    from studio.routers import storyboard, vault, audio, video, projects
    assert storyboard.router is not None
    assert vault.router is not None
    assert audio.router is not None
    assert video.router is not None
    assert projects.router is not None

def test_storyboard_router_endpoints_mounted():
    # Verify storyboard templates endpoint is registered and responds
    resp = client.get("/api/storyboard/templates")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

def test_vault_router_endpoints_mounted():
    # Verify character vault endpoint responds
    resp = client.get("/api/characters/vault")
    assert resp.status_code == 200

def test_audio_router_endpoints_mounted():
    # Verify sfx catalog responds
    resp = client.get("/api/sfx/catalog")
    assert resp.status_code == 200

def test_video_router_endpoints_mounted():
    # Verify video presets respond
    resp = client.get("/api/video/enhancer/presets")
    assert resp.status_code == 200
    assert len(resp.json()) > 0

def test_projects_router_endpoints_mounted():
    # Verify projects list responds
    resp = client.get("/api/projects")
    assert resp.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm --entrypoint pytest studio tests/test_routers.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'studio.routers'`

- [ ] **Step 3: Implement modular routers and refactor `studio/server.py`**

1. Create `studio/routers/__init__.py`.
2. Extract storyboard endpoints into `studio/routers/storyboard.py` (templates, storyboard JSON, export-timeline, update-shot, add-shot, delete-shot, reorder-shots, split-shot, reroll-shot, upload-shot-image, approve-shot, camera angles, subtitles).
3. Extract character vault endpoints into `studio/routers/vault.py` (headshot generator, vault list/save/delete/import, multi-angle headshots).
4. Extract audio & voice endpoints into `studio/routers/audio.py` (TTS preview, SFX catalog/suggest, BGM catalog/upload, voice clone, dubbing, shot audio render).
5. Extract video processing endpoints into `studio/routers/video.py` (LUT & transition presets, shot video render, remux, master assembly, reframe, 4K enhancer).
6. Extract projects library endpoints into `studio/routers/projects.py` (projects list, delete, thumbnail, SEO, project timeline & subtitles export).
7. Update `studio/server.py` to import and include each router with `app.include_router(...)`. Ensure `studio.server.Path` remains the attribute used for filesystem path resolution.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm --entrypoint pytest studio tests/test_routers.py tests/test_server.py -v`
Expected: ALL PASS (all router tests pass and all 40+ tests in `tests/test_server.py` pass without regression).

- [ ] **Step 5: Commit**

```bash
git add studio/routers/ studio/server.py tests/test_routers.py
git commit -m "refactor: modularize server.py into specialized FastAPI routers"
```

---

### Task 2: Realtime Server-Sent Events (SSE) Progress Broadcaster

**Files:**
- Create: `studio/events.py`
- Create: `studio/routers/events.py`
- Modify: `studio/video_enhancer.py:100-165`
- Modify: `studio/assembly.py:450-550`
- Modify: `studio/server.py`
- Create: `web/src/hooks/useProgressSSE.ts`
- Modify: `web/src/components/VideoEnhancerModal.tsx:60-110,265-295`
- Modify: `web/src/components/StoryboardView.tsx`
- Test: `tests/test_events_sse.py`

**Interfaces:**
- Produces: `ProgressBroadcaster.publish(event: dict)` in `studio.events`
- Produces: `GET /api/events/progress` SSE stream yielding `data: {"task_id": str, "stage": str, "percent": float, "eta": str}\n\n`
- Produces: `useProgressSSE(taskId?: string)` React hook returning `{ percent, stage, isRunning, error }`

- [ ] **Step 1: Write the failing test for SSE Broadcaster**

Create `tests/test_events_sse.py`:
```python
import pytest
import asyncio
import json
from studio.events import ProgressBroadcaster

@pytest.mark.anyio
async def test_progress_broadcaster_subscribe_and_publish():
    broadcaster = ProgressBroadcaster()
    queue = broadcaster.subscribe()
    
    event_payload = {
        "task_id": "test_task_123",
        "stage": "upscale_4k",
        "percent": 45.5,
        "detail": "Processing frame 135/300"
    }
    broadcaster.publish(event_payload)
    
    # Receive from subscriber queue
    received = await asyncio.wait_for(queue.get(), timeout=2.0)
    assert received == event_payload
    
    broadcaster.unsubscribe(queue)
    assert queue not in broadcaster.subscribers

def test_sse_endpoint_registered():
    from fastapi.testclient import TestClient
    from studio.server import app
    client = TestClient(app)
    
    # Test connection to SSE endpoint
    with client.stream("GET", "/api/events/progress") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm --entrypoint pytest studio tests/test_events_sse.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'studio.events'`

- [ ] **Step 3: Implement `ProgressBroadcaster` and FFmpeg `-progress pipe:1` integration**

1. Create `studio/events.py`:
   - `class ProgressBroadcaster`: thread-safe subscriber queue registry (`subscribe()`, `unsubscribe()`, `publish(data)`).
   - Global instance `global_progress_broadcaster = ProgressBroadcaster()`.
2. Create `studio/routers/events.py` with `GET /api/events/progress`:
   - Returns `StreamingResponse(event_stream(), media_type="text/event-stream")`.
   - Sends initial connected event and periodic keep-alive comments `: keep-alive\n\n`.
3. Update `studio/video_enhancer.py`:
   - In `enhance_video()`, inspect total duration/frames via `ffprobe` (or input shot duration).
   - Launch FFmpeg with `-progress pipe:1 -nostats`.
   - Read lines from stdout asynchronously/in worker thread, parse `out_time_us` to compute `percent = round((current_sec / total_sec) * 100, 1)`, and call `global_progress_broadcaster.publish({"task_id": task_id, "stage": "render_4k", "percent": percent})`.
4. Update `studio/assembly.py`:
   - In `run_assembly_stage()`, emit assembly milestone progress (`{"task_id": "assemble_master", "stage": "concat_audio_mux", "percent": p}`).
5. Create `web/src/hooks/useProgressSSE.ts`:
   - Connects to `/api/events/progress` using `EventSource`.
   - Filters events by `taskId` (or receives all when `taskId` is undefined).
   - Exposes `{ percent, stage, isRunning, error }`.
6. Update `web/src/components/VideoEnhancerModal.tsx` and `web/src/components/StoryboardView.tsx`:
   - Display animated progress bar and live percent during 4K render and Master Assembly.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm --entrypoint pytest studio tests/test_events_sse.py -v`
Expected: PASS

- [ ] **Step 5: Verify frontend builds without errors**

Run: `cd web && npm run build`
Expected: Build successfully created without TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add studio/events.py studio/routers/events.py studio/video_enhancer.py studio/assembly.py web/src/hooks/useProgressSSE.ts web/src/components/VideoEnhancerModal.tsx web/src/components/StoryboardView.tsx tests/test_events_sse.py
git commit -m "feat: add real-time SSE progress broadcaster for 4K video rendering and master assembly"
```

---

### Task 3: Docker Profile & Integration for Local AI Lip-Sync (SadTalker / Wav2Lip)

**Files:**
- Modify: `docker-compose.yml:1-50`
- Modify: `studio/lipsync.py:1-92`
- Modify: `studio/motion.py:260-275`
- Create: `studio/routers/system.py` or modify `studio/routers/events.py`
- Test: `tests/test_lipsync_local.py`
- Modify: `docs/superpowers/plans/` & `README.md` (Docker GPU instructions)

**Interfaces:**
- Consumes: `os.environ.get("LIPSYNC_API_URL", "http://sadtalker:5000/api/lipsync")`
- Produces: `apply_lipsync_for_shot(..., engine="local" | "sadtalker" | "wav2lip")` calling local SadTalker server.
- Produces: `GET /api/system/lipsync-status` returning `{"available": bool, "engine": "local" | "cloud" | "none", "gpu": bool}`.

- [ ] **Step 1: Write the failing test for local lip-sync and fallback**

Create `tests/test_lipsync_local.py`:
```python
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from studio.lipsync import apply_lipsync_for_shot, check_lipsync_service_status

def test_lipsync_local_success(tmp_path):
    img = tmp_path / "test.png"
    img.write_bytes(b"dummy_png")
    aud = tmp_path / "test.mp3"
    aud.write_bytes(b"dummy_mp3")
    out = tmp_path / "out.mp4"

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b"fake_mp4_video_stream"

    with patch("requests.post", return_value=mock_resp) as mock_post:
        res = apply_lipsync_for_shot(img, aud, out, engine="local")
        assert res == out
        assert out.exists()
        assert out.read_bytes() == b"fake_mp4_video_stream"
        mock_post.assert_called_once()

def test_lipsync_local_fallback_on_network_error(tmp_path):
    img = tmp_path / "test.png"
    img.write_bytes(b"dummy_png")
    aud = tmp_path / "test.mp3"
    aud.write_bytes(b"dummy_mp3")
    out = tmp_path / "out.mp4"

    import requests
    with patch("requests.post", side_effect=requests.exceptions.ConnectionError("Connection refused")):
        # Should gracefully return None and not raise exception
        res = apply_lipsync_for_shot(img, aud, out, engine="local")
        assert res is None
        assert not out.exists()

def test_check_lipsync_status_offline():
    import requests
    with patch("requests.get", side_effect=requests.exceptions.ConnectionError):
        status = check_lipsync_service_status()
        assert status["available"] is False
        assert status["engine"] == "none"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm --entrypoint pytest studio tests/test_lipsync_local.py -v`
Expected: FAIL (`check_lipsync_service_status` not defined, engine="local" not handled).

- [ ] **Step 3: Update `docker-compose.yml`, `studio/lipsync.py`, and `studio/motion.py`**

1. In `docker-compose.yml`, add the `sadtalker` service:
   ```yaml
     sadtalker:
       image: vinthony/sadtalker:latest
       container_name: studio_sadtalker
       profiles: ["gpu", "sadtalker", "lipsync"]
       restart: unless-stopped
       ports:
         - "5000:5000"
       environment:
         - CUDA_VISIBLE_DEVICES=0
       deploy:
         resources:
           reservations:
             devices:
               - driver: nvidia
                 count: all
                 capabilities: [gpu]
       volumes:
         - sadtalker_checkpoints:/root/.cache
   ```
   Add volume `sadtalker_checkpoints:` under `volumes:`.
2. In `studio/lipsync.py`:
   - Implement `check_lipsync_service_status(api_url: Optional[str] = None) -> dict`.
   - Update `apply_lipsync_for_shot`:
     - When `engine in ("local", "sadtalker", "wav2lip")`: send image & audio payload to `LIPSYNC_API_URL` (default `http://sadtalker:5000/api/lipsync` with fallback to `http://localhost:5000/api/lipsync`).
     - Save response video to `output_path`.
     - On timeout or network error, log warning and return `None` (seamless fallback to motion).
3. In `studio/motion.py`:
   - Update condition from `if config.lip_sync == "cloud"` to `if config.lip_sync in ("cloud", "local", "sadtalker", "wav2lip")`.
4. Expose `GET /api/system/lipsync-status` in router.

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm --entrypoint pytest studio tests/test_lipsync_local.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml studio/lipsync.py studio/motion.py studio/routers/ tests/test_lipsync_local.py
git commit -m "feat: add GPU docker profile and local SadTalker lip-sync support with automatic fallback"
```

---

### Task 4: Full System Verification & Regression Testing

**Files:**
- Test: All test suites (`tests/test_*.py`)
- Test: Frontend build (`web/`)
- Modify: `README.md` (Documentation on GPU profile startup)

- [ ] **Step 1: Run complete backend test suite (164+ tests)**

Run: `docker compose run --rm --entrypoint pytest studio -v`
Expected: 100% of all tests pass (0 failures, 0 errors).

- [ ] **Step 2: Run frontend production build**

Run: `docker compose run --rm --entrypoint bash ui -c "cd /app/web && npm run build"`
Expected: Build finished with 0 errors.

- [ ] **Step 3: Verify SSE endpoint with curl**

Run:
```bash
curl -N -s -X GET "http://localhost:8080/api/events/progress" --max-time 3
```
Expected: HTTP 200 stream header and `: keep-alive` or initial connected event.

- [ ] **Step 4: Document Docker GPU Lip-Sync usage in README**

Add instructions to `README.md`:
```bash
# Khởi chạy AI Film Studio kèm card NVIDIA GPU cho AI Lip-Sync (SadTalker):
docker compose --profile gpu up -d
```

- [ ] **Step 5: Final Git Commit**

```bash
git add README.md
git commit -m "docs: add guide for launching AI Film Studio with NVIDIA GPU lip-sync profile"
```
