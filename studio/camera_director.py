from pathlib import Path
from typing import Dict, List, Optional, Any
import copy
import shutil
import concurrent.futures

from studio.storyboard import Shot, Character
from studio.images import generate_image_for_shot, STYLE_DNA

CAMERA_ANGLES: Dict[str, Dict[str, Any]] = {
    "wide": {
        "id": "wide",
        "name": "Toàn cảnh (Wide Shot / Establishing)",
        "category": "Shot Size",
        "description": "Bao quát toàn bộ không gian, bối cảnh rộng lớn, giới thiệu địa điểm",
        "keywords": "wide establishing shot, panoramic view, full environment visible, grand cinematic composition",
    },
    "medium": {
        "id": "medium",
        "name": "Trung cảnh (Medium Shot / Cowboy)",
        "category": "Shot Size",
        "description": "Từ thắt lưng trở lên, cân bằng giữa biểu cảm nhân vật và không gian xung quanh",
        "keywords": "medium shot, waist up framing, balanced character and environment presence, standard cinema framing",
    },
    "close_up": {
        "id": "close_up",
        "name": "Cận cảnh (Close-Up)",
        "category": "Shot Size",
        "description": "Tập trung vào khuôn mặt, ánh mắt và cảm xúc mãnh liệt của nhân vật",
        "keywords": "close-up shot, intense facial expression, emotional depth, sharp character focus, shallow depth of field",
    },
    "extreme_close_up": {
        "id": "extreme_close_up",
        "name": "Đặc tả chi tiết (Extreme Close-Up)",
        "category": "Shot Size",
        "description": "Chi tiết micro vào ánh mắt, bàn tay, kỷ vật cổ xưa hoặc vết sẹo",
        "keywords": "extreme close-up macro detail, macro lens focus on eyes, micro textures, dramatic cinematic tension",
    },
    "low_angle": {
        "id": "low_angle",
        "name": "Góc thấp hất lên (Heroic Low Angle)",
        "category": "Perspective",
        "description": "Camera đặt thấp nhìn lên tạo cảm giác uy quyền, mạnh mẽ hoặc đe dọa",
        "keywords": "dramatic low angle shot looking up, towering stature, heroic perspective, dominant cinematic angle",
    },
    "high_angle": {
        "id": "high_angle",
        "name": "Góc cao nhìn xuống (High Angle / Bird's Eye)",
        "category": "Perspective",
        "description": "Nhìn từ trên xuống tạo cảm giác cô đơn, nhỏ bé hoặc góc nhìn toàn tri",
        "keywords": "high angle shot looking down, bird's eye perspective, vulnerability, vast spatial scale",
    },
    "over_the_shoulder": {
        "id": "over_the_shoulder",
        "name": "Góc qua vai (Over-The-Shoulder / OTS)",
        "category": "Perspective",
        "description": "Góc quay đối thoại qua vai kinh điển của điện ảnh",
        "keywords": "over-the-shoulder conversation shot, OTS framing, dialogue depth of field, narrative connection",
    },
    "dutch_angle": {
        "id": "dutch_angle",
        "name": "Góc nghiêng kịch tính (Dutch Angle / Canted)",
        "category": "Perspective",
        "description": "Độ nghiêng khung hình tạo cảm giác bất an, hoang mang, kịch tính",
        "keywords": "dutch angle tilted frame, canted camera horizon, psychological tension, uneasy cinematic mood",
    },
}

