import pytest
from pathlib import Path
from unittest.mock import MagicMock

def test_get_enhancer_presets():
    from studio.video_enhancer import get_enhancer_presets

    presets = get_enhancer_presets()
    assert isinstance(presets, list)
    assert len(presets) >= 5

    preset_ids = [p["id"] for p in presets]
    assert "4k_crisp" in preset_ids
    assert "4k_clean" in preset_ids
    assert "fps_60_smooth" in preset_ids
    assert "ultra_master_4k_60fps" in preset_ids
    assert "film_grain_enhance" in preset_ids

    for p in presets:
        assert "id" in p
        assert "name" in p
        assert "description" in p
        assert "target_resolution" in p
        assert "target_fps" in p

def test_build_enhancer_filter():
    from studio.video_enhancer import build_enhancer_filter

    f_4k_crisp = build_enhancer_filter("4k_crisp")
    assert "scale=3840:2160" in f_4k_crisp
    assert "unsharp" in f_4k_crisp

    f_4k_clean = build_enhancer_filter("4k_clean")
    assert "scale=3840:2160" in f_4k_clean
    assert "spline" in f_4k_clean

    f_60fps = build_enhancer_filter("fps_60_smooth")
    assert "minterpolate" in f_60fps
    assert "fps=60" in f_60fps

    f_grain = build_enhancer_filter("film_grain_enhance")
    assert "noise" in f_grain
    assert "eq" in f_grain

    # Custom scale and fps override
    f_custom = build_enhancer_filter("custom", custom_scale="1920:1080", custom_fps=48)
    assert "scale=1920:1080" in f_custom
    assert "fps=48" in f_custom

def test_enhance_video_mock(monkeypatch, tmp_path):
    from studio.video_enhancer import enhance_video

    mock_run = MagicMock()
    monkeypatch.setattr("subprocess.run", mock_run)

    dummy_in = tmp_path / "input.mp4"
    dummy_in.write_bytes(b"dummy_video_content")
    dummy_out = tmp_path / "output.mp4"

    out = enhance_video(
        input_path=dummy_in,
        output_path=dummy_out,
        preset_id="4k_crisp",
        hardware_accel=False,
    )

    assert out == dummy_out
    assert mock_run.called
    called_cmd = mock_run.call_args[0][0]
    assert called_cmd[0] == "ffmpeg"
    assert "-i" in called_cmd
    assert str(dummy_in) in called_cmd
    assert "-vf" in called_cmd
    assert str(dummy_out) in called_cmd

def test_enhance_shot_and_master(monkeypatch, tmp_path):
    from studio.video_enhancer import enhance_shot_video, enhance_master_video

    mock_run = MagicMock()
    monkeypatch.setattr("subprocess.run", mock_run)

    # Setup dummy shot video
    shot_dir = tmp_path / "outputs" / "videos"
    shot_dir.mkdir(parents=True, exist_ok=True)
    shot_file = shot_dir / "shot_01.mp4"
    shot_file.write_bytes(b"shot_video")

    enhanced_shot = enhance_shot_video(
        shot_id="shot_01",
        preset_id="4k_crisp",
        base_dir=tmp_path / "outputs",
    )
    assert enhanced_shot.name == "shot_01_enhanced.mp4"

    # Setup dummy master video
    master_file = tmp_path / "outputs" / "master_movie.mp4"
    master_file.write_bytes(b"master_video")

    enhanced_master = enhance_master_video(
        preset_id="ultra_master_4k_60fps",
        base_dir=tmp_path / "outputs",
    )
    assert enhanced_master.name == "master_movie_enhanced.mp4"
