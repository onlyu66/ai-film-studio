"""Character & Style Consistency Engine Pro - Character Vault.
Manages persistent character profiles with immutable visual DNA anchors,
deterministic seed locking, and multi-angle headshot generation.
"""

from pathlib import Path
from typing import Dict, List, Optional, Any
import time

DEFAULT_VAULT_CHARACTERS: List[Dict[str, Any]] = [
    {
        "id": "alex_cyberpunk",
        "name": "Alex Vũ (Cyberpunk Mercenary)",
        "visual_anchor": "30-year-old Vietnamese cyberpunk mercenary, short textured chrome-silver undercut hair, cybernetic glowing neon-cyan ocular implant on left eye, jawline stubble, wearing high-collar distressed techwear jacket with carbon-fiber shoulder pads",
        "voice": "vi-VN-NamMinhNeural",
        "seed": 4242,
        "headshot_url": "/api/outputs/characters/alex_headshot.png",
        "tags": ["cyberpunk", "mercenary", "male", "hero"],
    },
    {
        "id": "maya_rogue_ai",
        "name": "Maya Lâm (Rogue Coder)",
        "visual_anchor": "27-year-old female rogue AI coder, sleek asymmetrical jet-black bob haircut with neon magenta tips, piercing amber eyes, subtle holographic biometric tattoos on temples, wearing matte-black insulated tactical coat",
        "voice": "vi-VN-HoaiMyNeural",
        "seed": 7777,
        "headshot_url": "/api/outputs/characters/maya_headshot.png",
        "tags": ["cyberpunk", "hacker", "female", "tech"],
    },
    {
        "id": "commander_tran",
        "name": "Tướng Trần Long (Dragon Commander)",
        "visual_anchor": "32-year-old heroic Vietnamese warrior commander, rugged determined handsome face, battle scar over right cheekbone, topknot hairstyle tied with crimson silk ribbon, intense dark brown eyes, wearing ornate bronze and hammered steel lamellar dragon-scale armor",
        "voice": "vi-VN-NamMinhNeural",
        "seed": 1080,
        "headshot_url": "/api/outputs/characters/tran_headshot.png",
        "tags": ["historical", "commander", "male", "warrior"],
    },
    {
        "id": "linh_swordswoman",
        "name": "Linh Kiếm Sĩ (Shadow Swordswoman)",
        "visual_anchor": "24-year-old agile martial arts swordswoman, sharp graceful features, long flowing silky raven hair bound in high leather ponytail, alert obsidian eyes, wearing midnight-blue silk traveling robes fitted with lightweight leather vambraces",
        "voice": "vi-VN-HoaiMyNeural",
        "seed": 2026,
        "headshot_url": "/api/outputs/characters/linh_headshot.png",
        "tags": ["historical", "martial_arts", "female", "ninja"],
    },
]

DEFAULT_VAULT_PATH = Path("outputs/characters/vault.json")

def get_vault_path(override_path: Optional[Path] = None) -> Path:
    """Return the canonical path to the Character Vault file."""
    if override_path:
        return Path(override_path)
    return DEFAULT_VAULT_PATH

def get_vault_characters(vault_file: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Retrieve all characters in the Character Vault, initializing with curated defaults if empty."""
    from studio.storage import safe_read_json, atomic_write_json

    path = get_vault_path(vault_file)
    path.parent.mkdir(parents=True, exist_ok=True)

    if not path.exists():
        # Initialize with curated defaults
        atomic_write_json(path, DEFAULT_VAULT_CHARACTERS, backup=True)
        return [dict(c) for c in DEFAULT_VAULT_CHARACTERS]

    data = safe_read_json(path)
    if isinstance(data, list):
        return [dict(c) for c in data]
    return []

def save_character_to_vault(char_data: Dict[str, Any], vault_file: Optional[Path] = None) -> Dict[str, Any]:
    """Save or update a character profile in the Character Vault."""
    from studio.storage import atomic_write_json

    path = get_vault_path(vault_file)
    path.parent.mkdir(parents=True, exist_ok=True)

    chars = get_vault_characters(vault_file=path)
    char_id = str(char_data.get("id") or f"char_{int(time.time())}_{len(chars)+1}")

    clean_profile = {
        "id": char_id,
        "name": str(char_data.get("name") or "Diễn viên mới"),
        "visual_anchor": str(char_data.get("visual_anchor") or ""),
        "voice": str(char_data.get("voice") or "vi-VN-NamMinhNeural"),
        "seed": int(char_data.get("seed") or 42),
        "headshot_url": char_data.get("headshot_url"),
        "tags": char_data.get("tags") or ["custom"],
        "created_at": char_data.get("created_at") or int(time.time()),
    }

    # Upsert
    updated = False
    for i, c in enumerate(chars):
        if c.get("id") == char_id:
            chars[i] = clean_profile
            updated = True
            break

    if not updated:
        chars.insert(0, clean_profile)

    atomic_write_json(path, chars, backup=True)
    return clean_profile

def delete_vault_character(char_id: str, vault_file: Optional[Path] = None) -> bool:
    """Delete a character profile from the Character Vault."""
    from studio.storage import atomic_write_json

    path = get_vault_path(vault_file)
    if not path.exists():
        return False

    chars = get_vault_characters(vault_file=path)
    filtered = [c for c in chars if c.get("id") != char_id]

    if len(filtered) == len(chars):
        return False

    atomic_write_json(path, filtered, backup=True)
    return True

def import_vault_character_to_storyboard(
    vault_char_id: str,
    storyboard_path: Path,
    vault_file: Optional[Path] = None,
) -> Optional[Dict[str, Any]]:
    """Import a character from the Vault into an existing project storyboard."""
    from studio.storage import safe_read_json, atomic_write_json

    chars = get_vault_characters(vault_file=vault_file)
    vault_char = next((c for c in chars if c.get("id") == vault_char_id), None)
    if not vault_char:
        return None

    sb_path = Path(storyboard_path)
    if not sb_path.exists():
        return None

    sb_data = safe_read_json(sb_path)
    if not isinstance(sb_data, dict):
        return None

    if "characters" not in sb_data or not isinstance(sb_data["characters"], dict):
        sb_data["characters"] = {}

    target_id = vault_char["id"]
    sb_data["characters"][target_id] = {
        "name": vault_char["name"],
        "visual_anchor": vault_char["visual_anchor"],
        "voice": vault_char["voice"],
        "seed": vault_char["seed"],
        "headshot_url": vault_char.get("headshot_url"),
    }

    atomic_write_json(sb_path, sb_data, backup=True)
    return dict(vault_char)

def generate_multi_angle_prompts(visual_anchor: str, style: str = "cinematic") -> Dict[str, str]:
    """Generate specialized cinematography prompts for 3 standard facial angles to evaluate consistency."""
    clean_anchor = str(visual_anchor).strip()
    return {
        "frontal": f"Cinematic frontal studio portrait headshot of {clean_anchor}, looking directly at camera, eye level, neutral determined expression, {style} lighting, photorealistic 8k, masterpiece",
        "three_quarter": f"Cinematic three-quarter angle portrait headshot of {clean_anchor}, 45 degree angle turn, dynamic rim lighting, dramatic expression, {style}, photorealistic 8k, masterpiece",
        "profile": f"Cinematic side profile headshot of {clean_anchor}, 90 degree side view, silhouette edge lighting, deep shadows, {style}, photorealistic 8k, masterpiece",
    }
