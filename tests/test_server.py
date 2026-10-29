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

def test_clean_outputs_preserves_projects(tmp_path, monkeypatch):
    from pathlib import Path
    import json

    out_dir = tmp_path / "outputs"
    (out_dir / "images").mkdir(parents=True, exist_ok=True)
    (out_dir / "images" / "test.png").write_text("dummy", encoding="utf-8")
    (out_dir / "storyboard.json").write_text("{}", encoding="utf-8")

    proj_dir = out_dir / "projects" / "proj_keep"
    proj_dir.mkdir(parents=True, exist_ok=True)
    (proj_dir / "metadata.json").write_text(json.dumps({"id": "proj_keep"}), encoding="utf-8")

    orig_path = Path
    def mock_path(arg, *rest):
        if str(arg) == "outputs":
            return out_dir
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    resp = client.post("/api/clean")
    assert resp.status_code == 200

    # Ensure projects directory and its contents are strictly preserved!
    assert (proj_dir / "metadata.json").exists()
    # Ensure temporary images and storyboard were wiped
    assert not (out_dir / "images" / "test.png").exists()
    assert not (out_dir / "storyboard.json").exists()

def test_update_shot_resets_checkpoints(tmp_path, monkeypatch):
    import json
    from pathlib import Path
    from studio.state import StateManager

    out_dir = tmp_path / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "audio").mkdir(parents=True, exist_ok=True)
    (out_dir / "videos").mkdir(parents=True, exist_ok=True)

    sb_file = out_dir / "storyboard.json"
    sb_file.write_text(json.dumps({
        "title": "Test",
        "characters": {},
        "shots": [{"id": "s1", "dialogue": "Original", "character_id": None}]
    }), encoding="utf-8")

    state_file = out_dir / "state.json"
    state = StateManager(state_file)
    state.mark_complete("s1", "audio")
    state.mark_complete("s1", "video")
    state.save()

    audio_file = out_dir / "audio" / "s1.mp3"
    audio_file.write_text("audio content", encoding="utf-8")
    video_file = out_dir / "videos" / "s1.mp4"
    video_file.write_text("video content", encoding="utf-8")

    orig_path = Path
    def mock_path(arg, *rest):
        s = str(arg)
        if s == "outputs/storyboard.json":
            return sb_file
        if s == "outputs/state.json":
            return state_file
        if s == "outputs/audio/s1.mp3":
            return audio_file
        if s == "outputs/videos/s1.mp4":
            return video_file
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    resp = client.post("/api/storyboard/update-shot", json={
        "shot_id": "s1",
        "dialogue": "Updated Dialogue"
    })
    assert resp.status_code == 200

    # Audio should be unlinked for fresh TTS, but video is PRESERVED (no need to re-render video)
    assert not audio_file.exists()
    assert video_file.exists()

    # When image_prompt is changed, video is unlinked
    resp2 = client.post("/api/storyboard/update-shot", json={
        "shot_id": "s1",
        "image_prompt": "Updated Image Prompt"
    })
    assert resp2.status_code == 200
    assert not video_file.exists()

    # State checkpoint for s1 video should be reset after visual prompt change
    state_reloaded = StateManager(state_file)
    assert not state_reloaded.is_stage_complete("s1", "video")

def test_update_shot_volume_controls(tmp_path, monkeypatch):
    import json
    from pathlib import Path

    sb_file = tmp_path / "storyboard.json"
    sb_file.write_text(json.dumps({
        "title": "Test",
        "characters": {},
        "shots": [{"id": "s1", "dialogue": "Line", "voice_volume": 1.0, "sfx_volume": 1.0}]
    }), encoding="utf-8")

    orig_path = Path
    def mock_path(arg, *rest):
        if str(arg) == "outputs/storyboard.json":
            return sb_file
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    resp = client.post("/api/storyboard/update-shot", json={
        "shot_id": "s1",
        "voice_volume": 1.5,
        "sfx_volume": 0.8
    })
    assert resp.status_code == 200
    data = json.loads(sb_file.read_text(encoding="utf-8"))
    assert data["shots"][0]["voice_volume"] == 1.5
    assert data["shots"][0]["sfx_volume"] == 0.8

