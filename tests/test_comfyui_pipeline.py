from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from studio.config import StudioConfig
from studio.hardware import get_optimal_concurrency
from studio.image_providers import ComfyUIProvider, PollinationsProvider, get_image_provider
from studio.video_providers import ComfyUIVideoProvider, get_video_provider


def test_comfyui_concurrency_serialization():
    """Verify that ComfyUI forces worker concurrency to 1 to protect GPU VRAM."""
    cfg_image = StudioConfig(topic="Comfy Test", image_engine="comfyui")
    assert get_optimal_concurrency("image", cfg_image) == 1

    cfg_motion = StudioConfig(topic="Comfy Test", motion_engine="comfyui")
    assert get_optimal_concurrency("motion", cfg_motion) == 1


def test_comfyui_image_provider_success(tmp_path):
    """Verify ComfyUIProvider mutates workflow, executes via client, and writes image."""
    provider = ComfyUIProvider(api_url="http://127.0.0.1:8188")
    out_file = tmp_path / "shot_001.png"

    # Create dummy rendered image
    dummy_source = tmp_path / "mock_comfy_output.png"
    dummy_source.write_bytes(b"\x89PNG\r\n\x1a\n" + b"0" * 5000)

    with patch("studio.comfyui.client.ComfyUIClient.queue_and_wait", new_callable=AsyncMock) as mock_queue:
        mock_queue.return_value = [dummy_source]

        success = provider.generate(
            prompt="cyberpunk detective rainy street",
            width=1280,
            height=720,
            seed=42,
            output_path=out_file,
        )

        assert success is True
        assert out_file.exists()
        assert out_file.stat().st_size >= 5000
        mock_queue.assert_called_once()


def test_comfyui_image_provider_fallback_on_error(tmp_path):
    """Verify ComfyUIProvider gracefully falls back to Pollinations when ComfyUI fails."""
    provider = ComfyUIProvider(api_url="http://127.0.0.1:8188")
    out_file = tmp_path / "shot_fallback.png"

    with patch("studio.comfyui.client.ComfyUIClient.queue_and_wait", new_callable=AsyncMock) as mock_queue:
        mock_queue.side_effect = RuntimeError("ComfyUI server disconnected (ECONNREFUSED)")

        # Mock the fallback PollinationsProvider.generate to succeed
        with patch.object(PollinationsProvider, "generate", return_value=True) as mock_pollinations:
            success = provider.generate(
                prompt="test prompt",
                width=1280,
                height=720,
                seed=123,
                output_path=out_file,
            )

            assert success is True
            mock_pollinations.assert_called_once()


def test_comfyui_video_provider_routing_and_fallback(tmp_path):
    """Verify get_video_provider supports comfyui and falls back gracefully when server fails."""
    provider = get_video_provider(provider_type="comfyui", api_url="http://127.0.0.1:8188")
    assert isinstance(provider, ComfyUIVideoProvider)

    img_file = tmp_path / "shot_001.png"
    img_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"0" * 5000)
    out_video = tmp_path / "shot_001.mp4"

    # When ComfyUI fails, provider should return False without raising an uncaught exception
    with patch("studio.comfyui.client.ComfyUIClient.queue_and_wait", new_callable=AsyncMock) as mock_queue:
        mock_queue.side_effect = RuntimeError("ComfyUI node VHS_VideoCombine missing")

        res = provider.render_shot_video(
            image_path=img_file,
            output_path=out_video,
            prompt="camera pans right",
            duration=3.0,
        )
        assert res is False