CAMERA_MOTIONS: Dict[str, Dict[str, Any]] = {
    "static": {
        "id": "static",
        "name": "Cố định (Static Camera)",
        "description": "Máy quay cố định chuẩn mực điện ảnh tĩnh",
        "keywords": "locked off static shot, steady tripod frame, motionless camera",
    },
    "zoom_in": {
        "id": "zoom_in",
        "name": "Thu phóng tiến (Push In / Zoom In)",
        "description": "Tiến lại gần chủ thể, tăng dần sự căng thẳng",
        "keywords": "slow smooth push in zoom, camera moving closer to subject",
    },
    "zoom_out": {
        "id": "zoom_out",
        "name": "Thu phóng lùi (Pull Out / Zoom Out)",
        "description": "Lùi xa khỏi chủ thể, để lộ không gian rộng lớn",
        "keywords": "smooth pull back zoom out, revealing vast environment",
    },
    "pan_left": {
        "id": "pan_left",
        "name": "Lia máy sang trái (Pan Left)",
        "description": "Quay ngang trục sang trái mượt mà",
        "keywords": "smooth cinematic pan left, sweeping horizontal camera movement",
    },
    "pan_right": {
        "id": "pan_right",
        "name": "Lia máy sang phải (Pan Right)",
        "description": "Quay ngang trục sang phải mượt mà",
        "keywords": "smooth cinematic pan right, fluid lateral camera motion",
    },
    "tilt_up": {
        "id": "tilt_up",
        "name": "Nâng máy lên (Tilt Up)",
        "description": "Nâng góc máy lên bầu trời hoặc đỉnh tháp",
        "keywords": "slow vertical tilt up, revealing sky or towering architecture",
    },
    "tilt_down": {
        "id": "tilt_down",
        "name": "Hạ máy xuống (Tilt Down)",
        "description": "Hạ góc máy xuống mặt đất hoặc nhân vật",
        "keywords": "slow vertical tilt down, descending camera gaze",
    },
    "dolly_in": {
        "id": "dolly_in",
        "name": "Đẩy ray tiến (Dolly In)",
        "description": "Đẩy xe ray tiến thẳng về phía nhân vật với hiệu ứng thị sai parallax",
        "keywords": "dolly in forward tracking shot, cinematic parallax movement",
    },
    "dolly_out": {
        "id": "dolly_out",
        "name": "Kéo ray lùi (Dolly Out)",
        "description": "Kéo xe ray lùi xa khỏi nhân vật, mở rộng trường thị giác",
        "keywords": "dolly out reverse tracking shot, receding spatial depth",
    },
    "orbit_left": {
        "id": "orbit_left",
        "name": "Quay vòng quanh trái (Orbit Left)",
        "description": "Camera lượn vòng quanh chủ thể theo chiều ngược kim đồng hồ",
        "keywords": "orbital camera rotation around subject, 360 dynamic parallax",
    },
    "orbit_right": {
        "id": "orbit_right",
        "name": "Quay vòng quanh phải (Orbit Right)",
        "description": "Camera lượn vòng quanh chủ thể theo chiều kim đồng hồ",
        "keywords": "clockwise orbital camera move, dynamic wrapping perspective",
    },
    "fpv_drone": {
        "id": "fpv_drone",
        "name": "Flycam Drone nhào lượn (FPV Drone Dynamic)",
        "description": "Góc bay tự do của drone FPV tốc độ cao, nhào lượn ngoạn mục",
        "keywords": "dynamic FPV drone flythrough, fast swooping camera flight, aerial action",
    },
    "handheld": {
        "id": "handheld",
        "name": "Cầm tay kịch tính (Handheld Action)",
        "description": "Rung lắc tự nhiên tạo cảm giác chân thực phóng sự",
        "keywords": "organic handheld camera shake, authentic documentary motion, adrenaline action",
    },
}

LENS_PRESETS: Dict[str, Dict[str, Any]] = {
    "anamorphic_35mm": {
        "id": "anamorphic_35mm",
        "name": "Anamorphic 35mm (Widescreen Flare & Bokeh Oval)",
        "description": "Vệt sáng ngang xanh neon và bokeh oval chuẩn Hollywood",
        "keywords": "shot on 35mm Panavision anamorphic lens, horizontal blue streak flare, oval bokeh, 2.39:1 aspect aesthetic",
    },
    "cinema_50mm": {
        "id": "cinema_50mm",
        "name": "Cinema 50mm f/1.4 (Natural Human Vision)",
        "description": "Tiêu cự chuẩn mắt người nhìn, tự nhiên và chân thực",
        "keywords": "shot on 50mm prime lens f/1.4, natural optical perspective, creamy bokeh, pristine human eye view",
    },
    "portrait_85mm": {
        "id": "portrait_85mm",
        "name": "Portrait 85mm f/1.2 (Ultra Subject Isolation)",
        "description": "Tách bạch chủ thể hoàn hảo, hậu cảnh xóa mờ mộng mơ",
        "keywords": "85mm f/1.2 telephoto portrait lens, razor sharp facial details, sublime background defocus",
    },
    "telephoto_200mm": {
        "id": "telephoto_200mm",
        "name": "Telephoto 200mm (Compressed Depth)",
        "description": "Nén phối cảnh không gian, hậu cảnh khổng lồ kề cận",
        "keywords": "200mm telephoto lens, extreme spatial compression, distant background towering behind subject",
    },
    "ultra_wide_14mm": {
        "id": "ultra_wide_14mm",
        "name": "Ultra Wide 14mm (Epic Scale & Grandeur)",
        "description": "Góc siêu rộng 114 độ hoành tráng, chiều sâu bao la",
        "keywords": "14mm ultra wide angle lens, dramatic perspective lines, sweeping grand scale, expansive vision",
    },
    "imax_70mm": {
        "id": "imax_70mm",
        "name": "IMAX 70mm (Unrivaled Film Detail)",
        "description": "Độ chi tiết và độ nét cực đại chuẩn Christopher Nolan",
        "keywords": "shot on 70mm IMAX camera, immense resolution, crystal clear depth, grain-free ultra sharp cinema",
    },
}

