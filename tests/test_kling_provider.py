from pathlib import Path
from unittest.mock import patch, MagicMock
import pytest
from studio.video_providers import KlingDirectVideoProvider, check_kling_token
from studio.camera_3d import Camera3DTrajectory


def test_check_kling_token():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"code": 0, "message": "SUCCEED", "data": {"balance": 100}}
    with patch("requests.get", return_value=mock_resp):
        res = check_kling_token("test_kling_ak_sk")
        assert res["is_valid"] is True

    # Test invalid token 401
    mock_401 = MagicMock()
    mock_401.status_code = 401
    mock_401.json.return_value = {"code": 401, "message": "Unauthorized"}
    with patch("requests.get", return_value=mock_401):
        res = check_kling_token("invalid_token")
        assert res["is_valid"] is False


def test_check_kling_token_empty():
    res = check_kling_token("")
    assert res["is_valid"] is False
    assert "trống" in res["message"].lower()


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
            "task_result": {"videos": [{"url": "https://kling.api/video.mp4"}]},
        },
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


def test_kling_provider_missing_key(tmp_path: Path):
    dummy_img = tmp_path / "input.png"
    dummy_img.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 50)
    out_file = tmp_path / "out.mp4"

    provider = KlingDirectVideoProvider(api_key="")
    with patch.dict("os.environ", {}, clear=True):
        res = provider.render_shot_video(
            image_path=dummy_img,
            output_path=out_file,
            prompt="Test",
            duration=5.0,
        )
        assert res is False
