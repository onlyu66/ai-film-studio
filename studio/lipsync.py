from pathlib import Path
from typing import Optional
import os
import time
import requests

def apply_lipsync_for_shot(
    image_path: Path,
    audio_path: Optional[Path],
    output_path: Path,
    engine: str = "none"
) -> Optional[Path]:
    """
    Attempt to generate a talking face video with facial animation and lip-sync.
    Returns output_path on success, or None to fall back to the motion stage.
    """
    if engine != "cloud" or not audio_path or not audio_path.exists():
        return None

    api_token = os.environ.get("REPLICATE_API_TOKEN")
    if not api_token:
        print("  [Lip-Sync] Warning: REPLICATE_API_TOKEN not found in environment. Skipping lip-sync and falling back to motion engine.")
        return None

    print(f"  [Lip-Sync] Calling Cloud Lip-Sync for {output_path.stem}...")
    try:
        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
            "Prefer": "wait",
        }

        # Convert image and audio to data URIs or public uploads
        import base64
        with open(image_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")
        with open(audio_path, "rb") as f:
            aud_b64 = base64.b64encode(f.read()).decode("utf-8")

        source_image_uri = f"data:image/png;base64,{img_b64}"
        driven_audio_uri = f"data:audio/mp3;base64,{aud_b64}"

        payload = {
            "version": "853a9a31a48c66e7456d9be7ee9851610e209861611d279cf44148b5dfef6022", # cjwbw/sadtalker
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
            # Poll if not finished immediately
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
