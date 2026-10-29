import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from studio.reframe import (
    get_reframe_presets,
    build_reframe_filtergraph,
    reframe_video,
    REFRAME_PRESETS,
)

def test_get_reframe_presets():
    presets = get_reframe_presets()
    assert len(presets) >= 3
    preset_ids = [p["id"] for p in presets]
    assert "blur_padding" in preset_ids
    assert "pan_scan" in preset_ids
    assert "fit_center" in preset_ids

def test_build_reframe_filtergraph():
    # 1. Blur padding
    fg_blur, is_complex_blur = build_reframe_filtergraph("blur_padding")
    assert is_complex_blur is True
    assert "boxblur" in fg_blur
    assert "overlay" in fg_blur

    # 2. Pan and scan
    fg_pan, is_complex_pan = build_reframe_filtergraph("pan_scan")
    assert "crop" in fg_pan
    assert "1080:1920" in fg_pan

    # 3. Fit center
    fg_fit, is_complex_fit = build_reframe_filtergraph("fit_center")
    assert "pad=1080:1920" in fg_fit

    # 4. With subtitles
    fg_sub, _ = build_reframe_filtergraph("pan_scan", subtitle_path=Path("/tmp/sub.srt"))
    assert "subtitles=" in fg_sub

def test_reframe_video_exec(tmp_path):
    in_video = tmp_path / "master.mp4"
    in_video.write_bytes(b"dummy mp4 video bytes")
    out_video = tmp_path / "master_9_16.mp4"

    mock_run = MagicMock()
    mock_run.return_value.returncode = 0

    with patch("subprocess.run", mock_run):
        res = reframe_video(
            input_path=in_video,
            output_path=out_video,
            mode="blur_padding",
            hardware_accel="cpu",
        )

        assert res == out_video
        mock_run.assert_called_once()
        cmd = mock_run.call_args[0][0]
        assert "ffmpeg" in cmd[0]
        assert str(in_video) in cmd
        assert str(out_video) in cmd
        assert "-filter_complex" in cmd
