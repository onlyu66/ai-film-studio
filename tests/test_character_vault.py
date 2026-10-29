from pathlib import Path
import json
import pytest
from studio.character_vault import (
    get_vault_characters,
    save_character_to_vault,
    delete_vault_character,
    import_vault_character_to_storyboard,
    generate_multi_angle_prompts,
)

def test_get_vault_characters(tmp_path):
    vault_file = tmp_path / "vault.json"
    # When file doesn't exist, it should initialize with default curated characters
    chars = get_vault_characters(vault_file=vault_file)
    assert isinstance(chars, list)
    assert len(chars) >= 2
    assert vault_file.exists()

    first = chars[0]
    assert "id" in first
    assert "name" in first
    assert "visual_anchor" in first
    assert "seed" in first

def test_save_and_delete_vault_character(tmp_path):
    vault_file = tmp_path / "vault.json"
    new_char = {
        "id": "char_test_01",
        "name": "Thám tử Minh",
        "visual_anchor": "40-year-old Vietnamese detective, rugged face, trench coat",
        "voice": "vi-VN-NamMinhNeural",
        "seed": 12345,
        "headshot_url": "/api/outputs/images/headshot_minh.png",
    }

    # 1. Save
    saved = save_character_to_vault(new_char, vault_file=vault_file)
    assert saved["id"] == "char_test_01"
    assert saved["name"] == "Thám tử Minh"

    chars_after = get_vault_characters(vault_file=vault_file)
    assert any(c["id"] == "char_test_01" for c in chars_after)

    # 2. Delete
    deleted = delete_vault_character("char_test_01", vault_file=vault_file)
    assert deleted is True

    chars_final = get_vault_characters(vault_file=vault_file)
    assert not any(c["id"] == "char_test_01" for c in chars_final)

def test_import_vault_character_to_storyboard(tmp_path):
    vault_file = tmp_path / "vault.json"
    sb_file = tmp_path / "storyboard.json"

    # Pre-populate vault
    save_character_to_vault({
        "id": "hero_01",
        "name": "Chiến binh Rồng",
        "visual_anchor": "Warrior with dragon armor",
        "voice": "vi-VN-NamMinhNeural",
        "seed": 9999,
    }, vault_file=vault_file)

    # Pre-populate empty storyboard
    sb_file.write_text(json.dumps({
        "title": "Dragon Film",
        "language": "vi",
        "characters": {},
        "shots": []
    }), encoding="utf-8")

    # Import
    imported = import_vault_character_to_storyboard("hero_01", storyboard_path=sb_file, vault_file=vault_file)
    assert imported is not None
    assert imported["id"] == "hero_01"
    assert imported["name"] == "Chiến binh Rồng"

    # Verify storyboard on disk has the character
    with open(sb_file, "r", encoding="utf-8") as f:
        sb_data = json.load(f)
    assert "hero_01" in sb_data["characters"]
    assert sb_data["characters"]["hero_01"]["seed"] == 9999

def test_generate_multi_angle_prompts():
    anchor = "Young female cyberpunk pilot with neon purple hair"
    prompts = generate_multi_angle_prompts(anchor, style="cinematic")
    assert "frontal" in prompts
    assert "three_quarter" in prompts
    assert "profile" in prompts
    assert anchor in prompts["frontal"]
    assert anchor in prompts["three_quarter"]
    assert anchor in prompts["profile"]
