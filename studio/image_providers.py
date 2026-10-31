from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any, List, Optional
import os
import base64
import time
import requests
import urllib.parse
import asyncio
import logging
import shutil

logger = logging.getLogger(__name__)

def _run_coroutine_sync(coro):
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = None
    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(asyncio.run, coro).result()
    else:
        return asyncio.run(coro)

def _is_valid_image_bytes(content: bytes) -> bool:
    """Validate that downloaded payload is genuine binary image and not error JSON or HTML."""
    if not content or len(content) < 32:
        return False
    if content.startswith(b"\x89PNG") or content.startswith(b"\xff\xd8"):
        return True
    if len(content) > 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return True
    return False


class BaseImageProvider(ABC):
    """Abstract base class for all image generation providers."""

    def __init__(self, api_url: Optional[str] = None):
        self.api_url = (api_url or "").rstrip("/")

    @abstractmethod
    def generate(
        self,
        prompt: str,
        width: int,
        height: int,
        seed: int,
        output_path: Path,
    ) -> bool:
        """Generate an image from prompt and write binary image to output_path. Return True if successful."""
        pass

    @abstractmethod
    def check_health(self) -> Dict[str, Any]:
        """Check if engine is available and return status metadata."""
        pass


class PollinationsProvider(BaseImageProvider):
    """Cloud-based image generation via Pollinations / Flux."""

    def __init__(self, api_url: Optional[str] = None):
        super().__init__(api_url or "https://image.pollinations.ai")

    def generate(
        self,
        prompt: str,
        width: int,
        height: int,
        seed: int,
        output_path: Path,
    ) -> bool:
        clean_prompt = " ".join(prompt.split())[:600]
        encoded_prompt = urllib.parse.quote(clean_prompt)
        pollen_key = os.environ.get("POLLINATIONS_API_KEY") or os.environ.get("POLLEN_API_KEY")

        candidate_urls = []
        if pollen_key:
            candidate_urls.append(
                f"https://gen.pollinations.ai/image/{encoded_prompt}?key={pollen_key}&width={width}&height={height}&nologo=true"
            )
            candidate_urls.append(
                f"https://image.pollinations.ai/prompt/{encoded_prompt}?key={pollen_key}&width={width}&height={height}&seed={seed}&nologo=true"
            )
        else:
            candidate_urls.append(
                f"https://image.pollinations.ai/prompt/{encoded_prompt}?model=turbo&width={width}&height={height}&seed={seed}&nologo=true"
            )
            candidate_urls.append(
                f"https://image.pollinations.ai/prompt/{encoded_prompt}?model=flux-realism&width={width}&height={height}&seed={seed}&nologo=true"
            )

        headers = {"User-Agent": "AIFilmStudio/1.0", "Accept": "image/*"}
        if pollen_key:
            headers["Authorization"] = f"Bearer {pollen_key}"

        for url in candidate_urls:
            try:
                resp = requests.get(url, headers=headers, timeout=25)
                if resp.status_code == 200 and _is_valid_image_bytes(resp.content):
                    output_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(output_path, "wb") as f:
                        f.write(resp.content)
                    return True
            except Exception:
                continue

        return False

    def check_health(self) -> Dict[str, Any]:
        return {
            "id": "pollinations",
            "name": "Flux Cloud (Pollinations)",
            "is_available": True,
            "is_local": False,
            "url": self.api_url,
            "message": "Sẵn sàng (Cloud API)",
        }


