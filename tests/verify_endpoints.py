import urllib.request
import json
import sys

def test_endpoints():
    endpoints = [
        "/api/storyboard/templates",
        "/api/camera/presets",
        "/api/characters/vault",
        "/api/locations/vault",
        "/api/sfx/list",
        "/api/assets/bgm",
        "/api/lut/presets",
        "/api/transitions/presets",
        "/api/video/camera-3d/presets",
        "/api/comfyui/status",
        "/api/comfyui/workflows",
        "/api/reframe/presets",
        "/api/video/enhancer/presets",
        "/api/projects",
        "/api/system/hardware",
        "/api/system/image-engines",
        "/api/system/subtitle-presets"
    ]

    print("=== Testing FastAPI Sub-Router Endpoints ===")
    all_ok = True
    for ep in endpoints:
        try:
            req = urllib.request.Request(f"http://localhost:8000{ep}")
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                data_summary = len(data) if isinstance(data, (list, dict)) else "ok"
                print(f"[PASS 200] {ep} (size: {data_summary})")
        except Exception as e:
            print(f"[FAIL] {ep} -> {e}")
            all_ok = False

    if all_ok:
        print("\nAll endpoints returned HTTP 200 OK!")
    else:
        print("\nSome endpoints failed!")
        sys.exit(1)

if __name__ == "__main__":
    test_endpoints()
