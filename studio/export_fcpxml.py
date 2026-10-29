from pathlib import Path
from typing import Optional, Dict, Any, List
import math
import xml.etree.ElementTree as ET
from xml.dom import minidom

from studio.storyboard import Storyboard, Shot

def _fmt_time(seconds: float) -> str:
    """Format seconds into FCPXML standard time string (e.g. '0s', '4.5s', '8.0s')."""
    if abs(seconds) < 1e-6:
        return "0s"
    r = round(seconds, 2)
    if r == int(r):
        return f"{r:.1f}s"
    return f"{r}s"

def _linear_to_db(gain: float) -> str:
    """Convert linear volume ratio (e.g. 1.0, 0.5) to FCPXML decibel string."""
    if gain <= 0.001:
        return "-96dB"
    db = 20.0 * math.log10(gain)
    if db >= 0:
        return f"+{db:.1f}dB" if db > 0 else "0dB"
    return f"{db:.1f}dB"

def generate_fcpxml(
    storyboard: Storyboard,
    output_path: Path,
    aspect_ratio: str = "16:9",
    fps: int = 25,
    project_dir: Optional[Path] = None,
    bgm_path: Optional[Path] = None,
) -> Path:
    """
    Generate an industry-standard FCPXML v1.8 document for DaVinci Resolve,
    Adobe Premiere Pro, and Final Cut Pro X.
    
    Includes:
    - Multi-track timeline: Video, Voiceover TTS, SFX, BGM, and Subtitles
    - Accurate duration & offset timecodes
    - Audio volume automation from storyboard settings
    - Full character dialogues mapped to subtitle/title elements
    """
    output_path = Path(output_path).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    base_dir = project_dir if project_dir else Path("outputs")
    videos_dir = base_dir / "videos"
    audio_dir = base_dir / "audio"

    # Determine resolution from aspect_ratio
    if aspect_ratio == "9:16":
        width, height = 1080, 1920
    else:
        width, height = 1920, 1080

    frame_duration = f"1/{fps}s"

    # Root element
    fcpxml = ET.Element("fcpxml", {"version": "1.8"})

    # Resources section
    resources = ET.SubElement(fcpxml, "resources")
    fmt_id = "r1"
    ET.SubElement(resources, "format", {
        "id": fmt_id,
        "name": f"FFVideoFormat{width}x{height}p{fps}",
        "frameDuration": frame_duration,
        "width": str(width),
        "height": str(height),
    })

    # Title effect resource for subtitles
    ET.SubElement(resources, "effect", {
        "id": "r_title",
        "name": "Basic Title",
        "uid": ".../Titles.localized/Bumper:Opener.localized/Basic Title.localized/Basic Title.moti",
    })

    # Register assets
    asset_map: Dict[str, str] = {}
    next_res_idx = 2

    # Video & audio assets for each shot
    for shot in storyboard.shots:
        vid_file = (videos_dir / f"{shot.id}.mp4").resolve()
        aud_file = (audio_dir / f"{shot.id}.mp3").resolve()
        sfx_file = (audio_dir / f"sfx_{shot.id}.mp3").resolve()
        raw_aud_file = (audio_dir / f"raw_{shot.id}.mp3").resolve()

        dur_str = _fmt_time(shot.duration or 5.0)

        # Video asset
        v_res_id = f"r{next_res_idx}"
        next_res_idx += 1
        asset_map[f"video_{shot.id}"] = v_res_id
        ET.SubElement(resources, "asset", {
            "id": v_res_id,
            "name": f"{shot.id}.mp4",
            "src": f"file://{vid_file}",
            "start": "0s",
            "duration": dur_str,
            "has-video": "1",
            "has-audio": "1" if aud_file.exists() else "0",
            "format": fmt_id,
        })

        # Voiceover audio asset (use raw_shot or shot.mp3)
        speech_path = raw_aud_file if raw_aud_file.exists() else aud_file
        a_res_id = f"r{next_res_idx}"
        next_res_idx += 1
        asset_map[f"audio_{shot.id}"] = a_res_id
        ET.SubElement(resources, "asset", {
            "id": a_res_id,
            "name": f"{shot.id}.mp3",
            "src": f"file://{speech_path}",
            "start": "0s",
            "duration": dur_str,
            "has-audio": "1",
        })

        # SFX audio asset if available
        if sfx_file.exists():
            sfx_res_id = f"r{next_res_idx}"
            next_res_idx += 1
            asset_map[f"sfx_{shot.id}"] = sfx_res_id
            ET.SubElement(resources, "asset", {
                "id": sfx_res_id,
                "name": f"sfx_{shot.id}.mp3",
                "src": f"file://{sfx_file}",
                "start": "0s",
                "duration": dur_str,
                "has-audio": "1",
            })

    # Background music asset
    bgm_file = bgm_path if (bgm_path and bgm_path.exists()) else (base_dir / "bgm" / "bgm.mp3")
    total_duration = sum(shot.duration or 5.0 for shot in storyboard.shots)
    total_dur_str = _fmt_time(total_duration)

    bgm_res_id = None
    if bgm_file.exists():
        bgm_res_id = f"r{next_res_idx}"
        next_res_idx += 1
        ET.SubElement(resources, "asset", {
            "id": bgm_res_id,
            "name": bgm_file.name,
            "src": f"file://{bgm_file.resolve()}",
            "start": "0s",
            "duration": total_dur_str,
            "has-audio": "1",
        })

    # Library -> Event -> Project -> Sequence -> Spine
    library = ET.SubElement(fcpxml, "library")
    event = ET.SubElement(library, "event", {"name": "AI Film Studio"})
    project_name = getattr(storyboard, "title", None) or getattr(storyboard, "topic", "Master Movie")
    project = ET.SubElement(event, "project", {"name": project_name})
    sequence = ET.SubElement(project, "sequence", {
        "format": fmt_id,
        "duration": total_dur_str,
        "tcStart": "0s",
        "tcFormat": "NDF",
    })
    spine = ET.SubElement(sequence, "spine")

    # Populate clips on the spine
    current_offset = 0.0
    text_style_idx = 1

    for shot in storyboard.shots:
        shot_dur = shot.duration or 5.0
        offset_str = _fmt_time(current_offset)
        shot_dur_str = _fmt_time(shot_dur)

        # Primary video clip
        clip = ET.SubElement(spine, "clip", {
            "name": shot.id,
            "offset": offset_str,
            "duration": shot_dur_str,
            "start": "0s",
            "format": fmt_id,
        })

        # Video asset reference
        ET.SubElement(clip, "video", {
            "ref": asset_map.get(f"video_{shot.id}", "r1"),
            "offset": "0s",
            "duration": shot_dur_str,
            "start": "0s",
        })

        # Synchronized Voiceover track
        v_vol = float(getattr(shot, "voice_volume", 1.0) or 1.0)
        audio_elem = ET.SubElement(clip, "audio", {
            "ref": asset_map.get(f"audio_{shot.id}", "r1"),
            "lane": "-1",
            "offset": "0s",
            "duration": shot_dur_str,
            "role": "dialogue",
        })
        ET.SubElement(audio_elem, "adjust-volume", {
            "amount": _linear_to_db(v_vol),
        })

        # Ambient SFX track if present
        sfx_vol = float(getattr(shot, "sfx_volume", 1.0) or 1.0)
        if f"sfx_{shot.id}" in asset_map:
            sfx_elem = ET.SubElement(clip, "audio", {
                "ref": asset_map[f"sfx_{shot.id}"],
                "lane": "-2",
                "offset": "0s",
                "duration": shot_dur_str,
                "role": "effects",
            })
            ET.SubElement(sfx_elem, "adjust-volume", {
                "amount": _linear_to_db(sfx_vol),
            })

        # Dialogue subtitle title overlay
        if shot.dialogue:
            ts_id = f"ts{text_style_idx}"
            text_style_idx += 1
            title_elem = ET.SubElement(clip, "title", {
                "ref": "r_title",
                "lane": "1",
                "offset": "0s",
                "duration": shot_dur_str,
                "name": f"Subtitle {shot.id}",
            })
            text_elem = ET.SubElement(title_elem, "text")
            ts_span = ET.SubElement(text_elem, "text-style", {"ref": ts_id})
            ts_span.text = shot.dialogue

            ts_def = ET.SubElement(title_elem, "text-style-def", {"id": ts_id})
            ET.SubElement(ts_def, "text-style", {
                "font": "Arial",
                "fontSize": "48",
                "fontColor": "1 1 1 1",
                "bold": "1",
                "alignment": "center",
            })

        current_offset += shot_dur

    # Background music lane spanning full sequence if available
    if bgm_res_id:
        bgm_elem = ET.SubElement(spine, "audio", {
            "ref": bgm_res_id,
            "lane": "-3",
            "offset": "0s",
            "duration": total_dur_str,
            "role": "music",
        })
        ET.SubElement(bgm_elem, "adjust-volume", {
            "amount": "-12.0dB",
        })

    # Format prettified XML
    raw_xml = ET.tostring(fcpxml, encoding="utf-8")
    parsed = minidom.parseString(raw_xml)
    pretty_xml = parsed.toprettyxml(indent="    ", encoding="utf-8")

    output_path.write_bytes(pretty_xml)
    return output_path
