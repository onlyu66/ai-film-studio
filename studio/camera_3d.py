from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


def _clamp(val: float, min_val: float, max_val: float) -> float:
    return max(min_val, min(max_val, float(val)))


class Camera3DTrajectory(BaseModel):
    """
    3D Camera Trajectory Parameters for Cinematic AI Video Generation.
    Clamps angles and translations to cinematographic safety limits to prevent visual distortion.
    """
    trajectory_type: str = "custom"
    pan: float = 0.0       # -180.0 to 180.0 (degrees)
    tilt: float = 0.0      # -90.0 to 90.0 (degrees)
    roll: float = 0.0      # -180.0 to 180.0 (degrees)
    x: float = 0.0         # -10.0 to 10.0 (lateral translation)
    y: float = 0.0         # -10.0 to 10.0 (vertical translation)
    z: float = 0.0         # -10.0 to 10.0 (forward/backward dolly)
    zoom: float = 1.0      # 0.5 to 3.0 (focal shift)
    speed: float = 1.0     # 0.1 to 3.0 (motion velocity)

    @field_validator("pan", mode="before")
    @classmethod
    def clamp_pan(cls, v: Any) -> float:
        return _clamp(v, -180.0, 180.0)

    @field_validator("tilt", mode="before")
    @classmethod
    def clamp_tilt(cls, v: Any) -> float:
        return _clamp(v, -90.0, 90.0)

    @field_validator("roll", mode="before")
    @classmethod
    def clamp_roll(cls, v: Any) -> float:
        return _clamp(v, -180.0, 180.0)

    @field_validator("x", mode="before")
    @classmethod
    def clamp_x(cls, v: Any) -> float:
        return _clamp(v, -10.0, 10.0)

    @field_validator("y", mode="before")
    @classmethod
    def clamp_y(cls, v: Any) -> float:
        return _clamp(v, -10.0, 10.0)

    @field_validator("z", mode="before")
    @classmethod
    def clamp_z(cls, v: Any) -> float:
        return _clamp(v, -10.0, 10.0)

    @field_validator("zoom", mode="before")
    @classmethod
    def clamp_zoom(cls, v: Any) -> float:
        return _clamp(v, 0.5, 3.0)

    @field_validator("speed", mode="before")
    @classmethod
    def clamp_speed(cls, v: Any) -> float:
        return _clamp(v, 0.1, 3.0)


CAMERA_3D_PRESETS: Dict[str, Dict[str, Any]] = {
    "orbit_360": {
        "id": "orbit_360",
        "name": "Quay Quanh Chủ Thể 360° (Orbit 360°)",
        "description": "Máy quay lượn vòng 360 độ quanh tâm chủ thể, tạo cảm giác không gian 3D đa chiều",
        "pan": 180.0,
        "tilt": 10.0,
        "roll": 0.0,
        "x": 0.0,
        "y": 0.0,
        "z": 0.0,
        "zoom": 1.0,
        "speed": 1.0,
        "luma_cue": "smooth 360 degree orbital camera movement revolving around the subject, continuous cinematic rotation",
    },
    "vertigo_dolly_zoom": {
        "id": "vertigo_dolly_zoom",
        "name": "Hiệu Ứng Vertigo (Hitchcock Dolly Zoom)",
        "description": "Tiến lùi máy quay đồng thời zoom ngược chiều, tạo cảm giác nền bị bóp méo kịch tính",
        "pan": 0.0,
        "tilt": 0.0,
        "roll": 0.0,
        "x": 0.0,
        "y": 0.0,
        "z": 5.0,
        "zoom": 2.0,
        "speed": 1.2,
        "luma_cue": "intense vertigo dolly zoom effect, Hitchcock camera perspective warp, background pulling away while subject stays fixed",
    },
    "spiral_crane": {
        "id": "spiral_crane",
        "name": "Cẩu Lượn Xoắn Ốc (Spiral Crane Up)",
        "description": "Nâng cẩu máy quay theo hình xoắn ốc vút lên trời cao, mở rộng bối cảnh tráng lệ",
        "pan": 90.0,
        "tilt": -30.0,
        "roll": 15.0,
        "x": 1.5,
        "y": 4.0,
        "z": -2.0,
        "zoom": 1.1,
        "speed": 1.1,
        "luma_cue": "sweeping spiral crane shot lifting upwards into the sky, dynamic aerial rise with elegant rotation",
    },
    "bullet_time": {
        "id": "bullet_time",
        "name": "Ngưng Đọng Thời Gian (Bullet Time Matrix)",
        "description": "Chuyển động máy quay siêu mượt ở tốc độ chậm quanh hành động đang diễn ra",
        "pan": 120.0,
        "tilt": 5.0,
        "roll": -20.0,
        "x": 3.0,
        "y": 0.5,
        "z": -1.0,
        "zoom": 0.9,
        "speed": 0.4,
        "luma_cue": "bullet time slow motion camera sweep, freezing action with smooth matrix-style curved rotation",
    },
    "fpv_dive": {
        "id": "fpv_dive",
        "name": "Đột Kích FPV Drone (FPV Drone Dive)",
        "description": "Bổ nhào từ trên cao với góc nghiêng tốc độ lớn như flycam đua chuyên nghiệp",
        "pan": 0.0,
        "tilt": -45.0,
        "roll": 30.0,
        "x": 0.0,
        "y": -5.0,
        "z": 6.0,
        "zoom": 1.4,
        "speed": 2.0,
        "luma_cue": "high-speed FPV drone dive plunging downwards, rapid acrobatic dive with dynamic roll angle",
    },
    "low_arc_sweep": {
        "id": "low_arc_sweep",
        "name": "Quét Vòng Sát Mặt Đất (Low-Angle Arc Sweep)",
        "description": "Lướt góc thấp sát đất vòng qua chướng ngại vật hướng lên người hùng",
        "pan": -60.0,
        "tilt": 25.0,
        "roll": 0.0,
        "x": -3.5,
        "y": -2.0,
        "z": 1.5,
        "zoom": 1.0,
        "speed": 1.0,
        "luma_cue": "low-angle ground level arc sweep camera move, heroic perspective skimming across the floor curving towards subject",
    },
}


