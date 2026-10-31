import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any, List, Optional
import os
import time
import base64
import json
import hmac
import hashlib
import mimetypes
import requests

AI_VIDEO_MODELS: List[Dict[str, Any]] = [
    {
        "id": "wan-video/wan-2.1-i2v-480p",
        "name": "Wan 2.1 Video (480p)",
        "owner": "wan-video",
        "resolution": "832x480 / 480x832",
        "description": "Model AI video mã nguồn mở mạnh nhất thế giới, chuyển động mượt mà, vật lý chân thực",
        "is_recommended": True,
    },
    {
        "id": "wan-video/wan-2.1-i2v-720p",
        "name": "Wan 2.1 Video (720p HD)",
        "owner": "wan-video",
        "resolution": "1280x720 / 720x1280",
        "description": "Phiên bản độ nét cao 720p chuẩn chiếu rạp",
        "is_recommended": False,
    },
    {
        "id": "minimax/video-01",
        "name": "Minimax Video-01",
        "owner": "minimax",
        "resolution": "1280x720",
        "description": "Khả năng tái hiện góc máy điện ảnh và diễn hoạt nhân vật ấn tượng",
        "is_recommended": False,
    },
    {
        "id": "kwaivgi/kling-v1.6-standard",
        "name": "Kling 1.6 Standard (Replicate)",
        "owner": "kwaivgi",
        "resolution": "1080p",
        "description": "Chuyển động nhân vật sống động, tối ưu ánh sáng cinematic",
        "is_recommended": False,
    },
    {
        "id": "kling-v1-6",
        "name": "Kling 1.6 OpenAPI (Trực Tiếp)",
        "owner": "klingai",
        "resolution": "1080p Full HD",
        "description": "API trực tiếp Kling AI với bộ điều khiển Camera 3D Trajectory",
        "is_recommended": True,
    },
    {
        "id": "luma-dream-machine",
        "name": "Luma Dream Machine Ray-2",
        "owner": "lumalabs",
        "resolution": "1080p / 720p",
        "description": "Luma Dream Machine API, góc máy 3D và camera dolly tự nhiên",
        "is_recommended": False,
    },
    {
        "id": "stability-ai/stable-video-diffusion",
        "name": "Stable Video Diffusion (SVD)",
        "owner": "stability-ai",
        "resolution": "1024x576",
        "description": "Model video kinh điển, tốc độ kết xuất nhanh",
        "is_recommended": False,
    },
]


def get_available_video_models() -> List[Dict[str, Any]]:
    """Return list of supported AI video models."""
    return list(AI_VIDEO_MODELS)


