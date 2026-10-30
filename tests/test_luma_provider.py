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

    # 401 Unauthorized
    mock_401 = MagicMock()
    mock_401.status_code = 401
    mock_401.json.return_value = {"detail": "Invalid authorization token"}
    with patch("requests.get", return_value=mock_401):
        res = check_luma_token("luma-invalid")
        assert res["is_valid"] is False


def test_check_luma_token_empty():
    res = check_luma_token("")
    assert res["is_valid"] is False
    assert "trống" in res["message"].lower()


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
        "assets": {"video": "https://cdn.lumalabs.ai/gen_123.mp4"},
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


def test_luma_provider_missing_key(tmp_path: Path):
    dummy_img = tmp_path / "in.png"
    dummy_img.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 40)
    out_file = tmp_path / "out.mp4"

    provider = LumaDreamMachineProvider(api_key="")
    with patch.dict("os.environ", {}, clear=True):
        res = provider.render_shot_video(
            image_path=dummy_img,
            output_path=out_file,
            prompt="Spaceship",
            duration=5.0,
        )
        assert res is False
