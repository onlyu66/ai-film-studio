from pathlib import Path
from typing import Dict, List, Optional
import shutil
import subprocess

from studio.storyboard import Storyboard, Shot
from studio.config import StudioConfig
from studio.state import StateManager

import os
import requests
import time
from studio.lipsync import apply_lipsync_for_shot

def build_ffmpeg_command(
    image_path: Path,
    output_path: Path,
    duration: float,
    motion_type: str = "zoom_in",
    fps: int = 25,
    width: int = 1920,
    height: int = 1080,
    vfx: bool = False,
) -> List[str]:
    """Construct the FFmpeg command line to generate Ken Burns camera motion from a still image."""
    d = max(1, int(duration * fps))

    # Formulas for different 2.5D camera motions
    if motion_type == "zoom_out":
        zoompan_expr = f"z='if(eq(on,1),1.2,max(zoom-0.0015,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    elif motion_type == "pan_left":
        zoompan_expr = f"z='1.15':x='if(eq(on,1),iw-iw/zoom,max(x-1,0))':y='ih/2-(ih/zoom/2)'"
    elif motion_type == "pan_right":
        zoompan_expr = f"z='1.15':x='min(x+1,iw-iw/zoom)':y='ih/2-(ih/zoom/2)'"
    else:  # default zoom_in
        zoompan_expr = f"z='min(zoom+0.0015,1.2)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"

    vf_filters = [f"scale=4000:-1,zoompan={zoompan_expr}:d={d}:s={width}x{height}:fps={fps}"]

    if vfx:
        # Cinematic look: Vignette (dark corners) + subtle contrast & saturation boost + film grain
        vf_filters.append("vignette=PI/4,eq=contrast=1.08:saturation=1.12:brightness=0.01")

    vf_filter = ",".join(vf_filters)

    return [
        "ffmpeg",
        "-y",
        "-loop", "1",
        "-i", str(image_path),
        "-vf", vf_filter,
        "-t", str(float(duration)),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        str(output_path),
    ]

def _render_replicate_i2v(image_path: Path, output_path: Path, prompt: str = "") -> Optional[Path]:
    """Render dynamic AI video via Replicate Image-to-Video API."""
    api_token = os.environ.get("REPLICATE_API_TOKEN")
    if not api_token:
        print("  [Motion] Warning: REPLICATE_API_TOKEN not set. Falling back to Ken Burns.")
        return None

    import base64
    try:
        with open(image_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")

        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
            "Prefer": "wait",
        }
        payload = {
            "version": "78619623e12521c7bb5e2fce31ceea09ab7ff2ee", # Stable Video Diffusion / Hotshot-XL
            "input": {
                "input_image": f"data:image/png;base64,{img_b64}",
                "prompt": prompt or "cinematic motion, 4k photorealistic, fluid dynamic movement",
            }
        }
        resp = requests.post("https://api.replicate.com/v1/predictions", headers=headers, json=payload, timeout=90)
        if resp.status_code in (200, 201):
            res_data = resp.json()
            video_url = res_data.get("output")
            if video_url and isinstance(video_url, str):
                v_resp = requests.get(video_url, timeout=60)
                if v_resp.status_code == 200:
                    with open(output_path, "wb") as f:
                        f.write(v_resp.content)
                    return output_path
    except Exception as exc:
        print(f"  [Motion] Replicate I2V failed ({exc}). Falling back to Ken Burns.")

    return None

def render_motion_for_shot(
    image_path: Path,
    output_path: Path,
    duration: float,
    motion_type: str = "zoom_in",
    fps: int = 25,
    engine: str = "kenburns",
    prompt: str = ""
) -> Path:
    """Execute motion rendering for a single shot according to selected engine."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("FFmpeg executable not found. Please install ffmpeg.")

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if engine == "replicate":
        res = _render_replicate_i2v(image_path, output_path, prompt)
        if res:
            return res

    vfx = (engine == "vfx")
    cmd = build_ffmpeg_command(image_path, output_path, duration, motion_type, fps, vfx=vfx)
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg motion rendering failed: {result.stderr.decode('utf-8', errors='ignore')}")

    return output_path

from concurrent.futures import ThreadPoolExecutor, as_completed

def run_motion_stage(
    storyboard: Storyboard,
    config: StudioConfig,
    state: StateManager,
    durations: Optional[Dict[str, float]] = None
) -> Dict[str, Path]:
    """Run motion video clip generation for all shots in parallel with optional Lip-Sync and VFX."""
    img_dir = config.output_dir / "images"
    audio_dir = config.output_dir / "audio"
    vid_dir = config.output_dir / "videos"
    vid_dir.mkdir(parents=True, exist_ok=True)

    durations = durations or {}
    video_clips: Dict[str, Path] = {}

    pending_shots = []
    for shot in storyboard.shots:
        out_file = vid_dir / f"{shot.id}.mp4"
        if state.is_stage_complete(shot.id, "video") and out_file.exists():
            video_clips[shot.id] = out_file
        else:
            img_file = img_dir / f"{shot.id}.png"
            if img_file.exists():
                pending_shots.append(shot)

    if pending_shots:
        def process_shot_motion(shot: Shot):
            out_file = vid_dir / f"{shot.id}.mp4"
            img_file = img_dir / f"{shot.id}.png"
            shot_duration = durations.get(shot.id, shot.duration or 5.0)

            lipsync_success = False
            if config.lip_sync == "cloud" and shot.character_id and shot.dialogue.strip():
                audio_file = audio_dir / f"{shot.id}.mp3"
                res = apply_lipsync_for_shot(
                    image_path=img_file,
                    audio_path=audio_file,
                    output_path=out_file,
                    engine=config.lip_sync,
                )
                if res:
                    lipsync_success = True

            if not lipsync_success:
                render_motion_for_shot(
                    image_path=img_file,
                    output_path=out_file,
                    duration=shot_duration,
                    motion_type=shot.motion or "zoom_in",
                    engine=config.motion_engine,
                    prompt=shot.image_prompt,
                )

            return shot.id, out_file

        max_workers = max(1, min(4, os.cpu_count() or 2, len(pending_shots)))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(process_shot_motion, s) for s in pending_shots]
            for future in as_completed(futures):
                shot_id, out_path = future.result()
                video_clips[shot_id] = out_path
                state.mark_complete(shot_id, "video")
                state.save()

    return video_clips
