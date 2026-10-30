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

def test_api_get_lipsync_status_endpoint():
    from fastapi.testclient import TestClient
    from studio.server import app
    client = TestClient(app)
    resp = client.get("/api/system/lipsync-status")
    assert resp.status_code == 200
    data = resp.json()
    assert "available" in data
    assert "engine" in data
