from pathlib import Path
from typing import Dict, List, Optional, Callable, Any
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
    aspect_ratio: str = "16:9",
    letterbox: bool = False,
    style: str = "cinematic",
) -> List[str]:
    """Construct the FFmpeg command line to generate smooth Ease-In-Out Ken Burns camera motion from a still image."""
    d = max(1, int(duration * fps))

    if aspect_ratio == "9:16":
        width, height = 1080, 1920
        scale_filter = "scale=-1:4000"
    else:
        scale_filter = "scale=4000:-1"

    # Cinematic sinusoidal S-curve ease-in-out factor: 0 at start, 1.0 at end, peak velocity at midpoint
    ease = f"(0.5-0.5*cos(PI*on/{d}))"
    motion_clean = (motion_type or "zoom_in").lower().strip()

    if motion_clean in ("zoom_out", "pull_out"):
        # Gentle dolly backwards from 1.15 to 1.0
        zoompan_expr = f"z='1.15-0.15*{ease}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    elif motion_clean in ("pan_left", "truck_left"):
        # Smooth truck left
        zoompan_expr = f"z='1.15':x='(iw-iw/zoom)*(1.0-{ease})':y='ih/2-(ih/zoom/2)'"
    elif motion_clean in ("pan_right", "truck_right"):
        # Smooth truck right
        zoompan_expr = f"z='1.15':x='(iw-iw/zoom)*{ease}':y='ih/2-(ih/zoom/2)'"
    elif motion_clean == "tilt_up":
        # Smooth pedestal tilt upwards
        zoompan_expr = f"z='1.15':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(1.0-{ease})'"
    elif motion_clean == "tilt_down":
        # Smooth pedestal tilt downwards
        zoompan_expr = f"z='1.15':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*{ease}'"
    elif motion_clean in ("handheld", "action", "shake"):
        # Organic handheld breathing camera motion with subtle harmonic drift
        zoompan_expr = f"z='1.08+0.04*{ease}':x='iw/2-(iw/zoom/2)+6*sin(4*PI*on/{d})':y='ih/2-(ih/zoom/2)+4*cos(3*PI*on/{d})'"
    else:  # default zoom_in / push_in
        # Gentle dolly push-in from 1.0 to 1.15
        zoompan_expr = f"z='1.0+0.15*{ease}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"

    vf_filters = [f"{scale_filter},zoompan={zoompan_expr}:d={d}:s={width}x{height}:fps={fps}"]

    if vfx:
        # Style-tailored color grading
        style_clean = (style or "cinematic").lower()
        if style_clean == "noir":
            vf_filters.append("vignette=PI/3,eq=contrast=1.25:saturation=0.0:brightness=-0.02")
        elif style_clean == "anime":
            vf_filters.append("eq=contrast=1.06:saturation=1.22:brightness=0.02")
        elif style_clean == "documentary":
            vf_filters.append("vignette=PI/5,eq=contrast=1.05:saturation=1.05:brightness=0.01")
        else:  # cinematic Hollywood teal & orange warmth
            vf_filters.append("vignette=PI/4,eq=contrast=1.10:saturation=1.14:brightness=0.01,colorbalance=rs=0.04:bs=-0.03:rm=0.02:bm=-0.01")

    # Optional 2.39:1 widescreen anamorphic letterbox (12% black bars on top and bottom)
    if letterbox and aspect_ratio != "9:16":
        vf_filters.append("drawbox=x=0:y=0:w=iw:h=ih*0.12:color=black@1.0:t=fill,drawbox=x=0:y=ih-ih*0.12:w=iw:h=ih*0.12:color=black@1.0:t=fill")

    vf_filter = ",".join(vf_filters)

    return [
        "ffmpeg",
        "-y",
        "-loop", "1",
        "-i", str(image_path),
        "-vf", vf_filter,
        "-t", str(float(duration)),
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-tune", "stillimage",
        "-threads", "0",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
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
    prompt: str = "",
    aspect_ratio: str = "16:9",
    letterbox: bool = False,
    style: str = "cinematic",
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
    cmd = build_ffmpeg_command(
        image_path,
        output_path,
        duration,
        motion_type,
        fps,
        vfx=vfx,
        aspect_ratio=aspect_ratio,
        letterbox=letterbox,
        style=style,
    )
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg motion rendering failed: {result.stderr.decode('utf-8', errors='ignore')}")

    return output_path

from concurrent.futures import ThreadPoolExecutor, as_completed

def run_motion_stage(
    storyboard: Storyboard,
    config: StudioConfig,
    state: StateManager,
    durations: Optional[Dict[str, float]] = None,
    progress_callback: Optional[Callable[..., None]] = None,
    cancel_event: Optional[Any] = None,
) -> Dict[str, Path]:
    """Run motion video clip generation for all shots in parallel with optional Lip-Sync and VFX."""
    if cancel_event and cancel_event.is_set():
        from studio.orchestrator import PipelineCancelledException
        raise PipelineCancelledException("Tiến trình sản xuất đã bị hủy.")

    img_dir = config.output_dir / "images"
    audio_dir = config.output_dir / "audio"
    vid_dir = config.output_dir / "videos"
    vid_dir.mkdir(parents=True, exist_ok=True)

    durations = durations or {}
    video_clips: Dict[str, Path] = {}

    pending_shots = []
    for shot in storyboard.shots:
        out_file = vid_dir / f"{shot.id}.mp4"
        if state.is_stage_complete(shot.id, "video") and out_file.exists() and out_file.stat().st_size > 0:
            video_clips[shot.id] = out_file
        else:
            img_file = img_dir / f"{shot.id}.png"
            if not img_file.exists() or img_file.stat().st_size < 1000:
                from studio.images import _create_fallback_image
                w, h = (720, 1280) if getattr(config, "aspect_ratio", "16:9") == "9:16" else (1280, 720)
                _create_fallback_image(img_file, width=w, height=h, label=shot.image_prompt or shot.id)
            pending_shots.append(shot)

    if pending_shots:
        total_shots = len(storyboard.shots)
        done_count = len(video_clips)

        def process_shot_motion(shot: Shot):
            out_file = vid_dir / f"{shot.id}.mp4"
            if cancel_event and cancel_event.is_set():
                return shot.id, out_file
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
                    aspect_ratio=getattr(config, "aspect_ratio", "16:9"),
                    letterbox=getattr(config, "letterbox", False),
                    style=getattr(config, "style", "cinematic"),
                )

            return shot.id, out_file

        max_workers = max(1, min(4, os.cpu_count() or 2, len(pending_shots)))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(process_shot_motion, s) for s in pending_shots]
            for future in as_completed(futures):
                if cancel_event and cancel_event.is_set():
                    executor.shutdown(wait=False, cancel_futures=True)
                    from studio.orchestrator import PipelineCancelledException
                    raise PipelineCancelledException("Tiến trình sản xuất đã bị hủy.")

                shot_id, out_path = future.result()
                video_clips[shot_id] = out_path
                state.mark_complete(shot_id, "video")
                state.save()
                done_count += 1
                if progress_callback:
                    pct = 65 + int(20 * (done_count / max(1, total_shots)))
                    log_msg = f"[Motion] Đã render clip cho phân cảnh '{shot_id}'"
                    try:
                        progress_callback(
                            4,
                            "Đang render chuyển động máy quay 2.5D...",
                            min(pct, 85),
                            log_msg,
                            shot_id=shot_id,
                            shot_idx=done_count,
                            shots_total=total_shots,
                            action="motion",
                        )
                    except TypeError:
                        progress_callback(
                            4,
                            "Đang render chuyển động máy quay 2.5D...",
                            min(pct, 85),
                            log_msg,
                        )

    return video_clips
