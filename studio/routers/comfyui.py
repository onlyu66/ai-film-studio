"""FastAPI Router for ComfyUI Integration."""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from studio.comfyui.client import ComfyUIClient, ComfyUIHealthStatus
from studio.comfyui.manager import ComfyUIConfig, WorkflowInfo, WorkflowManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/comfyui", tags=["comfyui"])

_manager: Optional[WorkflowManager] = None
_client: Optional[ComfyUIClient] = None


def get_manager() -> WorkflowManager:
    global _manager
    if _manager is None:
        _manager = WorkflowManager()
    return _manager


def get_client() -> ComfyUIClient:
    global _client
    manager = get_manager()
    cfg = manager.get_config()
    target_url = cfg.api_url or "http://127.0.0.1:8188"
    if _client is None or _client.api_url != target_url:
        _client = ComfyUIClient(api_url=target_url)
    return _client


class SaveConfigPayload(BaseModel):
    api_url: Optional[str] = "http://127.0.0.1:8188"
    is_image_enabled: bool = False
    is_video_enabled: bool = False
    image_workflow: str = "flux_schnell"
    video_workflow: str = "animatediff_v3"
    checkpoint: Optional[str] = None
    lora: Optional[str] = None
    lora_weight: float = 0.8
    steps: int = 20
    cfg: float = 7.0
    video_frames: int = 16
    video_fps: int = 12
    project_id: Optional[str] = None
    save_as_global: bool = True


class UploadWorkflowPayload(BaseModel):
    name: str
    workflow_json: Dict[str, Any]
    category: str = "image"
    description: Optional[str] = ""


@router.get("/status")
async def get_comfyui_status(url: Optional[str] = Query(None)):
    """Reports ComfyUI connection health, GPU device name, and VRAM availability."""
    client = ComfyUIClient(api_url=url) if url else get_client()
    status = await client.check_health()
    return {
        "connected": status.connected,
        "device_name": status.device_name,
        "vram_total_gb": status.vram_total_gb,
        "vram_free_gb": status.vram_free_gb,
        "queue_remaining": status.queue_remaining,
        "version": status.version,
    }


@router.get("/hardware-check")
async def get_comfyui_hardware_check(client_gpu: Optional[str] = Query(None)):
    """
    Evaluates host GPU and system capability to run local or Docker ComfyUI.
    Can accept client_gpu hint from browser WebGL if running inside Docker.
    """
    from studio.hardware import detect_hardware, detect_gpu_details, check_docker_gpu_support, assess_comfyui_compatibility

    hw = detect_hardware()
    gpus = detect_gpu_details()

    # Check if ComfyUI is online and reporting GPU
    client = get_client()
    status = await client.check_health()

    gpu_name = "Unknown GPU"
    vram_gb = 0.0

    if status.connected and status.device_name not in ("CPU", "Unknown"):
        gpu_name = status.device_name
        vram_gb = status.vram_total_gb
    elif gpus:
        gpu_name = gpus[0].get("name", "Unknown GPU")
        vram_gb = float(gpus[0].get("vram_gb", 0.0))
    elif client_gpu:
        gpu_name = client_gpu
        lower_hint = client_gpu.lower()
        if "950m" in lower_hint or "960m" in lower_hint:
            vram_gb = 2.0
        elif "1050" in lower_hint or "1650" in lower_hint:
            vram_gb = 4.0
        elif "2060" in lower_hint or "3060" in lower_hint:
            vram_gb = 6.0
        elif "3070" in lower_hint or "4070" in lower_hint:
            vram_gb = 8.0
        else:
            vram_gb = 0.0

    docker_status = check_docker_gpu_support()

    report = assess_comfyui_compatibility(
        gpu_name=gpu_name,
        vram_gb=vram_gb,
        ram_gb=hw.get("ram_total_gb", 8.0),
        cpu_cores=hw.get("cpu_cores", 4),
        docker_gpu_supported=docker_status.get("supported", False),
    )

    return {
        "success": True,
        "hardware": report,
        "detected_gpus": gpus,
    }


