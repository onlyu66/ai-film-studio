"""Unit tests for Location & World-Building Consistency Engine (Location Vault Pro)."""

from pathlib import Path
import json
import pytest

from studio.location_vault import (
    DEFAULT_VAULT_LOCATIONS,
    get_vault_path,
    get_vault_locations,
    save_location_to_vault,
    delete_vault_location,
    import_vault_location_to_storyboard,
    assign_location_to_shot,
    build_location_prompt,
)
from studio.storyboard import Storyboard, Shot, Character

def test_default_vault_locations_exist():
    assert len(DEFAULT_VAULT_LOCATIONS) >= 4
    for loc in DEFAULT_VAULT_LOCATIONS:
        assert "id" in loc
        assert "name" in loc
        assert "environment_dna" in loc
        assert "seed" in loc
        assert "tags" in loc

def test_get_and_save_vault_locations(tmp_path: Path):
    vault_file = tmp_path / "locations" / "vault.json"
    
    # 1. First read creates default locations
    locations = get_vault_locations(vault_file=vault_file)
    assert len(locations) == len(DEFAULT_VAULT_LOCATIONS)
    assert vault_file.exists()

    # 2. Save a new custom location
    new_loc = {
        "id": "mars_greenhouse",
        "name": "Nhà Kính Sao Hỏa (Mars Bio-Dome)",
        "environment_dna": "High-tech hexagonal glass geodesic dome on red Martian surface, hydroponic spiraling towers of glowing lush green flora, dusty orange sunset visible through glass, titanium airlock doors",
        "lighting": "Warm ambient sunset through tinted hexagonal glass panels, bioluminescent green foliage",
        "color_palette": "Mars crimson orange, neon emerald green, matte silver titanium",
        "seed": 9999,
        "tags": ["sci-fi", "mars", "dome", "plants"],
    }
    saved = save_location_to_vault(new_loc, vault_file=vault_file)
    assert saved["id"] == "mars_greenhouse"
    assert saved["name"] == "Nhà Kính Sao Hỏa (Mars Bio-Dome)"

    # Verify persistence
    updated_locations = get_vault_locations(vault_file=vault_file)
    assert len(updated_locations) == len(DEFAULT_VAULT_LOCATIONS) + 1
    found = next((l for l in updated_locations if l["id"] == "mars_greenhouse"), None)
    assert found is not None
    assert found["seed"] == 9999

def test_delete_vault_location(tmp_path: Path):
    vault_file = tmp_path / "locations" / "vault.json"
    get_vault_locations(vault_file=vault_file)

    # Delete existing location
    target_id = DEFAULT_VAULT_LOCATIONS[0]["id"]
    deleted = delete_vault_location(target_id, vault_file=vault_file)
    assert deleted is True

    # Deleting again returns False
    deleted_again = delete_vault_location(target_id, vault_file=vault_file)
    assert deleted_again is False

    # Count reduced by 1
    current = get_vault_locations(vault_file=vault_file)
    assert len(current) == len(DEFAULT_VAULT_LOCATIONS) - 1

def test_import_vault_location_to_storyboard(tmp_path: Path):
    vault_file = tmp_path / "locations" / "vault.json"
    sb_file = tmp_path / "storyboard.json"

    # Create dummy storyboard
    sb = Storyboard(
        title="Test Film",
        language="vi",
        characters={"hero": Character(name="Alex", visual_anchor="Young warrior")},
        shots=[Shot(id="shot_001", chapter=1, character_id="hero", dialogue="Xin chào", image_prompt="Hero standing")]
    )
    sb_file.write_text(json.dumps(sb.to_dict(), ensure_ascii=False), encoding="utf-8")

    # Import default location
    loc_id = DEFAULT_VAULT_LOCATIONS[0]["id"]
    imported = import_vault_location_to_storyboard(loc_id, storyboard_path=sb_file, vault_file=vault_file)
    assert imported is not None
    assert imported["id"] == loc_id

    # Check storyboard content
    with open(sb_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert "locations" in data
    assert loc_id in data["locations"]
    assert data["locations"][loc_id]["name"] == DEFAULT_VAULT_LOCATIONS[0]["name"]

def test_assign_location_to_shot(tmp_path: Path):
    sb_file = tmp_path / "storyboard.json"
    sb_data = {
        "title": "Test Film",
        "language": "vi",
        "characters": {},
        "locations": {
            "cyber_alley": {
                "name": "Hẻm Cyberpunk",
                "environment_dna": "Dark alley with neon signs, puddles reflecting rain"
            }
        },
        "shots": [
            {"id": "shot_001", "chapter": 1, "character_id": None, "dialogue": "", "image_prompt": "Running", "location_id": None},
            {"id": "shot_002", "chapter": 1, "character_id": None, "dialogue": "", "image_prompt": "Talking", "location_id": None}
        ]
    }
    sb_file.write_text(json.dumps(sb_data, ensure_ascii=False), encoding="utf-8")

    # Assign location to shot_001
    success = assign_location_to_shot("shot_001", "cyber_alley", storyboard_path=sb_file)
    assert success is True

    with open(sb_file, "r", encoding="utf-8") as f:
        updated = json.load(f)
    assert updated["shots"][0]["location_id"] == "cyber_alley"
    assert updated["shots"][1]["location_id"] is None

def test_build_location_prompt():
    loc = {
        "name": "Phòng Thí Nghiệm Neo Tokyo",
        "environment_dna": "futuristic quantum computing server room, glowing liquid nitrogen pipes, holographic monitors",
        "lighting": "cool cyan rim lighting and deep shadow chiaroscuro",
        "color_palette": "cyan, navy, obsidian"
    }
    prompt = build_location_prompt(loc)
    assert "Phòng Thí Nghiệm Neo Tokyo" in prompt
    assert "futuristic quantum computing" in prompt
    assert "cool cyan rim lighting" in prompt

def test_api_location_vault_endpoints(monkeypatch, tmp_path: Path):
    from fastapi.testclient import TestClient
    from studio.server import app
    import studio.server as srv

    client = TestClient(app)

    # 1. Test GET /api/locations/vault
    resp = client.get("/api/locations/vault")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 4

    # 2. Test POST /api/locations/vault/save
    save_payload = {
        "id": "test_citadel",
        "name": "Thành Trì Cổ",
        "environment_dna": "Ancient stone fortress on mountain peak surrounded by clouds",
        "lighting": "Dramatic sunset rim light",
        "color_palette": "Stone gray and amber gold",
        "seed": 5555,
        "tags": ["fortress", "ancient"]
    }
    resp = client.post("/api/locations/vault/save", json=save_payload)
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert resp.json()["location"]["id"] == "test_citadel"

    # 3. Test POST /api/locations/generate-preview
    preview_payload = {
        "location_id": "test_citadel",
        "environment_dna": "Ancient stone fortress",
        "lighting": "Dramatic sunset",
        "color_palette": "Stone gray",
        "seed": 5555
    }
    resp = client.post("/api/locations/generate-preview", json=preview_payload)
    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert "preview_url" in resp.json()

    # 4. Test POST /api/locations/upload-preview (1x1 transparent png base64)
    png_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    upload_payload = {
        "location_id": "test_citadel",
        "image_base64": png_base64
    }
    resp = client.post("/api/locations/upload-preview", json=upload_payload)
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # 5. Test DELETE /api/locations/vault/test_citadel
    resp = client.delete("/api/locations/vault/test_citadel")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

