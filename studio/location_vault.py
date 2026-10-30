"""Location & World-Building Consistency Engine Pro - Location Vault.
Manages persistent location and set profiles with immutable environment DNA anchors,
deterministic architectural details, lighting palettes, and scene assignment.
"""

from pathlib import Path
from typing import Dict, List, Optional, Any
import time

DEFAULT_VAULT_LOCATIONS: List[Dict[str, Any]] = [
    {
        "id": "cyber_alley",
        "name": "Hẻm Neon Cyberpunk 2099",
        "environment_dna": "Narrow cyberpunk metropolis alleyway, towering brutalist skyscrapers overhead with tangled holographic advertising cables, rain-slicked asphalt reflecting vibrant magenta and cyan neon signs, steam rising from underground sewer grates, retro-futuristic vending machines humming softly",
        "lighting": "High-contrast chiaroscuro lighting, sharp neon pink and electric blue rim lights, deep atmospheric shadowy corners",
        "color_palette": "Electric cyan, neon magenta, rainy asphalt black, amber glow",
        "seed": 2099,
        "preview_url": "/api/outputs/locations/cyber_alley.png",
        "tags": ["cyberpunk", "urban", "night", "rain"],
    },
    {
        "id": "deep_space_bridge",
        "name": "Khoang Chỉ Huy Tàu Không Gian (Deep Space Bridge)",
        "environment_dna": "Command deck of an interstellar dreadnought cruiser, massive panoramic curved reinforced blast-glass viewing window looking out into a spiral purple nebula with distant star clusters, ergonomic carbon-fiber operator consoles with glowing azure touch interfaces",
        "lighting": "Dim ambient command lighting with soft azure console luminescence and starfield rim glow",
        "color_palette": "Deep void navy, starlight white, electric azure, metallic gunmetal",
        "seed": 4040,
        "preview_url": "/api/outputs/locations/deep_space_bridge.png",
        "tags": ["sci-fi", "space", "spaceship", "interior"],
    },
    {
        "id": "thang_long_palace",
        "name": "Hoàng Thành Thăng Long (Đại Điện Hoàng Gia)",
        "environment_dna": "Imperial palace grand audience throne hall, towering carved ironwood pillars lacquered in scarlet and gold with dragon motifs, polished terracotta tile floor reflecting flickering silk lanterns, hand-carved gilded wooden throne elevated on marble steps",
        "lighting": "Warm flickering lantern light, golden atmospheric dust motes filtering through carved wooden lattice windows",
        "color_palette": "Imperial scarlet, antiqued gold, dark ironwood brown, warm amber",
        "seed": 1010,
        "preview_url": "/api/outputs/locations/thang_long_palace.png",
        "tags": ["historical", "ancient", "palace", "vietnamese"],
    },
    {
        "id": "neo_tokyo_lab",
        "name": "Phòng Thí Nghiệm Lượng Tử (Quantum AI Lab)",
        "environment_dna": "Ultra-clean subterranean quantum computing laboratory, central cylindrical chamber containing a suspended superconducting dilution refrigerator wrapped in polished copper coils and glass tubes with flowing luminescent coolant, sterile white composite walls, holographic volumetric server diagnostics",
        "lighting": "Pristine white clinical overhead strip lighting balanced with glowing teal liquid coolant reflections",
        "color_palette": "Sterile pearl white, copper bronze, glowing cyan teal, frosted glass",
        "seed": 8888,
        "preview_url": "/api/outputs/locations/neo_tokyo_lab.png",
        "tags": ["sci-fi", "tech", "laboratory", "indoor"],
    },
    {
        "id": "noir_jazz_bar",
        "name": "Quán Bar Jazz Noir Chiaroscuro",
        "environment_dna": "Moody 1950s underground jazz lounge, smoky air catching the beam of a single vintage amber spotlight on an empty brass saxophone and baby grand piano, mahogany bar counter with crystal whiskey decanters, dark green velvet circular booths, rain pattering against frosted leaded glass",
        "lighting": "Dramatic film noir chiaroscuro, low-key warm tungsten lamp light with heavy cinematic shadows",
        "color_palette": "Warm amber, deep mahogany, emerald velvet, smoky charcoal",
        "seed": 1950,
        "preview_url": "/api/outputs/locations/noir_jazz_bar.png",
        "tags": ["noir", "bar", "vintage", "atmospheric"],
    },
]

DEFAULT_LOCATION_VAULT_PATH = Path("outputs/locations/vault.json")