@router.get("/models")
async def get_comfyui_models(url: Optional[str] = Query(None)):
    """Scans and lists installed checkpoints, LoRAs, and VAEs."""
    client = ComfyUIClient(api_url=url) if url else get_client()
    models = await client.get_models()
    return {
        "success": True,
        "models": models,
    }


@router.get("/workflows")
async def list_comfyui_workflows(url: Optional[str] = Query(None)):
    """Lists built-in and user-uploaded workflows with node compatibility status."""
    manager = get_manager()
    client = ComfyUIClient(api_url=url) if url else get_client()

    available_nodes: Optional[List[str]] = None
    try:
        available_nodes = await client.get_available_nodes()
    except Exception:
        pass

    workflows = manager.list_workflows(available_nodes=available_nodes)
    return {
        "success": True,
        "workflows": [
            {
                "id": w.id,
                "name": w.name,
                "category": w.category,
                "description": w.description,
                "is_builtin": w.is_builtin,
                "required_nodes": w.required_nodes,
                "missing_nodes": w.missing_nodes,
                "is_compatible": w.is_compatible,
            }
            for w in workflows
        ],
    }


@router.post("/workflows/upload")
async def upload_custom_workflow(payload: UploadWorkflowPayload):
    """Uploads and saves a custom workflow JSON."""
    manager = get_manager()
    try:
        info = manager.save_custom_workflow(
            name=payload.name,
            workflow_dict=payload.workflow_json,
            category=payload.category,
            description=payload.description or "",
        )
        return {
            "success": True,
            "workflow": {
                "id": info.id,
                "name": info.name,
                "category": info.category,
            },
        }
    except Exception as e:
        logger.error(f"[ComfyUIRouter] Error saving custom workflow: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to save workflow: {e}")


@router.get("/config")
def get_comfyui_config(project_id: Optional[str] = Query(None)):
    """Retrieves ComfyUI config (evaluating project override then global)."""
    manager = get_manager()
    config = manager.get_config(project_id=project_id)
    return {
        "success": True,
        "config": config.to_dict(),
    }


@router.post("/config")
def save_comfyui_config(payload: SaveConfigPayload):
    """Saves ComfyUI config either as global default or per-project override."""
    manager = get_manager()
    config = ComfyUIConfig(
        api_url=payload.api_url or "http://127.0.0.1:8188",
        is_image_enabled=payload.is_image_enabled,
        is_video_enabled=payload.is_video_enabled,
        image_workflow=payload.image_workflow,
        video_workflow=payload.video_workflow,
        checkpoint=payload.checkpoint,
        lora=payload.lora,
        lora_weight=payload.lora_weight,
        steps=payload.steps,
        cfg=payload.cfg,
        video_frames=payload.video_frames,
        video_fps=payload.video_fps,
    )
    manager.save_config(
        config=config,
        project_id=payload.project_id,
        save_as_global=payload.save_as_global,
    )
    return {
        "success": True,
        "config": config.to_dict(),
    }


@router.post("/test")
async def test_comfyui_connection(url: Optional[str] = Query(None)):
    """Performs a quick smoke check to verify ComfyUI responsiveness."""
    client = ComfyUIClient(api_url=url) if url else get_client()
    status = await client.check_health()
    if not status.connected:
        return {
            "success": False,
            "message": "Không thể kết nối tới ComfyUI tại địa chỉ cấu hình.",
        }
    return {
        "success": True,
        "device": status.device_name,
        "vram_free_gb": status.vram_free_gb,
        "message": f"Kết nối ComfyUI thành công! Thiết bị: {status.device_name} ({status.vram_free_gb} GB VRAM trống).",
    }


@router.get("/colab-notebook")
async def get_colab_notebook():
    """Provides direct download for the official Google Colab Jupyter Notebook."""
    nb_path = Path("notebooks/comfyui_colab.ipynb")
    if not nb_path.exists():
        raise HTTPException(status_code=404, detail="Colab notebook not found")
    return FileResponse(
        str(nb_path),
        media_type="application/x-ipynb+json",
        filename="ai_film_studio_comfyui_colab.ipynb",
    )
