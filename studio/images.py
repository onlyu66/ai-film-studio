from pathlib import Path
from typing import Dict, Optional, Callable, Any
import urllib.parse
import time
import os
import shutil
import subprocess
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
    """Compose the complete generation prompt incorporating character visual DNA, cinematography framing, and style DNA."""
    parts = []

    # 1. Subject & Character Visual DNA Anchor
    if shot.character_id and shot.character_id in characters:
        char = characters[shot.character_id]
        if char.visual_anchor:
            parts.append(f"Subject: {char.name}, {char.visual_anchor}")

    # 2. Cinematography Framing, Angle & Lighting
    cine_cues = []
    if getattr(shot, "shot_size", None):
        cine_cues.append(f"{shot.shot_size.replace('_', ' ')} shot")
    if getattr(shot, "camera_angle", None):
        cine_cues.append(f"{shot.camera_angle.replace('_', ' ')} camera angle")
    if getattr(shot, "lighting", None):
        cine_cues.append(f"{shot.lighting.replace('_', ' ')} lighting")
    if cine_cues:
        parts.append(", ".join(cine_cues))

    # 3. Scene Action & Environment
    if shot.image_prompt:
        parts.append(shot.image_prompt)

    # 4. Cinematic Lens, Optical Quality & Style DNA
    lens_quality = "shot on 35mm anamorphic lens, f/1.8 aperture, shallow depth of field, photorealistic 8k, color graded, masterpiece"
    parts.append(lens_quality)

    style_suffix = STYLE_DNA.get(style.lower(), STYLE_DNA["cinematic"])
    parts.append(style_suffix)

    return ", ".join(parts)

def _is_valid_image_bytes(content: bytes) -> bool:
    """Validate that downloaded payload is genuine binary image and not error JSON or HTML."""
    if not content or len(content) < 4000:
        return False
    # Check magic bytes for PNG, JPEG, or WEBP
    if content.startswith(b"\x89PNG") or content.startswith(b"\xff\xd8"):
        return True
    if len(content) > 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return True
    # Discard JSON error responses or HTML error pages
    prefix = content[:100].lstrip()
    if prefix.startswith(b"{") or prefix.startswith(b"<"):
        return False
    return True