def test_approve_shot(tmp_path, monkeypatch):
    import json
    from pathlib import Path

    sb_file = tmp_path / "storyboard.json"
    sb_file.write_text(json.dumps({
        "title": "Test",
        "characters": {},
        "shots": [{"id": "s1", "is_approved": False}]
    }), encoding="utf-8")

    orig_path = Path
    def mock_path(arg, *rest):
        if str(arg) == "outputs/storyboard.json":
            return sb_file
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    resp = client.post("/api/storyboard/approve-shot", json={"shot_id": "s1", "approved": True})
    assert resp.status_code == 200
    assert resp.json()["is_approved"] is True

    # Verify persisted in file
    content = json.loads(sb_file.read_text(encoding="utf-8"))
    assert content["shots"][0]["is_approved"] is True

def test_assemble_master_validation(tmp_path, monkeypatch):
    import json
    from pathlib import Path

    sb_file = tmp_path / "storyboard.json"
    sb_file.write_text(json.dumps({
        "title": "Test",
        "characters": {},
        "shots": [{"id": "s_missing"}]
    }), encoding="utf-8")

    orig_path = Path
    def mock_path(arg, *rest):
        if str(arg) == "outputs/storyboard.json":
            return sb_file
        if str(arg) == "outputs/videos":
            return tmp_path / "videos"
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    resp = client.post("/api/storyboard/assemble-master", json={})
    # Should fail with 400 because video clips are missing
    assert resp.status_code == 400
    assert "chưa được render" in resp.json()["detail"]

def test_storyboard_caching(tmp_path, monkeypatch):
    import json
    from pathlib import Path

    sb_file = tmp_path / "storyboard.json"
    sb_file.write_text(json.dumps({
        "title": "Cached Film",
        "characters": {},
        "shots": [{"id": "s1", "dialogue": "Hello"}]
    }), encoding="utf-8")

    orig_path = Path
    def mock_path(arg, *rest):
        if str(arg) == "outputs/storyboard.json":
            return sb_file
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    # First fetch (populates cache)
    resp1 = client.get("/api/storyboard")
    assert resp1.status_code == 200
    assert resp1.json()["title"] == "Cached Film"

    # Second fetch (serves from cache)
    resp2 = client.get("/api/storyboard")
    assert resp2.status_code == 200
    assert resp2.json()["shots"][0]["dialogue"] == "Hello"

def test_gzip_compression_enabled():
    from starlette.middleware.gzip import GZipMiddleware
    # Verify GZipMiddleware is in the FastAPI middleware stack
    has_gzip = any(m.cls == GZipMiddleware for m in app.user_middleware)
    assert has_gzip, "GZipMiddleware should be registered in FastAPI app"

