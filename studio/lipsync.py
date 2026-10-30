from pathlib import Path
from typing import Optional, Dict, Any
import os
import time
import requests

def check_lipsync_service_status(api_url: Optional[str] = None) -> Dict[str, Any]:
    """Check health and availability of local GPU SadTalker and cloud lip-sync engines."""
    url = api_url or os.environ.get("LIPSYNC_API_URL") or "http://sadtalker:5000/api/lipsync"
    has_cloud = bool(os.environ.get("REPLICATE_API_TOKEN"))

    health_url = url.replace("/api/lipsync", "/health") if "/api/lipsync" in url else f"{url.rstrip('/')}/health"
    local_available = False
    try:
        r = requests.get(health_url, timeout=2.0)
        if r.status_code == 200:
            local_available = True
    except Exception:
        # Check localhost fallback
        if "sadtalker:5000" in health_url:
            try:
                local_r = requests.get("http://localhost:5000/health", timeout=1.0)
                if local_r.status_code == 200:
                    local_available = True
                    url = "http://localhost:5000/api/lipsync"
            except Exception:
                local_available = False

    if local_available:
        return {
            "available": True,
            "engine": "local",
            "provider": "sadtalker_local",
            "url": url,
            "gpu": True,
        }
    elif has_cloud:
        return {
            "available": True,
            "engine": "cloud",
            "provider": "replicate_sadtalker",
            "url": "https://api.replicate.com/v1/predictions",
            "gpu": False,
        }
    else:
        return {
            "available": False,
            "engine": "none",
            "provider": "none",
            "url": None,
            "gpu": False,
        }

def apply_lipsync_for_shot(
    image_path: Path,
    audio_path: Optional[Path],
    output_path: Path,
    engine: str = "none"
) -> Optional[Path]:
    """
    Attempt to generate a talking face video with facial animation and lip-sync.
    Supports engine="local" | "sadtalker" | "wav2lip" (local GPU Docker)
    and engine="cloud" (Replicate cloud).
    Returns output_path on success, or None to fall back to the standard motion stage.
    """
    engine_clean = str(engine or "none").lower().strip()
    if engine_clean in ("none", "") or not audio_path or not audio_path.exists():
        return None

    if not image_path.exists():
        return None

    # --- Mode 1: Local GPU Docker (SadTalker / Wav2Lip) ---
    if engine_clean in ("local", "sadtalker", "wav2lip"):
        api_url = os.environ.get("LIPSYNC_API_URL") or "http://sadtalker:5000/api/lipsync"
        print(f"  [Lip-Sync] Calling Local GPU Lip-Sync ({engine_clean}) for {output_path.stem}...")

        import base64
        try:
            with open(image_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("utf-8")
            with open(audio_path, "rb") as f:
                aud_b64 = base64.b64encode(f.read()).decode("utf-8")

            payload = {
                "image_base64": img_b64,
                "audio_base64": aud_b64,
                "still": False,
                "enhancer": "gfpgan",
            }

            resp = None
            try:
                resp = requests.post(api_url, json=payload, timeout=120)
            except requests.exceptions.ConnectionError:
                # If sadtalker container hostname is unreachable from host tests, attempt localhost:5000
                if "sadtalker:5000" in api_url:
                    fallback_url = "http://localhost:5000/api/lipsync"
                    resp = requests.post(fallback_url, json=payload, timeout=120)
                else:
                    raise

            if resp and resp.status_code == 200 and len(resp.content) > 10:
                output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, "wb") as f:
                    f.write(resp.content)
                print(f"  [Lip-Sync] ✓ Local lip-sync video created for {output_path.name}")
                return output_path
            else:
                status_code = resp.status_code if resp else "No Response"
                print(f"  [Lip-Sync] Local service returned {status_code}. Falling back to motion.")
                return None

        except Exception as exc:
            print(f"  [Lip-Sync Warning] Local lip-sync failed ({exc}). Falling back to camera motion.")
            return None

    # --- Mode 2: Cloud Lip-Sync (Replicate SadTalker) ---
    if engine_clean == "cloud":
        api_token = os.environ.get("REPLICATE_API_TOKEN")
        if not api_token:
            print("  [Lip-Sync] Warning: REPLICATE_API_TOKEN not found in environment. Falling back to motion engine.")
            return None

        print(f"  [Lip-Sync] Calling Cloud Lip-Sync for {output_path.stem}...")
        try:
            headers = {
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
                "Prefer": "wait",
            }

            import base64
            with open(image_path, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode("utf-8")
            with open(audio_path, "rb") as f:
                aud_b64 = base64.b64encode(f.read()).decode("utf-8")

            source_image_uri = f"data:image/png;base64,{img_b64}"
            driven_audio_uri = f"data:audio/mp3;base64,{aud_b64}"

            payload = {
                "version": "853a9a31a48c66e7456d9be7ee9851610e209861611d279cf44148b5dfef6022",
                "input": {
                    "source_image": source_image_uri,
                    "driven_audio": driven_audio_uri,
                    "enhancer": "gfpgan",
                    "still": False,
                }
            }

            resp = requests.post(
                "https://api.replicate.com/v1/predictions",
                headers=headers,
                json=payload,
                timeout=120,
            )
            if resp.status_code not in (200, 201):
                print(f"  [Lip-Sync] API returned {resp.status_code}: {resp.text[:100]}")
                return None

            result = resp.json()
            video_url = result.get("output")
            if not video_url and result.get("urls", {}).get("get"):
                poll_url = result["urls"]["get"]
                for _ in range(60):
                    time.sleep(3)
                    p_resp = requests.get(poll_url, headers=headers, timeout=30)
                    if p_resp.status_code == 200:
                        p_data = p_resp.json()
                        status = p_data.get("status")
                        if status == "succeeded":
                            video_url = p_data.get("output")
                            break
                        elif status in ("failed", "canceled"):
                            break

            if video_url and isinstance(video_url, str):
                v_resp = requests.get(video_url, timeout=60)
                if v_resp.status_code == 200:
                    output_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(output_path, "wb") as f:
                        f.write(v_resp.content)
                    print(f"  [Lip-Sync] ✓ Lip-sync successfully generated for {output_path.name}")
                    return output_path

        except Exception as exc:
            print(f"  [Lip-Sync] Warning: Lip-sync generation failed ({exc}). Falling back to standard camera motion.")

    return None
