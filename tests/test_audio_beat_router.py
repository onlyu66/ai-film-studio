from fastapi.testclient import TestClient
import studio.server as srv
from studio.server import app

client = TestClient(app)

def test_api_audio_waveform_bgm_cinematic():
    resp = client.get("/api/audio/waveform?track=cinematic")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "duration" in data
    assert "tempo_bpm" in data
    assert "beat_times" in data
    assert "peaks" in data
    assert len(data["peaks"]) > 0

def test_api_audio_waveform_invalid_track():
    resp = client.get("/api/audio/waveform?track=non_existent_track_xyz")
    # Trả về fallback hợp lệ thay vì crash 500
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["tempo_bpm"] == 120
    assert len(data["peaks"]) > 0

def test_api_audio_snap_to_beats():
    resp = client.post("/api/audio/beat-sync/snap", json={
        "project_id": "current",
        "bgm_track": "cinematic",
        "min_shot_duration": 1.5,
        "save_to_storyboard": False
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "shots" in data
    assert "total_duration" in data
    assert "tempo_bpm" in data

def test_api_audio_snap_save_creates_backup(monkeypatch, tmp_path):
    sb_path = tmp_path / "storyboard.json"
    from studio.storage import atomic_write_json
    atomic_write_json(sb_path, {"shots": [{"id": "s1", "duration": 4.0}]}, backup=False)
    orig_path = srv.Path
    monkeypatch.setattr(srv, "Path", lambda p: sb_path if "storyboard.json" in str(p) else orig_path(p))

    resp = client.post("/api/audio/beat-sync/snap", json={
        "project_id": "current",
        "bgm_track": "cinematic",
        "min_shot_duration": 1.5,
        "save_to_storyboard": True
    })
    assert resp.status_code == 200
    bak_file = tmp_path / "storyboard.json.bak1"
    assert bak_file.exists()

