from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, Any, List, Optional
import os
import time
import base64
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
        "name": "Kling 1.6 Standard",
        "owner": "kwaivgi",
        "resolution": "1080p",
        "description": "Chuyển động nhân vật sống động, tối ưu ánh sáng cinematic",
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