def generate_image_for_shot(
    shot: Shot,
    characters: Dict[str, Character],
    style: str,
    output_dir: Path,
    retries: int = 3,
    timeout: int = 25,
    aspect_ratio: str = "16:9",
    seed_override: Optional[int] = None,
    engine: Optional[str] = None,
    prompt_override: Optional[str] = None,
) -> Optional[Path]:
    """Generate image via Pollinations API with automatic key support and robust fallback. Returns file path or None."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    out_file = output_dir / f"{shot.id}.png"

    raw_prompt = prompt_override or build_full_prompt(shot, characters, style)
    # Sanitize prompt and limit length to avoid URI Too Long (414)
    clean_prompt = " ".join(raw_prompt.split())[:600]
    encoded_prompt = urllib.parse.quote(clean_prompt)

    seed = seed_override or 42
    if seed_override is None and shot.character_id and shot.character_id in characters:
        seed = characters[shot.character_id].seed

    if aspect_ratio == "9:16":
        w, h = 720, 1280
    elif aspect_ratio == "1:1":
        w, h = 1024, 1024
    else:
        w, h = 1280, 720

    pollen_key = os.environ.get("POLLINATIONS_API_KEY") or os.environ.get("POLLEN_API_KEY")

    # Build prioritized list of candidate URLs
    candidate_urls = []
    if pollen_key:
        candidate_urls.append(
            f"https://gen.pollinations.ai/image/{encoded_prompt}?key={pollen_key}&width={w}&height={h}&nologo=true"
        )
        candidate_urls.append(
            f"https://image.pollinations.ai/prompt/{encoded_prompt}?key={pollen_key}&width={w}&height={h}&seed={seed}&nologo=true"
        )
    else:
        # Without key, turbo and flux-realism are significantly more reliable than base flux
        candidate_urls.append(
            f"https://image.pollinations.ai/prompt/{encoded_prompt}?model=turbo&width={w}&height={h}&seed={seed}&nologo=true"
        )
        candidate_urls.append(
            f"https://image.pollinations.ai/prompt/{encoded_prompt}?model=flux-realism&width={w}&height={h}&seed={seed}&nologo=true"
        )

    # Secondary reliable photographic fallback if AI API is rate-limited or unavailable
    candidate_urls.append(
        f"https://picsum.photos/seed/{shot.id}_{seed}/{w}/{h}"
    )

    headers = {
        "User-Agent": "AIFilmStudio/1.0",
        "Accept": "image/*",
    }
    if pollen_key:
        headers["Authorization"] = f"Bearer {pollen_key}"

    for url in candidate_urls:
        for attempt in range(max(1, retries)):
            try:
                resp = requests.get(url, headers=headers, timeout=timeout)
                if resp.status_code == 200 and _is_valid_image_bytes(resp.content):
                    with open(out_file, "wb") as f:
                        f.write(resp.content)
                    return out_file
                # If rate-limited (402 or 429), break immediately to next candidate
                if resp.status_code in (402, 429):
                    break
            except (requests.RequestException, Exception):
                if attempt < retries - 1:
                    time.sleep(1.0)

    return None

from concurrent.futures import ThreadPoolExecutor, as_completed

def run_image_stage(
    storyboard: Storyboard,
    config: StudioConfig,
    state: StateManager,
    progress_callback: Optional[Callable[..., None]] = None,
    cancel_event: Optional[Any] = None,
) -> Dict[str, Path]:
    """Run image generation for all shots in storyboard in parallel with robust fallback. Returns mapping of shot_id -> image_path."""
    if cancel_event and cancel_event.is_set():
        from studio.orchestrator import PipelineCancelledException
        raise PipelineCancelledException("Tiến trình sản xuất đã bị hủy.")

    img_dir = config.output_dir / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    images: Dict[str, Path] = {}

    aspect_ratio = getattr(config, "aspect_ratio", "16:9")
    w, h = (720, 1280) if aspect_ratio == "9:16" else (1280, 720)

    pending_shots = []
    for shot in storyboard.shots:
        out_file = img_dir / f"{shot.id}.png"
        # Require file to exist and be > 5000 bytes to avoid stale 1x1 black pixel glitches
        if state.is_stage_complete(shot.id, "image") and out_file.exists() and out_file.stat().st_size > 5000:
            images[shot.id] = out_file
        else:
            pending_shots.append(shot)

    if pending_shots:
        total_shots = len(storyboard.shots)
        done_count = len(images)

        def process_shot_image(shot: Shot):
            out_file = img_dir / f"{shot.id}.png"
            if cancel_event and cancel_event.is_set():
                return shot.id, out_file
            result = generate_image_for_shot(
                shot=shot,
                characters=storyboard.characters,
                style=config.style,
                output_dir=img_dir,
                aspect_ratio=aspect_ratio,
            )
            if result and result.exists() and result.stat().st_size > 5000:
                return shot.id, result
            else:
                _create_fallback_image(out_file, width=w, height=h, label=shot.image_prompt or shot.id)
                return shot.id, out_file

        from studio.hardware import get_optimal_concurrency
        optimal_workers = get_optimal_concurrency("image", config)
        max_workers = max(1, min(optimal_workers, len(pending_shots)))

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(process_shot_image, s) for s in pending_shots]
            for future in as_completed(futures):
                if cancel_event and cancel_event.is_set():
                    executor.shutdown(wait=False, cancel_futures=True)
                    from studio.orchestrator import PipelineCancelledException
                    raise PipelineCancelledException("Tiến trình sản xuất đã bị hủy.")

                shot_id, img_path = future.result()
                images[shot_id] = img_path
                state.mark_complete(shot_id, "image")
                state.save()
                done_count += 1
                if progress_callback:
                    pct = 40 + int(25 * (done_count / max(1, total_shots)))
                    log_msg = f"[Visuals] Đã tạo ảnh cho phân cảnh '{shot_id}'"
                    try:
                        progress_callback(
                            3,
                            "Đang vẽ hình ảnh điện ảnh Flux...",
                            min(pct, 65),
                            log_msg,
                            shot_id=shot_id,
                            shot_idx=done_count,
                            shots_total=total_shots,
                            action="image",
                        )
                    except TypeError:
                        progress_callback(
                            3,
                            "Đang vẽ hình ảnh điện ảnh Flux...",
                            min(pct, 65),
                            log_msg,
                        )

    return images

def _write_solid_bmp(path: Path, width: int, height: int, r: int = 18, g: int = 21, b: int = 31) -> None:
    """Write an uncompressed valid full-size 24-bit BMP image in pure Python."""
    row_padded = (width * 3 + 3) & (~3)
    image_size = row_padded * height
    file_size = 54 + image_size
    header = bytearray(54)
    header[0:2] = b'BM'
    header[2:6] = file_size.to_bytes(4, 'little')
    header[10:14] = (54).to_bytes(4, 'little')
    header[14:18] = (40).to_bytes(4, 'little')
    header[18:22] = width.to_bytes(4, 'little')
    header[22:26] = height.to_bytes(4, 'little')
    header[26:28] = (1).to_bytes(2, 'little')
    header[28:30] = (24).to_bytes(2, 'little')
    header[34:38] = image_size.to_bytes(4, 'little')
    row = bytearray(row_padded)
    for x in range(width):
        row[x*3] = b
        row[x*3+1] = g
        row[x*3+2] = r
    with open(path, 'wb') as f:
        f.write(header)
        for _ in range(height):
            f.write(row)

def _create_fallback_image(path: Path, width: int = 1280, height: int = 720, label: str = "") -> None:
    """Create a high-resolution valid cinematic fallback image so FFmpeg motion rendering never fails."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    if shutil.which("ffmpeg"):
        safe_label = (label or "CINEMATIC SCENE").replace("'", "").replace(":", "-")[:60]
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", f"color=c=0x12151f:s={width}x{height}:d=1",
            "-vf", f"vignette=PI/4,drawbox=y=ih*0.65:color=black@0.65:width=iw:height=ih*0.35:t=fill,drawtext=text='{safe_label}':fontcolor=white@0.8:fontsize=32:x=(w-text_w)/2:y=h*0.78",
            "-vframes", "1",
            str(path)
        ]
        try:
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            if path.exists() and path.stat().st_size > 1000:
                return
        except Exception:
            pass

    # Pure Python fallback
    _write_solid_bmp(path, width, height, r=18, g=21, b=31)

