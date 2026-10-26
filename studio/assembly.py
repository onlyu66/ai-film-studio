from pathlib import Path
from typing import Dict, List, Optional
import shutil
import subprocess
import time
from pydub import AudioSegment

from studio.storyboard import Storyboard
from studio.config import StudioConfig
from studio.state import StateManager
from studio.subtitles import generate_srt

def create_concat_file(video_paths: List[Path], output_path: Path) -> Path:
    """Write FFmpeg concat demuxer file listing all video clips."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"file '{p.resolve()}'" for p in video_paths]
    output_path.write_text("\n".join(lines), encoding="utf-8")
    return output_path

def resolve_bgm_path(custom_bgm: Optional[Path], style: str = "cinematic") -> Optional[Path]:
    """Resolve background music path: custom path first, then style preset, then default."""
    if custom_bgm and Path(custom_bgm).exists():
        return Path(custom_bgm)

    style_clean = (style or "cinematic").lower().strip()
    candidates = [
        Path(f"assets/bgm/{style_clean}.mp3"),
        Path(f"assets/bgm/{style_clean}.wav"),
        Path("assets/bgm/default.mp3"),
        Path("assets/bgm/default.wav"),
    ]
    for p in candidates:
        if p.exists():
            return p
    return None

def resolve_mood_bgm(mood: Optional[str]) -> Optional[Path]:
    """Resolve dynamic mood-specific BGM file if available."""
    if not mood:
        return None
    mood_clean = str(mood).lower().strip().replace(" ", "_")
    candidates = [
        Path(f"assets/bgm/{mood_clean}.mp3"),
        Path(f"assets/bgm/{mood_clean}.wav"),
    ]
    for p in candidates:
        if p.exists():
            return p
    return None

def build_master_audio(
    storyboard: Storyboard,
    audio_dir: Path,
    durations: Dict[str, float],
    output_audio_path: Path,
    bgm_path: Optional[Path] = None,
    ducking_db: float = -14.0,
    style: str = "cinematic"
) -> Path:
    """Concatenate narration clips, overlay dynamic mood/looped background music with ducking, and apply smooth fades."""
    output_audio_path = Path(output_audio_path)
    output_audio_path.parent.mkdir(parents=True, exist_ok=True)

    master = AudioSegment.silent(duration=0)

    for shot in storyboard.shots:
        shot_dur = durations.get(shot.id, shot.duration or 5.0)
        shot_dur_ms = int(round(shot_dur * 1000))

        audio_file = audio_dir / f"{shot.id}.mp3"
        if audio_file.exists() and shot.dialogue and shot.dialogue.strip():
            segment = AudioSegment.from_file(str(audio_file))
            # Match duration
            if len(segment) < shot_dur_ms:
                silence_gap = AudioSegment.silent(duration=shot_dur_ms - len(segment))
                segment = segment + silence_gap
            else:
                segment = segment[:shot_dur_ms]
        else:
            segment = AudioSegment.silent(duration=shot_dur_ms)

        # Mix environmental SFX if specified and audio file exists in assets/sfx/
        if getattr(shot, "sfx", None):
            sfx_name = str(shot.sfx).lower().strip().replace(" ", "_")
            sfx_candidates = [
                Path(f"assets/sfx/{sfx_name}.mp3"),
                Path(f"assets/sfx/{sfx_name}.wav"),
            ]
            for sfx_cand in sfx_candidates:
                if sfx_cand.exists():
                    try:
                        sfx_seg = AudioSegment.from_file(str(sfx_cand)) - 16.0
                        if len(sfx_seg) < shot_dur_ms:
                            loops = (shot_dur_ms // len(sfx_seg)) + 1
                            sfx_seg = (sfx_seg * loops)[:shot_dur_ms]
                        else:
                            sfx_seg = sfx_seg[:shot_dur_ms]
                        segment = segment.overlay(sfx_seg)
                        break
                    except Exception:
                        pass

        master += segment

    # Mix BGM (dynamic mood-based crossfade or style-based fallback)
    effective_default_bgm = resolve_bgm_path(bgm_path, style)
    has_custom_mood_bgm = any(
        resolve_mood_bgm(getattr(s, "mood", None)) is not None
        for s in storyboard.shots
    )

    if (effective_default_bgm and effective_default_bgm.exists()) or has_custom_mood_bgm:
        bgm_timeline = AudioSegment.silent(duration=0)
        sections = []
        current_bgm_path = None
        current_section_dur = 0

        for shot in storyboard.shots:
            shot_dur = durations.get(shot.id, shot.duration or 5.0)
            shot_dur_ms = int(round(shot_dur * 1000))
            shot_bgm = resolve_mood_bgm(getattr(shot, "mood", None)) or effective_default_bgm

            if shot_bgm == current_bgm_path:
                current_section_dur += shot_dur_ms
            else:
                if current_bgm_path is not None and current_section_dur > 0:
                    sections.append((current_bgm_path, current_section_dur))
                current_bgm_path = shot_bgm
                current_section_dur = shot_dur_ms

        if current_bgm_path is not None and current_section_dur > 0:
            sections.append((current_bgm_path, current_section_dur))

        for bgm_file, dur_ms in sections:
            if bgm_file and Path(bgm_file).exists():
                bgm_seg = AudioSegment.from_file(str(bgm_file)) + ducking_db
                loops = (dur_ms // len(bgm_seg)) + 1
                sec_audio = (bgm_seg * loops)[:dur_ms]
            else:
                sec_audio = AudioSegment.silent(duration=dur_ms)

            if len(bgm_timeline) == 0:
                bgm_timeline = sec_audio
            else:
                fade_len = min(600, len(bgm_timeline), len(sec_audio))
                if fade_len > 100:
                    bgm_timeline = bgm_timeline.append(sec_audio, crossfade=fade_len)
                else:
                    bgm_timeline = bgm_timeline + sec_audio

        if len(bgm_timeline) > 0 and len(master) > 0:
            if len(bgm_timeline) < len(master):
                bgm_timeline = bgm_timeline + AudioSegment.silent(duration=len(master) - len(bgm_timeline))
            else:
                bgm_timeline = bgm_timeline[:len(master)]
            master = master.overlay(bgm_timeline)

    # Smooth audio fade in (800ms) and fade out (1000ms)
    if len(master) > 2000:
        master = master.fade_in(800).fade_out(1000)

    master.export(str(output_audio_path), format="mp3")
    return output_audio_path

def build_hardsub_filter(srt_path: Path, aspect_ratio: str = "16:9") -> str:
    """Generate FFmpeg subtitles filter with stylish yellow-and-black bordered font."""
    escaped_path = str(srt_path.resolve()).replace("\\", "/").replace(":", "\\:")
    if aspect_ratio == "9:16":
        style = "FontSize=18,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1,Outline=2.5,Shadow=1,Alignment=2,MarginV=90"
    else:
        style = "FontSize=22,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1,Outline=2.5,Shadow=1,Alignment=2,MarginV=40"
    return f"subtitles='{escaped_path}':force_style='{style}'"

def run_assembly_stage(
    storyboard: Storyboard,
    config: StudioConfig,
    state: StateManager,
    durations: Optional[Dict[str, float]] = None
) -> Path:
    """Assemble all video clips, narration audio, BGM, and subtitles into master movie."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("FFmpeg executable not found.")

    durations = durations or {}
    vid_dir = config.output_dir / "videos"
    audio_dir = config.output_dir / "audio"
    final_dir = config.output_dir / "final"
    final_dir.mkdir(parents=True, exist_ok=True)

    # Collect video paths in order
    video_paths: List[Path] = []
    for shot in storyboard.shots:
        v_file = vid_dir / f"{shot.id}.mp4"
        if v_file.exists():
            video_paths.append(v_file)

    if not video_paths:
        raise RuntimeError("No video clips found to assemble.")

    timestamp = int(time.time())
    concat_list_file = final_dir / f"concat_{timestamp}.txt"
    create_concat_file(video_paths, concat_list_file)

    # 1. Concat video clips
    raw_video = final_dir / f"raw_video_{timestamp}.mp4"
    cmd_concat = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(concat_list_file),
        "-c", "copy",
        str(raw_video)
    ]
    subprocess.run(cmd_concat, check=True)

    # 2. Build master audio track
    master_audio = final_dir / f"master_audio_{timestamp}.mp3"
    build_master_audio(
        storyboard=storyboard,
        audio_dir=audio_dir,
        durations=durations,
        output_audio_path=master_audio,
        bgm_path=config.bgm_path,
        style=config.style,
    )

    # 3. Generate SRT subtitle file
    master_srt = final_dir / f"movie_{timestamp}.srt"
    generate_srt(storyboard, durations, master_srt)

    # 4. Mux final video with audio (with optional Burn-in Hardsub)
    final_movie = final_dir / f"movie_{timestamp}.mp4"
    if getattr(config, "hardsub", False):
        sub_filter = build_hardsub_filter(master_srt, getattr(config, "aspect_ratio", "16:9"))
        cmd_mux = [
            "ffmpeg", "-y",
            "-i", str(raw_video),
            "-i", str(master_audio),
            "-vf", sub_filter,
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-shortest",
            str(final_movie)
        ]
    else:
        cmd_mux = [
            "ffmpeg", "-y",
            "-i", str(raw_video),
            "-i", str(master_audio),
            "-c:v", "copy",
            "-c:a", "aac",
            "-shortest",
            str(final_movie)
        ]
    subprocess.run(cmd_mux, check=True)

    # Clean up intermediate files
    if concat_list_file.exists():
        concat_list_file.unlink()
    if raw_video.exists():
        raw_video.unlink()

    return final_movie