def check_replicate_token(token: str) -> Dict[str, Any]:
    """Validate a Replicate API token via /v1/account."""
    if not token or not token.strip():
        return {
            "is_valid": False,
            "message": "Token không được để trống.",
        }

    clean_token = token.strip()
    headers = {
        "Authorization": f"Bearer {clean_token}",
        "User-Agent": "AIFilmStudio/1.0",
    }

    try:
        resp = requests.get("https://api.replicate.com/v1/account", headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            username = data.get("username", "user")
            return {
                "is_valid": True,
                "username": username,
                "message": f"Token hợp lệ! (Tài khoản: {username})",
            }
        elif resp.status_code == 401:
            return {
                "is_valid": False,
                "message": "Token không hợp lệ hoặc đã bị vô hiệu hóa (401 Unauthorized).",
            }
        else:
            return {
                "is_valid": False,
                "message": f"Không thể xác thực token (HTTP {resp.status_code}).",
            }
    except Exception as exc:
        return {
            "is_valid": False,
            "message": f"Lỗi kết nối tới Replicate: {str(exc)}",
        }


class BaseVideoProvider(ABC):
    """Abstract base class for all AI Video Generation providers."""

    @abstractmethod
    def render_shot_video(
        self,
        image_path: Path,
        output_path: Path,
        prompt: str,
        duration: float,
        aspect_ratio: str = "16:9",
        trajectory: Optional[Any] = None,
    ) -> bool:
        pass


class ReplicateVideoProvider(BaseVideoProvider):
    """Replicate Image-to-Video provider with asynchronous polling."""

    def __init__(
        self,
        api_token: Optional[str] = None,
        model: Optional[str] = None,
        poll_interval: float = 2.0,
        max_poll_seconds: float = 180.0,
    ):
        self.api_token = (api_token or os.environ.get("REPLICATE_API_TOKEN", "")).strip()
        self.model = model or "wan-video/wan-2.1-i2v-480p"
        self.poll_interval = poll_interval
        self.max_poll_seconds = max_poll_seconds

    def render_shot_video(
        self,
        image_path: Path,
        output_path: Path,
        prompt: str,
        duration: float,
        aspect_ratio: str = "16:9",
        trajectory: Optional[Any] = None,
    ) -> bool:
        if not self.api_token:
            return False

        if not Path(image_path).exists():
            return False

        try:
            with open(image_path, "rb") as f:
                img_bytes = f.read()
            img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        except Exception:
            return False

        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "User-Agent": "AIFilmStudio/1.0",
        }

        # Build model-compatible input
        input_data: Dict[str, Any] = {
            "prompt": prompt or "cinematic camera movement, masterpiece, 4k",
        }
        if "wan" in self.model:
            input_data["image"] = f"data:image/png;base64,{img_b64}"
        elif "minimax" in self.model:
            input_data["first_frame_image"] = f"data:image/png;base64,{img_b64}"
        else:
            input_data["input_image"] = f"data:image/png;base64,{img_b64}"

        # Determine target endpoint
        parts = self.model.strip().split("/")
        if len(parts) == 2:
            owner, name = parts
            url = f"https://api.replicate.com/v1/models/{owner}/{name}/predictions"
            payload = {"input": input_data}
        else:
            url = "https://api.replicate.com/v1/predictions"
            payload = {"version": self.model, "input": input_data}

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=30)
            if resp.status_code not in (200, 201):
                # Fallback to generic predictions endpoint if model-specific path returned 404
                if resp.status_code == 404 and len(parts) == 2:
                    url = "https://api.replicate.com/v1/predictions"
                    payload = {"model": self.model, "input": input_data}
                    resp = requests.post(url, headers=headers, json=payload, timeout=30)

            if resp.status_code not in (200, 201):
                return False

            pred_data = resp.json()
            pred_id = pred_data.get("id")
            if not pred_id:
                return False

            # Check if prediction succeeded immediately
            status = pred_data.get("status")
            output_url = pred_data.get("output")

            # Asynchronous Polling loop
            start_time = time.time()
            poll_url = f"https://api.replicate.com/v1/predictions/{pred_id}"

            while status not in ("succeeded", "failed", "canceled"):
                if time.time() - start_time > self.max_poll_seconds:
                    return False

                time.sleep(self.poll_interval)
                poll_resp = requests.get(poll_url, headers=headers, timeout=10)
                if poll_resp.status_code == 200:
                    pred_data = poll_resp.json()
                    status = pred_data.get("status")
                    output_url = pred_data.get("output")
                else:
                    break

            if status != "succeeded" or not output_url:
                return False

            # Output may be string URL or list of URLs
            video_url = output_url[0] if isinstance(output_url, list) else output_url
            if not isinstance(video_url, str) or not video_url.startswith("http"):
                return False

            # Download final video stream
            vid_resp = requests.get(video_url, timeout=60)
            if vid_resp.status_code == 200 and len(vid_resp.content) > 10:
                output_path = Path(output_path)
                output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, "wb") as f:
                    f.write(vid_resp.content)
                return True
        except Exception:
            pass

        return False


