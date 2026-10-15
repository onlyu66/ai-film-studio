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

def test_ffmpeg_missing_error(monkeypatch):
    monkeypatch.setattr(shutil, "which", lambda cmd: None)
    from studio.motion import render_motion_for_shot
    with pytest.raises(RuntimeError, match="[Ff][Ff]mpeg"):
        render_motion_for_shot(Path("in.png"), Path("out.mp4"), 5.0, "zoom_in")

def test_empty_dialogue_default_duration():
    cmd = build_ffmpeg_command(Path("in.png"), Path("out.mp4"), 5.0, "zoom_in")
    idx = cmd.index("-t")
    assert float(cmd[idx + 1]) == 5.0
