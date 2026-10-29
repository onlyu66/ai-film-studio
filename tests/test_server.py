import json
from pathlib import Path
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

def test_get_system_hardware_endpoint():
    resp = client.get("/api/system/hardware")
    assert resp.status_code == 200
    data = resp.json()
    assert "cpu_cores" in data
    assert "ram_total_gb" in data
    assert "recommended_profile" in data
    assert data["recommended_profile"] in ("eco", "balanced", "turbo")

def test_get_storyboard_templates_endpoints():
    # 1. List all templates
    resp = client.get("/api/storyboard/templates")
    assert resp.status_code == 200
    templates = resp.json()
    assert isinstance(templates, list)
    assert len(templates) >= 6
    ids = [t["id"] for t in templates]
    assert "cyberpunk_2077" in ids

    # 2. Get single template
    resp_single = client.get("/api/storyboard/templates/cyberpunk_2077")
    assert resp_single.status_code == 200
    t = resp_single.json()
    assert t["id"] == "cyberpunk_2077"
    assert t["name"] == "Cyberpunk Viễn Tưởng 2077"
    assert "kael_zen" in t["characters"]

    # 3. 404 for invalid template
    resp_404 = client.get("/api/storyboard/templates/non_existent")
    assert resp_404.status_code == 404

def test_get_image_engines_endpoint():
    resp = client.get("/api/system/image-engines")
    assert resp.status_code == 200
    engines = resp.json()
    assert isinstance(engines, list)
    ids = [e["id"] for e in engines]
    assert "pollinations" in ids
    assert "sd_webui" in ids
    assert "comfyui" in ids

