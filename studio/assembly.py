from pathlib import Path
from typing import Dict, List, Optional, Callable
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
    if style_clean == "none":
        return None

    # 1. Check style-specific candidates
    style_candidates = [
        Path(f"assets/bgm/{style_clean}.mp3"),
        Path(f"assets/bgm/{style_clean}.wav"),
    ]
    for p in style_candidates:
        if p.exists() and p.stat().st_size > 1000:
            return p

    # 2. Check default fallback if style is standard or empty
    if style_clean in ("default", "cinematic", ""):
        default_candidates = [
            Path("assets/bgm/default.mp3"),
            Path("assets/bgm/default.wav"),
            Path("assets/bgm/cinematic.mp3"),
        ]
        for p in default_candidates:
            if p.exists() and p.stat().st_size > 1000:
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
        if p.exists() and p.stat().st_size > 1000:
            return p

    try:
        from studio.audio_assets import ensure_audio_assets
        ensure_audio_assets()
        for p in candidates:
            if p.exists() and p.stat().st_size > 1000:
                return p
    except Exception:
        pass

    return None

def resolve_sfx_path(sfx_str: Optional[str]) -> Optional[Path]:
    """Resolve sound effect name or keyword to local CC0 asset file with alias mapping."""
    if not sfx_str:
        return None
    clean = str(sfx_str).lower().strip().replace(" ", "_")

    # 1. Direct match on local asset files
    candidates = [
        Path(f"assets/sfx/{clean}.mp3"),
        Path(f"assets/sfx/{clean}.wav"),
    ]
    for c in candidates:
        if c.exists() and c.stat().st_size > 1000:
            return c

    # 2. Keyword aliases (English & Vietnamese)
    alias_map = {
        "rain": ["rain", "mưa", "drizzle", "storm_rain"],
        "wind": ["wind", "gió", "breeze", "howling", "bão"],
        "thunder": ["thunder", "sấm", "sét", "lightning"],
        "city": ["city", "đô_thị", "phố", "street", "urban", "crowd"],
        "traffic": ["traffic", "kẹt_xe", "giao_thông", "xe_cộ"],
        "waves": ["waves", "sóng", "biển", "ocean", "sea"],
        "campfire": ["campfire", "lửa", "fire", "cháy", "đốt_lửa"],
        "birds": ["birds", "chim", "hót"],
        "cyberpunk": ["cyber", "sci-fi", "alien", "space", "không_gian", "vũ_trụ"],
    }
    for standard_name, keywords in alias_map.items():
        if any(kw in clean for kw in keywords):
            cand = Path(f"assets/sfx/{standard_name}.mp3")
            if cand.exists() and cand.stat().st_size > 1000:
                return cand
            try:
                from studio.audio_assets import get_or_download_sfx
                downloaded = get_or_download_sfx(standard_name)
                if downloaded and downloaded.exists():
                    return downloaded
            except Exception:
                pass

    return None

def match_target_amplitude(sound: AudioSegment, target_dBFS: float = -20.0) -> AudioSegment:
    """Normalize audio segment volume accurately to target dBFS."""
    if sound.dBFS == float("-inf") or len(sound) == 0:
        return sound
    gain = target_dBFS - sound.dBFS
    return sound.apply_gain(gain)

