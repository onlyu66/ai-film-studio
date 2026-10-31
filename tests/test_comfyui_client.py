import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, patch, MagicMock
import pytest
from studio.comfyui.client import ComfyUIClient, ComfyUIHealthStatus

@pytest.mark.anyio
async def test_check_health_connected():
    client = ComfyUIClient("http://127.0.0.1:8188")
    mock_stats = {
        "system": {"os": "nt", "python_version": "3.11"},
        "devices": [
            {
                "name": "NVIDIA GeForce RTX 4070",
                "type": "cuda",
                "vram_total": 12 * 1024 * 1024 * 1024,
                "vram_free": 8 * 1024 * 1024 * 1024,
            }
        ],
    }
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_stats
        mock_get.return_value = mock_resp

        status = await client.check_health()
        assert status.connected is True
        assert "RTX 4070" in status.device_name
        assert status.vram_total_gb == 12.0
        assert status.vram_free_gb == 8.0

@pytest.mark.anyio
async def test_check_health_unreachable():
    client = ComfyUIClient("http://127.0.0.1:8188")
    with patch("httpx.AsyncClient.get", side_effect=Exception("Connection refused")):
        status = await client.check_health()
        assert status.connected is False
        assert status.vram_total_gb == 0.0

@pytest.mark.anyio
async def test_get_models_from_object_info():
    client = ComfyUIClient("http://127.0.0.1:8188")
    mock_object_info = {
        "CheckpointLoaderSimple": {
            "input": {
                "required": {
                    "ckpt_name": [["flux-schnell.safetensors", "sdxl_base.safetensors"]]
                }
            }
        },
        "LoraLoader": {
            "input": {
                "required": {
                    "lora_name": [["film_noir_v1.safetensors", "cyberpunk.safetensors"]]
                }
            }
        },
    }
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_object_info
        mock_get.return_value = mock_resp

        models = await client.get_models()
        assert "flux-schnell.safetensors" in models["checkpoints"]
        assert "sdxl_base.safetensors" in models["checkpoints"]
        assert "film_noir_v1.safetensors" in models["loras"]

        nodes = await client.get_available_nodes()
        assert "CheckpointLoaderSimple" in nodes
        assert "LoraLoader" in nodes

@pytest.mark.anyio
async def test_queue_and_wait_success(tmp_path):
    client = ComfyUIClient("http://127.0.0.1:8188")
    progress_calls = []

    def on_progress(shot_id, step, total):
        progress_calls.append((shot_id, step, total))

    mock_history = {
        "test-prompt-id": {
            "outputs": {
                "9": {
                    "images": [
                        {"filename": "out_001.png", "subfolder": "", "type": "output"}
                    ]
                }
            }
        }
    }

    with patch("httpx.AsyncClient.post") as mock_post, \
         patch("httpx.AsyncClient.get") as mock_get:
        # Prompt queue POST
        prompt_resp = MagicMock()
        prompt_resp.status_code = 200
        prompt_resp.json.return_value = {"prompt_id": "test-prompt-id"}
        mock_post.return_value = prompt_resp

        # History GET and View GET
        hist_resp = MagicMock()
        hist_resp.status_code = 200
        hist_resp.json.return_value = mock_history

        view_resp = MagicMock()
        view_resp.status_code = 200
        view_resp.content = b"fake-png-data"

        mock_get.side_effect = [hist_resp, view_resp]

        dest_dir = tmp_path / "outputs"
        files = await client.poll_history_and_download(
            "test-prompt-id",
            output_dir=dest_dir,
            timeout_sec=5.0
        )
        assert len(files) == 1
        assert files[0].name == "out_001.png"
        assert files[0].read_bytes() == b"fake-png-data"
