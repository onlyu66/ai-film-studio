from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest

from studio.video_providers import (
    BaseVideoProvider,
    ReplicateVideoProvider,
    check_replicate_token,
    get_available_video_models,
    AI_VIDEO_MODELS,
)


def test_get_available_video_models():
    models = get_available_video_models()
    assert isinstance(models, list)
    assert len(models) >= 4
    ids = [m["id"] for m in models]
    assert "wan-video/wan-2.1-i2v-480p" in ids
    assert "minimax/video-01" in ids
    assert "kwaivgi/kling-v1.6-standard" in ids
    assert "stability-ai/stable-video-diffusion" in ids


def test_check_replicate_token():
    # Valid token
    mock_valid_resp = MagicMock()
    mock_valid_resp.status_code = 200
    mock_valid_resp.json.return_value = {"username": "cinema_director"}

    with patch("requests.get", return_value=mock_valid_resp):
        res = check_replicate_token("r8_valid_token_123")
        assert res["is_valid"] is True
        assert res["username"] == "cinema_director"

    # Invalid token
    mock_invalid_resp = MagicMock()
    mock_invalid_resp.status_code = 401
    mock_invalid_resp.json.return_value = {"detail": "Unauthenticated"}

    with patch("requests.get", return_value=mock_invalid_resp):
        res = check_replicate_token("r8_invalid_token")
        assert res["is_valid"] is False


def test_replicate_video_provider_missing_token(tmp_path: Path):
    dummy_img = tmp_path / "frame.png"
    dummy_img.write_bytes(b"\x89PNG\r\n\x1a\n")
    out_file = tmp_path / "clip.mp4"

    provider = ReplicateVideoProvider(api_token="", model="wan-video/wan-2.1-i2v-480p")
    with patch.dict("os.environ", {}, clear=True):
        success = provider.render_shot_video(
            image_path=dummy_img,
            output_path=out_file,
            prompt="A dragon soaring over stormy mountains",
            duration=3.5,
        )
        assert success is False
        assert not out_file.exists()


def test_replicate_video_provider_polling_success(tmp_path: Path):
    dummy_img = tmp_path / "input.png"
    dummy_img.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50)
    out_file = tmp_path / "output.mp4"

    provider = ReplicateVideoProvider(
        api_token="r8_test_secret",
        model="wan-video/wan-2.1-i2v-480p",
        poll_interval=0.01,
        max_poll_seconds=5,
    )

    # 1. Post prediction response: starting
    mock_create_resp = MagicMock()
    mock_create_resp.status_code = 201
    mock_create_resp.json.return_value = {"id": "pred_test_abc", "status": "starting"}

    # 2. Polling responses: processing then succeeded
    mock_poll_proc = MagicMock()
    mock_poll_proc.status_code = 200
    mock_poll_proc.json.return_value = {"id": "pred_test_abc", "status": "processing"}

    mock_poll_succ = MagicMock()
    mock_poll_succ.status_code = 200
    mock_poll_succ.json.return_value = {
        "id": "pred_test_abc",
        "status": "succeeded",
        "output": "https://replicate.delivery/fake_wan_video.mp4",
    }

    # 3. Video download response
    mock_dl_resp = MagicMock()
    mock_dl_resp.status_code = 200
    mock_dl_resp.content = b"fake_mp4_binary_content_stream_12345"

    poll_calls = [mock_poll_proc, mock_poll_succ]

    def mock_get(url, *args, **kwargs):
        if "predictions/pred_test_abc" in url:
            return poll_calls.pop(0) if poll_calls else mock_poll_succ
        elif "fake_wan_video.mp4" in url:
            return mock_dl_resp
        return MagicMock(status_code=404)

    with patch("requests.post", return_value=mock_create_resp):
        with patch("requests.get", side_effect=mock_get):
            success = provider.render_shot_video(
                image_path=dummy_img,
                output_path=out_file,
                prompt="Cinematic camera pan across neon cyberpunk city",
                duration=4.0,
            )
            assert success is True
            assert out_file.exists()
            assert out_file.read_bytes() == b"fake_mp4_binary_content_stream_12345"


def test_replicate_video_provider_failure_handling(tmp_path: Path):
    dummy_img = tmp_path / "input.png"
    dummy_img.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50)
    out_file = tmp_path / "output_fail.mp4"

    provider = ReplicateVideoProvider(
        api_token="r8_test_secret",
        model="wan-video/wan-2.1-i2v-480p",
        poll_interval=0.01,
        max_poll_seconds=5,
    )

    # Creation failed
    mock_create_fail = MagicMock()
    mock_create_fail.status_code = 422
    mock_create_fail.text = "Unprocessable Entity"

    with patch("requests.post", return_value=mock_create_fail):
        success = provider.render_shot_video(
            image_path=dummy_img,
            output_path=out_file,
            prompt="Test error",
            duration=3.0,
        )
        assert success is False
        assert not out_file.exists()