class SDWebUIProvider(BaseImageProvider):
    """Local Stable Diffusion WebUI / Automatic1111 / Forge integration via REST API."""

    def __init__(self, api_url: Optional[str] = None):
        super().__init__(api_url or os.environ.get("SD_WEBUI_URL", "http://127.0.0.1:7860"))

    def generate(
        self,
        prompt: str,
        width: int,
        height: int,
        seed: int,
        output_path: Path,
    ) -> bool:
        endpoint = f"{self.api_url}/sdapi/v1/txt2img"
        payload = {
            "prompt": prompt,
            "negative_prompt": "blurry, low quality, distorted, deformed, watermark, ugly, bad anatomy",
            "seed": seed,
            "width": width,
            "height": height,
            "steps": 20,
            "cfg_scale": 7.0,
            "sampler_name": "Euler a",
        }

        try:
            resp = requests.post(endpoint, json=payload, timeout=60)
            if resp.status_code == 200:
                data = resp.json()
                images = data.get("images", [])
                if images and isinstance(images, list):
                    img_data = base64.b64decode(images[0])
                    if _is_valid_image_bytes(img_data):
                        output_path.parent.mkdir(parents=True, exist_ok=True)
                        with open(output_path, "wb") as f:
                            f.write(img_data)
                        return True
        except Exception:
            pass

        return False

    def check_health(self) -> Dict[str, Any]:
        endpoint = f"{self.api_url}/sdapi/v1/sd-models"
        try:
            resp = requests.get(endpoint, timeout=2.0)
            if resp.status_code == 200:
                models = [m.get("model_name", m.get("title", "")) for m in resp.json()]
                return {
                    "id": "sd_webui",
                    "name": "Local SD WebUI (A1111/Forge)",
                    "is_available": True,
                    "is_local": True,
                    "url": self.api_url,
                    "models": models,
                    "message": f"Online ({len(models)} models sẵn sàng)",
                }
        except Exception:
            pass

        return {
            "id": "sd_webui",
            "name": "Local SD WebUI (A1111/Forge)",
            "is_available": False,
            "is_local": True,
            "url": self.api_url,
            "models": [],
            "message": "Không thể kết nối (Port 7860 offline)",
        }