def build_master_audio(
    storyboard: Storyboard,
    audio_dir: Path,
    durations: Dict[str, float],
    output_audio_path: Path,
    bgm_path: Optional[Path] = None,
    ducking_db: float = -6.0,
    style: str = "cinematic"
) -> Path:
    """Concatenate narration clips, overlay environmental SFX, layer dynamic BGM with smart speech ducking, and apply smooth fades."""
    output_audio_path = Path(output_audio_path)
    output_audio_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        from studio.audio_assets import ensure_audio_assets
        ensure_audio_assets()
    except Exception:
        pass

    master = AudioSegment.silent(duration=0)

    # 1. Build narration + SFX track shot by shot
    for shot in storyboard.shots:
        shot_dur = durations.get(shot.id, shot.duration or 5.0)
        shot_dur_ms = int(round(shot_dur * 1000))

        has_speech = False
        audio_file = audio_dir / f"{shot.id}.mp3"
        if audio_file.exists() and shot.dialogue and shot.dialogue.strip():
            segment = AudioSegment.from_file(str(audio_file))
            has_speech = True
            # Pad or trim narration to match shot duration
            if len(segment) < shot_dur_ms:
                silence_gap = AudioSegment.silent(duration=shot_dur_ms - len(segment))
                segment = segment + silence_gap
            else:
                segment = segment[:shot_dur_ms]
        else:
            segment = AudioSegment.silent(duration=shot_dur_ms)

        # Mix environmental SFX if specified
        sfx_file = resolve_sfx_path(getattr(shot, "sfx", None))
        if sfx_file and sfx_file.exists():
            try:
                sfx_seg = AudioSegment.from_file(str(sfx_file))
                # Target SFX volume: -22 dBFS during speech (subtle backdrop), -17 dBFS when no speech
                target_sfx_dbfs = -22.0 if has_speech else -17.0
                sfx_seg = match_target_amplitude(sfx_seg, target_dBFS=target_sfx_dbfs)

                if len(sfx_seg) < shot_dur_ms:
                    loops = (shot_dur_ms // len(sfx_seg)) + 1
                    sfx_seg = (sfx_seg * loops)[:shot_dur_ms]
                else:
                    sfx_seg = sfx_seg[:shot_dur_ms]
                segment = segment.overlay(sfx_seg)
            except Exception:
                pass

        master += segment

    # 2. Mix BGM (dynamic mood-based crossfade or style-based fallback)
    effective_default_bgm = resolve_bgm_path(bgm_path, style)
    has_custom_mood_bgm = any(
        resolve_mood_bgm(getattr(s, "mood", None)) is not None
        for s in storyboard.shots
    )

    if (effective_default_bgm and effective_default_bgm.exists()) or has_custom_mood_bgm:
        bgm_timeline = AudioSegment.silent(duration=0)

        for shot in storyboard.shots:
            shot_dur = durations.get(shot.id, shot.duration or 5.0)
            shot_dur_ms = int(round(shot_dur * 1000))
            shot_bgm = resolve_mood_bgm(getattr(shot, "mood", None)) or effective_default_bgm

            if shot_bgm and Path(shot_bgm).exists():
                raw_bgm = AudioSegment.from_file(str(shot_bgm))
                # Target BGM level: -25 dBFS during speech (gentle ducking), -19 dBFS when idle
                has_dialogue = bool(shot.dialogue and shot.dialogue.strip())
                target_bgm_dbfs = -25.0 if has_dialogue else -19.0
                shot_bgm_seg = match_target_amplitude(raw_bgm, target_dBFS=target_bgm_dbfs)

                loops = (shot_dur_ms // len(shot_bgm_seg)) + 1
                shot_bgm_seg = (shot_bgm_seg * loops)[:shot_dur_ms]
            else:
                shot_bgm_seg = AudioSegment.silent(duration=shot_dur_ms)

            if len(bgm_timeline) == 0:
                bgm_timeline = shot_bgm_seg
            else:
                fade_len = min(400, len(bgm_timeline), len(shot_bgm_seg))
                if fade_len > 80:
                    bgm_timeline = bgm_timeline.append(shot_bgm_seg, crossfade=fade_len)
                else:
                    bgm_timeline = bgm_timeline + shot_bgm_seg

        if len(bgm_timeline) > 0 and len(master) > 0:
            if len(bgm_timeline) < len(master):
                bgm_timeline = bgm_timeline + AudioSegment.silent(duration=len(master) - len(bgm_timeline))
            else:
                bgm_timeline = bgm_timeline[:len(master)]
            master = master.overlay(bgm_timeline)
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
    durations: Optional[Dict[str, float]] = None,
    progress_callback: Optional[Callable[[int, str, int, str], None]] = None,
) -> Path:
    """Assemble all video clips, narration audio, BGM, and subtitles into master movie."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("FFmpeg executable not found.")

    try:
        from studio.audio_assets import ensure_audio_assets
        ensure_audio_assets()
    except Exception:
        pass

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
    if progress_callback:
        progress_callback(5, "Đang ghép nối các video clips bằng FFmpeg...", 88, "[Assembly] Đang ghép nối các phân cảnh video...")
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
    if progress_callback:
        progress_callback(5, "Đang hòa âm master audio & background music...", 92, "[Assembly] Đang hòa âm narration & nhạc nền BGM...")
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
    if progress_callback:
        progress_callback(5, "Đang xuất bản video hoàn thiện...", 96, "[Assembly] Đang mux video, audio và phụ đề hoàn chỉnh...")
    final_movie = final_dir / f"movie_{timestamp}.mp4"
    if getattr(config, "hardsub", False):
        sub_filter = build_hardsub_filter(master_srt, getattr(config, "aspect_ratio", "16:9"))
        cmd_mux = [
            "ffmpeg", "-y",
            "-i", str(raw_video),
            "-i", str(master_audio),
            "-vf", sub_filter,
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            str(final_movie)
        ]
    else:
        cmd_mux = [
            "ffmpeg", "-y",
            "-i", str(raw_video),
            "-i", str(master_audio),
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
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