LIGHTING_PRESETS: Dict[str, Dict[str, Any]] = {
    "golden_hour": {
        "id": "golden_hour",
        "name": "Nắng vàng hoàng hôn (Golden Hour)",
        "description": "Ánh sáng vàng ấm áp lúc hoàng hôn, viền tóc tỏa sáng",
        "keywords": "warm golden hour sunlight, low sun angle, radiant amber rim light, soft cinematic glow",
    },
    "rembrandt": {
        "id": "rembrandt",
        "name": "Rembrandt kịch tính (Dramatic Chiaroscuro)",
        "description": "Tam giác sáng kinh điển trên má, đổ bóng kịch tính",
        "keywords": "Rembrandt studio lighting, triangle highlight on cheek, dramatic chiaroscuro, moody shadows",
    },
    "volumetric_rays": {
        "id": "volumetric_rays",
        "name": "Tia sáng sương mù (God Rays / Volumetric)",
        "description": "Tia nắng xuyên qua cửa sổ hoặc sương mù huyền ảo",
        "keywords": "volumetric lighting, God rays piercing through atmospheric mist, ethereal sunbeams, dust motes",
    },
    "cyberpunk_neon": {
        "id": "cyberpunk_neon",
        "name": "Neon Cyberpunk (Cyan & Magenta Split)",
        "description": "Ánh sáng neon đối lập xanh tím rực rỡ",
        "keywords": "cyberpunk neon lighting, split cyan and magenta backlighting, high contrast reflections on wet surface",
    },
    "moody_noir": {
        "id": "moody_noir",
        "name": "Film Noir bí ẩn (Hard Venetian Shadows)",
        "description": "Bóng đổ sọc rèm Venetian và độ tương phản cao",
        "keywords": "film noir lighting, Venetian blind shadow stripes, stark black and white contrast, mysterious key light",
    },
    "soft_studio": {
        "id": "soft_studio",
        "name": "Studio êm dịu (Soft Three-Point Diffused)",
        "description": "Ánh sáng 3 điểm tản mịn màng, không gắt",
        "keywords": "soft diffused three-point studio lighting, gentle fill light, wrap-around illumination, zero harsh shadows",
    },
}


def get_camera_presets() -> Dict[str, List[Dict[str, Any]]]:
    """Return all camera angles, motions, lenses, and lighting presets."""
    return {
        "angles": list(CAMERA_ANGLES.values()),
        "motions": list(CAMERA_MOTIONS.values()),
        "lenses": list(LENS_PRESETS.values()),
        "lightings": list(LIGHTING_PRESETS.values()),
    }


