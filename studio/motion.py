from pathlib import Path
from typing import Dict, List, Optional
import shutil
import subprocess

from studio.storyboard import Storyboard, Shot
from studio.config import StudioConfig
from studio.state import StateManager

def build_ffmpeg_command(
    image_path: Path,
    output_path: Path,
    duration: float,
    motion_type: str = "zoom_in",
    fps: int = 25,
    width: int = 1920,
    height: int = 1080
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

    vf_filter = f"scale=4000:-1,zoompan={zoompan_expr}:d={d}:s={width}x{height}:fps={fps}"

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

def render_motion_for_shot(
    image_path: Path,
    output_path: Path,
    duration: float,
    motion_type: str = "zoom_in",
    fps: int = 25
) -> Path:
    """Execute FFmpeg to render the animated video clip for a single shot."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("FFmpeg executable not found. Please install ffmpeg.")

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = build_ffmpeg_command(image_path, output_path, duration, motion_type, fps)
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg motion rendering failed: {result.stderr.decode('utf-8', errors='ignore')}")

    return output_path

def run_motion_stage(
    storyboard: Storyboard,
    config: StudioConfig,
    state: StateManager,
    durations: Optional[Dict[str, float]] = None
) -> Dict[str, Path]:
    """Run motion video clip generation for all shots."""
    img_dir = config.output_dir / "images"
    vid_dir = config.output_dir / "videos"
    vid_dir.mkdir(parents=True, exist_ok=True)

    durations = durations or {}
    video_clips: Dict[str, Path] = {}

    for shot in storyboard.shots:
        out_file = vid_dir / f"{shot.id}.mp4"

        if state.is_stage_complete(shot.id, "video") and out_file.exists():
            video_clips[shot.id] = out_file
            continue

        img_file = img_dir / f"{shot.id}.png"
        if not img_file.exists():
            # If image missing, cannot render motion
            continue

        shot_duration = durations.get(shot.id, shot.duration or 5.0)
        render_motion_for_shot(
            image_path=img_file,
            output_path=out_file,
            duration=shot_duration,
            motion_type=shot.motion or "zoom_in",
        )

        video_clips[shot.id] = out_file
        state.mark_complete(shot.id, "video")
        state.save()

    return video_clips
