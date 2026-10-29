import re
from pathlib import Path
from typing import Dict, List, Optional, Any
from studio.storyboard import Storyboard

SUBTITLE_PRESETS: Dict[str, Dict[str, Any]] = {
    "tiktok_bold": {
        "id": "tiktok_bold",
        "name": "TikTok / Reels Bold",
        "font_name": "Montserrat",
        "font_size_16_9": 22,
        "font_size_9_16": 20,
        "primary_color": "&H0000FFFF",  # Bright Yellow (&H0000FFFF -> #FFFF00)
        "secondary_color": "&H00FFFFFF",
        "outline_color": "&H00000000",  # Black
        "back_color": "&H80000000",
        "bold": 1,
        "italic": 0,
        "outline": 3.0,
        "shadow": 1.5,
        "alignment": 2,  # Bottom Center
        "margin_v_16_9": 40,
        "margin_v_9_16": 120,
        "description": "Chữ vàng viền đen dày nổi bật, chuẩn video ngắn Shorts & TikTok",
        "preview_text": "Phim điện ảnh siêu thực đỉnh cao",
    },
    "cinematic": {
        "id": "cinematic",
        "name": "Cinematic Classic",
        "font_name": "Cinzel",
        "font_size_16_9": 20,
        "font_size_9_16": 17,
        "primary_color": "&H00E8FFFF",  # Warm Light White/Ivory (&H00E8FFFF -> #FFFFE8)
        "secondary_color": "&H00D0D0D0",
        "outline_color": "&H00101010",
        "back_color": "&H60000000",
        "bold": 1,
        "italic": 0,
        "outline": 1.5,
        "shadow": 1.0,
        "alignment": 2,
        "margin_v_16_9": 40,
        "margin_v_9_16": 80,
        "description": "Phông chữ trang nhã viền thanh mảnh chuẩn phim chiếu rạp",
        "preview_text": "Bí mật ngàn năm dưới đáy đại dương",
    },
    "cyberpunk": {
        "id": "cyberpunk",
        "name": "Cyberpunk Neon",
        "font_name": "Courier New",
        "font_size_16_9": 22,
        "font_size_9_16": 18,
        "primary_color": "&H00FFFF00",  # Cyan Neon (&H00FFFF00 -> #00FFFF)
        "secondary_color": "&H00FF00FF",  # Magenta Neon
        "outline_color": "&H00000000",
        "back_color": "&H90300030",
        "bold": 1,
        "italic": 0,
        "outline": 2.8,
        "shadow": 2.0,
        "alignment": 2,
        "margin_v_16_9": 40,
        "margin_v_9_16": 90,
        "description": "Sắc màu Cyan viền đen phong cách khoa học viễn tưởng tương lai",
        "preview_text": "Hệ thống AI Cyberpunk 2088",
    },
    "retro_vhs": {
        "id": "retro_vhs",
        "name": "Retro 80s VHS",
        "font_name": "Trebuchet MS",
        "font_size_16_9": 21,
        "font_size_9_16": 18,
        "primary_color": "&H0033E0FF",  # Amber gold (&H0033E0FF -> #FFE033)
        "secondary_color": "&H00FFFFFF",
        "outline_color": "&H00000000",
        "back_color": "&HAA000000",
        "bold": 1,
        "italic": 0,
        "outline": 2.2,
        "shadow": 0.0,
        "alignment": 2,
        "margin_v_16_9": 45,
        "margin_v_9_16": 95,
        "description": "Màu vàng cổ điển với nền tối vintage hoài niệm thập niên 80",
        "preview_text": "Bản ghi hình lưu trữ năm 1984",
    },
    "minimalist": {
        "id": "minimalist",
        "name": "Minimalist Clean",
        "font_name": "Arial",
        "font_size_16_9": 19,
        "font_size_9_16": 16,
        "primary_color": "&H00FFFFFF",  # Pure White
        "secondary_color": "&H00E0E0E0",
        "outline_color": "&H00202020",
        "back_color": "&H00000000",
        "bold": 0,
        "italic": 0,
        "outline": 1.2,
        "shadow": 0.8,
        "alignment": 2,
        "margin_v_16_9": 35,
        "margin_v_9_16": 70,
        "description": "Tối giản, tinh tế, không viền nặng, tập trung vào hình ảnh",
        "preview_text": "Khoảnh khắc bình minh tĩnh lặng",
    },
    "karaoke_pop": {
        "id": "karaoke_pop",
        "name": "Karaoke Pop Highlight",
        "font_name": "Montserrat",
        "font_size_16_9": 23,
        "font_size_9_16": 20,
        "primary_color": "&H0000FFFF",  # Yellow
        "secondary_color": "&H00FFFFFF",  # White before highlight
        "outline_color": "&H00000000",
        "back_color": "&H80000000",
        "bold": 1,
        "italic": 0,
        "outline": 3.0,
        "shadow": 1.5,
        "alignment": 2,
        "margin_v_16_9": 50,
        "margin_v_9_16": 130,
        "description": "Hiệu ứng nhảy sáng từ ngữ theo nhịp điệu phát âm cuốn hút",
        "preview_text": "Từng câu thoại bừng sáng sống động",
    },
}

def ass_color_to_hex(ass_color: str) -> str:
    """Convert ASS &HAABBGGRR color format to web #RRGGBB hex."""
    cleaned = ass_color.replace("&H", "").replace("&", "").strip()
    if len(cleaned) == 8:
        # AABBGGRR -> RR, GG, BB
        b, g, r = cleaned[2:4], cleaned[4:6], cleaned[6:8]
        return f"#{r}{g}{b}".lower()
    elif len(cleaned) == 6:
        # BBGGRR -> RR, GG, BB
        b, g, r = cleaned[0:2], cleaned[2:4], cleaned[4:6]
        return f"#{r}{g}{b}".lower()
    return "#ffffff"

