from studio.camera_3d import (
    Camera3DTrajectory,
    get_camera_3d_presets,
    compile_kling_camera_control,
    compile_luma_camera_prompt,
    compile_ffmpeg_3d_transform,
)

def test_camera_3d_presets_structure():
    presets = get_camera_3d_presets()
    assert "orbit_360" in presets
    assert "vertigo_dolly_zoom" in presets
    assert "spiral_crane" in presets
    assert "bullet_time" in presets
    assert "fpv_dive" in presets
    assert "low_arc_sweep" in presets
    assert presets["orbit_360"]["pan"] != 0
    assert "name" in presets["orbit_360"]
    assert "description" in presets["orbit_360"]

def test_kling_camera_control_compilation():
    traj = Camera3DTrajectory(
        trajectory_type="orbit_360",
        pan=90.0,
        tilt=15.0,
        roll=0.0,
        x=2.0,
        y=0.0,
        z=0.0,
        zoom=1.0,
        speed=1.2,
    )
    kling_ctrl = compile_kling_camera_control(traj)
    assert kling_ctrl["type"] == "simple"
    assert "config" in kling_ctrl
    assert kling_ctrl["config"]["pan"] == 90.0
    assert kling_ctrl["config"]["tilt"] == 15.0
    assert kling_ctrl["config"]["zoom"] == 1.0

def test_luma_camera_prompt_compilation():
    traj = Camera3DTrajectory(
        trajectory_type="vertigo_dolly_zoom",
        pan=0.0,
        tilt=0.0,
        roll=0.0,
        x=0.0,
        y=0.0,
        z=5.0,
        zoom=2.0,
        speed=1.5,
    )
    prompt = compile_luma_camera_prompt(traj, "A cyberpunk hacker typing")
    assert "A cyberpunk hacker typing" in prompt
    assert "dolly zoom" in prompt.lower() or "vertigo" in prompt.lower()

def test_trajectory_clamping():
    # Test values beyond boundaries are clamped
    traj = Camera3DTrajectory(
        trajectory_type="custom",
        pan=300.0,   # exceeds 180
        tilt=-120.0, # exceeds -90
        roll=250.0,  # exceeds 180
        x=25.0,      # exceeds 10
        y=-15.0,     # exceeds -10
        z=99.0,      # exceeds 10
        zoom=5.0,    # exceeds 3.0
        speed=10.0,  # exceeds 3.0
    )
    assert traj.pan == 180.0
    assert traj.tilt == -90.0
    assert traj.roll == 180.0
    assert traj.x == 10.0
    assert traj.y == -10.0
    assert traj.z == 10.0
    assert traj.zoom == 3.0
    assert traj.speed == 3.0

def test_ffmpeg_3d_transform_compilation():
    traj = Camera3DTrajectory(
        trajectory_type="vertigo_dolly_zoom",
        pan=0.0,
        tilt=0.0,
        roll=0.0,
        x=0.0,
        y=0.0,
        z=5.0,
        zoom=1.5,
        speed=1.0,
    )
    filter_str = compile_ffmpeg_3d_transform(traj, duration=3.0)
    assert "zoompan" in filter_str or "scale" in filter_str
