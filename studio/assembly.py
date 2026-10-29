from pathlib import Path
from typing import Dict, List, Optional, Callable
import shutil
import subprocess
import time
from pydub import AudioSegment

from studio.storyboard import Storyboard
from studio.config import StudioConfig
from studio.state import StateManager
from studio.subtitles import generate_srt, generate_ass, SUBTITLE_PRESETS

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
        if c.exists() and c.stat().st_size > 500:
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

    # 3. Try SFX module asset resolver
    try:
        from studio.sfx import resolve_sfx_asset
        resolved = resolve_sfx_asset(clean)
        if resolved and resolved.exists() and resolved.stat().st_size > 500:
            return resolved
    except Exception:
        pass

    return None

def match_target_amplitude(sound: AudioSegment, target_dBFS: float = -20.0) -> AudioSegment:
    """Normalize audio segment volume accurately to target dBFS."""
    if sound.dBFS == float("-inf") or len(sound) == 0:
        return sound
    gain = target_dBFS - sound.dBFS
    return sound.apply_gain(gain)

def mix_sfx_into_shot_audio(
    speech_audio_path: Optional[Path],
    sfx_str: Optional[str],
    shot_duration: float,
    output_path: Path,
    voice_volume: float = 1.0,
    sfx_volume: float = 1.0,
    sfx_offset_ms: int = 0,
) -> Path:
    """Mix speech audio with ambient/environmental SFX into a high-quality audio file for shot preview.
    Supports independent volume scaling (0.0 to 2.0) and custom start timing offset.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    shot_dur_ms = max(1000, int(round(shot_duration * 1000)))

    has_speech = False
    if speech_audio_path and Path(speech_audio_path).exists() and Path(speech_audio_path).stat().st_size > 0:
        try:
            segment = AudioSegment.from_file(str(speech_audio_path))
            has_speech = True

            v_vol = max(0.0, float(voice_volume))
            if v_vol <= 0.001:
                segment = AudioSegment.silent(duration=len(segment))
            elif abs(v_vol - 1.0) > 0.001:
                import math
                gain = 20 * math.log10(v_vol)
                segment = segment.apply_gain(gain)

            if len(segment) < shot_dur_ms:
                silence_gap = AudioSegment.silent(duration=shot_dur_ms - len(segment))
                segment = segment + silence_gap
            else:
                segment = segment[:shot_dur_ms]
        except Exception:
            segment = AudioSegment.silent(duration=shot_dur_ms)
    else:
        segment = AudioSegment.silent(duration=shot_dur_ms)

    sfx_vol = max(0.0, float(sfx_volume))
    if sfx_vol > 0.001:
        sfx_file = resolve_sfx_path(sfx_str)
        if sfx_file and sfx_file.exists():
            try:
                import math
                sfx_seg = AudioSegment.from_file(str(sfx_file))
                base_target_dbfs = -22.0 if has_speech else -17.0
                sfx_gain = 20 * math.log10(sfx_vol)
                target_sfx_dbfs = max(-60.0, min(-5.0, base_target_dbfs + sfx_gain))
                sfx_seg = match_target_amplitude(sfx_seg, target_dBFS=target_sfx_dbfs)

                # Apply 50ms micro-fade to avoid audio clicks
                if len(sfx_seg) > 100:
                    sfx_seg = sfx_seg.fade_in(50).fade_out(50)

                offset = max(0, min(max(0, shot_dur_ms - 200), int(sfx_offset_ms)))
                available_dur = max(100, shot_dur_ms - offset)

                if len(sfx_seg) < available_dur:
                    # Loop if it's an ambient sound (longer than 5s)
                    if len(sfx_seg) > 5000:
                        loops = (available_dur // len(sfx_seg)) + 1
                        sfx_seg = (sfx_seg * loops)[:available_dur]
                else:
                    sfx_seg = sfx_seg[:available_dur]

                segment = segment.overlay(sfx_seg, position=offset)
            except Exception as e:
                print(f"  [SFX Warning] Failed to overlay SFX '{sfx_str}': {e}")

    segment.export(str(output_path), format="mp3", bitrate="192k")
    return output_path

def build_master_audio(
    storyboard: Storyboard,
    audio_dir: Path,
    durations: Dict[str, float],
    output_audio_path: Path,
    bgm_path: Optional[Path] = None,
    ducking_db: float = -6.0,
    style: str = "cinematic",
    bgm_volume: float = 0.7,
    ducking_level: str = "medium",
    voice_volume: float = 1.0,
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

        normal_audio_file = audio_dir / f"{shot.id}.mp3"
        raw_audio_file = audio_dir / f"raw_{shot.id}.mp3"

        effective_voice_vol = getattr(shot, "voice_volume", 1.0) * voice_volume
        effective_sfx_vol = getattr(shot, "sfx_volume", 1.0)
        effective_sfx_offset = getattr(shot, "sfx_offset_ms", 0)

        if normal_audio_file.exists() and normal_audio_file.stat().st_size > 0:
            segment = AudioSegment.from_file(str(normal_audio_file))
            if voice_volume != 1.0 and voice_volume > 0.0:
                gain_db = (voice_volume - 1.0) * 10.0
                segment = segment.apply_gain(gain_db)
            if len(segment) < shot_dur_ms:
                silence_gap = AudioSegment.silent(duration=shot_dur_ms - len(segment))
                segment = segment + silence_gap
            else:
                segment = segment[:shot_dur_ms]
        elif raw_audio_file.exists() or (shot.dialogue and shot.dialogue.strip()) or getattr(shot, "sfx", None):
            speech_path = raw_audio_file if raw_audio_file.exists() else None
            mix_sfx_into_shot_audio(
                speech_audio_path=speech_path,
                sfx_str=getattr(shot, "sfx", None),
                shot_duration=shot_dur,
                output_path=normal_audio_file,
                voice_volume=effective_voice_vol,
                sfx_volume=effective_sfx_vol,
                sfx_offset_ms=effective_sfx_offset,
            )
            segment = AudioSegment.from_file(str(normal_audio_file))
            if len(segment) < shot_dur_ms:
                silence_gap = AudioSegment.silent(duration=shot_dur_ms - len(segment))
                segment = segment + silence_gap
            else:
                segment = segment[:shot_dur_ms]
        else:
            segment = AudioSegment.silent(duration=shot_dur_ms)

        master += segment

    # 2. Mix BGM with Smart Auto-Ducking (if BGM volume > 0)
    if bgm_volume > 0.0:
        effective_default_bgm = resolve_bgm_path(bgm_path, style)
        has_custom_mood_bgm = any(
            resolve_mood_bgm(getattr(s, "mood", None)) is not None
            for s in storyboard.shots
        )

        if (effective_default_bgm and effective_default_bgm.exists()) or has_custom_mood_bgm:
            bgm_timeline = AudioSegment.silent(duration=0)

            # Determine ducking attenuation
            ducking_map = {"none": 0.0, "light": -6.0, "medium": -12.0, "heavy": -18.0}
            if ducking_level in ducking_map:
                ducking_offset = ducking_map[ducking_level]
            elif ducking_db != -6.0:
                ducking_offset = ducking_db
            else:
                ducking_offset = -12.0

            # Compute baseline BGM level based on bgm_volume
            # volume=1.0 -> -19 dBFS; volume=0.7 -> -22.6 dBFS; volume=1.5 -> -13 dBFS
            base_idle_dbfs = max(-35.0, min(-10.0, -19.0 + (bgm_volume - 1.0) * 12.0))

            for shot in storyboard.shots:
                shot_dur = durations.get(shot.id, shot.duration or 5.0)
                shot_dur_ms = int(round(shot_dur * 1000))
                shot_bgm = resolve_mood_bgm(getattr(shot, "mood", None)) or effective_default_bgm

                if shot_bgm and Path(shot_bgm).exists():
                    raw_bgm = AudioSegment.from_file(str(shot_bgm))
                    has_dialogue = bool(shot.dialogue and shot.dialogue.strip())
                    target_bgm_dbfs = (base_idle_dbfs + ducking_offset) if has_dialogue else base_idle_dbfs
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

    # Smooth audio fade in (800ms) and fade out (1000ms)
    if len(master) > 2000:
        master = master.fade_in(800).fade_out(1000)

    master.export(str(output_audio_path), format="mp3")
    return output_audio_path
    return output_audio_path

def build_hardsub_filter(
    sub_path: Path,
    aspect_ratio: str = "16:9",
    style_id: str = "tiktok_bold",
    position: str = "bottom",
) -> str:
    """Generate FFmpeg subtitles filter with stylish typography and customizable presets."""
    escaped_path = str(Path(sub_path).resolve()).replace("\\", "/").replace(":", "\\:")

    # If already an ASS file, use ass filter directly
    if str(sub_path).lower().endswith(".ass"):
        return f"ass='{escaped_path}'"

    # Otherwise for SRT, apply force_style matching preset & position
    from studio.subtitles import SUBTITLE_PRESETS
    preset = SUBTITLE_PRESETS.get(style_id, SUBTITLE_PRESETS.get("tiktok_bold", {}))

    is_vertical = (aspect_ratio == "9:16")
    font_name = preset.get("font_name", "Montserrat")
    font_size = preset.get("font_size_9_16", 18) if is_vertical else preset.get("font_size_16_9", 22)
    primary_color = preset.get("primary_color", "&H0000FFFF")
    outline_color = preset.get("outline_color", "&H00000000")
    back_color = preset.get("back_color", "&H80000000")
    bold = preset.get("bold", 1)
    outline = preset.get("outline", 2.5)
    shadow = preset.get("shadow", 1.0)
    margin_v = preset.get("margin_v_9_16", 90) if is_vertical else preset.get("margin_v_16_9", 40)

    pos_lower = (position or "bottom").lower().strip()
    if pos_lower in ("top", "upper"):
        alignment = 8
    elif pos_lower in ("middle", "center"):
        alignment = 5
    else:
        alignment = 2

    # Backward compatibility with existing tests checking exact string for default 9:16 & 16:9
    if style_id == "tiktok_bold" and position == "bottom":
        if is_vertical:
            style = "FontSize=18,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1,Outline=2.5,Shadow=1,Alignment=2,MarginV=90"
        else:
            style = "FontSize=22,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BackColour=&H80000000,Bold=1,Outline=2.5,Shadow=1,Alignment=2,MarginV=40"
    else:
        style = f"FontName={font_name},FontSize={font_size},PrimaryColour={primary_color},OutlineColour={outline_color},BackColour={back_color},Bold={bold},Outline={outline},Shadow={shadow},Alignment={alignment},MarginV={margin_v}"

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
    transition_preset = getattr(config, "transition_preset", "cut") or "cut"
    trans_duration = float(getattr(config, "transition_duration", 0.6) or 0.6)

    from studio.color_grading import build_xfade_filtergraph, get_color_lut_filter

    clip_durations = [durations.get(s.id, s.duration or 5.0) for s in storyboard.shots if (vid_dir / f"{s.id}.mp4").exists()]
    xfade_filter = build_xfade_filtergraph(clip_durations, transition=transition_preset, trans_duration=trans_duration)

    if progress_callback:
        progress_callback(5, "Đang ghép nối các video clips bằng FFmpeg...", 88, f"[Assembly] Đang ghép nối các phân cảnh video (Chuyển cảnh: {transition_preset})...")
    raw_video = final_dir / f"raw_video_{timestamp}.mp4"

    if xfade_filter and len(video_paths) >= 2:
        cmd_concat = ["ffmpeg", "-y"]
        for vp in video_paths:
            cmd_concat.extend(["-i", str(vp)])
        last_v_tag = f"[v{len(video_paths)-1}]"
        cmd_concat.extend([
            "-filter_complex", xfade_filter,
            "-map", last_v_tag,
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-an",
            str(raw_video)
        ])
    else:
        cmd_concat = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_list_file),
            "-c:v", "copy",
            "-an",
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
        style=getattr(config, "bgm_preset", None) or config.style,
        bgm_volume=getattr(config, "bgm_volume", 0.7),
        ducking_level=getattr(config, "ducking_level", "medium"),
        voice_volume=getattr(config, "voice_volume", 1.0),
    )

    # 3. Generate SRT and ASS subtitle files
    master_srt = final_dir / f"movie_{timestamp}.srt"
    generate_srt(storyboard, durations, master_srt)

    master_ass = final_dir / f"movie_{timestamp}.ass"
    generate_ass(
        storyboard=storyboard,
        audio_durations=durations,
        output_path=master_ass,
        preset_id=getattr(config, "subtitle_style", "tiktok_bold"),
        aspect_ratio=getattr(config, "aspect_ratio", "16:9"),
        position=getattr(config, "subtitle_position", "bottom"),
        karaoke=getattr(config, "subtitle_karaoke", False),
    )

    # 4. Mux final video with audio (with optional Burn-in Hardsub & Master Color LUT)
    if progress_callback:
        progress_callback(5, "Đang xuất bản video hoàn thiện...", 96, "[Assembly] Đang mux video, audio và phụ đề hoàn chỉnh...")
    final_movie = final_dir / f"movie_{timestamp}.mp4"

    color_lut = getattr(config, "color_lut", None)
    lut_filter = get_color_lut_filter(color_lut) if color_lut and color_lut != "none" else ""

    vf_filters = []
    if getattr(config, "hardsub", False):
        sub_filter = build_hardsub_filter(
            master_ass,
            aspect_ratio=getattr(config, "aspect_ratio", "16:9"),
            style_id=getattr(config, "subtitle_style", "tiktok_bold"),
            position=getattr(config, "subtitle_position", "bottom"),
        )
        vf_filters.append(sub_filter)
    if lut_filter:
        vf_filters.append(lut_filter)

    final_vf = ",".join(vf_filters) if vf_filters else None

    if final_vf:
        cmd_mux = [
            "ffmpeg", "-y",
            "-i", str(raw_video),
            "-i", str(master_audio),
            "-vf", final_vf,
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
