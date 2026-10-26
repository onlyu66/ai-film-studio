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
