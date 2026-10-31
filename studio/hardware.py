from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
import json
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


def detect_gpu_details() -> List[Dict[str, Any]]:
    """
    Detects dedicated and integrated GPUs across Windows (WMI/PowerShell),
    Linux/WSL (nvidia-smi), and hardware device nodes.
    Returns list of dicts: [{"name": str, "vram_gb": float, "driver": str}]
    """
    gpus: List[Dict[str, Any]] = []

    # 1. Try nvidia-smi if available
    if shutil.which("nvidia-smi"):
        try:
            res = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=2.0,
                check=False,
            )
            if res.returncode == 0 and res.stdout.strip():
                for line in res.stdout.strip().splitlines():
                    parts = [p.strip() for p in line.split(",")]
                    if len(parts) >= 2:
                        name = parts[0]
                        total_mb = float(parts[1]) if parts[1].replace(".", "", 1).isdigit() else 0.0
                        driver = parts[2] if len(parts) > 2 else "Unknown"
                        gpus.append({
                            "name": name,
                            "vram_gb": round(total_mb / 1024.0, 1),
                            "driver": driver,
                        })
                if gpus:
                    return gpus
        except Exception:
            pass

    # 2. Try PowerShell on Windows host if accessible
    ps_cmd = (
        "Get-CimInstance Win32_VideoController | "
        "ForEach-Object { [PSCustomObject]@{ Name = $_.Name; VRAM_GB = [math]::Round($_.AdapterRAM / 1GB, 1); Driver = $_.DriverVersion } } | "
        "ConvertTo-Json"
    )
    for shell in ["powershell.exe", "powershell"]:
        if shutil.which(shell):
            try:
                res = subprocess.run(
                    [shell, "-NoProfile", "-Command", ps_cmd],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=3.0,
                    check=False,
                )
                if res.returncode == 0 and res.stdout.strip():
                    parsed = json.loads(res.stdout.strip())
                    if isinstance(parsed, dict):
                        parsed = [parsed]
                    for item in parsed:
                        name = item.get("Name", "")
                        vram = float(item.get("VRAM_GB", 0.0))
                        driver = str(item.get("Driver", ""))
                        if name:
                            gpus.append({
                                "name": name,
                                "vram_gb": vram,
                                "driver": driver,
                            })
                    if gpus:
                        # Put dedicated NVIDIA/AMD/Intel Arc GPUs first
                        gpus.sort(key=lambda x: (
                            "nvidia" in x["name"].lower() or "rtx" in x["name"].lower() or "geforce" in x["name"].lower(),
                            x["vram_gb"]
                        ), reverse=True)
                        return gpus
            except Exception:
                pass

    return gpus


