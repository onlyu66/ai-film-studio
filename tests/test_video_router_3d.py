from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from studio.server import app
from studio.video_providers import get_video_provider, KlingDirectVideoProvider, LumaDreamMachineProvider, ReplicateVideoProvider

client = TestClient(app)

def test_api_video_models():
    resp = client.get("/api/video/models")
    assert resp.status_code == 200
    models = resp.json()
    assert isinstance(models, list)
    ids = [m["id"] for m in models]
    assert any("kling" in m_id for m_id in ids)
    assert any("luma" in m_id for m_id in ids)
    assert any("wan" in m_id for m_id in ids)

def test_api_camera_3d_presets():
    resp = client.get("/api/video/camera-3d/presets")
    assert resp.status_code == 200
    presets = resp.json()
    assert "orbit_360" in presets
    assert "vertigo_dolly_zoom" in presets
    assert "spiral_crane" in presets
    assert "bullet_time" in presets
    assert "fpv_dive" in presets
    assert "low_arc_sweep" in presets

def test_api_camera_3d_preview():
    payload = {
        "trajectory_type": "orbit_360",
        "pan": 90.0,
        "tilt": 10.0,
        "speed": 1.5,
        "base_prompt": "Futuristic flying car"
    }
    resp = client.post("/api/video/camera-3d/preview", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "kling_config" in data
    assert "luma_prompt" in data
    assert "ffmpeg_filter" in data
    assert data["kling_config"]["config"]["pan"] == 5.0
    assert "orbit" in data["luma_prompt"].lower() or "car" in data["luma_prompt"].lower()

def test_api_test_token_kling():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"code": 0, "data": {}}
    with patch("requests.get", return_value=mock_resp):
        resp = client.post("/api/video/test-token", json={"provider": "kling", "token": "kling_test_key"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_valid"] is True

def test_api_test_token_luma():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = []
    with patch("requests.get", return_value=mock_resp):
        resp = client.post("/api/video/test-token", json={"provider": "luma", "token": "luma_test_key"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_valid"] is True

def test_get_video_provider_factory():
    p1 = get_video_provider("kling", api_token="secret")
    assert isinstance(p1, KlingDirectVideoProvider)

    p2 = get_video_provider("luma", api_token="secret")
    assert isinstance(p2, LumaDreamMachineProvider)

    p3 = get_video_provider("replicate", api_token="secret")
    assert isinstance(p3, ReplicateVideoProvider)

    # Deduced by model
    p4 = get_video_provider("auto", api_token="secret", model="kling-v1-6")
    assert isinstance(p4, KlingDirectVideoProvider)

    # Overridden model default check
    p_kling_override = get_video_provider("kling", api_token="secret", model="wan-video/wan-2.1-i2v-480p")
    assert p_kling_override.model == "kling-v1-6"

    p_luma_override = get_video_provider("luma", api_token="secret", model="wan-video/wan-2.1-i2v-480p")
    assert p_luma_override.model == "luma-dream-machine"
