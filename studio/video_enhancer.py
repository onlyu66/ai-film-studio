from pathlib import Path
from typing import Dict, List, Optional, Any
import subprocess
import shutil

ENHANCER_PRESETS: List[Dict[str, Any]] = [
    {
        "id": "4k_crisp",
        "name": "4K Ultra HD Crisp",
        "description": "Nâng cấp siêu phân giải 4K (3840x2160) sử dụng thuật toán Lanczos và Unsharp Masking tăng độ chi tiết viền",
        "target_resolution": "3840x2160",
        "target_fps": "original",
        "filter": "scale=3840:2160:flags=lanczos,unsharp=5:5:0.8:3:3:0.4",
        "badge": "4K UHD",
        "icon": "Maximize",
    },
    {
        "id": "4k_clean",
        "name": "4K Ultra HD Clean",
        "description": "Nâng cấp 4K mượt mà với thuật toán Spline, tối ưu cho phim hoạt hình, anime hoặc tranh minh họa",
        "target_resolution": "3840x2160",
        "target_fps": "original",
        "filter": "scale=3840:2160:flags=spline",
        "badge": "4K Spline",
        "icon": "Sparkles",
    },
    {
        "id": "fps_60_smooth",
        "name": "60fps Cinematic Motion Interpolation",
        "description": "Nội suy chuyển động bù hai chiều (MCI - Bidirectional AOBMC) mượt mà chuẩn 60fps điện ảnh cao cấp",
        "target_resolution": "original",
        "target_fps": "60fps",
        "filter": "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1",
        "badge": "60 FPS MCI",
        "icon": "Zap",
    },
    {
        "id": "fps_60_fast",
        "name": "60fps Fast Motion Smoothing",
        "description": "Nội suy khung hình 60fps chế độ Blend tối ưu tốc độ render nhanh chóng",
        "target_resolution": "original",
        "target_fps": "60fps",
        "filter": "minterpolate=fps=60:mi_mode=blend",
        "badge": "60 FPS Fast",
        "icon": "Gauge",
    },
    {
        "id": "ultra_master_4k_60fps",
        "name": "Ultra 4K UHD 60fps Cinema Master",
        "description": "Kết hợp toàn diện nâng cấp 4K siêu nét và chuyển động 60fps siêu mượt cho bản xuất bản xuất sắc nhất",
        "target_resolution": "3840x2160",
        "target_fps": "60fps",
        "filter": "scale=3840:2160:flags=lanczos,unsharp=5:5:0.8:3:3:0.4,minterpolate=fps=60:mi_mode=blend",
        "badge": "4K + 60FPS",
        "icon": "Award",
    },
    {
        "id": "film_grain_enhance",
        "name": "35mm Film Grain & Contrast Enhancement",
        "description": "Tăng cường tương phản điện ảnh và bổ sung lớp hạt phim nhựa 35mm hữu cơ sống động",
        "target_resolution": "original",
        "target_fps": "original",
        "filter": "eq=contrast=1.08:brightness=0.01:saturation=1.05,noise=alls=12:allf=t+u",
        "badge": "35mm Grain",
        "icon": "Film",
    },
]

def get_enhancer_presets() -> List[Dict[str, Any]]:
    """Return all available video enhancer presets."""
    return ENHANCER_PRESETS

def build_enhancer_filter(
    preset_id: str,
    custom_scale: Optional[str] = None,
    custom_fps: Optional[int] = None,
) -> str:
    """Build FFmpeg video filtergraph for given preset and custom parameters."""
    preset = next((p for p in ENHANCER_PRESETS if p["id"] == preset_id), None)
    filter_parts: List[str] = []

    if preset:
        filter_parts.append(preset["filter"])

    if custom_scale:
        filter_parts.append(f"scale={custom_scale}:flags=lanczos")

    if custom_fps:
        filter_parts.append(f"minterpolate=fps={custom_fps}:mi_mode=blend")

    if not filter_parts:
        return "scale=3840:2160:flags=lanczos,unsharp=5:5:0.8:3:3:0.4"

    return ",".join(filter_parts)

def enhance_video(
    input_path: Path,
    output_path: Path,
    preset_id: str = "4k_crisp",
    custom_scale: Optional[str] = None,
    custom_fps: Optional[int] = None,
    hardware_accel: bool = True,
) -> Path:
    """Enhance video resolution, framerate, and cinematic clarity via FFmpeg."""
    input_path = Path(input_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        raise FileNotFoundError(f"Input video not found: {input_path}")

    filter_graph = build_enhancer_filter(preset_id, custom_scale, custom_fps)

    # Determine hardware encoder if available
    vcodec = "libx264"
    if hardware_accel:
        try:
            from studio.hardware import get_ffmpeg_encoder
            enc_name, _ = get_ffmpeg_encoder()
            if enc_name in ("h264_nvenc", "hevc_nvenc", "h264_vaapi"):
                vcodec = enc_name
        except Exception:
            vcodec = "libx264"

    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_path),
        "-vf", filter_graph,
        "-c:v", vcodec,
        "-pix_fmt", "yuv420p",
        "-c:a", "copy",
        str(output_path),
    ]

    subprocess.run(cmd, check=True)
    return output_path

def enhance_shot_video(
    shot_id: str,
    preset_id: str = "4k_crisp",
    project_id: Optional[str] = None,
    base_dir: Optional[Path] = None,
    custom_scale: Optional[str] = None,
    custom_fps: Optional[int] = None,
) -> Path:
    """Enhance a specific shot clip to 4K or 60fps."""
    if base_dir:
        input_file = Path(base_dir) / "videos" / f"{shot_id}.mp4"
        output_file = Path(base_dir) / "videos" / f"{shot_id}_enhanced.mp4"
    elif project_id and project_id not in ("current", ""):
        input_file = Path(f"outputs/projects/{project_id}/videos/{shot_id}.mp4")
        output_file = Path(f"outputs/projects/{project_id}/videos/{shot_id}_enhanced.mp4")
    else:
        input_file = Path(f"outputs/videos/{shot_id}.mp4")
        output_file = Path(f"outputs/videos/{shot_id}_enhanced.mp4")

    return enhance_video(
        input_path=input_file,
        output_path=output_file,
        preset_id=preset_id,
        custom_scale=custom_scale,
        custom_fps=custom_fps,
    )

def enhance_master_video(
    preset_id: str = "ultra_master_4k_60fps",
    project_id: Optional[str] = None,
    base_dir: Optional[Path] = None,
    custom_scale: Optional[str] = None,
    custom_fps: Optional[int] = None,
) -> Path:
    """Enhance the final assembled master movie."""
    if base_dir:
        candidate_1 = Path(base_dir) / "master_movie.mp4"
        candidate_2 = Path(base_dir) / "final" / "movie.mp4"
        input_file = candidate_1 if candidate_1.exists() else candidate_2
        output_file = Path(base_dir) / "master_movie_enhanced.mp4"
    elif project_id and project_id not in ("current", ""):
        input_file = Path(f"outputs/projects/{project_id}/master_movie.mp4")
        output_file = Path(f"outputs/projects/{project_id}/master_movie_enhanced.mp4")
    else:
        input_file = Path("outputs/master_movie.mp4")
        output_file = Path("outputs/master_movie_enhanced.mp4")

    return enhance_video(
        input_path=input_file,
        output_path=output_file,
        preset_id=preset_id,
        custom_scale=custom_scale,
        custom_fps=custom_fps,
    )
