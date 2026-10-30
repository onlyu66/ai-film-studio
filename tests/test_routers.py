import pytest
from fastapi.testclient import TestClient
from studio.server import app

client = TestClient(app)

def test_router_modules_exist():
    from studio.routers import storyboard, vault, audio, video, projects
    assert storyboard.router is not None
    assert vault.router is not None
    assert audio.router is not None
    assert video.router is not None
    assert projects.router is not None

def test_storyboard_router_endpoints_mounted():
    # Verify storyboard templates endpoint is registered and responds
    resp = client.get("/api/storyboard/templates")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

def test_vault_router_endpoints_mounted():
    # Verify character vault endpoint responds
    resp = client.get("/api/characters/vault")
    assert resp.status_code == 200

def test_audio_router_endpoints_mounted():
    # Verify sfx catalog responds
    resp = client.get("/api/sfx/catalog")
    assert resp.status_code == 200

def test_video_router_endpoints_mounted():
    # Verify video presets respond
    resp = client.get("/api/video/enhancer/presets")
    assert resp.status_code == 200
    assert len(resp.json()) > 0

def test_projects_router_endpoints_mounted():
    # Verify projects list responds
    resp = client.get("/api/projects")
    assert resp.status_code == 200
