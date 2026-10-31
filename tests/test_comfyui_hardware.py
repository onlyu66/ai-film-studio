from unittest.mock import patch
from fastapi.testclient import TestClient
import pytest

from studio.hardware import assess_comfyui_compatibility, detect_gpu_details, check_docker_gpu_support
from studio.server import app

client = TestClient(app)


def test_assess_comfyui_compatibility_high_vram():
    report = assess_comfyui_compatibility(
        gpu_name="NVIDIA GeForce RTX 4080",
        vram_gb=16.0,
        ram_gb=32.0,
        cpu_cores=16,
        docker_gpu_supported=True,
    )
    assert report["tier"] == "optimal"
    assert report["vram_gb"] == 16.0
    assert report["recommended_engine"] == "comfyui"
    assert report["models"]["flux_schnell"]["supported"] is True
    assert report["models"]["sdxl"]["supported"] is True
    assert report["models"]["animatediff"]["supported"] is True
    assert report["models"]["wan_2_1"]["supported"] is True


def test_assess_comfyui_compatibility_mid_vram():
    report = assess_comfyui_compatibility(
        gpu_name="NVIDIA GeForce RTX 3070",
        vram_gb=8.0,
        ram_gb=16.0,
        cpu_cores=8,
        docker_gpu_supported=True,
    )
    assert report["tier"] == "compatible"
    assert report["vram_gb"] == 8.0
    assert report["recommended_engine"] == "comfyui"
    assert report["models"]["flux_schnell"]["supported"] is True
    assert report["models"]["sdxl"]["supported"] is True
    assert "--fp8_e4m3fn-text-enc" in report["recommended_flags"]


def test_assess_comfyui_compatibility_low_vram_gtx950m():
    # User's exact hardware profile
    report = assess_comfyui_compatibility(
        gpu_name="NVIDIA GeForce GTX 950M",
        vram_gb=2.0,
        ram_gb=16.0,
        cpu_cores=8,
        docker_gpu_supported=False,
    )
    assert report["tier"] == "low_vram_warning"
    assert report["vram_gb"] == 2.0
    assert report["recommended_engine"] == "pollinations"
    assert report["models"]["flux_schnell"]["supported"] is False
    assert report["models"]["sdxl"]["supported"] is False
    assert report["models"]["animatediff"]["supported"] is False
    assert report["models"]["sd_15"]["supported"] is True
    assert report["docker_gpu_status"]["supported"] is False
    assert "Pollinations" in report["summary"]


def test_assess_comfyui_compatibility_cpu_only():
    report = assess_comfyui_compatibility(
        gpu_name="Intel(R) HD Graphics 530",
        vram_gb=1.0,
        ram_gb=8.0,
        cpu_cores=4,
        docker_gpu_supported=False,
    )
    assert report["tier"] in ("cpu_only", "low_vram_warning")
    assert report["recommended_engine"] == "pollinations"
    assert report["models"]["flux_schnell"]["supported"] is False


def test_api_comfyui_hardware_check_endpoint():
    with patch("studio.hardware.detect_gpu_details") as mock_gpu:
        mock_gpu.return_value = [{
            "name": "NVIDIA GeForce RTX 4070",
            "vram_gb": 12.0,
            "driver": "560.94"
        }]
        resp = client.get("/api/comfyui/hardware-check")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "hardware" in data
        hw = data["hardware"]
        assert hw["vram_gb"] == 12.0
        assert hw["tier"] == "optimal"
        assert hw["models"]["flux_schnell"]["supported"] is True