def generate_kling_jwt(ak: str, sk: str) -> str:
    """Generate HS256 JWT Bearer token from Kling AccessKey and SecretKey."""
    headers = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "iss": ak,
        "exp": now + 1800,
        "nbf": now - 5,
    }

    def b64url(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")

    header_b64 = b64url(json.dumps(headers, separators=(",", ":")).encode("utf-8"))
    payload_b64 = b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    sig = hmac.new(sk.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = b64url(sig)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def get_kling_auth_header(token: str) -> Dict[str, str]:
    """Return headers with Bearer token, automatically signing AK:SK if provided."""
    clean_token = token.strip()
    if ":" in clean_token:
        parts = clean_token.split(":", 1)
        jwt_token = generate_kling_jwt(parts[0], parts[1])
        return {"Authorization": f"Bearer {jwt_token}"}
    return {"Authorization": f"Bearer {clean_token}"}


def check_kling_token(token: str) -> Dict[str, Any]:
    """Validate a Kling API token / JWT via Kling account endpoint."""
    if not token or not token.strip():
        return {
            "is_valid": False,
            "message": "Token Kling không được để trống.",
        }

    headers = get_kling_auth_header(token.strip())
    headers["User-Agent"] = "AIFilmStudio/1.0"

    try:
        resp = requests.get("https://api.klingai.com/v1/user/balance", headers=headers, timeout=6)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("code") == 0:
                return {
                    "is_valid": True,
                    "message": "Token Kling hợp lệ và sẵn sàng sinh video!",
                }
            else:
                return {
                    "is_valid": False,
                    "message": f"Kling phản hồi: {data.get('message', 'Mã lỗi không xác định')}",
                }
        elif resp.status_code == 401:
            return {
                "is_valid": False,
                "message": "Token Kling không hợp lệ hoặc đã hết hạn (401 Unauthorized).",
            }
        else:
            return {
                "is_valid": False,
                "message": f"Không thể xác thực token Kling (HTTP {resp.status_code}).",
            }
    except Exception as exc:
        return {
            "is_valid": False,
            "message": f"Lỗi kết nối tới Kling AI: {str(exc)}",
        }


class KlingDirectVideoProvider(BaseVideoProvider):
    """Direct Kling AI OpenAPI provider with 3D Camera Control."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "kling-v1-6",
        poll_interval: float = 3.0,
        max_poll_seconds: float = 180.0,
    ):
        self.api_key = (api_key or os.environ.get("KLING_API_KEY", "")).strip()
        self.model = model or "kling-v1-6"
        self.poll_interval = poll_interval
        self.max_poll_seconds = max_poll_seconds

    def render_shot_video(
        self,
        image_path: Path,
        output_path: Path,
        prompt: str,
        duration: float,
        aspect_ratio: str = "16:9",
        trajectory: Optional[Any] = None,
    ) -> bool:
        if not self.api_key:
            return False

        if not Path(image_path).exists():
            return False

        try:
            with open(image_path, "rb") as f:
                img_bytes = f.read()
            img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        except Exception:
            return False

        headers = get_kling_auth_header(self.api_key)
        headers["Content-Type"] = "application/json"
        headers["User-Agent"] = "AIFilmStudio/1.0"

        payload: Dict[str, Any] = {
            "model_name": self.model,
            "image": img_b64,
            "prompt": prompt or "cinematic motion, ultra-detailed 4k masterpiece",
            "mode": "std",
            "duration": "10" if duration > 6.0 else "5",
            "aspect_ratio": "16:9" if aspect_ratio == "16:9" else "9:16",
        }

        if trajectory:
            from studio.camera_3d import compile_kling_camera_control
            payload["camera_control"] = compile_kling_camera_control(trajectory)

        try:
            url = "https://api.klingai.com/v1/videos/image2video"
            resp = requests.post(url, headers=headers, json=payload, timeout=30)
            if resp.status_code != 200:
                return False

            resp_json = resp.json()
            if resp_json.get("code") != 0:
                return False

            task_id = resp_json.get("data", {}).get("task_id")
            if not task_id:
                return False

            start_time = time.time()
            poll_url = f"https://api.klingai.com/v1/videos/image2video/{task_id}"

            video_url = None
            consecutive_errors = 0
            while time.time() - start_time < self.max_poll_seconds:
                time.sleep(self.poll_interval)
                try:
                    poll_resp = requests.get(poll_url, headers=headers, timeout=10)
                except Exception:
                    consecutive_errors += 1
                    if consecutive_errors >= 4:
                        return False
                    continue

                if poll_resp.status_code == 200:
                    consecutive_errors = 0
                    poll_data = poll_resp.json()
                    task_data = poll_data.get("data", {})
                    task_status = task_data.get("task_status")

                    if task_status == "succeed":
                        videos = task_data.get("task_result", {}).get("videos", [])
                        if videos and "url" in videos[0]:
                            video_url = videos[0]["url"]
                        break
                    elif task_status in ("failed", "canceled"):
                        return False
                else:
                    consecutive_errors += 1
                    if consecutive_errors >= 4:
                        break

            if not video_url:
                return False

            # Download video stream
            vid_resp = requests.get(video_url, timeout=60)
            if vid_resp.status_code == 200 and len(vid_resp.content) > 10:
                output_path = Path(output_path)
                output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, "wb") as f:
                    f.write(vid_resp.content)
                return True

        except Exception:
            return False

        return False


def check_luma_token(token: str) -> Dict[str, Any]:
    """Validate a Luma Dream Machine API token via /dream-machine/v1/generations."""
    if not token or not token.strip():
        return {
            "is_valid": False,
            "message": "Token Luma Dream Machine không được để trống.",
        }

    clean_token = token.strip()
    headers = {
        "Authorization": f"Bearer {clean_token}",
        "User-Agent": "AIFilmStudio/1.0",
    }

    try:
        resp = requests.get("https://api.lumalabs.ai/dream-machine/v1/generations?limit=1", headers=headers, timeout=6)
        if resp.status_code == 200:
            return {
                "is_valid": True,
                "message": "Token Luma Dream Machine hợp lệ và sẵn sàng sinh video!",
            }
        elif resp.status_code in (401, 403):
            return {
                "is_valid": False,
                "message": "Token Luma không hợp lệ hoặc không có quyền truy cập (401/403).",
            }
        else:
            return {
                "is_valid": False,
                "message": f"Không thể xác thực token Luma (HTTP {resp.status_code}).",
            }
    except Exception as exc:
        return {
            "is_valid": False,
            "message": f"Lỗi kết nối tới Luma Labs: {str(exc)}",
        }


class LumaDreamMachineProvider(BaseVideoProvider):
    """Luma Dream Machine Ray-2 video provider."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "luma-dream-machine",
        poll_interval: float = 3.0,
        max_poll_seconds: float = 180.0,
    ):
        self.api_key = (api_key or os.environ.get("LUMA_API_KEY", "")).strip()
        self.model = model or "luma-dream-machine"
        self.poll_interval = poll_interval
        self.max_poll_seconds = max_poll_seconds

    def render_shot_video(
        self,
        image_path: Path,
        output_path: Path,
        prompt: str,
        duration: float,
        aspect_ratio: str = "16:9",
        trajectory: Optional[Any] = None,
    ) -> bool:
        if not self.api_key:
            return False

        if not Path(image_path).exists():
            return False

        try:
            with open(image_path, "rb") as f:
                img_bytes = f.read()
            img_b64 = base64.b64encode(img_bytes).decode("utf-8")
        except Exception:
            return False

        final_prompt = prompt or "cinematic camera movement, high production value 4k"
        if trajectory:
            from studio.camera_3d import compile_luma_camera_prompt
            final_prompt = compile_luma_camera_prompt(trajectory, final_prompt)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "AIFilmStudio/1.0",
        }

        mime_type = mimetypes.guess_type(str(image_path))[0] or "image/png"
        payload: Dict[str, Any] = {
            "prompt": final_prompt,
            "aspect_ratio": "16:9" if aspect_ratio == "16:9" else "9:16",
            "loop": False,
            "keyframes": {
                "frame0": {
                    "type": "image",
                    "url": f"data:{mime_type};base64,{img_b64}",
                }
            },
        }

        try:
            url = "https://api.lumalabs.ai/dream-machine/v1/generations"
            resp = requests.post(url, headers=headers, json=payload, timeout=30)
            if resp.status_code not in (200, 201):
                return False

            gen_data = resp.json()
            gen_id = gen_data.get("id")
            if not gen_id:
                return False

            state = gen_data.get("state")
            start_time = time.time()
            poll_url = f"https://api.lumalabs.ai/dream-machine/v1/generations/{gen_id}"
            video_url = None
            consecutive_errors = 0

            while time.time() - start_time < self.max_poll_seconds:
                if state == "completed":
                    video_url = gen_data.get("assets", {}).get("video")
                    break
                elif state in ("failed", "canceled"):
                    return False

                time.sleep(self.poll_interval)
                try:
                    poll_resp = requests.get(poll_url, headers=headers, timeout=10)
                except Exception:
                    consecutive_errors += 1
                    if consecutive_errors >= 4:
                        return False
                    continue

                if poll_resp.status_code == 200:
                    consecutive_errors = 0
                    gen_data = poll_resp.json()
                    state = gen_data.get("state")
                else:
                    consecutive_errors += 1
                    if consecutive_errors >= 4:
                        break

            if not video_url and state == "completed":
                video_url = gen_data.get("assets", {}).get("video")

            if not video_url:
                return False

            # Download video stream
            vid_resp = requests.get(video_url, timeout=60)
            if vid_resp.status_code == 200 and len(vid_resp.content) > 10:
                output_path = Path(output_path)
                output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, "wb") as f:
                    f.write(vid_resp.content)
                return True

        except Exception:
            return False

        return False