def test_test_image_engine_connection_endpoint():
    resp = client.post(
        "/api/settings/test-image-engine",
        json={"engine": "pollinations", "url": "https://image.pollinations.ai"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "pollinations"
    assert data["is_available"] is True

def test_get_video_models_endpoint():
    resp = client.get("/api/system/video-models")
    assert resp.status_code == 200
    models = resp.json()
    assert isinstance(models, list)
    assert len(models) >= 4
    ids = [m["id"] for m in models]
    assert "wan-video/wan-2.1-i2v-480p" in ids

def test_test_video_token_endpoint():
    # Empty token returns is_valid False
    resp = client.post("/api/settings/test-video-token", json={"token": ""})
    assert resp.status_code == 200
    assert resp.json()["is_valid"] is False

def test_get_subtitle_presets_endpoint():
    resp = client.get("/api/system/subtitle-presets")
    assert resp.status_code == 200
    presets = resp.json()
    assert isinstance(presets, list)
    assert len(presets) >= 6
    ids = [p["id"] for p in presets]
    assert "tiktok_bold" in ids
    assert "cinematic" in ids
    assert "cyberpunk" in ids

def test_download_subtitles_endpoint(tmp_path, monkeypatch):
    import json
    proj_dir = tmp_path / "outputs" / "projects" / "proj_sub_123"
    proj_dir.mkdir(parents=True, exist_ok=True)

    sb_json = {
        "title": "Sub Test Movie",
        "language": "vi",
        "shots": [
            {
                "id": "s1",
                "chapter": 1,
                "character_id": None,
                "dialogue": "Lời thoại phụ đề tiếng Việt",
                "image_prompt": "prompt 1",
                "motion": "zoom_in",
                "duration": 3.0,
            }
        ]
    }
    (proj_dir / "storyboard.json").write_text(json.dumps(sb_json), encoding="utf-8")

    orig_path = Path
    def mock_path(arg, *rest):
        str_arg = str(arg)
        if str_arg == "outputs/projects":
            return tmp_path / "outputs" / "projects"
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    # 1. Download SRT
    resp_srt = client.get("/api/projects/proj_sub_123/subtitles/srt")
    assert resp_srt.status_code == 200
    assert "attachment" in resp_srt.headers.get("content-disposition", "")
    assert ".srt" in resp_srt.headers.get("content-disposition", "")
    assert "Lời thoại phụ đề tiếng Việt" in resp_srt.text

    # 2. Download ASS
    resp_ass = client.get("/api/projects/proj_sub_123/subtitles/ass")
    assert resp_ass.status_code == 200
    assert "attachment" in resp_ass.headers.get("content-disposition", "")
    assert ".ass" in resp_ass.headers.get("content-disposition", "")
    assert "[Script Info]" in resp_ass.text
    assert "Lời thoại phụ đề tiếng Việt" in resp_ass.text

    # 3. Invalid format
    resp_invalid = client.get("/api/projects/proj_sub_123/subtitles/vtt")
    assert resp_invalid.status_code == 400

def test_get_bgm_catalog_endpoint():
    resp = client.get("/api/assets/bgm")
    assert resp.status_code == 200
    catalog = resp.json()
    assert isinstance(catalog, list)
    assert len(catalog) >= 8
    ids = [t["id"] for t in catalog]
    assert "cinematic" in ids
    assert "action" in ids
    assert "dramatic" in ids

def test_upload_bgm_endpoint(tmp_path, monkeypatch):
    import base64
    bgm_dir = tmp_path / "assets" / "bgm"
    bgm_dir.mkdir(parents=True, exist_ok=True)

    orig_path = Path
    def mock_path(arg, *rest):
        str_arg = str(arg)
        if str_arg == "assets/bgm" or str_arg.startswith("assets/bgm/"):
            return tmp_path / str_arg
        return orig_path(arg, *rest)

    monkeypatch.setattr("studio.server.Path", mock_path)

    raw_bytes = b"fake_mp3_content_data_1234567890" * 10
    b64_str = base64.b64encode(raw_bytes).decode("utf-8")
    resp = client.post("/api/assets/bgm/upload", json={"filename": "my_custom_music.mp3", "audio_base64": b64_str})
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "stream_url" in data
    assert "id" in data

def test_get_camera_presets_endpoint():
    resp = client.get("/api/camera/presets")
    assert resp.status_code == 200
    data = resp.json()
    assert "angles" in data
    assert "motions" in data
    assert "lenses" in data
    assert "lightings" in data
    assert len(data["angles"]) >= 6
    assert len(data["motions"]) >= 8

def test_multi_angle_coverage_endpoints(tmp_path, monkeypatch):
    sb_data = {
        "title": "Camera Test Film",
        "language": "en",
        "characters": {
            "c1": {
                "name": "Detective",
                "visual_anchor": "detective in trench coat",
                "voice": "en-US-GuyNeural",
                "seed": 1234,
            }
        },
        "shots": [
            {
                "id": "shot_cam_001",
                "chapter": 1,
                "character_id": "c1",
                "dialogue": "Check the perimeter.",
                "image_prompt": "Detective standing near an old warehouse",
                "motion": "zoom_in",
                "duration": 4.0,
            }
        ]
    }
    sb_file = Path("outputs/storyboard.json")
    sb_file.parent.mkdir(parents=True, exist_ok=True)
    sb_file.write_text(json.dumps(sb_data, ensure_ascii=False), encoding="utf-8")

    from unittest.mock import patch
    mock_render_res = {
        "wide": "/outputs/images/shot_cam_001_wide.png",
        "medium": "/outputs/images/shot_cam_001_medium.png",
        "close_up": "/outputs/images/shot_cam_001_close_up.png",
    }

    with patch("studio.camera_director.render_multi_angle_coverage", return_value=mock_render_res):
        resp = client.post("/api/shots/shot_cam_001/multi-angle", json={"angles": ["wide", "medium", "close_up"]})
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["shot_id"] == "shot_cam_001"
        assert "wide" in data["angles"]

    # Mock candidate file for apply-angle
    img_dir = Path("outputs/images")
    img_dir.mkdir(parents=True, exist_ok=True)
    wide_img = img_dir / "shot_cam_001_wide.png"
    wide_img.write_bytes(b"\x89PNG\r\n\x1a\n" + b"0" * 2000)

    resp_apply = client.post("/api/shots/shot_cam_001/apply-angle", json={"angle": "wide", "re_render_motion": False})
    assert resp_apply.status_code == 200
    data_apply = resp_apply.json()
    assert data_apply["success"] is True
    assert data_apply["applied_angle"] == "wide"

    # Verify storyboard was updated
    updated_sb = json.loads(sb_file.read_text(encoding="utf-8"))
    assert updated_sb["shots"][0]["camera_angle"] == "wide"

def test_get_lut_and_transition_presets_endpoints():
    resp_luts = client.get("/api/lut/presets")
    assert resp_luts.status_code == 200
    luts = resp_luts.json()
    assert isinstance(luts, list)
    assert len(luts) >= 8
    lut_ids = [l["id"] for l in luts]
    assert "teal_and_orange" in lut_ids
    assert "kodachrome_1970" in lut_ids

    resp_trans = client.get("/api/transitions/presets")
    assert resp_trans.status_code == 200
    transitions = resp_trans.json()
    assert isinstance(transitions, list)
    assert len(transitions) >= 8
    trans_ids = [t["id"] for t in transitions]
    assert "cut" in trans_ids
    assert "dissolve" in trans_ids


def test_voice_clone_and_dubbing_endpoints(tmp_path, monkeypatch):
    import base64
    from unittest.mock import patch

    # 1. GET /api/voice/list
    resp_list = client.get("/api/voice/list")
    assert resp_list.status_code == 200
    voices = resp_list.json()
    assert isinstance(voices, list)
    assert len(voices) >= 8

    # 2. POST /api/voice/clone
    dummy_audio_b64 = base64.b64encode(b"dummy mp3 data").decode("utf-8")
    resp_clone = client.post(
        "/api/voice/clone",
        json={
            "name": "Giọng Thuyết Minh Test",
            "provider": "local",
            "audio_base64": dummy_audio_b64,
            "description": "Giọng trầm điện ảnh",
            "lang": "vi",
            "gender": "male",
        },
    )
    assert resp_clone.status_code == 200
    cloned = resp_clone.json()
    assert cloned["name"] == "Giọng Thuyết Minh Test"
    assert cloned["provider"] == "local"
    assert "id" in cloned

    # 3. POST /api/voice/preview
    with patch("studio.voice_clone.synthesize_speech", return_value=tmp_path / "preview.mp3"):
        resp_prev = client.post(
            "/api/voice/preview",
            json={
                "text": "Kiểm tra chất lượng giọng nói",
                "voice_id": cloned["id"],
                "provider": "local",
                "lang": "vi",
            },
        )
        assert resp_prev.status_code == 200
        assert "audio_url" in resp_prev.json()

    # 4. POST /api/dubbing/create
    mock_dub_result = {
        "project_id": "proj_123",
        "target_lang": "en",
        "status": "completed",
        "translated_shots": [],
        "subtitle_path": "/fake/sub.srt",
    }
    with patch("studio.dubbing.run_dubbing_pipeline", return_value=mock_dub_result):
        resp_dub = client.post(
            "/api/dubbing/create",
            json={
                "project_id": "proj_123",
                "target_lang": "en",
            },
        )
        assert resp_dub.status_code == 200
        dub_data = resp_dub.json()
        assert dub_data["status"] == "completed"
        assert dub_data["target_lang"] == "en"


def test_reframe_endpoints(tmp_path, monkeypatch):
    from unittest.mock import patch

    # 1. GET /api/reframe/presets
    resp_presets = client.get("/api/reframe/presets")
    assert resp_presets.status_code == 200
    presets = resp_presets.json()
    assert isinstance(presets, list)
    assert len(presets) >= 3
    ids = [p["id"] for p in presets]
    assert "blur_padding" in ids
    assert "pan_scan" in ids

    # 2. POST /api/reframe/create
    proj_dir = Path("outputs/projects/proj_test_rf")
    proj_dir.mkdir(parents=True, exist_ok=True)
    master_file = proj_dir / "master_movie.mp4"
    master_file.write_bytes(b"dummy master video")

    out_file = proj_dir / "master_movie_9_16_blur_padding.mp4"

    try:
        with patch("studio.reframe.reframe_video", return_value=out_file):
            resp_create = client.post(
                "/api/reframe/create",
                json={
                    "project_id": "proj_test_rf",
                    "mode": "blur_padding",
                    "burn_subtitles": False,
                },
            )
            assert resp_create.status_code == 200
            data = resp_create.json()
            assert data["success"] is True
            assert "master_movie_9_16_blur_padding.mp4" in data["filename"]
    finally:
        import shutil
        if proj_dir.exists():
            shutil.rmtree(proj_dir, ignore_errors=True)

def test_character_vault_endpoints(tmp_path):
    # 1. GET /api/characters/vault
    resp_get = client.get("/api/characters/vault")
    assert resp_get.status_code == 200
    vault_chars = resp_get.json()
    assert isinstance(vault_chars, list)
    assert len(vault_chars) >= 2

    # 2. POST /api/characters/vault/save
    resp_save = client.post(
        "/api/characters/vault/save",
        json={
            "id": "char_vault_test_01",
            "name": "Nữ Điệp Viên",
            "visual_anchor": "28-year-old female secret agent in black catsuit",
            "voice": "vi-VN-HoaiMyNeural",
            "seed": 8888,
        }
    )
    assert resp_save.status_code == 200
    saved_data = resp_save.json()
    assert saved_data["success"] is True
    assert saved_data["character"]["id"] == "char_vault_test_01"

    # 3. POST /api/characters/vault/import into project
    import json
    proj_dir = Path("outputs/projects/proj_test_vault_imp")
    proj_dir.mkdir(parents=True, exist_ok=True)
    sb_path = proj_dir / "storyboard.json"
    sb_path.write_text(json.dumps({
        "title": "Vault Import Test",
        "language": "vi",
        "characters": {},
        "shots": []
    }), encoding="utf-8")

    try:
        resp_imp = client.post(
            "/api/characters/vault/import",
            json={
                "project_id": "proj_test_vault_imp",
                "vault_char_id": "char_vault_test_01"
            }
        )
        assert resp_imp.status_code == 200
        imp_data = resp_imp.json()
        assert imp_data["success"] is True
        assert imp_data["character"]["name"] == "Nữ Điệp Viên"

        # 4. DELETE /api/characters/vault/char_vault_test_01
        resp_del = client.delete("/api/characters/vault/char_vault_test_01")
        assert resp_del.status_code == 200
        assert resp_del.json()["success"] is True
    finally:
        import shutil
        if proj_dir.exists():
            shutil.rmtree(proj_dir, ignore_errors=True)


def test_split_shot_endpoint(tmp_path):
    import json
    proj_dir = Path("outputs/projects/proj_test_split")
    proj_dir.mkdir(parents=True, exist_ok=True)
    sb_path = proj_dir / "storyboard.json"
    sb_path.write_text(json.dumps({
        "title": "Split Test",
        "language": "vi",
        "characters": {},
        "shots": [
            {
                "id": "shot_orig",
                "chapter": 1,
                "character_id": None,
                "dialogue": "Đây là câu thoại dài cần tách",
                "image_prompt": "Cảnh quay phong cảnh",
                "motion": "zoom_in",
                "duration": 6.0
            }
        ]
    }), encoding="utf-8")

    try:
        resp = client.post(
            "/api/storyboard/split-shot",
            json={
                "shot_id": "shot_orig",
                "split_at_sec": 2.5,
                "project_id": "proj_test_split",
            }
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["total_shots"] == 2
        assert len(data["new_shots"]) == 2
        assert data["new_shots"][0]["id"] == "shot_orig"
        assert abs(data["new_shots"][0]["duration"] - 2.5) < 0.1
        assert "shot_orig_b" in data["new_shots"][1]["id"]
        assert abs(data["new_shots"][1]["duration"] - 3.5) < 0.1
    finally:
        import shutil
        if proj_dir.exists():
            shutil.rmtree(proj_dir, ignore_errors=True)

def test_sfx_endpoints(tmp_path):
    # 1. GET /api/sfx/catalog
    resp_cat = client.get("/api/sfx/catalog")
    assert resp_cat.status_code == 200
    catalog = resp_cat.json()
    assert isinstance(catalog, list)
    assert len(catalog) >= 24
    cat_ids = [item["id"] for item in catalog]
    assert "gunshot" in cat_ids
    assert "thunder" in cat_ids
    assert "heartbeat" in cat_ids

    # 2. GET /api/assets/sfx/thunder
    resp_audio = client.get("/api/assets/sfx/thunder")
    assert resp_audio.status_code in (200, 206)

    # 3. POST /api/sfx/suggest
    resp_sug = client.post(
        "/api/sfx/suggest",
        json={
            "prompt": "Sát thủ rút súng nổ vang trời",
            "dialogue": "Đứng lại!",
            "genre": "Hành động"
        }
    )
    assert resp_sug.status_code == 200
    sug = resp_sug.json()
    assert sug["sfx_id"] in ("gunshot", "explosion")
    assert sug["volume"] > 0
    assert "offset_ms" in sug

    # 4. POST /api/sfx/batch-suggest
    import json
    proj_dir = Path("outputs/projects/proj_test_sfx_batch")
    proj_dir.mkdir(parents=True, exist_ok=True)
    sb_path = proj_dir / "storyboard.json"
    sb_path.write_text(json.dumps({
        "title": "SFX Batch Test",
        "language": "vi",
        "genre": "Hành động",
        "characters": {},
        "shots": [
            {
                "id": "s1",
                "chapter": 1,
                "character_id": None,
                "dialogue": "Chạy mau!",
                "image_prompt": "Chiếc xe ô tô phanh gấp lốp rít trên đường",
                "motion": "zoom_in",
                "duration": 3.0
            }
        ]
    }), encoding="utf-8")

    try:
        resp_batch = client.post(
            "/api/sfx/batch-suggest",
            json={"project_id": "proj_test_sfx_batch", "overwrite_existing": True}
        )
        assert resp_batch.status_code == 200
        batch_data = resp_batch.json()
        assert batch_data["success"] is True
        assert batch_data["assigned_count"] >= 1
        assert len(batch_data["shots"]) >= 1
        assert batch_data["shots"][0]["sfx"] in ("car_skid", "city", "traffic")
    finally:
        import shutil
        if proj_dir.exists():
            shutil.rmtree(proj_dir, ignore_errors=True)


def test_video_enhancer_endpoints(monkeypatch, tmp_path):
    # 1. GET /api/video/enhancer/presets
    resp = client.get("/api/video/enhancer/presets")
    assert resp.status_code == 200
    presets = resp.json()
    assert isinstance(presets, list)
    assert len(presets) >= 5
    preset_ids = [p["id"] for p in presets]
    assert "4k_crisp" in preset_ids
    assert "fps_60_smooth" in preset_ids

    # Mock enhance_video to avoid actual FFmpeg rendering during test
    from unittest.mock import MagicMock
    mock_run = MagicMock()
    monkeypatch.setattr("subprocess.run", mock_run)

    # 2. POST /api/video/enhancer/enhance-shot
    dummy_shot_dir = Path("outputs/videos")
    dummy_shot_dir.mkdir(parents=True, exist_ok=True)
    dummy_shot_file = dummy_shot_dir / "shot_test_enhance.mp4"
    dummy_shot_file.write_bytes(b"shot_video_bytes")

    try:
        resp_shot = client.post(
            "/api/video/enhancer/enhance-shot",
            json={
                "shot_id": "shot_test_enhance",
                "preset_id": "4k_crisp"
            }
        )
        assert resp_shot.status_code == 200
        shot_data = resp_shot.json()
        assert shot_data["success"] is True
        assert shot_data["shot_id"] == "shot_test_enhance"
        assert "enhanced_url" in shot_data

        # 3. POST /api/video/enhancer/enhance-master
        dummy_master_file = Path("outputs/master_movie.mp4")
        dummy_master_file.write_bytes(b"master_video_bytes")

        resp_master = client.post(
            "/api/video/enhancer/enhance-master",
            json={
                "preset_id": "ultra_master_4k_60fps"
            }
        )
        assert resp_master.status_code == 200
        master_data = resp_master.json()
        assert master_data["success"] is True
        assert "enhanced_url" in master_data
    finally:
        if dummy_shot_file.exists():
            dummy_shot_file.unlink()
        if (dummy_shot_dir / "shot_test_enhance_enhanced.mp4").exists():
            (dummy_shot_dir / "shot_test_enhance_enhanced.mp4").unlink()
        if dummy_master_file.exists():
            dummy_master_file.unlink()
        if Path("outputs/master_movie_enhanced.mp4").exists():
            Path("outputs/master_movie_enhanced.mp4").unlink()
