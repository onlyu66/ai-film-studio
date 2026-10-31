from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
import pytest
from studio.server import app

client = TestClient(app)

def test_api_comfyui_status():
    with patch("studio.comfyui.client.ComfyUIClient.check_health", new_callable=AsyncMock) as mock_health:
        from studio.comfyui.client import ComfyUIHealthStatus
        mock_health.return_value = ComfyUIHealthStatus(
            connected=True,
            device_name="NVIDIA RTX 4070",
            vram_total_gb=12.0,
            vram_free_gb=8.5,
            queue_remaining=0,
            version="0.3.0",
        )
        resp = client.get("/api/comfyui/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["connected"] is True
        assert data["device_name"] == "NVIDIA RTX 4070"
        assert data["vram_total_gb"] == 12.0

def test_api_comfyui_workflows_list():
    resp = client.get("/api/comfyui/workflows")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    ids = [w["id"] for w in data["workflows"]]
    assert "flux_schnell" in ids
    assert "animatediff_v3" in ids

def test_api_comfyui_config_get_and_post():
    # Save config
    payload = {
        "is_image_enabled": True,
        "is_video_enabled": True,
        "image_workflow": "flux_schnell",
        "video_workflow": "animatediff_v3",
        "checkpoint": "flux1-schnell.safetensors",
        "save_as_global": True,
    }
    post_resp = client.post("/api/comfyui/config", json=payload)
    assert post_resp.status_code == 200
    assert post_resp.json()["success"] is True

    # Retrieve config
    get_resp = client.get("/api/comfyui/config")
    assert get_resp.status_code == 200
    cfg = get_resp.json()["config"]
    assert cfg["is_image_enabled"] is True
    assert cfg["is_video_enabled"] is True
    assert cfg["image_workflow"] == "flux_schnell"

def test_api_comfyui_models():
    with patch("studio.comfyui.client.ComfyUIClient.get_models", new_callable=AsyncMock) as mock_models:
        mock_models.return_value = {
            "checkpoints": ["model1.safetensors"],
            "loras": ["lora1.safetensors"],
            "vaes": ["vae1.safetensors"],
        }
        resp = client.get("/api/comfyui/models")
        assert resp.status_code == 200
        data = resp.json()
        assert "model1.safetensors" in data["models"]["checkpoints"]

def test_api_comfyui_colab_notebook():
    resp = client.get("/api/comfyui/colab-notebook")
    assert resp.status_code == 200
    assert "ipynb" in resp.headers.get("content-type", "")