class ComfyUIVideoProvider(BaseVideoProvider):
    """ComfyUI Image-to-Video provider using AnimateDiff or Wan 2.1."""

    def __init__(
        self,
        api_url: Optional[str] = None,
        workflow_id: Optional[str] = None,
        workflow_manager: Optional[Any] = None,
        config: Optional[Any] = None,
        poll_interval: float = 2.0,
        max_poll_seconds: float = 240.0,
        **kwargs,
    ):
        self.api_url = (api_url or os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188")).rstrip("/")
        self.workflow_id = workflow_id
        self.workflow_manager = workflow_manager
        self.config = config
        self.poll_interval = poll_interval
        self.max_poll_seconds = max_poll_seconds

    def render_shot_video(
        self,
        image_path: Path,
        output_path: Path,
        prompt: str,
        duration: float,
        aspect_ratio: str = "16:9",
        trajectory: Optional[Any] = None,
    ) -> bool:
        image_path = Path(image_path)
        output_path = Path(output_path)
        if not image_path.exists():
            return False

        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            from studio.comfyui.client import ComfyUIClient
            from studio.comfyui.manager import WorkflowManager
            from studio.comfyui.mapper import SmartNodeMapper
            from studio.image_providers import _run_coroutine_sync

            mgr = self.workflow_manager or WorkflowManager()
            wf_id = self.workflow_id or (getattr(self.config, "video_workflow", None) if self.config else None) or "animatediff_v3"
            workflow = mgr.get_workflow(wf_id)
            if not workflow:
                workflow = mgr.get_workflow("animatediff_v3")
            if not workflow:
                raise RuntimeError(f"Video workflow '{wf_id}' could not be loaded")

            client = ComfyUIClient(api_url=self.api_url)

            # Upload source image to ComfyUI
            uploaded_name = _run_coroutine_sync(client.upload_image(image_path))

            # Determine dimensions
            if aspect_ratio == "9:16":
                w, h = 480, 832
            else:
                w, h = 832, 480

            mapper = SmartNodeMapper()
            mutated_wf = mapper.inject_parameters(
                workflow=workflow,
                prompt=prompt,
                seed=42,
                width=w,
                height=h,
                image_path=uploaded_name,
                steps=getattr(self.config, "steps", None) if self.config else None,
                cfg=getattr(self.config, "cfg", None) if self.config else None,
            )

            shot_id = output_path.stem
            outputs = _run_coroutine_sync(
                client.queue_and_wait(
                    mutated_wf,
                    shot_id=shot_id,
                    output_dir=output_path.parent,
                    timeout_sec=self.max_poll_seconds,
                )
            )

            if outputs and len(outputs) > 0:
                primary = outputs[0]
                if primary != output_path and primary.exists():
                    shutil.copyfile(primary, output_path)
                if output_path.exists() and output_path.stat().st_size > 100:
                    return True
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"[ComfyUIVideoProvider] Video generation failed: {e}")

        return False


