# ComfyUI Dual Engine Hub (Image & Video) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate ComfyUI as an independent dual-engine (cinematic image generation & motion video generation) with smart in-place node mapping, real-time WebSocket progress streaming, built-in and custom workflow management, and graceful fallback.

**Architecture:** A non-blocking asynchronous Python bridge in `studio/comfyui/` communicates with ComfyUI via REST and WebSocket, deserializes/injects parameters into workflow DAGs in-place, and demultiplexes sampling progress to the frontend via SSE. The React UI provides a dedicated `ComfyUIModal` for hardware monitoring, model selection, workflow upload, and independent image/video activation.

**Tech Stack:** Python 3.11, FastAPI, Pydantic v2, `httpx`, `websockets`, React 18, TypeScript, Tailwind CSS, Lucide icons.

**Spec:** [`docs/superpowers/specs/2026-10-31-comfyui-dual-engine-design.md`](file:///C:/Documents/ai-film-studio/docs/superpowers/specs/2026-10-31-comfyui-dual-engine-design.md)

## Global Constraints

- **Language & Runtime:** Python 3.11 (Backend), Node v22 / React 18 (Frontend).
- **Execution Concurrency:** ComfyUI stages must strictly run with `concurrency = 1` on the local GPU to prevent CUDA OOM.
- **Node Mutation:** In-place parameter mutation only; no dynamic graph synthesizing/rewiring.
- **Graceful Fallback:** Disconnection or CUDA OOM during batch `/api/produce` must automatically fail-over to Pollinations / Ken Burns with alert logging.
- **Configuration Persistence:** Dual-layer: Global default (`outputs/comfyui_config.json`) with per-project override in `storyboard.json["comfyui"]`.

## Review Focus

1. **Unknown/Complex Workflow Graphs:** Custom workflow JSON with non-standard node names must not crash; mapper gracefully identifies core nodes or reports missing mapping.
2. **Missing Custom Nodes:** Workflows requiring nodes not installed on ComfyUI (e.g. `VHS_VideoCombine`) must be flagged with warning badges before submission.
3. **ComfyUI Unreachable / Down:** API calls when ComfyUI is offline must return structured health status (`connected: false`) without unhandled socket timeouts.
4. **WebSocket Reconnection:** If WebSocket drops mid-sampling, client reconnects or falls back to HTTP history polling without losing output files.
5. **VRAM Saturation:** Pipeline must serialize jobs and gracefully handle OOM errors without crashing the FastAPI master process.

---

### Task 1: ComfyUI In-Place Node Graph Mapper (`studio/comfyui/mapper.py`)

**Files:**
- Create: `studio/comfyui/__init__.py`
- Create: `studio/comfyui/mapper.py`
- Test: `tests/test_comfyui_mapper.py`

**Interfaces:**
- Produces:
  - `SmartNodeMapper.detect_nodes(workflow: dict) -> DetectedNodes`
  - `SmartNodeMapper.inject_parameters(workflow: dict, prompt: str, seed: int, width: int, height: int, negative_prompt: str = "", image_path: str = None, checkpoint: str = None, lora: str = None, lora_weight: float = 1.0, steps: int = None, cfg: float = None) -> dict`
  - `SmartNodeMapper.validate_workflow(workflow: dict, available_nodes: list[str]) -> list[str]` (returns missing node classes)

- [x] **Step 1: Write failing tests for graph mapping and parameter injection**

Create `tests/test_comfyui_mapper.py`:
```python
import pytest
from studio.comfyui.mapper import SmartNodeMapper

def test_detect_nodes_standard_graph():
    sample_workflow = {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "cfg": 8, "denoise": 1, "latent_image": ["5", 0],
                "model": ["4", 0], "negative": ["7", 0], "positive": ["6", 0],
                "sampler_name": "euler", "scheduler": "normal", "seed": 42, "steps": 20
            }
        },
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "v1-5.safetensors"}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"batch_size": 1, "height": 512, "width": 512}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": "initial prompt"}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["4", 1], "text": "bad quality"}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "Test", "images": ["8", 0]}}
    }
    mapper = SmartNodeMapper()
    detected = mapper.detect_nodes(sample_workflow)
    assert detected.positive_prompt_id == "6"
    assert detected.negative_prompt_id == "7"
    assert detected.sampler_id == "3"
    assert detected.latent_id == "5"
    assert detected.checkpoint_id == "4"
    assert detected.output_id == "9"

def test_inject_parameters():
    sample_workflow = {
        "3": {"class_type": "KSampler", "inputs": {"seed": 0, "steps": 20, "positive": ["6", 0], "negative": ["7", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "old.safetensors"}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": 512, "height": 512}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": "old"}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": "old neg"}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0]}}
    }
    mapper = SmartNodeMapper()
    updated = mapper.inject_parameters(
        sample_workflow,
        prompt="A cinematic cyberpunk street",
        seed=12345,
        width=1024,
        height=576,
        negative_prompt="blurry",
        checkpoint="flux-schnell.safetensors",
        steps=25
    )
    assert updated["6"]["inputs"]["text"] == "A cinematic cyberpunk street"
    assert updated["7"]["inputs"]["text"] == "blurry"
    assert updated["3"]["inputs"]["seed"] == 12345
    assert updated["3"]["inputs"]["steps"] == 25
    assert updated["5"]["inputs"]["width"] == 1024
    assert updated["5"]["inputs"]["height"] == 576
    assert updated["4"]["inputs"]["ckpt_name"] == "flux-schnell.safetensors"
```

- [x] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm studio -m pytest tests/test_comfyui_mapper.py -v`  
Expected: FAIL (No module named `studio.comfyui.mapper`).

- [x] **Step 3: Implement `SmartNodeMapper` in `studio/comfyui/mapper.py`**

Implement node graph traversal, heuristics matching `CLIPTextEncode` linked to `positive`/`negative`, `KSampler`, `EmptyLatentImage`, `LoadImage`, `CheckpointLoaderSimple`, and `SaveImage`/`VHS_VideoCombine`. Implement safe in-place dict copy & injection.

- [x] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm studio -m pytest tests/test_comfyui_mapper.py -v`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add studio/comfyui/ mapper.py tests/test_comfyui_mapper.py
git commit -m "feat(comfyui): implement smart in-place node graph parameter mapper"
```

---

### Task 2: ComfyUI Async Client & WebSocket Demultiplexer (`studio/comfyui/client.py`)

**Files:**
- Create: `studio/comfyui/client.py`
- Test: `tests/test_comfyui_client.py`

**Interfaces:**
- Consumes: `SmartNodeMapper` from `studio.comfyui.mapper`
- Produces: `ComfyUIClient` class:
  - `async check_health() -> ComfyUIHealthStatus`
  - `async get_models() -> dict[str, list[str]]` (checkpoints, loras, vaes)
  - `async get_available_nodes() -> list[str]` (list of all class_types from `/object_info`)
  - `async queue_and_wait(workflow: dict, shot_id: str, on_progress: Callable = None, timeout_sec: float = 180.0) -> list[Path]`

- [x] **Step 1: Write unit tests with mocked ComfyUI server responses**

Create `tests/test_comfyui_client.py`:
- Mock `GET /system_stats` returning GPU memory and version.
- Mock `GET /object_info` returning node definitions and model lists.
- Mock `POST /prompt` returning `prompt_id`.
- Test `queue_and_wait` progress tracking and file downloading.

- [x] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm studio -m pytest tests/test_comfyui_client.py -v`  
Expected: FAIL (No module `studio.comfyui.client`).

- [x] **Step 3: Implement `ComfyUIClient` in `studio/comfyui/client.py`**

- Use `httpx.AsyncClient` for REST requests.
- Use `websockets` for WebSocket listener connecting to `ws://{host}:{port}/ws?clientId={client_id}`.
- Parse `status`, `progress`, `executing`, and `executed` message payloads, forwarding progress `(step, total_steps)` to `on_progress(shot_id, step, total_steps)`.
- Download image/video outputs via `/view` into local destination paths.

- [x] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm studio -m pytest tests/test_comfyui_client.py -v`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add studio/comfyui/client.py tests/test_comfyui_client.py
git commit -m "feat(comfyui): implement async REST and WebSocket client with demultiplexing"
```

---

### Task 3: Built-in Workflow Templates & Custom Workflow Upload (`studio/comfyui/`)

**Files:**
- Create: `studio/comfyui/workflows/flux_schnell.json`
- Create: `studio/comfyui/workflows/sdxl_cinematic.json`
- Create: `studio/comfyui/workflows/animatediff_v3.json`
- Create: `studio/comfyui/workflows/wan2_1_i2v.json`
- Create: `studio/comfyui/manager.py`
- Test: `tests/test_comfyui_workflows.py`

**Interfaces:**
- Produces: `WorkflowManager`:
  - `list_workflows(available_nodes: list[str]) -> list[WorkflowInfo]` (with compatibility flag)
  - `get_workflow(name_or_id: str) -> dict`
  - `save_custom_workflow(name: str, workflow_json: dict) -> WorkflowInfo`
  - `get_config() -> ComfyUIConfig`
  - `save_config(config: ComfyUIConfig, global_scope: bool) -> None`

- [x] **Step 1: Write test for workflow catalog and custom upload**

Create `tests/test_comfyui_workflows.py`:
- Test that all 4 built-in workflows load as valid JSON graphs.
- Test that `WorkflowManager.list_workflows` flags missing nodes if `VHS_VideoCombine` is omitted from available nodes.
- Test saving and reading global config (`outputs/comfyui_config.json`).

- [x] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm studio -m pytest tests/test_comfyui_workflows.py -v`  
Expected: FAIL

- [x] **Step 3: Implement workflow templates and `WorkflowManager`**

- Populate `flux_schnell.json`, `sdxl_cinematic.json`, `animatediff_v3.json`, and `wan2_1_i2v.json` with standard verified ComfyUI API graphs.
- Implement `WorkflowManager` in `studio/comfyui/manager.py` handling JSON files in `studio/comfyui/workflows/` and custom uploads in `outputs/comfyui_workflows/`.

- [x] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm studio -m pytest tests/test_comfyui_workflows.py -v`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add studio/comfyui/workflows/ studio/comfyui/manager.py tests/test_comfyui_workflows.py
git commit -m "feat(comfyui): bundle built-in workflows and workflow manager"
```

---

### Task 4: ComfyUI REST API Router (`studio/routers/comfyui.py`)

**Files:**
- Create: `studio/routers/comfyui.py`
- Modify: `studio/server.py:50-80` (include `comfyui.router`)
- Test: `tests/test_comfyui_router.py`

**Interfaces:**
- Produces:
  - `GET /api/comfyui/status`
  - `GET /api/comfyui/models`
  - `GET /api/comfyui/workflows`
  - `POST /api/comfyui/workflows/upload`
  - `GET /api/comfyui/config`
  - `POST /api/comfyui/config`
  - `POST /api/comfyui/test`

- [x] **Step 1: Write router tests**

Create `tests/test_comfyui_router.py`:
- Test `GET /api/comfyui/status` returns connected or offline without 500 error.
- Test `GET /api/comfyui/workflows` lists built-in workflows.
- Test `POST /api/comfyui/config` updates configuration and persists to disk.

- [x] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm studio -m pytest tests/test_comfyui_router.py -v`  
Expected: FAIL (404 Not Found on `/api/comfyui/*`).

- [x] **Step 3: Implement router and mount in `studio/server.py`**

- Implement `studio/routers/comfyui.py` wiring `WorkflowManager` and `ComfyUIClient`.
- In `studio/server.py`, add `app.include_router(comfyui.router)`.

- [x] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm studio -m pytest tests/test_comfyui_router.py -v`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add studio/routers/comfyui.py studio/server.py tests/test_comfyui_router.py
git commit -m "feat(api): expose ComfyUI management REST endpoints"
```

---

### Task 5: Pipeline Orchestrator Integration & Graceful Fallback (`studio/image_providers.py`, `studio/video.py`, `studio/orchestrator.py`)

**Files:**
- Modify: `studio/image_providers.py:180-275` (upgrade `ComfyUIProvider`)
- Modify: `studio/video.py` (add ComfyUI Video Engine branch)
- Modify: `studio/orchestrator.py:200-350` (enforce `concurrency = 1` and fallback logic)
- Test: `tests/test_comfyui_pipeline.py`

**Interfaces:**
- Consumes: `ComfyUIClient`, `WorkflowManager`, `SmartNodeMapper`
- Produces:
  - Pipeline Stage 3 (Images) routes to `ComfyUIProvider` when `is_image_enabled = True`.
  - Pipeline Stage 4 (Motion) routes to ComfyUI Image-to-Video when `is_video_enabled = True`.
  - On failure/OOM: logs warning and invokes fallback provider inline.

- [x] **Step 1: Write test for pipeline ComfyUI provider and failover**

Create `tests/test_comfyui_pipeline.py`:
- Test that `ComfyUIProvider.generate` uses client and mapper.
- Test that when ComfyUI client raises an error or is unreachable, the provider falls back to Pollinations Flux without raising an uncaught exception.
- Test that Stage 4 video generator routes to ComfyUI video and falls back to Ken Burns if ComfyUI fails.

- [x] **Step 2: Run test to verify it fails**

Run: `docker compose run --rm studio -m pytest tests/test_comfyui_pipeline.py -v`  
Expected: FAIL

- [x] **Step 3: Implement pipeline routing and fallback**

- Upgrade `ComfyUIProvider` in `studio/image_providers.py` to use `ComfyUIClient.queue_and_wait` with mapper parameter injection.
- Add ComfyUI Image-to-Video handler in `studio/video.py`.
- In `studio/orchestrator.py`, set workers = 1 when ComfyUI is active.

- [x] **Step 4: Run test to verify it passes**

Run: `docker compose run --rm studio -m pytest tests/test_comfyui_pipeline.py -v`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add studio/image_providers.py studio/video.py studio/orchestrator.py tests/test_comfyui_pipeline.py
git commit -m "feat(pipeline): integrate ComfyUI dual engine with automated fallback"
```

---

### Task 6: Frontend ComfyUI Studio Hub UI (`web/src/components/ComfyUIModal.tsx`)

**Files:**
- Create: `web/src/components/ComfyUIModal.tsx`
- Modify: `web/src/components/Navbar.tsx` (add ComfyUI status button & modal launcher)
- Modify: `web/src/components/StoryboardView.tsx` (display live ComfyUI progress on shot cards)
- Modify: `web/src/types/index.ts` (add ComfyUI config & status types)
- Modify: `web/src/api/studio.ts` (add ComfyUI API client calls)

**Interfaces:**
- Produces:
  - `ComfyUIModal`: Interactive modal with connection check, Image/Video activation toggles, Model selectors, and custom workflow dropzone.
  - Live progress display during Stage 3 & 4.

- [x] **Step 1: Update TypeScript interfaces in `web/src/types/index.ts` and `api/studio.ts`**

Define `ComfyUIStatus`, `ComfyUIConfig`, `WorkflowItem`, `ComfyUIModels` types. Add API methods `getComfyUIStatus`, `getComfyUIModels`, `getComfyUIWorkflows`, `uploadComfyUIWorkflow`, `saveComfyUIConfig`.

- [x] **Step 2: Verify existing build status**

Run: `cd web && npm run build`  
Expected: PASS

- [x] **Step 3: Implement `web/src/components/ComfyUIModal.tsx`**

- Header with live connection check button and GPU VRAM meter.
- Independent activation toggles for Image and Video engines.
- Global vs Per-Project configuration radio buttons.
- Tabs for Image Workflow, Video Workflow, and Custom Workflow JSON upload.
- Custom node compatibility warnings.

- [x] **Step 4: Wire Modal into Navbar and Storyboard progress listeners**

- Add ComfyUI indicator in `Navbar.tsx` (🟢/🔴 badge).
- In `StoryboardView.tsx`, display real-time ComfyUI sampling steps (`Step X/Y - Z%`) on shot cards during generation.

- [x] **Step 5: Run frontend build check**

Run: `cd web && npm run build`  
Expected: `✓ built in ...ms` without TypeScript or bundle errors.

- [x] **Step 6: Commit**

```bash
git add web/src/components/ComfyUIModal.tsx web/src/components/Navbar.tsx web/src/components/StoryboardView.tsx web/src/types/index.ts web/src/api/studio.ts
git commit -m "feat(ui): add ComfyUI Studio Hub modal and live progress card indicators"
```

---

### Task 7: Full End-to-End Verification & Integration Test

**Files:**
- Entire workspace

- [x] **Step 1: Run complete backend pytest suite**

Run: `docker compose run --rm studio -m pytest tests/ -v`  
Expected: All backend tests (audio, server, assembly, comfyui) PASS 100%.

- [x] **Step 2: Run complete frontend build check**

Run: `cd web && npm run build`  
Expected: Frontend bundles cleanly into `web/dist/`.

- [x] **Step 3: Verification of key flows**
1. Check `GET /api/comfyui/status` returns gracefully even when local ComfyUI is not currently running.
2. Verify all 4 built-in workflow JSONs parse and map correctly.
3. Verify fallback mechanism routes cleanly to Pollinations and Ken Burns.

- [x] **Step 4: Final commit**

```bash
git commit --allow-empty -m "chore(comfyui): complete and verify ComfyUI dual engine integration"
```