def get_subtitle_presets() -> List[Dict[str, Any]]:
    """Return list of subtitle typography presets enriched with hex colors for UI."""
    result = []
    for pid, p in SUBTITLE_PRESETS.items():
        item = dict(p)
        item["primary_color_hex"] = ass_color_to_hex(p.get("primary_color", "&H00FFFFFF"))
        item["outline_color_hex"] = ass_color_to_hex(p.get("outline_color", "&H00000000"))
        result.append(item)
    return result

def format_timestamp(seconds: float) -> str:
    """Format seconds into SRT timestamp HH:MM:SS,mmm."""
    total_ms = int(round(seconds * 1000))
    hours = total_ms // 3600000
    minutes = (total_ms % 3600000) // 60000
    secs = (total_ms % 60000) // 1000
    ms = total_ms % 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"

def format_ass_timestamp(seconds: float) -> str:
    """Format seconds into ASS timestamp H:MM:SS.cc (centiseconds)."""
    total_cs = int(round(seconds * 100))
    hours = total_cs // 360000
    minutes = (total_cs % 360000) // 6000
    secs = (total_cs % 6000) // 100
    cs = total_cs % 100
    return f"{hours}:{minutes:02d}:{secs:02d}.{cs:02d}"

def generate_srt(
    storyboard: Storyboard,
    audio_durations: Dict[str, float],
    output_path: Path
) -> Path:
    """Generate a standard .srt subtitle file from storyboard dialogue and shot durations."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    entries = []
    current_time = 0.0
    subtitle_index = 1

    for shot in storyboard.shots:
        duration = audio_durations.get(shot.id, shot.duration or 5.0)
        start_time = current_time
        end_time = current_time + duration
        current_time = end_time

        text = (shot.dialogue or "").strip()
        if not text:
            continue

        start_str = format_timestamp(start_time)
        end_str = format_timestamp(end_time)

        entry = f"{subtitle_index}\n{start_str} --> {end_str}\n{text}\n"
        entries.append(entry)
        subtitle_index += 1

    content = "\n".join(entries)
    output_path.write_text(content, encoding="utf-8")
    return output_path

def generate_ass(
    storyboard: Storyboard,
    audio_durations: Dict[str, float],
    output_path: Path,
    preset_id: str = "tiktok_bold",
    aspect_ratio: str = "16:9",
    position: str = "bottom",
    karaoke: bool = False,
) -> Path:
    """Generate an Advanced SubStation Alpha (.ass) subtitle file with rich typography & karaoke support."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    preset = SUBTITLE_PRESETS.get(preset_id, SUBTITLE_PRESETS["tiktok_bold"])

    # Font size & margin based on aspect ratio
    is_vertical = (aspect_ratio == "9:16")
    font_size = preset["font_size_9_16"] if is_vertical else preset["font_size_16_9"]
    margin_v = preset["margin_v_9_16"] if is_vertical else preset["margin_v_16_9"]

    # Position alignment:
    # 2 = Bottom-Center, 5 = Middle-Center, 8 = Top-Center
    pos_lower = (position or "bottom").lower().strip()
    if pos_lower in ("top", "upper"):
        alignment = 8
    elif pos_lower in ("middle", "center"):
        alignment = 5
    else:
        alignment = 2

    # Canvas dimensions
    res_x = 1080 if is_vertical else 1920
    res_y = 1920 if is_vertical else 1080

    font_name = preset.get("font_name", "Montserrat")
    primary = preset.get("primary_color", "&H0000FFFF")
    secondary = preset.get("secondary_color", "&H00FFFFFF")
    outline = preset.get("outline_color", "&H00000000")
    back = preset.get("back_color", "&H80000000")
    bold = preset.get("bold", 1)
    italic = preset.get("italic", 0)
    outline_val = preset.get("outline", 2.5)
    shadow_val = preset.get("shadow", 1.0)

    header = f"""[Script Info]
Title: AI Film Studio Master Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: {res_x}
PlayResY: {res_y}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary},{secondary},{outline},{back},{bold},{italic},0,0,100,100,0,0,1,{outline_val},{shadow_val},{alignment},20,20,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events = []
    current_time = 0.0

    for shot in storyboard.shots:
        duration = audio_durations.get(shot.id, shot.duration or 5.0)
        start_time = current_time
        end_time = current_time + duration
        current_time = end_time

        text = (shot.dialogue or "").strip()
        if not text:
            continue

        start_ass = format_ass_timestamp(start_time)
        end_ass = format_ass_timestamp(end_time)

        if karaoke:
            # Word-by-word karaoke highlight using {\k<centisecs>}
            words = text.split()
            if words:
                total_cs = max(1, int(round(duration * 100)))
                cs_per_word = max(10, total_cs // len(words))
                karaoke_parts = []
                for w in words:
                    karaoke_parts.append(f"{{\\k{cs_per_word}}}{w}")
                event_text = " ".join(karaoke_parts)
            else:
                event_text = text
        else:
            event_text = text

        events.append(f"Dialogue: 0,{start_ass},{end_ass},Default,,0,0,{margin_v},,{event_text}")

    full_content = header + "\n".join(events) + "\n"
    output_path.write_text(full_content, encoding="utf-8")
    return output_path
