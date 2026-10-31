from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
import os
import shutil
import subprocess

_hw_cache: Optional[Dict[str, Any]] = None

def _detect_memory_gb() -> Tuple[float, float]:
    """Detect total and available RAM in GB."""
    mem_total_gb = 4.0
    mem_avail_gb = 2.0
    meminfo_path = Path("/proc/meminfo")
    if meminfo_path.exists():
        try:
            with open(meminfo_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            kb_map = {}
            for line in lines:
                parts = line.split(":")
                if len(parts) == 2:
                    k = parts[0].strip()
                    val_str = parts[1].strip().split()[0]
                    if val_str.isdigit():
                        kb_map[k] = int(val_str)
            if "MemTotal" in kb_map:
                mem_total_gb = round(kb_map["MemTotal"] / (1024 * 1024), 1)
            if "MemAvailable" in kb_map:
                mem_avail_gb = round(kb_map["MemAvailable"] / (1024 * 1024), 1)
            else:
                mem_avail_gb = round(mem_total_gb * 0.6, 1)
        except Exception:
            pass
    return mem_total_gb, mem_avail_gb

def _can_run_encoder(encoder: str) -> bool:
    """Verify if a specific encoder can actually be loaded and initialized at runtime."""
    if not shutil.which("ffmpeg"):
        return False
    try:
        proc = subprocess.run(
            ["ffmpeg", "-f", "lavfi", "-i", "color=c=black:s=16x16:d=0.04", "-c:v", encoder, "-f", "null", "-"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=1.0,
            check=False,
        )
        return proc.returncode == 0
    except Exception:
        return False

def _detect_ffmpeg_encoders() -> List[str]:
    """Query FFmpeg for working and loadable H.264 video encoders."""
    encoders = ["libx264"]
    if not shutil.which("ffmpeg"):
        return encoders

    candidates = ["h264_nvenc", "h264_vaapi", "h264_qsv"]
    for c in candidates:
        if _can_run_encoder(c) and c not in encoders:
            encoders.append(c)
    return encoders

def detect_hardware() -> Dict[str, Any]:
    """
    Detect system CPU, RAM, GPU, and FFmpeg acceleration capabilities.
    Cached after initial invocation for high performance.
    """
    global _hw_cache
    if _hw_cache is not None:
        return _hw_cache

    cpu_cores = os.cpu_count() or 2
    mem_total_gb, mem_avail_gb = _detect_memory_gb()
    encoders = _detect_ffmpeg_encoders()

    has_gpu = False
    if "h264_nvenc" in encoders:
        has_gpu = True
    elif shutil.which("nvidia-smi"):
        try:
            res = subprocess.run(
                ["nvidia-smi", "-L"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=1.0,
                check=False,
            )
            if res.returncode == 0 and "GPU" in res.stdout:
                has_gpu = True
        except Exception:
            pass

    # Profile recommendation
    if mem_total_gb < 4.0 or cpu_cores <= 2:
        recommended = "eco"
    elif mem_total_gb >= 15.0 and cpu_cores >= 8:
        recommended = "turbo"
    else:
        recommended = "balanced"

    _hw_cache = {
        "cpu_cores": cpu_cores,
        "ram_total_gb": mem_total_gb,
        "ram_available_gb": mem_avail_gb,
        "has_gpu": has_gpu,
        "available_encoders": encoders,
        "recommended_profile": recommended,
    }
    return _hw_cache

def get_optimal_concurrency(
    stage: str,
    config: Optional[Any] = None,
    profile: Optional[str] = None,
) -> int:
    """
    Calculate optimal worker pool concurrency for a specific stage
    based on configuration or detected hardware capabilities.
    """
    # 1. ComfyUI engine GPU safety serialization (forces concurrency = 1)
    if config is not None:
        if stage == "image":
            img_engine = getattr(config, "image_engine", "")
            if str(img_engine).lower() in ("comfyui", "comfy"):
                return 1
            if getattr(config, "image_concurrency", None):
                return max(1, int(config.image_concurrency))
        if stage == "motion":
            mot_engine = getattr(config, "motion_engine", "")
            if str(mot_engine).lower() in ("comfyui", "comfy"):
                return 1
            if getattr(config, "motion_concurrency", None):
                return max(1, int(config.motion_concurrency))
        if stage == "tts" and getattr(config, "tts_concurrency", None):
            return max(1, int(config.tts_concurrency))

    hw = detect_hardware()
    active_profile = profile or getattr(config, "hardware_profile", None) or hw["recommended_profile"]

    cpu_cores = hw["cpu_cores"]

    if active_profile == "eco":
        if stage == "motion":
            return min(2, cpu_cores)
        if stage == "image":
            return 2
        return min(3, cpu_cores)

    if active_profile == "turbo":
        if stage == "motion":
            return max(3, min(8, cpu_cores))
        if stage == "image":
            has_key = bool(os.environ.get("POLLINATIONS_API_KEY") or os.environ.get("POLLEN_API_KEY"))
            return 4 if has_key else 3
        return max(4, min(8, cpu_cores))

    # Balanced profile (default)
    if stage == "motion":
        return max(2, min(4, cpu_cores))
    if stage == "image":
        has_key = bool(os.environ.get("POLLINATIONS_API_KEY") or os.environ.get("POLLEN_API_KEY"))
        return 4 if has_key else 2
    return min(5, cpu_cores)

def get_ffmpeg_video_encoder(accel: str = "auto") -> Tuple[str, List[str]]:
    """
    Determine the optimal FFmpeg video encoder and tuning parameters.
    Supports 'auto', 'cpu', 'nvenc', 'vaapi'.
    """
    normalized = (accel or "auto").lower().strip()

    if normalized == "cpu":
        return "libx264", ["-preset", "veryfast", "-tune", "stillimage"]

    hw = detect_hardware()
    available = hw.get("available_encoders", [])

    if normalized in ("nvenc", "cuda", "gpu") or normalized == "auto":
        if "h264_nvenc" in available:
            return "h264_nvenc", ["-preset", "p4", "-cq", "24"]

    if normalized in ("vaapi",) and "h264_vaapi" in available:
        return "h264_vaapi", ["-qp", "24"]

    # Default fallback
    return "libx264", ["-preset", "veryfast", "-tune", "stillimage"]
