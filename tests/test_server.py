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
