import base64
from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest

from studio.image_providers import (
    BaseImageProvider,
    SDWebUIProvider,
    ComfyUIProvider,
    PollinationsProvider,
    discover_image_engines,
    get_image_provider,
)

# 1x1 transparent PNG in base64
SAMPLE_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    b"\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"
)
SAMPLE_BASE64 = base64.b64encode(SAMPLE_PNG_BYTES).decode("utf-8")


def test_sd_webui_provider_generate_success(tmp_path: Path):
    provider = SDWebUIProvider(api_url="http://127.0.0.1:7860")
    target_file = tmp_path / "shot_001.png"

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "images": [SAMPLE_BASE64],
        "parameters": {},
        "info": "{}",
    }

    with patch("requests.post", return_value=mock_resp) as mock_post:
        success = provider.generate(
            prompt="Cyberpunk street in neon rain",
            width=1280,
            height=720,
            seed=42,
            output_path=target_file,
        )
        assert success is True
        assert target_file.exists()
        assert target_file.stat().st_size > 10

        # Verify endpoint called
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert "/sdapi/v1/txt2img" in args[0]
        assert kwargs["json"]["prompt"] == "Cyberpunk street in neon rain"
        assert kwargs["json"]["width"] == 1280
        assert kwargs["json"]["height"] == 720
        assert kwargs["json"]["seed"] == 42


def test_sd_webui_provider_error_handling(tmp_path: Path):
    provider = SDWebUIProvider(api_url="http://127.0.0.1:7860")
    target_file = tmp_path / "shot_fail.png"

    with patch("requests.post", side_effect=Exception("Connection refused")):
        success = provider.generate(
            prompt="Test prompt",
            width=1280,
            height=720,
            seed=42,
            output_path=target_file,
        )
        assert success is False
        assert not target_file.exists()


def test_sd_webui_check_health():
    provider = SDWebUIProvider(api_url="http://127.0.0.1:7860")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = [{"title": "v1-5-pruned.safetensors", "model_name": "v1-5-pruned"}]

    with patch("requests.get", return_value=mock_resp):
        health = provider.check_health()
        assert health["is_available"] is True
        assert "v1-5-pruned" in health["models"]


def test_comfyui_provider_generate_success(tmp_path: Path):
    provider = ComfyUIProvider(api_url="http://127.0.0.1:8188")
    target_file = tmp_path / "shot_comfy.png"

    mock_prompt_resp = MagicMock()
    mock_prompt_resp.status_code = 200
    mock_prompt_resp.json.return_value = {"prompt_id": "prompt_abc_123"}

    mock_history_resp = MagicMock()
    mock_history_resp.status_code = 200
    mock_history_resp.json.return_value = {
        "prompt_abc_123": {
            "outputs": {
                "9": {
                    "images": [
                        {"filename": "ComfyUI_00001_.png", "subfolder": "", "type": "output"}
                    ]
                }
            }
        }
    }

    mock_view_resp = MagicMock()
    mock_view_resp.status_code = 200
    mock_view_resp.content = SAMPLE_PNG_BYTES

    def mock_requests_get(url, *args, **kwargs):
        if "/history" in url:
            return mock_history_resp
        elif "/view" in url:
            return mock_view_resp
        return MagicMock(status_code=404)

    with patch("requests.post", return_value=mock_prompt_resp):
        with patch("requests.get", side_effect=mock_requests_get):
            success = provider.generate(
                prompt="Epic fantasy castle at sunset",
                width=1280,
                height=720,
                seed=777,
                output_path=target_file,
            )
            assert success is True
            assert target_file.exists()
            assert target_file.stat().st_size > 10


def test_discover_image_engines():
    engines = discover_image_engines()
    assert isinstance(engines, list)
    ids = [e["id"] for e in engines]
    assert "pollinations" in ids
    assert "sd_webui" in ids
    assert "comfyui" in ids


def test_get_image_provider():
    p1 = get_image_provider("sd_webui", "http://localhost:7860")
    assert isinstance(p1, SDWebUIProvider)

    p2 = get_image_provider("comfyui", "http://localhost:8188")
    assert isinstance(p2, ComfyUIProvider)

    p3 = get_image_provider("pollinations")
    assert isinstance(p3, PollinationsProvider)