def get_camera_3d_presets() -> Dict[str, Dict[str, Any]]:
    """Return dictionary of 6 standard cinematic 3D camera trajectory presets."""
    return CAMERA_3D_PRESETS


def compile_kling_camera_control(trajectory: Camera3DTrajectory) -> Dict[str, Any]:
    """
    Compile 3D Camera Trajectory parameters into Kling AI camera_control schema.
    Kling expects type ('simple') and config dict with pan, tilt, roll, zoom, horizontal, vertical.
    """
    return {
        "type": "simple",
        "config": {
            "pan": float(trajectory.pan),
            "tilt": float(trajectory.tilt),
            "roll": float(trajectory.roll),
            "zoom": float(trajectory.zoom),
            "horizontal": float(trajectory.x),
            "vertical": float(trajectory.y),
        },
    }


def compile_luma_camera_prompt(trajectory: Camera3DTrajectory, base_prompt: str) -> str:
    """
    Compile 3D Camera Trajectory parameters into descriptive cinematic visual cues for Luma Dream Machine.
    """
    preset_key = trajectory.trajectory_type
    cues = []

    if preset_key in CAMERA_3D_PRESETS and "luma_cue" in CAMERA_3D_PRESETS[preset_key]:
        cues.append(CAMERA_3D_PRESETS[preset_key]["luma_cue"])
    else:
        # Dynamic translation of trajectory angles
        if abs(trajectory.pan) > 20:
            direction = "right" if trajectory.pan > 0 else "left"
            cues.append(f"sweeping camera pan to the {direction}")
        if abs(trajectory.tilt) > 15:
            tilt_dir = "upwards" if trajectory.tilt > 0 else "downwards"
            cues.append(f"camera tilting {tilt_dir}")
        if abs(trajectory.roll) > 10:
            cues.append("dramatic canted dutch angle roll")
        if trajectory.z > 1.5:
            cues.append("smooth forward push-in dolly")
        elif trajectory.z < -1.5:
            cues.append("steady pull-back dolly")
        if trajectory.zoom > 1.2:
            cues.append("optical zoom-in focus")
        elif trajectory.zoom < 0.8:
            cues.append("wide-angle expansion")

    if not cues:
        cues.append("steady cinematic camera tracking shot")

    combined_cues = ", ".join(cues)
    return f"{base_prompt.strip()}, {combined_cues}"


def compile_ffmpeg_3d_transform(trajectory: Camera3DTrajectory, duration: float = 3.0) -> str:
    """
    Compile 3D Camera Trajectory parameters into FFmpeg zoompan/rotate filter chain for fallback emulation.
    """
    fps = 25
    total_frames = max(1, int(duration * fps))
    zoom_start = 1.0
    zoom_end = float(trajectory.zoom)
    
    # Calculate pan offsets
    x_offset = int(trajectory.x * 20)
    y_offset = int(trajectory.y * 20)

    # zoompan filter syntax
    zoom_expr = f"min(zoom+{(zoom_end - zoom_start)/total_frames:.5f},{zoom_end:.2f})" if zoom_end >= zoom_start else f"max(zoom-{(zoom_start - zoom_end)/total_frames:.5f},{zoom_end:.2f})"
    
    filter_chain = (
        f"zoompan=z='{zoom_expr}':d={total_frames}:x='iw/2-(iw/zoom/2)+{x_offset}':y='ih/2-(ih/zoom/2)+{y_offset}':s=1280x720:fps={fps}"
    )

    if abs(trajectory.roll) > 1.0:
        angle_rad = (trajectory.roll * 3.14159 / 180.0) / total_frames
        filter_chain += f",rotate='{angle_rad:.5f}*n':c=black:ow=1280:oh=720"

    return filter_chain
