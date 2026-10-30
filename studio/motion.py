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
    accel: str = "auto",
    color_lut: Optional[str] = None,
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

    if motion_clean in ("static", "none", "locked"):
        # Pure locked off static frame
        zoompan_expr = f"z='1.02':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    elif motion_clean in ("zoom_out", "pull_out"):
        # Gentle dolly backwards from 1.15 to 1.0
        zoompan_expr = f"z='1.15-0.15*{ease}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    elif motion_clean in ("dolly_in", "push_in_deep"):
        # Deep cinematic push-in from 1.0 to 1.25
        zoompan_expr = f"z='1.0+0.25*{ease}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
    elif motion_clean in ("dolly_out", "pull_out_deep"):
        # Deep cinematic pull-out from 1.25 down to 1.0
        zoompan_expr = f"z='1.25-0.25*{ease}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
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
    elif motion_clean in ("orbit_left", "orbital_left"):
        # Elliptical counter-clockwise orbit
        zoompan_expr = f"z='1.14+0.04*sin(PI*on/{d})':x='iw/2-(iw/zoom/2)+(iw*0.06)*cos(PI*on/{d})':y='ih/2-(ih/zoom/2)+(ih*0.02)*sin(PI*on/{d})'"
    elif motion_clean in ("orbit_right", "orbital_right"):
        # Elliptical clockwise orbit
        zoompan_expr = f"z='1.14+0.04*sin(PI*on/{d})':x='iw/2-(iw/zoom/2)-(iw*0.06)*cos(PI*on/{d})':y='ih/2-(ih/zoom/2)-(ih*0.02)*sin(PI*on/{d})'"
    elif motion_clean in ("fpv_drone", "drone", "swoop"):
        # Dynamic drone swoop with forward drive and bank
        zoompan_expr = f"z='1.05+0.18*{ease}':x='iw/2-(iw/zoom/2)+12*sin(2*PI*on/{d})':y='(ih-ih/zoom)*(0.2+0.8*{ease})'"
    elif motion_clean in ("handheld", "action", "shake"):
        # Organic handheld breathing camera motion with subtle harmonic drift
        zoompan_expr = f"z='1.08+0.04*{ease}':x='iw/2-(iw/zoom/2)+6*sin(4*PI*on/{d})':y='ih/2-(ih/zoom/2)+4*cos(3*PI*on/{d})'"
    else:  # default zoom_in / push_in
        # Gentle dolly push-in from 1.0 to 1.15
        zoompan_expr = f"z='1.0+0.15*{ease}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"

    vf_filters = [f"{scale_filter},zoompan={zoompan_expr}:d={d}:s={width}x{height}:fps={fps}"]

    if color_lut:
        try:
            from studio.color_grading import get_color_lut_filter
            lut_f = get_color_lut_filter(color_lut)
            if lut_f:
                vf_filters.append(lut_f)
        except Exception:
            pass
    elif vfx:
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

    from studio.hardware import get_ffmpeg_video_encoder
    enc, flags = get_ffmpeg_video_encoder(accel)

    return [
        "ffmpeg",
        "-y",
        "-loop", "1",
        "-i", str(image_path),
        "-vf", vf_filter,
        "-t", str(float(duration)),
        "-c:v", enc,
        *flags,
        "-threads", "0",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(output_path),
    ]

def _render_replicate_i2v(
    image_path: Path,
    output_path: Path,
    prompt: str = "",
    api_token: Optional[str] = None,
    model: Optional[str] = None,
    duration: float = 4.0,
    aspect_ratio: str = "16:9",
) -> Optional[Path]:
    """Render dynamic AI video via Replicate Image-to-Video API with async polling."""
    try:
        from studio.video_providers import ReplicateVideoProvider
        provider = ReplicateVideoProvider(api_token=api_token, model=model)
        if provider.render_shot_video(image_path, output_path, prompt, duration, aspect_ratio):
            if output_path.exists() and output_path.stat().st_size > 100:
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
    accel: str = "auto",
    video_api_token: Optional[str] = None,
    video_model: Optional[str] = None,
    color_lut: Optional[str] = None,
    trajectory: Optional[Any] = None,
) -> Path:
    """Execute motion rendering for a single shot according to selected engine."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("FFmpeg executable not found. Please install ffmpeg.")

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if engine in ("replicate", "kling", "luma") or (video_model and ("kling" in video_model or "luma" in video_model)):
        from studio.video_providers import get_video_provider
        provider = get_video_provider(
            provider_type=engine,
            api_token=video_api_token,
            model=video_model,
        )
        ai_prompt = prompt
        try:
            from studio.camera_director import CAMERA_MOTIONS
            if motion_type and motion_type in CAMERA_MOTIONS:
                motion_desc = CAMERA_MOTIONS[motion_type]["keywords"]
                ai_prompt = f"{ai_prompt}, {motion_desc}" if ai_prompt else motion_desc
        except Exception:
            pass

        try:
            success = provider.render_shot_video(
                image_path=image_path,
                output_path=output_path,
                prompt=ai_prompt,
                duration=duration,
                aspect_ratio=aspect_ratio,
                trajectory=trajectory,
            )
            if success and output_path.exists() and output_path.stat().st_size > 100:
                return output_path
        except Exception as exc:
            print(f"  [Motion] Video provider {engine} failed ({exc}). Falling back to Ken Burns.")

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
        accel=accel,
        color_lut=color_lut,
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
            if config.lip_sync in ("cloud", "local", "sadtalker", "wav2lip") and shot.character_id and shot.dialogue.strip():
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
                    accel=getattr(config, "hardware_accel", "auto"),
                    video_api_token=getattr(config, "video_api_token", None),
                    video_model=getattr(config, "video_model", None),
                )

            return shot.id, out_file

        from studio.hardware import get_optimal_concurrency
        optimal_workers = get_optimal_concurrency("motion", config)
        max_workers = max(1, min(optimal_workers, len(pending_shots)))
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
