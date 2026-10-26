from fastapi.testclient import TestClient
from studio.server import app

client = TestClient(app)

def test_api_status():
    resp = client.get("/api/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "stage" in data

def test_api_storyboard_empty_fallback():
    resp = client.get("/api/storyboard")
    assert resp.status_code == 200
    data = resp.json()
    assert "shots" in data

def test_api_reroll_shot_missing_404():
    resp = client.post("/api/storyboard/reroll-shot", json={"shot_id": "nonexistent"})
    assert resp.status_code in (400, 404)

def test_storyboard_add_delete_reorder(tmp_path, monkeypatch):
    import json
    from pathlib import Path
    
    # Mock outputs/storyboard.json location
    test_sb = tmp_path / "storyboard.json"
    initial_data = {
        "title": "Test Film",
        "language": "vi",
        "characters": {},
        "shots": [
            {"id": "s1", "chapter": 1, "dialogue": "A", "image_prompt": "x", "motion": "zoom_in"},
            {"id": "s2", "chapter": 1, "dialogue": "B", "image_prompt": "y", "motion": "zoom_in"},
        ]
    }
    test_sb.write_text(json.dumps(initial_data), encoding="utf-8")
    
    # Monkeypatch Path("outputs/storyboard.json") to test_sb
    orig_path = Path
    def mock_path(arg, *rest):
        if str(arg) == "outputs/storyboard.json":
            return test_sb
        return orig_path(arg, *rest)
    
    monkeypatch.setattr("studio.server.Path", mock_path)
    
    # 1. Add shot
    add_resp = client.post("/api/storyboard/add-shot", json={"after_shot_id": "s1", "dialogue": "New shot"})
    assert add_resp.status_code == 200
    added_shot = add_resp.json()["shot"]
    assert added_shot["dialogue"] == "New shot"
    
    # 2. Reorder shots
    reorder_resp = client.post("/api/storyboard/reorder-shots", json={"shot_ids": ["s2", added_shot["id"], "s1"]})
    assert reorder_resp.status_code == 200
    assert reorder_resp.json()["shots_count"] == 3
    
    # 3. Delete shot
    del_resp = client.post("/api/storyboard/delete-shot", json={"shot_id": added_shot["id"]})
    assert del_resp.status_code == 200
    assert del_resp.json()["shot_id"] == added_shot["id"]

def test_api_projects_list_and_delete(tmp_path, monkeypatch):
    import json
    from pathlib import Path

    proj_dir = tmp_path / "projects" / "proj_test"
    proj_dir.mkdir(parents=True, exist_ok=True)
    meta = {
        "id": "proj_test",
        "title": "Saved Film",
        "topic": "Atlantis",
        "video_file": "movie.mp4",
        "srt_file": "movie.srt",
        "thumb_file": "thumb.png"
    }
    (proj_dir / "metadata.json").write_text(json.dumps(meta), encoding="utf-8")

    orig_path = Path
    def mock_path(arg, *rest):
        if str(arg) == "outputs/projects":
            return tmp_path / "projects"
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    # List projects
    resp = client.get("/api/projects")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Saved Film"
    assert "/api/outputs/projects/proj_test/movie.mp4" in data[0]["video_url"]

    # Delete project
    del_resp = client.delete("/api/projects/proj_test")
    assert del_resp.status_code == 200
    assert not proj_dir.exists()

def test_api_project_seo(tmp_path, monkeypatch):
    import json
    from pathlib import Path

    proj_dir = tmp_path / "projects" / "proj_seo"
    proj_dir.mkdir(parents=True, exist_ok=True)
    meta = {
        "id": "proj_seo",
        "title": "Atlantis Rising",
        "topic": "The mystery of deep ocean empire",
        "style": "cinematic",
        "episode": 2,
        "series_title": "Ancient Mysteries",
        "video_file": "movie.mp4"
    }
    (proj_dir / "metadata.json").write_text(json.dumps(meta), encoding="utf-8")

    sb_data = {
        "title": "Atlantis Rising",
        "shots": [
            {"id": "s1", "chapter": 1, "dialogue": "We reached the ruins", "duration": 4.5},
            {"id": "s2", "chapter": 2, "dialogue": "The guardian awoke", "duration": 6.0},
        ]
    }
    (proj_dir / "storyboard.json").write_text(json.dumps(sb_data), encoding="utf-8")

    orig_path = Path
    def mock_path(arg, *rest):
        if str(arg) == "outputs/projects":
            return tmp_path / "projects"
        if str(arg) == "outputs/projects/proj_seo":
            return proj_dir
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    resp = client.get("/api/projects/proj_seo/seo")
    assert resp.status_code == 200
    data = resp.json()
    assert data["project_id"] == "proj_seo"
    assert len(data["titles"]) >= 4
    assert len(data["chapters"]) == 2
    assert "00:00" in data["chapters"][0]["timestamp"]
    assert "00:04" in data["chapters"][1]["timestamp"]
    assert "Ancient Mysteries" in data["series_title"]
    assert data["episode"] == 2
    assert "#aifilm" in data["description"]
    assert len(data["tags"]) > 0

def test_websocket_pipeline():
    with client.websocket_connect("/ws/pipeline") as ws:
        # First message sent upon connect is current status
        data = ws.receive_json()
        assert data["type"] == "status"
        assert "stage" in data["data"]
        # Test ping-pong
        ws.send_text("ping")
        pong = ws.receive_json()
        assert pong["type"] == "pong"

def test_api_test_webhook():
    resp = client.post("/api/settings/test-webhook", json={"webhook_url": "https://example.com/webhook"})
    assert resp.status_code == 200
    assert resp.json()["success"] is True

def test_api_character_headshot_upload(tmp_path, monkeypatch):
    import base64
    from pathlib import Path

    orig_path = Path
    def mock_path(arg, *rest):
        if str(arg) == "outputs/characters":
            p = tmp_path / "characters"
            p.mkdir(parents=True, exist_ok=True)
            return p
        if str(arg) == "outputs/storyboard.json":
            return tmp_path / "dummy_sb.json"
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    # 1x1 transparent PNG in base64
    b64_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    resp = client.post("/api/characters/upload-headshot", json={
        "character_id": "hero_char",
        "image_base64": b64_png
    })
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert "hero_char" in resp.json()["headshot_url"]
