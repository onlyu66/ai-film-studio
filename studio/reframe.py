from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import subprocess
import os

from studio.hardware import get_ffmpeg_video_encoder

REFRAME_PRESETS: Dict[str, Dict[str, Any]] = {
    "blur_padding": {
        "id": "blur_padding",
        "name": "Ambient Glass Blur (Nền mờ nghệ thuật)",
        "description": "Giữ nguyên tỉ lệ 16:9 ở giữa, nền trên và dưới được phóng to và làm mờ bokeh lung linh chuẩn Shorts/TikTok",
    },
    "pan_scan": {
        "id": "pan_scan",
        "name": "Dynamic Pan & Scan (Tràn viền 9:16)",
        "description": "Cắt cúp tỉ lệ 9:16 toàn màn hình 1080x1920, bám sát tâm điểm phân cảnh không có viền",
    },
    "fit_center": {
        "id": "fit_center",
        "name": "Fit Letterbox (Khung viền điện ảnh)",
        "description": "Tỉ lệ 16:9 nguyên bản ở trung tâm với viền tối giản trên dưới",
    },
}


SUBTITLE_STYLES: Dict[str, str] = {
    "mrbeast": "FontName=Arial,FontSize=26,Bold=1,PrimaryColour=&H0000FFFF&,OutlineColour=&H00000000&,Outline=3.5,Shadow=2,MarginV=160",
    "neon_cyan": "FontName=Arial,FontSize=24,Bold=1,PrimaryColour=&H00FFFF00&,OutlineColour=&H00000000&,Outline=2.5,Shadow=1.5,MarginV=150",
    "cinema_white": "FontName=Helvetica,FontSize=20,Bold=0,PrimaryColour=&H00FFFFFF&,OutlineColour=&H00000000&,Outline=2,Shadow=1,MarginV=140",
}


def get_reframe_presets() -> List[Dict[str, Any]]:
    """Return list of available reframe presets."""
    return list(REFRAME_PRESETS.values())


def build_reframe_filtergraph(
    mode: str = "blur_padding",
    subtitle_path: Optional[Path] = None,
    subtitle_style: str = "mrbeast",
) -> Tuple[str, bool]:
    """
    Build FFmpeg filtergraph for vertical 9:16 (1080x1920).
    Returns (filter_string, is_complex_filter).
    """
    mode = mode.lower().strip()
    sub_filter = ""
    if subtitle_path:
        sub_esc = str(subtitle_path).replace("\\", "/").replace(":", "\\:")
        style_force = SUBTITLE_STYLES.get(subtitle_style, SUBTITLE_STYLES["mrbeast"])
        sub_filter = f",subtitles='{sub_esc}':force_style='{style_force}'"

    if mode == "blur_padding":
        base_fg = (
            "[0:v]split=2[bg][fg];"
            "[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=luma_radius=min(h\\,w)/20:luma_power=2[bg_b];"
            "[fg]scale=1080:-1[fg_s];"
            "[bg_b][fg_s]overlay=(W-w)/2:(H-h)/2"
        )
        if sub_filter:
            sub_esc = str(subtitle_path).replace("\\", "/").replace(":", "\\:")
            style_force = SUBTITLE_STYLES.get(subtitle_style, SUBTITLE_STYLES["mrbeast"])
            base_fg += f"[out_base];[out_base]subtitles='{sub_esc}':force_style='{style_force}'[outv]"
        else:
            base_fg += "[outv]"
        return base_fg, True

    elif mode == "pan_scan":
        # Crop 9:16 out of center and scale to 1080:1920
        fg = "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920" + sub_filter
        return fg, False

    else:
        # fit_center: Scale width to 1080 and pad height to 1920 with black bars
        fg = "scale=1080:-1,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" + sub_filter
        return fg, False


def reframe_video(
    input_path: Path,
    output_path: Path,
    mode: str = "blur_padding",
    subtitle_path: Optional[Path] = None,
    subtitle_style: str = "mrbeast",
    hardware_accel: str = "auto",
) -> Path:
    """
    Convert a 16:9 landscape video into a 9:16 vertical video (1080x1920).
    """
    input_path = Path(input_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    filter_str, is_complex = build_reframe_filtergraph(
        mode,
        subtitle_path=subtitle_path,
        subtitle_style=subtitle_style,
    )

    encoder_name, enc_flags = get_ffmpeg_video_encoder(hardware_accel)

    cmd = ["ffmpeg", "-y", "-i", str(input_path)]

    if is_complex:
        cmd.extend(["-filter_complex", filter_str, "-map", "[outv]", "-map", "0:a?"])
    else:
        cmd.extend(["-vf", filter_str, "-map", "0:v?", "-map", "0:a?"])

    cmd.extend(enc_flags)
    cmd.extend(["-c:a", "aac", "-b:a", "192k", str(output_path)])

    subprocess.run(cmd, check=True)
    return output_path
