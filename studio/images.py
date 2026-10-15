from pathlib import Path
from typing import Dict, Optional
import urllib.parse
import time
import requests

from studio.storyboard import Storyboard, Shot, Character
from studio.config import StudioConfig
from studio.state import StateManager

STYLE_DNA = {
    "cinematic": "cinematic film still, 35mm photograph, anamorphic lens flare, photorealistic 8k, dramatic lighting, masterpiece",
    "anime": "vibrant anime style, Makoto Shinkai aesthetics, beautiful cinematic anime background, masterpiece",
    "noir": "classic film noir, deep shadows, high contrast, dramatic moody lighting, 1940s vintage atmosphere",
    "documentary": "national geographic documentary still, natural ambient lighting, hyperrealistic, authentic, 8k resolution",
}

def build_full_prompt(shot: Shot, characters: Dict[str, Character], style: str = "cinematic") -> str:
    """Compose the complete generation prompt incorporating character anchors and style DNA."""
    parts = []

    # 1. Prepend character visual anchor if applicable
    if shot.character_id and shot.character_id in characters:
        char = characters[shot.character_id]
        if char.visual_anchor:
            parts.append(char.visual_anchor)

    # 2. Shot scene prompt
    if shot.image_prompt:
        parts.append(shot.image_prompt)

    # 3. Style DNA suffix
    style_suffix = STYLE_DNA.get(style.lower(), STYLE_DNA["cinematic"])
    parts.append(style_suffix)

    return ", ".join(parts)

def generate_image_for_shot(
    shot: Shot,
    characters: Dict[str, Character],
    style: str,
    output_dir: Path,
    retries: int = 3,
    timeout: int = 30
) -> Optional[Path]:
    """Generate image via Pollinations API with exponential backoff retry. Returns file path or None."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    out_file = output_dir / f"{shot.id}.png"

    prompt = build_full_prompt(shot, characters, style)
    encoded_prompt = urllib.parse.quote(prompt)

    seed = 42
    if shot.character_id and shot.character_id in characters:
        seed = characters[shot.character_id].seed

    url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?model=flux&width=1280&height=720&seed={seed}&nologo=true"

    for attempt in range(retries):
        try:
            resp = requests.get(url, timeout=timeout)
            if resp.status_code == 200 and resp.content:
                with open(out_file, "wb") as f:
                    f.write(resp.content)
                return out_file
        except (requests.RequestException, Exception):
            if attempt < retries - 1:
                time.sleep(2 ** attempt)

    return None

def run_image_stage(
    storyboard: Storyboard,
    config: StudioConfig,
    state: StateManager
) -> Dict[str, Path]:
    """Run image generation for all shots in storyboard. Returns mapping of shot_id -> image_path."""
    img_dir = config.output_dir / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    images: Dict[str, Path] = {}

    for shot in storyboard.shots:
        out_file = img_dir / f"{shot.id}.png"

        if state.is_stage_complete(shot.id, "image") and out_file.exists():
            images[shot.id] = out_file
            continue

        result = generate_image_for_shot(
            shot=shot,
            characters=storyboard.characters,
            style=config.style,
            output_dir=img_dir,
        )

        if result and result.exists():
            images[shot.id] = result
        else:
            # Fallback placeholder 1280x720 black image if network unavailable
            _create_fallback_image(out_file)
            images[shot.id] = out_file

        state.mark_complete(shot.id, "image")
        state.save()

    return images

def _create_fallback_image(path: Path) -> None:
    """Create a minimal solid color PNG fallback if image generation fails."""
    # 1x1 black PNG binary
    png_1x1 = (
        b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
        b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc`\x00\x00'
        b'\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82'
    )
    with open(path, "wb") as f:
        f.write(png_1x1)
