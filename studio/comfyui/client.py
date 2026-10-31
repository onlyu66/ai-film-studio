"""Async REST and WebSocket Client for ComfyUI."""

import asyncio
import json
import logging
import os
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import urlparse

import httpx
import websockets

logger = logging.getLogger(__name__)


@dataclass
class ComfyUIHealthStatus:
    connected: bool = False
    device_name: str = "Unknown"
    vram_total_gb: float = 0.0
    vram_free_gb: float = 0.0
    queue_remaining: int = 0
    version: str = "Unknown"


class ComfyUIClient:
    """Async Client managing REST and WebSocket communication with ComfyUI."""

    def __init__(self, api_url: Optional[str] = None):
        self.api_url = (api_url or os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")).rstrip("/")

    def _create_http_client(self, timeout: float = 10.0) -> httpx.AsyncClient:
        """Create httpx.AsyncClient pre-configured for local and remote cloud tunnels (Colab, RunPod, Cloudflare, ngrok)."""
        return httpx.AsyncClient(
            timeout=timeout,
            headers={
                "User-Agent": "AIFilmStudio/1.0",
                "ngrok-skip-browser-warning": "true",
            },
            follow_redirects=True,
        )

    @property
    def ws_url(self) -> str:
        parsed = urlparse(self.api_url)
        scheme = "wss" if parsed.scheme == "https" else "ws"
        return f"{scheme}://{parsed.netloc}/ws"

    async def check_health(self) -> ComfyUIHealthStatus:
        """Checks connection status and reports GPU VRAM availability with smart host fallback."""
        candidates = [self.api_url]
        for c in ["http://host.docker.internal:8188", "http://comfyui:8188", "http://127.0.0.1:8188"]:
            if c not in candidates:
                candidates.append(c)

        for url in candidates:
            endpoint = f"{url}/system_stats"
            timeout = 4.0 if url.startswith("https") else 1.5
            try:
                async with self._create_http_client(timeout=timeout) as client:
                    resp = await client.get(endpoint)
                    if resp.status_code == 200:
                        self.api_url = url
                        data = resp.json()
                        devices = data.get("devices", [])
                        device_name = "CPU"
                        vram_total = 0.0
                        vram_free = 0.0
                        if devices:
                            primary_device = devices[0]
                            device_name = primary_device.get("name", "GPU")
                            vram_total = round(primary_device.get("vram_total", 0) / (1024**3), 1)
                            vram_free = round(primary_device.get("vram_free", 0) / (1024**3), 1)

                        version = data.get("system", {}).get("python_version", "1.0")

                        # Query queue length
                        queue_remaining = 0
                        try:
                            q_resp = await client.get(f"{url}/prompt", timeout=2.0)
                            if q_resp.status_code == 200:
                                q_data = q_resp.json()
                                queue_remaining = q_data.get("exec_info", {}).get("queue_remaining", 0)
                        except Exception:
                            pass

                        return ComfyUIHealthStatus(
                            connected=True,
                            device_name=device_name,
                            vram_total_gb=vram_total,
                            vram_free_gb=vram_free,
                            queue_remaining=queue_remaining,
                            version=version,
                        )
            except Exception as e:
                logger.debug(f"[ComfyUIClient] Health check failed for {url}: {e}")

        return ComfyUIHealthStatus(connected=False)

    async def get_models(self) -> Dict[str, List[str]]:
        """Scans ComfyUI /object_info to extract lists of installed checkpoints, LoRAs, and VAEs."""
        endpoint = f"{self.api_url}/object_info"
        models: Dict[str, List[str]] = {
            "checkpoints": [],
            "loras": [],
            "vaes": [],
        }
        try:
            async with self._create_http_client(timeout=8.0) as client:
                resp = await client.get(endpoint)
                if resp.status_code == 200:
                    data = resp.json()

                    # 1. Checkpoints from CheckpointLoaderSimple
                    ckpt_node = data.get("CheckpointLoaderSimple", {})
                    ckpt_choices = (
                        ckpt_node.get("input", {})
                        .get("required", {})
                        .get("ckpt_name", [[]])[0]
                    )
                    if isinstance(ckpt_choices, list):
                        models["checkpoints"] = sorted(ckpt_choices)

                    # 2. LoRAs from LoraLoader
                    lora_node = data.get("LoraLoader", {})
                    lora_choices = (
                        lora_node.get("input", {})
                        .get("required", {})
                        .get("lora_name", [[]])[0]
                    )
                    if isinstance(lora_choices, list):
                        models["loras"] = sorted(lora_choices)

                    # 3. VAEs from VAELoader
                    vae_node = data.get("VAELoader", {})
                    vae_choices = (
                        vae_node.get("input", {})
                        .get("required", {})
                        .get("vae_name", [[]])[0]
                    )
                    if isinstance(vae_choices, list):
                        models["vaes"] = sorted(vae_choices)
        except Exception as e:
            logger.warning(f"[ComfyUIClient] Failed to scan models from {endpoint}: {e}")

        return models

    async def get_available_nodes(self) -> List[str]:
        """Returns the list of all registered node class_types in ComfyUI."""
        endpoint = f"{self.api_url}/object_info"
        try:
            async with self._create_http_client(timeout=8.0) as client:
                resp = await client.get(endpoint)
                if resp.status_code == 200:
                    return list(resp.json().keys())
        except Exception as e:
            logger.warning(f"[ComfyUIClient] Failed to get available nodes: {e}")
        return []

    async def upload_image(self, image_path: Path, subfolder: str = "") -> str:
        """Uploads an image to ComfyUI /upload/image and returns the stored filename."""
        endpoint = f"{self.api_url}/upload/image"
        image_path = Path(image_path)
        if not image_path.exists():
            return image_path.name

        try:
            with open(image_path, "rb") as f:
                files = {"image": (image_path.name, f.read(), "image/png")}
                data = {"subfolder": subfolder, "overwrite": "true"}
                async with self._create_http_client(timeout=45.0) as client:
                    resp = await client.post(endpoint, files=files, data=data)
                    if resp.status_code == 200:
                        res_data = resp.json()
                        return res_data.get("name", image_path.name)
        except Exception as e:
            logger.warning(f"[ComfyUIClient] upload_image failed: {e}")

        return image_path.name

    async def queue_prompt(self, workflow: Dict[str, Any], client_id: str) -> str:
        """Sends workflow to ComfyUI /prompt endpoint and returns prompt_id."""
        endpoint = f"{self.api_url}/prompt"
        payload = {"prompt": workflow, "client_id": client_id}
        async with self._create_http_client(timeout=15.0) as client:
            resp = await client.post(endpoint, json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"ComfyUI prompt submission failed: {resp.status_code} - {resp.text}")
            data = resp.json()
            prompt_id = data.get("prompt_id")
            if not prompt_id:
                raise RuntimeError("ComfyUI did not return a prompt_id")
            return prompt_id

    async def poll_history_and_download(
        self,
        prompt_id: str,
        output_dir: Path,
        timeout_sec: float = 180.0,
    ) -> List[Path]:
        """Polls /history/{prompt_id} until completion, then downloads output files."""
        output_dir.mkdir(parents=True, exist_ok=True)
        start_time = asyncio.get_event_loop().time()

        async with self._create_http_client(timeout=20.0) as client:
            while (asyncio.get_event_loop().time() - start_time) < timeout_sec:
                try:
                    resp = await client.get(f"{self.api_url}/history/{prompt_id}")
                    if resp.status_code == 200:
                        data = resp.json().get(prompt_id, {})
                        outputs = data.get("outputs", {})
                        if outputs:
                            downloaded_files: List[Path] = []
                            for _, node_output in outputs.items():
                                # Check for images
                                images = node_output.get("images", [])
                                # Check for videos / gifs (from VHS_VideoCombine)
                                videos = node_output.get("gifs", []) or node_output.get("videos", [])

                                for item in images + videos:
                                    filename = item.get("filename")
                                    subfolder = item.get("subfolder", "")
                                    item_type = item.get("type", "output")
                                    if not filename:
                                        continue

                                    view_url = (
                                        f"{self.api_url}/view?"
                                        f"filename={filename}&subfolder={subfolder}&type={item_type}"
                                    )
                                    view_resp = await client.get(view_url)
                                    if view_resp.status_code == 200:
                                        dest = output_dir / filename
                                        with open(dest, "wb") as f:
                                            f.write(view_resp.content)
                                        downloaded_files.append(dest)

                            if downloaded_files:
                                return downloaded_files
                except Exception as e:
                    logger.debug(f"[ComfyUIClient] Polling history: {e}")

                await asyncio.sleep(1.0)

        raise TimeoutError(f"ComfyUI prompt {prompt_id} timed out after {timeout_sec} seconds")

    async def queue_and_wait(
        self,
        workflow: Dict[str, Any],
        shot_id: str = "",
        output_dir: Optional[Path] = None,
        on_progress: Optional[Callable[[str, int, int], None]] = None,
        timeout_sec: float = 180.0,
    ) -> List[Path]:
        """Queues workflow, streams real-time progress via WebSocket, and returns downloaded outputs."""
        client_id = uuid.uuid4().hex
        target_dir = output_dir or Path("outputs/comfyui")
        target_dir.mkdir(parents=True, exist_ok=True)

        ws_endpoint = f"{self.ws_url}?clientId={client_id}"

        try:
            # Connect WebSocket
            async with websockets.connect(ws_endpoint, ping_interval=10, ping_timeout=10) as ws:
                # Queue the prompt
                prompt_id = await self.queue_prompt(workflow, client_id)
                start_time = asyncio.get_event_loop().time()

                while (asyncio.get_event_loop().time() - start_time) < timeout_sec:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                        if isinstance(msg, str):
                            event = json.loads(msg)
                            msg_type = event.get("type")
                            msg_data = event.get("data", {})

                            if msg_type == "progress":
                                value = msg_data.get("value", 0)
                                max_val = msg_data.get("max", 1)
                                if on_progress:
                                    on_progress(shot_id, value, max_val)

                            elif msg_type == "executing":
                                executing_node = msg_data.get("node")
                                executing_prompt = msg_data.get("prompt_id")
                                if executing_node is None and executing_prompt == prompt_id:
                                    # Execution finished!
                                    return await self.poll_history_and_download(
                                        prompt_id, target_dir, timeout_sec=15.0
                                    )
                    except asyncio.TimeoutError:
                        continue
        except Exception as e:
            logger.warning(f"[ComfyUIClient] WebSocket stream encountered error, falling back to HTTP: {e}")
            # If prompt was submitted or needs fallback
            try:
                prompt_id = await self.queue_prompt(workflow, client_id)
                return await self.poll_history_and_download(prompt_id, target_dir, timeout_sec=timeout_sec)
            except Exception as ex:
                raise RuntimeError(f"ComfyUI execution failed: {ex}") from ex

        raise TimeoutError(f"ComfyUI job for shot {shot_id} timed out after {timeout_sec}s")