def check_docker_gpu_support() -> Dict[str, Any]:
    """
    Checks if Docker CLI is installed and if Docker can run GPU containers via NVIDIA Container Toolkit.
    """
    docker_bin = shutil.which("docker")
    if not docker_bin:
        return {
            "installed": False,
            "supported": False,
            "message": "Docker CLI chưa được cài đặt hoặc không nằm trong PATH hệ thống.",
        }

    # Test running lightweight GPU container
    try:
        res = subprocess.run(
            ["docker", "run", "--rm", "--gpus", "all", "alpine", "echo", "ok"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=5.0,
            check=False,
        )
        if res.returncode == 0 and "ok" in res.stdout:
            return {
                "installed": True,
                "supported": True,
                "message": "Docker GPU Passthrough hoạt động hoàn hảo với NVIDIA Container Toolkit.",
            }
        stderr_text = res.stderr.strip()
        if "no adapters were found" in stderr_text or "initialization error" in stderr_text:
            return {
                "installed": True,
                "supported": False,
                "message": "Docker phát hiện WSL nhưng không nhận diện được adapter GPU (Driver NVIDIA trên host cần >= 510+ và hỗ trợ WSL2 GPU).",
            }
        return {
            "installed": True,
            "supported": False,
            "message": f"Docker không hỗ trợ cờ --gpus: {stderr_text[:120] if stderr_text else 'Lỗi cấu hình runtime'}",
        }
    except Exception as e:
        return {
            "installed": True,
            "supported": False,
            "message": f"Không thể kiểm tra Docker GPU: {e}",
        }


def assess_comfyui_compatibility(
    gpu_name: str = "Unknown",
    vram_gb: float = 0.0,
    ram_gb: float = 8.0,
    cpu_cores: int = 4,
    docker_gpu_supported: bool = False,
) -> Dict[str, Any]:
    """
    Evaluates hardware readiness for running local or containerized ComfyUI workflows,
    returning detailed capability tiers, model support matrix, and optimization flags.
    """
    vram = max(0.0, float(vram_gb))
    name_lower = (gpu_name or "").lower()
    has_nvidia = "nvidia" in name_lower or "geforce" in name_lower or "rtx" in name_lower or "gtx" in name_lower

    if vram >= 12.0 and has_nvidia:
        tier = "optimal"
        badge_color = "emerald"
        summary = (
            f"Cấu hình phần cứng tối ưu cho ComfyUI! Card {gpu_name} ({vram} GB VRAM) "
            f"sẵn sàng chạy các model AI tiên tiến nhất (Flux Schnell, SDXL, Wan 2.1) ở độ phân giải cao."
        )
        recommended_engine = "comfyui"
        recommended_flags = ["--listen", "0.0.0.0", "--port", "8188", "--highvram"]
        models = {
            "flux_schnell": {"supported": True, "precision": "FP16 / FP8", "note": "Sinh ảnh 4-8 bước, tốc độ cao."},
            "sdxl": {"supported": True, "precision": "FP16", "note": "Độ chi tiết tối đa, hỗ trợ LoRA & ControlNet."},
            "sd_15": {"supported": True, "precision": "FP16", "note": "Tốc độ cực nhanh."},
            "animatediff": {"supported": True, "resolution": "768x512 / 1024x576", "note": "Hoạt cảnh 16-32 frames mượt mà."},
            "wan_2_1": {"supported": True, "precision": "FP8 / FP16", "note": "Sinh video AI thế hệ mới khả dụng."},
        }
    elif vram >= 6.0 and has_nvidia:
        tier = "compatible"
        badge_color = "cyan"
        summary = (
            f"Phần cứng tương thích tốt với ComfyUI ({gpu_name} - {vram} GB VRAM). "
            f"Khuyến nghị sử dụng model Flux Schnell lượng tử hóa FP8 để tiết kiệm VRAM."
        )
        recommended_engine = "comfyui"
        recommended_flags = ["--listen", "0.0.0.0", "--port", "8188", "--lowvram", "--fp8_e4m3fn-text-enc"]
        models = {
            "flux_schnell": {"supported": True, "precision": "FP8 / NF4", "note": "Chạy tốt với checkpoint lượng tử hóa FP8."},
            "sdxl": {"supported": True, "precision": "FP16 / FP8", "note": "Chạy ổn định với SDXL Turbo / Lightning."},
            "sd_15": {"supported": True, "precision": "FP16", "note": "Tốc độ rất nhanh."},
            "animatediff": {"supported": True, "resolution": "512x512", "note": "Khuyến nghị 16 frames ở 512x512."},
            "wan_2_1": {"supported": False, "precision": "unsupported", "note": "Yêu cầu tối thiểu 12GB - 16GB VRAM."},
        }
    elif vram >= 4.0 and has_nvidia:
        tier = "minimal"
        badge_color = "amber"
        summary = (
            f"Dung lượng VRAM hạn chế ({gpu_name} - {vram} GB VRAM). "
            f"Chỉ nên chạy Stable Diffusion 1.5 với cờ --lowvram; model Flux hoặc SDXL sẽ bị tràn bộ nhớ (CUDA OOM)."
        )
        recommended_engine = "pollinations"
        recommended_flags = ["--listen", "0.0.0.0", "--port", "8188", "--lowvram"]
        models = {
            "flux_schnell": {"supported": False, "precision": "unsupported", "note": "Dễ tràn VRAM (CUDA Out of Memory)."},
            "sdxl": {"supported": False, "precision": "unsupported", "note": "Hạn chế, chỉ chạy được SDXL Turbo rất nhỏ."},
            "sd_15": {"supported": True, "precision": "FP16", "note": "Khả dụng với cờ --lowvram."},
            "animatediff": {"supported": False, "resolution": "unsupported", "note": "Yêu cầu tối thiểu 8GB VRAM."},
            "wan_2_1": {"supported": False, "precision": "unsupported", "note": "Không đủ VRAM."},
        }
    elif vram > 0 and has_nvidia:
        tier = "low_vram_warning"
        badge_color = "rose"
        summary = (
            f"Dung lượng VRAM ({gpu_name} - {vram} GB VRAM) dưới mức tối thiểu để chạy ComfyUI cục bộ. "
            f"Hệ thống khuyến nghị sử dụng Cloud Pollinations (Flux Schnell 4K miễn phí, không tốn VRAM máy bạn) "
            f"và hiệu ứng Ken Burns để đạt hiệu quả tốt nhất."
        )
        recommended_engine = "pollinations"
        recommended_flags = ["--listen", "0.0.0.0", "--port", "8188", "--lowvram", "--cpu"]
        models = {
            "flux_schnell": {"supported": False, "precision": "unsupported", "note": "Không đủ VRAM (cần tối thiểu 8GB+)."},
            "sdxl": {"supported": False, "precision": "unsupported", "note": "Không đủ VRAM (cần tối thiểu 6GB+)."},
            "sd_15": {"supported": True if vram >= 2.0 else False, "precision": "FP16", "note": "Chỉ chạy được với cờ --lowvram, rất dễ OOM."},
            "animatediff": {"supported": False, "resolution": "unsupported", "note": "Không đủ VRAM (cần tối thiểu 8GB+)."},
            "wan_2_1": {"supported": False, "precision": "unsupported", "note": "Không đủ VRAM (cần tối thiểu 12GB+)."},
        }
    else:
        tier = "cpu_only"
        badge_color = "rose"
        summary = (
            f"Không phát hiện GPU rời NVIDIA phù hợp ({gpu_name}). "
            f"ComfyUI chỉ có thể chạy ở chế độ CPU rất chậm (5-10 phút/ảnh). "
            f"Khuyến nghị sử dụng Cloud Pollinations & Ken Burns trong Studio."
        )
        recommended_engine = "pollinations"
        recommended_flags = ["--listen", "0.0.0.0", "--port", "8188", "--cpu"]
        models = {
            "flux_schnell": {"supported": False, "precision": "unsupported", "note": "Chế độ CPU quá chậm."},
            "sdxl": {"supported": False, "precision": "unsupported", "note": "Không khả dụng trên CPU."},
            "sd_15": {"supported": False, "precision": "CPU", "note": "Chạy rất chậm trên CPU."},
            "animatediff": {"supported": False, "resolution": "unsupported", "note": "Không hỗ trợ video trên CPU."},
            "wan_2_1": {"supported": False, "precision": "unsupported", "note": "Không hỗ trợ video trên CPU."},
        }

    recommendations = []
    if tier == "optimal":
        recommendations.append("Bạn có thể chạy ComfyUI cục bộ (run_nvidia_gpu.bat) hoặc qua Docker GPU với hiệu suất cao nhất.")
        recommendations.append("Hỗ trợ đầy đủ tất cả workflow: Flux Schnell, SDXL, AnimateDiff và Wan 2.1.")
    elif tier == "compatible":
        recommendations.append("Nên chọn model Flux Schnell bản lượng tử hóa FP8 để sinh ảnh mượt mà.")
        recommendations.append("Bật cờ khởi động --lowvram và --fp8_e4m3fn-text-enc trong file cấu hình ComfyUI.")
    else:
        recommendations.append(f"Card đồ họa {gpu_name} ({vram} GB VRAM) không đủ bộ nhớ để chạy các mô hình AI thế hệ mới (Flux/Wan).")
        recommendations.append("Việc kéo ComfyUI về Docker trên máy này sẽ không thể tăng tốc GPU do driver WSL2 và giới hạn VRAM.")
        recommendations.append("Giải pháp tối ưu: Giữ nguyên tùy chọn Cloud Pollinations (miễn phí, nhanh 3-5 giây trên máy chủ Cloud) và Ken Burns.")

    return {
        "gpu_name": gpu_name,
        "vram_gb": vram,
        "ram_gb": ram_gb,
        "cpu_cores": cpu_cores,
        "tier": tier,
        "badge_color": badge_color,
        "summary": summary,
        "models": models,
        "recommended_engine": recommended_engine,
        "recommended_flags": recommended_flags,
        "docker_gpu_status": {
            "supported": docker_gpu_supported,
            "message": "Docker GPU Passthrough sẵn sàng." if docker_gpu_supported else "Docker không nhận được GPU (Driver NVIDIA host cần >= 510+ và hỗ trợ WSL2 GPU).",
        },
        "recommendations": recommendations,
    }