def ensure_sample_locations(loc_dir: Path) -> None:
    """Ensure placeholder preview images for sample vault locations exist (16:9 ratio)."""
    import subprocess
    loc_dir = Path(loc_dir)
    loc_dir.mkdir(parents=True, exist_ok=True)
    colors = {
        "cyber_alley.png": "0x150b28",
        "deep_space_bridge.png": "0x07112c",
        "thang_long_palace.png": "0x321308",
        "neo_tokyo_lab.png": "0x09222a",
        "noir_jazz_bar.png": "0x281908",
    }
    for name, col in colors.items():
        p = loc_dir / name
        if not p.exists():
            try:
                subprocess.run(
                    ["ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c={col}:s=640x360", "-frames:v", "1", str(p)],
                    check=True,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            except Exception:
                pass

def get_vault_path(override_path: Optional[Path] = None) -> Path:
    """Return the canonical path to the Location Vault file."""
    if override_path:
        return Path(override_path)
    return DEFAULT_LOCATION_VAULT_PATH

def get_vault_locations(vault_file: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Retrieve all locations in the Location Vault, initializing with curated defaults if empty."""
    from studio.storage import safe_read_json, atomic_write_json

    path = get_vault_path(vault_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    ensure_sample_locations(path.parent)

    if not path.exists():
        atomic_write_json(path, DEFAULT_VAULT_LOCATIONS, backup=True)
        return [dict(loc) for loc in DEFAULT_VAULT_LOCATIONS]

    data = safe_read_json(path)
    if isinstance(data, list):
        return [dict(loc) for loc in data]
    return []

def save_location_to_vault(loc_data: Dict[str, Any], vault_file: Optional[Path] = None) -> Dict[str, Any]:
    """Save or update a location profile in the Location Vault."""
    from studio.storage import atomic_write_json

    path = get_vault_path(vault_file)
    path.parent.mkdir(parents=True, exist_ok=True)

    locations = get_vault_locations(vault_file=path)
    loc_id = str(loc_data.get("id") or f"loc_{int(time.time())}_{len(locations)+1}")

    clean_profile = {
        "id": loc_id,
        "name": str(loc_data.get("name") or "Bối cảnh mới"),
        "environment_dna": str(loc_data.get("environment_dna") or ""),
        "lighting": str(loc_data.get("lighting") or "Cinematic ambient lighting"),
        "color_palette": str(loc_data.get("color_palette") or "Natural cinematic palette"),
        "seed": int(loc_data.get("seed") or 42),
        "preview_url": loc_data.get("preview_url"),
        "tags": loc_data.get("tags") or ["custom"],
        "created_at": loc_data.get("created_at") or int(time.time()),
    }

    # Upsert
    updated = False
    for i, l in enumerate(locations):
        if l.get("id") == loc_id:
            locations[i] = clean_profile
            updated = True
            break

    if not updated:
        locations.insert(0, clean_profile)

    atomic_write_json(path, locations, backup=True)
    return clean_profile

def delete_vault_location(loc_id: str, vault_file: Optional[Path] = None) -> bool:
    """Delete a location profile from the Location Vault."""
    from studio.storage import atomic_write_json

    path = get_vault_path(vault_file)
    if not path.exists():
        return False

    locations = get_vault_locations(vault_file=path)
    filtered = [l for l in locations if l.get("id") != loc_id]

    if len(filtered) == len(locations):
        return False

    atomic_write_json(path, filtered, backup=True)
    return True

def import_vault_location_to_storyboard(
    vault_loc_id: str,
    storyboard_path: Path,
    vault_file: Optional[Path] = None,
) -> Optional[Dict[str, Any]]:
    """Import a location from the Vault into an existing project storyboard."""
    from studio.storage import safe_read_json, atomic_write_json

    locations = get_vault_locations(vault_file=vault_file)
    vault_loc = next((l for l in locations if l.get("id") == vault_loc_id), None)
    if not vault_loc:
        return None

    sb_path = Path(storyboard_path)
    if not sb_path.exists():
        return None

    sb_data = safe_read_json(sb_path)
    if not isinstance(sb_data, dict):
        return None

    if "locations" not in sb_data or not isinstance(sb_data["locations"], dict):
        sb_data["locations"] = {}

    target_id = vault_loc["id"]
    sb_data["locations"][target_id] = {
        "id": target_id,
        "name": vault_loc["name"],
        "environment_dna": vault_loc["environment_dna"],
        "lighting": vault_loc.get("lighting", ""),
        "color_palette": vault_loc.get("color_palette", ""),
        "seed": vault_loc.get("seed", 42),
        "preview_url": vault_loc.get("preview_url"),
        "tags": vault_loc.get("tags", []),
    }

    atomic_write_json(sb_path, sb_data, backup=True)
    return dict(vault_loc)

def assign_location_to_shot(
    shot_id: str,
    loc_id: Optional[str],
    storyboard_path: Path,
) -> bool:
    """Assign or unassign a location to a specific shot in the storyboard."""
    from studio.storage import safe_read_json, atomic_write_json

    sb_path = Path(storyboard_path)
    if not sb_path.exists():
        return False

    sb_data = safe_read_json(sb_path)
    if not isinstance(sb_data, dict) or "shots" not in sb_data:
        return False

    matched = False
    for s in sb_data.get("shots", []):
        if s.get("id") == shot_id:
            s["location_id"] = loc_id if loc_id else None
            matched = True
            break

    if not matched:
        return False

    atomic_write_json(sb_path, sb_data, backup=True)
    return True

def build_location_prompt(loc_data: Dict[str, Any]) -> str:
    """Generate a cohesive environment description from a location profile."""
    parts = []
    name = loc_data.get("name")
    if name:
        parts.append(f"Setting: {name}")
    dna = loc_data.get("environment_dna")
    if dna:
        parts.append(dna)
    lighting = loc_data.get("lighting")
    if lighting:
        parts.append(f"Lighting: {lighting}")
    palette = loc_data.get("color_palette")
    if palette:
        parts.append(f"Color tone: {palette}")
    return ", ".join(parts)
