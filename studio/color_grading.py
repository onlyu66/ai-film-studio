from typing import Dict, List, Optional, Any

COLOR_LUTS: Dict[str, Dict[str, Any]] = {
    "teal_and_orange": {
        "id": "teal_and_orange",
        "name": "Hollywood Teal & Orange",
        "description": "Tone bom tấn Hollywood kinh điển: ấm áp da người, xanh ngọc bóng tối",
        "css_gradient": "from-amber-600 to-cyan-700",
        "ffmpeg_filter": "colorbalance=rs=0.08:gs=0.01:bs=-0.06:rm=-0.04:gm=0.02:bm=0.06:rh=0.05:gh=0.02:bh=-0.04,eq=contrast=1.12:saturation=1.18:brightness=0.01,vignette=PI/4",
    },
    "kodachrome_1970": {
        "id": "kodachrome_1970",
        "name": "Vintage Kodachrome 1970s",
        "description": "Màu phim nhựa cổ điển thập niên 70: ấm áp, hơi hoài niệm vàng đồng",
        "css_gradient": "from-amber-700 to-rose-900",
        "ffmpeg_filter": "curves=vintage,colorbalance=rs=0.06:gs=0.02:bs=-0.05,eq=contrast=1.08:saturation=1.10:gamma_r=1.05:gamma_b=0.95,vignette=PI/3.5",
    },
    "wes_anderson_pastel": {
        "id": "wes_anderson_pastel",
        "name": "Wes Anderson Pastel Warmth",
        "description": "Gam màu pastel mộng mơ, vàng dịu và hồng đào tinh tế đối xứng",
        "css_gradient": "from-yellow-500 to-pink-500",
        "ffmpeg_filter": "colorbalance=rs=0.05:gs=0.03:bs=-0.02:rm=0.04:gm=0.02:bm=-0.03,eq=contrast=0.96:saturation=1.12:brightness=0.02,vignette=PI/5",
    },
    "cyberpunk_matrix": {
        "id": "cyberpunk_matrix",
        "name": "Cyberpunk Matrix Neon",
        "description": "Bóng tối xanh lục ma trận và ánh sáng neon tím viễn tưởng",
        "css_gradient": "from-emerald-500 to-fuchsia-600",
        "ffmpeg_filter": "colorbalance=rs=-0.05:gs=0.08:bs=0.04:rm=-0.08:gm=0.06:bm=0.05:rh=0.06:gh=-0.02:bh=0.08,eq=contrast=1.20:saturation=1.25:brightness=-0.02,vignette=PI/3",
    },
    "bleach_bypass": {
        "id": "bleach_bypass",
        "name": "Bleach Bypass (Saving Private Ryan)",
        "description": "Khử bão hòa -45%, độ tương phản sắc bén, phong cách chiến tranh gai góc",
        "css_gradient": "from-zinc-500 to-stone-800",
        "ffmpeg_filter": "eq=contrast=1.35:saturation=0.55:brightness=-0.02,colorbalance=rs=-0.02:gs=0.01:bs=0.03,vignette=PI/3",
    },
    "film_noir_bw": {
        "id": "film_noir_bw",
        "name": "Silver Nitrate Noir (B&W)",
        "description": "Đen trắng tráng bạc kinh điển, tương phản cao, đổ bóng sọc",
        "css_gradient": "from-zinc-200 to-black",
        "ffmpeg_filter": "hue=s=0,eq=contrast=1.30:brightness=-0.03,vignette=PI/2.5",
    },
    "golden_sunset": {
        "id": "golden_sunset",
        "name": "Golden Sunset Glow",
        "description": "Nắng vàng cam hoàng hôn rực rỡ, lãng mạn dạt dào cảm xúc",
        "css_gradient": "from-yellow-400 to-orange-600",
        "ffmpeg_filter": "colorbalance=rs=0.12:gs=0.04:bs=-0.08:rm=0.08:gm=0.02:bm=-0.06,eq=contrast=1.10:saturation=1.22:brightness=0.01,vignette=PI/4",
    },
    "nordic_cold": {
        "id": "nordic_cold",
        "name": "Nordic Cold Mystery",
        "description": "Tông lạnh xanh xám Bắc Âu bí ẩn, băng giá và sâu thẳm",
        "css_gradient": "from-cyan-900 to-slate-900",
        "ffmpeg_filter": "colorbalance=rs=-0.06:gs=-0.01:bs=0.09:rm=-0.05:gm=0.01:bm=0.08,eq=contrast=1.08:saturation=0.85:brightness=-0.01,vignette=PI/3",
    },
}