class ComfyUIProvider(BaseImageProvider):
    """Local ComfyUI integration via prompt graph API and WebSocket listener."""

    def __init__(
        self,
        api_url: Optional[str] = None,
        workflow_id: Optional[str] = None,
        workflow_manager: Optional[Any] = None,
        config: Optional[Any] = None,
        fallback_provider: Optional[BaseImageProvider] = None,
    ):
        super().__init__(api_url or os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188"))
        self.workflow_id = workflow_id
        self.workflow_manager = workflow_manager
        self.config = config
        self.fallback_provider = fallback_provider

    def generate(
        self,
        prompt: str,
        width: int,
        height: int,
        seed: int,
        output_path: Path,
    ) -> bool:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            from studio.comfyui.client import ComfyUIClient
            from studio.comfyui.manager import WorkflowManager
            from studio.comfyui.mapper import SmartNodeMapper

            mgr = self.workflow_manager or WorkflowManager()
            wf_id = self.workflow_id or (getattr(self.config, "image_workflow", None) if self.config else None) or "flux_schnell"
            workflow = mgr.get_workflow(wf_id)
            if not workflow:
                workflow = mgr.get_workflow("flux_schnell")
            if not workflow:
                raise RuntimeError(f"Workflow '{wf_id}' could not be loaded")

            mapper = SmartNodeMapper()
            mutated_wf = mapper.inject_parameters(
                workflow=workflow,
                prompt=prompt,
                seed=seed,
                width=width,
                height=height,
                checkpoint=getattr(self.config, "checkpoint", None) if self.config else None,
                lora=getattr(self.config, "lora", None) if self.config else None,
                lora_weight=getattr(self.config, "lora_weight", 0.8) if self.config else 0.8,
                steps=getattr(self.config, "steps", None) if self.config else None,
                cfg=getattr(self.config, "cfg", None) if self.config else None,
            )

            client = ComfyUIClient(api_url=self.api_url)
            shot_id = output_path.stem

            def _on_sampling_progress(s_id: str, step: int, total_steps: int):
                try:
                    from studio.server import broadcast_ws
                    broadcast_ws("comfyui_progress", {
                        "shot_id": s_id,
                        "step": step,
                        "total_steps": total_steps,
                        "percent": round((step / max(1, total_steps)) * 100, 1),
                        "engine": "image",
                    })
                except Exception:
                    pass

            outputs = _run_coroutine_sync(
                client.queue_and_wait(
                    mutated_wf,
                    shot_id=shot_id,
                    output_dir=output_path.parent,
                    on_progress=_on_sampling_progress,
                )
            )

            if outputs and len(outputs) > 0:
                primary = outputs[0]
                if primary != output_path and primary.exists():
                    shutil.copyfile(primary, output_path)
                if output_path.exists() and output_path.stat().st_size > 1000:
                    return True
        except Exception as e:
            logger.warning(f"[ComfyUIProvider] ComfyUI generation failed: {e}. Falling back to Pollinations.")

        # Graceful fallback to PollinationsProvider
        fallback = self.fallback_provider or PollinationsProvider()
        try:
            return fallback.generate(prompt, width, height, seed, output_path)
        except Exception as fb_err:
            logger.error(f"[ComfyUIProvider] Fallback provider also failed: {fb_err}")
            return False

    def check_health(self) -> Dict[str, Any]:
        candidates = [self.api_url]
        if "127.0.0.1" in self.api_url or "localhost" in self.api_url:
            candidates.append("http://host.docker.internal:8188")
        elif "host.docker.internal" in self.api_url:
            candidates.append("http://127.0.0.1:8188")

        for url in candidates:
            endpoint = f"{url}/system_stats"
            try:
                resp = requests.get(endpoint, timeout=2.0)
                if resp.status_code == 200:
                    self.api_url = url
                    stats = resp.json()
                    devices = stats.get("devices", [])
                    device_name = devices[0].get("name", "GPU") if devices else "CPU"
                    vram_info = ""
                    if devices:
                        free_gb = round(devices[0].get("vram_free", 0) / (1024**3), 1)
                        vram_info = f" ({free_gb} GB VRAM free)"
                    return {
                        "id": "comfyui",
                        "name": "Local ComfyUI",
                        "is_available": True,
                        "is_local": True,
                        "url": self.api_url,
                        "devices": [device_name],
                        "message": f"Online (Thiết bị: {device_name}{vram_info})",
                    }
            except Exception:
                pass

        return {
            "id": "comfyui",
            "name": "Local ComfyUI",
            "is_available": False,
            "is_local": True,
            "url": self.api_url,
            "devices": [],
            "message": "Không thể kết nối (Port 8188 offline)",
        }


def get_image_provider(
    engine: str = "pollinations",
    api_url: Optional[str] = None,
) -> BaseImageProvider:
    """Factory to retrieve an image provider instance by engine name."""
    clean_engine = (engine or "pollinations").lower().strip()
    if clean_engine in ("sd_webui", "sd", "forge", "automatic1111"):
        return SDWebUIProvider(api_url=api_url)
    elif clean_engine in ("comfyui", "comfy"):
        return ComfyUIProvider(api_url=api_url)
    return PollinationsProvider(api_url=api_url)


def discover_image_engines() -> List[Dict[str, Any]]:
    """Scan and discover available image generation engines on host and cloud."""
    engines = []

    # 1. Cloud Pollinations
    pollinations = PollinationsProvider()
    engines.append(pollinations.check_health())

    # 2. Local SD WebUI
    # In Docker, check host.docker.internal first if configured
    candidates_sd = [
        os.environ.get("SD_WEBUI_URL"),
        "http://host.docker.internal:7860",
        "http://127.0.0.1:7860",
    ]
    sd_active_provider = None
    for url in candidates_sd:
        if url:
            p = SDWebUIProvider(api_url=url)
            h = p.check_health()
            if h.get("is_available"):
                sd_active_provider = h
                break

    if sd_active_provider:
        engines.append(sd_active_provider)
    else:
        engines.append(SDWebUIProvider().check_health())

    # 3. Local ComfyUI
    candidates_comfy = [
        os.environ.get("COMFYUI_URL"),
        "http://host.docker.internal:8188",
        "http://127.0.0.1:8188",
    ]
    comfy_active_provider = None
    for url in candidates_comfy:
        if url:
            p = ComfyUIProvider(api_url=url)
            h = p.check_health()
            if h.get("is_available"):
                comfy_active_provider = h
                break

    if comfy_active_provider:
        engines.append(comfy_active_provider)
    else:
        engines.append(ComfyUIProvider().check_health())

    return engines
