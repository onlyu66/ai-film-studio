import shutil
import pytest
from pathlib import Path
from studio.motion import build_ffmpeg_command

def test_build_ffmpeg_zoom_in():
    cmd = build_ffmpeg_command(Path("in.png"), Path("out.mp4"), 5.0, "zoom_in")
    assert cmd[0] == "ffmpeg"
    assert "-t" in cmd
    idx = cmd.index("-t")
    assert cmd[idx + 1] == "5.0"
    assert "zoompan" in " ".join(cmd)

def test_build_ffmpeg_pan_left():
    cmd = build_ffmpeg_command(Path("in.png"), Path("out.mp4"), 4.0, "pan_left")
    assert "zoompan" in " ".join(cmd)

def test_build_ffmpeg_vertical_aspect_ratio():
    cmd = build_ffmpeg_command(Path("in.png"), Path("out.mp4"), 4.0, "zoom_in", aspect_ratio="9:16")
    joined = " ".join(cmd)
    assert "1080x1920" in joined
    assert "scale=-1:4000" in joined

def test_ffmpeg_missing_error(monkeypatch):
    monkeypatch.setattr(shutil, "which", lambda cmd: None)
    from studio.motion import render_motion_for_shot
    with pytest.raises(RuntimeError, match="[Ff][Ff]mpeg"):
        render_motion_for_shot(Path("in.png"), Path("out.mp4"), 5.0, "zoom_in")

def test_empty_dialogue_default_duration():
    cmd = build_ffmpeg_command(Path("in.png"), Path("out.mp4"), 5.0, "zoom_in")
    idx = cmd.index("-t")
    assert float(cmd[idx + 1]) == 5.0

def test_build_ffmpeg_vfx_filter():
    cmd = build_ffmpeg_command(Path("in.png"), Path("out.mp4"), 5.0, "zoom_in", vfx=True)
    joined = " ".join(cmd)
    assert "vignette" in joined
    assert "contrast" in joined

def test_build_ffmpeg_all_cinematic_motions():
    for motion in ["zoom_in", "zoom_out", "pan_left", "pan_right", "tilt_up", "tilt_down", "handheld"]:
        cmd = build_ffmpeg_command(Path("in.png"), Path("out.mp4"), 3.0, motion)
        assert "zoompan" in " ".join(cmd)

def test_build_ffmpeg_letterbox():
    cmd = build_ffmpeg_command(Path("in.png"), Path("out.mp4"), 3.0, "zoom_in", letterbox=True)
    assert "drawbox" in " ".join(cmd)

def test_lipsync_fallback_when_no_token(tmp_path):
    from studio.lipsync import apply_lipsync_for_shot
    img = tmp_path / "img.png"
    img.write_text("dummy")
    aud = tmp_path / "aud.mp3"
    aud.write_text("dummy")
    out = tmp_path / "out.mp4"
    res = apply_lipsync_for_shot(img, aud, out, engine="none")
    assert res is None

