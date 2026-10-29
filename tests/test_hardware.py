import os
import pytest
from studio.config import StudioConfig
from studio.hardware import (
    detect_hardware,
    get_optimal_concurrency,
    get_ffmpeg_video_encoder,
)

def test_detect_hardware_returns_system_info():
    info = detect_hardware()
    assert isinstance(info, dict)
    assert "cpu_cores" in info
    assert info["cpu_cores"] >= 1
    assert "ram_total_gb" in info
    assert info["ram_total_gb"] > 0
    assert "has_gpu" in info
    assert isinstance(info["has_gpu"], bool)
    assert "available_encoders" in info
    assert isinstance(info["available_encoders"], list)
    assert "libx264" in info["available_encoders"]
    assert "recommended_profile" in info
    assert info["recommended_profile"] in ("eco", "balanced", "turbo")

def test_get_optimal_concurrency_with_explicit_config():
    cfg = StudioConfig(topic="Test")
    setattr(cfg, "image_concurrency", 7)
    setattr(cfg, "motion_concurrency", 5)

    assert get_optimal_concurrency("image", config=cfg) == 7
    assert get_optimal_concurrency("motion", config=cfg) == 5

def test_get_optimal_concurrency_profiles():
    # Eco profile should constrain workers
    eco_workers = get_optimal_concurrency("motion", profile="eco")
    assert 1 <= eco_workers <= 2

    # Turbo profile should allow higher workers within CPU limits
    turbo_workers = get_optimal_concurrency("motion", profile="turbo")
    assert turbo_workers >= eco_workers

def test_get_ffmpeg_video_encoder_cpu():
    enc, flags = get_ffmpeg_video_encoder(accel="cpu")
    assert enc == "libx264"
    assert "-preset" in flags
    assert "veryfast" in flags

def test_get_ffmpeg_video_encoder_auto_fallback():
    enc, flags = get_ffmpeg_video_encoder(accel="auto")
    assert enc in ("libx264", "h264_nvenc", "h264_vaapi", "h264_qsv")
    assert len(flags) > 0