def compose_cinematic_prompt(
    base_prompt: str,
    camera_angle: Optional[str] = None,
    camera_motion: Optional[str] = None,
    lens: Optional[str] = None,
    lighting: Optional[str] = None,
    visual_anchor: Optional[str] = None,
    style: str = "cinematic",
) -> str:
    """Compose an enriched cinematic prompt combining character anchor, framing, lens, lighting, and style."""
    parts: List[str] = []

    # 1. Character Visual DNA Anchor
    if visual_anchor and str(visual_anchor).strip():
        parts.append(f"Subject: {visual_anchor.strip()}")

    # 2. Camera Angle / Framing
    if camera_angle and camera_angle in CAMERA_ANGLES:
        parts.append(CAMERA_ANGLES[camera_angle]["keywords"])
    elif camera_angle and str(camera_angle).strip():
        parts.append(f"{camera_angle.replace('_', ' ')} camera angle")

    # 3. Base Action / Scene Description
    if base_prompt and str(base_prompt).strip():
        parts.append(base_prompt.strip())

    # 4. Lens Preset
    if lens and lens in LENS_PRESETS:
        parts.append(LENS_PRESETS[lens]["keywords"])
    elif lens and str(lens).strip():
        parts.append(f"shot on {lens.replace('_', ' ')}")

    # 5. Lighting Preset
    if lighting and lighting in LIGHTING_PRESETS:
        parts.append(LIGHTING_PRESETS[lighting]["keywords"])
    elif lighting and str(lighting).strip():
        parts.append(f"{lighting.replace('_', ' ')} lighting")

    # 6. Camera Motion hint (optional)
    if camera_motion and camera_motion in CAMERA_MOTIONS and camera_motion != "static":
        parts.append(CAMERA_MOTIONS[camera_motion]["keywords"])

    # 7. Style DNA Suffix
    style_suffix = STYLE_DNA.get(style.lower(), STYLE_DNA["cinematic"])
    parts.append(style_suffix)

    return ", ".join(parts)


def generate_multi_angle_prompts(
    base_prompt: str,
    angles: Optional[List[str]] = None,
    lens: Optional[str] = None,
    lighting: Optional[str] = None,
    visual_anchor: Optional[str] = None,
    style: str = "cinematic",
) -> Dict[str, str]:
    """Generate prompt variants for multiple camera angles (default: wide, medium, close_up)."""
    target_angles = angles or ["wide", "medium", "close_up"]
    result: Dict[str, str] = {}
    for angle in target_angles:
        result[angle] = compose_cinematic_prompt(
            base_prompt=base_prompt,
            camera_angle=angle,
            lens=lens,
            lighting=lighting,
            visual_anchor=visual_anchor,
            style=style,
        )
    return result


def render_multi_angle_coverage(
    shot: Shot,
    characters: Dict[str, Character],
    angles: Optional[List[str]] = None,
    output_dir: Optional[Path] = None,
    style: str = "cinematic",
    aspect_ratio: str = "16:9",
    engine: str = "pollinations",
    api_url: Optional[str] = None,
) -> Dict[str, str]:
    """
    Render 3 camera angle image candidates (wide, medium, close_up) in parallel for a given shot.
    Returns mapping of angle -> image_url.
    """
    target_angles = angles or ["wide", "medium", "close_up"]
    out_dir = Path(output_dir or "outputs/images")
    out_dir.mkdir(parents=True, exist_ok=True)

    char = characters.get(shot.character_id) if shot.character_id else None
    base_seed = getattr(char, "seed", 42) if char else 42

    results: Dict[str, str] = {}

    def _render_single_angle(angle: str):
        # Create a modified clone of shot with this angle
        angle_shot = copy.deepcopy(shot)
        angle_shot.camera_angle = angle

        angle_prompt = compose_cinematic_prompt(
            base_prompt=shot.image_prompt,
            camera_angle=angle,
            lens=getattr(shot, "camera_lens", None),
            lighting=getattr(shot, "lighting", None),
            visual_anchor=char.visual_anchor if char else None,
            style=style,
        )
        angle_shot.image_prompt = angle_prompt

        # Save to dedicated file, e.g. shot_001_wide.png
        candidate_file = out_dir / f"{shot.id}_{angle}.png"

        gen_path = generate_image_for_shot(
            shot=angle_shot,
            characters=characters,
            style=style,
            output_dir=out_dir,
            aspect_ratio=aspect_ratio,
            seed_override=base_seed,
            engine=engine,
            api_url=api_url,
        )

        if gen_path and Path(gen_path).exists():
            shutil.copyfile(gen_path, candidate_file)
            return angle, f"/outputs/images/{candidate_file.name}"
        return angle, None

    # Run multi-angle generation with ThreadPoolExecutor
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(target_angles), 3)) as pool:
        futures = [pool.submit(_render_single_angle, angle) for angle in target_angles]
        for f in concurrent.futures.as_completed(futures):
            try:
                angle, url = f.result()
                if url:
                    results[angle] = url
            except Exception as e:
                print(f"[CameraDirector] Error rendering angle: {e}")

    return results