def test_render_shot_audio_endpoint(tmp_path, monkeypatch):
    import json
    from pathlib import Path

    out_dir = tmp_path / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "audio").mkdir(parents=True, exist_ok=True)

    sb_file = out_dir / "storyboard.json"
    sb_file.write_text(json.dumps({
        "title": "Audio Test",
        "language": "vi",
        "characters": {},
        "shots": [{"id": "shot_test_01", "dialogue": "Xin chào thế giới", "character_id": None}]
    }), encoding="utf-8")

    orig_path = Path
    def mock_path(arg, *rest):
        str_arg = str(arg)
        if str_arg == "outputs/storyboard.json":
            return sb_file
        if str_arg == "outputs/audio":
            return out_dir / "audio"
        if str_arg.startswith("outputs/"):
            return out_dir / str_arg.replace("outputs/", "")
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    dummy_audio = out_dir / "audio" / "shot_test_01.mp3"
    dummy_audio.write_text("fake audio")
    monkeypatch.setattr("studio.tts.generate_audio_for_shot", lambda **kwargs: dummy_audio)
    monkeypatch.setattr("studio.tts.get_audio_duration", lambda p: 4.2)

    resp = client.post("/api/storyboard/render-shot-audio", json={"shot_id": "shot_test_01"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["shot_id"] == "shot_test_01"
    assert data["duration"] == 4.2
    assert "shot_test_01.mp3" in data["audio_url"]

def test_export_timeline_endpoint(tmp_path, monkeypatch):
    import json
    from pathlib import Path

    out_dir = tmp_path / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    sb_file = out_dir / "storyboard.json"
    sb_file.write_text(json.dumps({
        "title": "Timeline Export Test",
        "language": "vi",
        "characters": {},
        "shots": [
            {"id": "shot_01", "dialogue": "Lời thoại số 1", "duration": 4.0, "image_prompt": "Cảnh 1"}
        ]
    }), encoding="utf-8")

    orig_path = Path
    def mock_path(arg, *rest):
        str_arg = str(arg)
        if str_arg == "outputs/storyboard.json":
            return sb_file
        if str_arg.startswith("outputs/"):
            return out_dir / str_arg.replace("outputs/", "")
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    # 1. Export current storyboard timeline
    resp = client.get("/api/storyboard/export-timeline?format=fcpxml&aspect_ratio=16:9&fps=25")
    assert resp.status_code == 200
    assert "attachment" in resp.headers.get("content-disposition", "")
    assert ".fcpxml" in resp.headers.get("content-disposition", "")
    assert "<fcpxml version=\"1.8\">" in resp.text
    assert "Lời thoại số 1" in resp.text

def test_export_project_timeline_endpoint(tmp_path, monkeypatch):
    import json
    from pathlib import Path

    proj_dir = tmp_path / "outputs" / "projects" / "proj_test_123"
    proj_dir.mkdir(parents=True, exist_ok=True)
    sb_file = proj_dir / "storyboard.json"
    sb_file.write_text(json.dumps({
        "title": "Project Saved Film",
        "language": "vi",
        "characters": {},
        "shots": [
            {"id": "shot_p1", "dialogue": "Lời thoại lưu trữ", "duration": 5.0, "image_prompt": "Cảnh lưu trữ"}
        ]
    }), encoding="utf-8")

    orig_path = Path
    def mock_path(arg, *rest):
        str_arg = str(arg)
        if str_arg == "outputs/projects/proj_test_123/storyboard.json":
            return sb_file
        if "outputs/projects/proj_test_123" in str_arg:
            return proj_dir
        if str_arg == "outputs/projects":
            return tmp_path / "outputs" / "projects"
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    resp = client.get("/api/projects/proj_test_123/export-timeline?format=fcpxml")
    assert resp.status_code == 200
    assert "attachment" in resp.headers.get("content-disposition", "")
    assert ".fcpxml" in resp.headers.get("content-disposition", "")
    assert "<fcpxml version=\"1.8\">" in resp.text
    assert "Lời thoại lưu trữ" in resp.text

def test_cancel_pipeline_endpoints():
    import studio.server as srv

    # 1. When idle
    srv.pipeline_state["status"] = "idle"
    srv._cancel_event.clear()
    resp = client.post("/api/pipeline/cancel")
    assert resp.status_code == 200
    assert resp.json()["success"] is False
    assert "Không có tiến trình" in resp.json()["message"]

    # 2. When running
    srv.pipeline_state["status"] = "running"
    resp = client.post("/api/pipeline/cancel")
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert srv._cancel_event.is_set()

    # Reset
    srv.pipeline_state["status"] = "idle"
    srv._cancel_event.clear()

def test_status_endpoint_includes_per_shot_metadata():
    import studio.server as srv
    srv.pipeline_state["current_shot_id"] = "shot_test_99"
    srv.pipeline_state["current_shot_index"] = 4
    srv.pipeline_state["shots_total"] = 10
    srv.pipeline_state["active_action"] = "image"

    resp = client.get("/api/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_shot_id"] == "shot_test_99"
    assert data["current_shot_index"] == 4
    assert data["shots_total"] == 10
    assert data["active_action"] == "image"
    assert "can_cancel" in data

    # Reset
    srv.pipeline_state["current_shot_id"] = None
    srv.pipeline_state["current_shot_index"] = None
    srv.pipeline_state["shots_total"] = None
    srv.pipeline_state["active_action"] = None