def get_video_provider(
    provider_type: str = "replicate",
    api_token: Optional[str] = None,
    model: Optional[str] = None,
    **kwargs,
) -> BaseVideoProvider:
    """
    Factory function returning a concrete VideoProvider instance.
    provider_type can be: 'kling', 'luma', 'replicate', or auto-deduced from model.
    """
    p_lower = (provider_type or "").lower().strip()
    m_lower = (model or "").lower().strip()

    if p_lower in ("comfyui", "comfy"):
        return ComfyUIVideoProvider(
            api_url=kwargs.get("api_url"),
            workflow_id=kwargs.get("workflow_id"),
            workflow_manager=kwargs.get("workflow_manager"),
            config=kwargs.get("config"),
            **{k: v for k, v in kwargs.items() if k not in ("api_url", "workflow_id", "workflow_manager", "config")}
        )
    elif p_lower == "kling" or ("kling-v1-6" in m_lower) or ("kling" in m_lower and "standard" not in m_lower and "replicate" not in m_lower):
        actual_model = model if (model and "kling" in model.lower()) else "kling-v1-6"
        return KlingDirectVideoProvider(api_key=api_token, model=actual_model, **kwargs)
    elif p_lower == "luma" or "luma" in m_lower:
        actual_model = model if (model and "luma" in model.lower()) else "luma-dream-machine"
        return LumaDreamMachineProvider(api_key=api_token, model=actual_model, **kwargs)
    else:
        return ReplicateVideoProvider(api_token=api_token, model=model, **kwargs)