SCENE_TRANSITIONS: Dict[str, Dict[str, Any]] = {
    "cut": {
        "id": "cut",
        "name": "Cut (Hard Cut)",
        "description": "Chuyển cảnh tức thì chuẩn mực biên tập phim",
        "xfade_name": "",
        "default_duration": 0.0,
    },
    "dissolve": {
        "id": "dissolve",
        "name": "Dissolve (Hòa tan mượt mà)",
        "description": "Hai cảnh hòa tan lồng ghép vào nhau êm ái, liền mạch",
        "xfade_name": "fade",
        "default_duration": 0.6,
    },
    "fade_black": {
        "id": "fade_black",
        "name": "Dip to Black (Mờ dần về đen)",
        "description": "Màn hình tối dần về đen rồi bừng sáng cảnh mới, ngắt quãng thời gian",
        "xfade_name": "fadeblack",
        "default_duration": 0.5,
    },
    "fade_white": {
        "id": "fade_white",
        "name": "Dip to White (Chớp sáng trắng)",
        "description": "Chớp lóa sáng trắng, phù hợp cảnh hồi tưởng hoặc chấn động",
        "xfade_name": "fadewhite",
        "default_duration": 0.5,
    },
    "whip_pan": {
        "id": "whip_pan",
        "name": "Whip Pan Blur (Lia nhòe ngang)",
        "description": "Lia máy cực nhanh tạo vệt nhòe ngang chuyển cảnh hành động",
        "xfade_name": "hblur",
        "default_duration": 0.4,
    },
    "film_burn": {
        "id": "film_burn",
        "name": "Film Burn (Vệt cháy phim)",
        "description": "Vệt sáng chớp ngang phong cách phim nhựa cổ điển",
        "xfade_name": "hlwind",
        "default_duration": 0.5,
    },
    "glitch": {
        "id": "glitch",
        "name": "Digital Glitch (Nhiễu pixel số hóa)",
        "description": "Hiệu ứng vỡ hạt pixel kỹ thuật số cho phim Sci-Fi & Cyberpunk",
        "xfade_name": "pixelize",
        "default_duration": 0.4,
    },
    "circle_open": {
        "id": "circle_open",
        "name": "Circle Iris Open (Mở tròn từ tâm)",
        "description": "Vòng tròn mở rộng dần từ trung tâm như ống kính mở màn",
        "xfade_name": "circleopen",
        "default_duration": 0.6,
    },
}


def get_color_luts() -> List[Dict[str, Any]]:
    """Return all available cinematic color grading LUT presets."""
    return list(COLOR_LUTS.values())


def get_scene_transitions() -> List[Dict[str, Any]]:
    """Return all available scene transition presets."""
    return list(SCENE_TRANSITIONS.values())


def get_color_lut_filter(lut_id: Optional[str]) -> str:
    """Return the FFmpeg video filter string for the specified color LUT preset."""
    if not lut_id or lut_id in ("none", "default"):
        return ""
    clean_id = str(lut_id).lower().strip()
    preset = COLOR_LUTS.get(clean_id)
    if preset:
        return preset["ffmpeg_filter"]
    return ""


def build_xfade_filtergraph(
    durations: List[float],
    transition: str = "dissolve",
    trans_duration: float = 0.6,
) -> Optional[str]:
    """
    Construct the FFmpeg xfade filtergraph chain for N clips with specified durations.
    Returns None if fewer than 2 clips or transition is 'cut'.
    """
    if not durations or len(durations) < 2:
        return None

    clean_trans = (transition or "cut").lower().strip()
    if clean_trans == "cut":
        return None

    trans_obj = SCENE_TRANSITIONS.get(clean_trans)
    xfade_type = trans_obj["xfade_name"] if trans_obj else "fade"
    if not xfade_type:
        return None

    duration = max(0.2, min(trans_duration, 1.5))
    num_clips = len(durations)

    filter_chains: List[str] = []
    accumulated_offset = 0.0

    for i in range(num_clips - 1):
        d_curr = float(durations[i])
        if i == 0:
            accumulated_offset = max(0.1, d_curr - duration)
            prev_tag = "[0:v]"
        else:
            accumulated_offset = max(accumulated_offset + 0.1, accumulated_offset + d_curr - duration)
            prev_tag = f"[v{i}]"

        next_tag = f"[{i + 1}:v]"
        out_tag = f"[v{i + 1}]"

        step_expr = (
            f"{prev_tag}{next_tag}xfade=transition={xfade_type}:"
            f"duration={duration:.1f}:offset={accumulated_offset:.1f}{out_tag}"
        )
        filter_chains.append(step_expr)

    return ";".join(filter_chains)
