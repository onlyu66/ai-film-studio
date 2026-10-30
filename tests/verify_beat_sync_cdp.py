import json
import time
import urllib.request
import websocket
import base64
from pathlib import Path

targets_url = "http://localhost:9222/json"
with urllib.request.urlopen(targets_url) as resp:
    targets = json.loads(resp.read().decode('utf-8'))

page_target = next(t for t in targets if "localhost:8080" in t.get("url", "") and t.get("type") == "page")
ws_url = page_target["webSocketDebuggerUrl"]
print("Target Page:", ws_url)

ws = websocket.create_connection(ws_url, timeout=10, suppress_origin=True)

msg_id = 0
def send_cmd(method, params=None):
    global msg_id
    msg_id += 1
    req = {"id": msg_id, "method": method, "params": params or {}}
    ws.send(json.dumps(req))
    while True:
        resp = json.loads(ws.recv())
        if resp.get("id") == msg_id:
            return resp.get("result", {})

# 1. Reload page with cache bypass
print("Reloading page...")
send_cmd("Page.reload", {"ignoreCache": True})
time.sleep(3.5)

# 2. Check Timeline Scrubber and Waveform elements
eval_timeline = send_cmd("Runtime.evaluate", {
    "expression": """
    (() => {
        // Find Snap to Beat button
        const allBtns = Array.from(document.querySelectorAll('button'));
        const snapBtn = allBtns.find(b => b.textContent && b.textContent.includes('Bắt Nhịp'));
        
        // Find BPM badge
        const bpmElement = Array.from(document.querySelectorAll('span')).find(s => s.textContent && s.textContent.includes('BPM'));
        
        // Find Canvas element inside Timeline
        const canvases = Array.from(document.querySelectorAll('canvas'));
        
        // Find Beat Grid toggle
        const gridBtn = allBtns.find(b => b.textContent && b.textContent.includes('Nhịp'));

        return {
            has_snap_button: Boolean(snapBtn),
            snap_button_text: snapBtn ? snapBtn.textContent.trim() : null,
            has_bpm_badge: Boolean(bpmElement),
            bpm_text: bpmElement ? bpmElement.textContent.trim() : null,
            canvas_count: canvases.length,
            has_grid_toggle: Boolean(gridBtn),
        };
    })()
    """,
    "returnByValue": True
})
print("Timeline Scrubber State:", eval_timeline)

# 3. Click "Snap to Beat" button
eval_click_snap = send_cmd("Runtime.evaluate", {
    "expression": """
    (() => {
        const allBtns = Array.from(document.querySelectorAll('button'));
        const snapBtn = allBtns.find(b => b.textContent && b.textContent.includes('Bắt Nhịp'));
        if (snapBtn) {
            snapBtn.click();
            return { success: true, clicked: true };
        }
        return { success: false, reason: 'Snap button not found' };
    })()
    """,
    "returnByValue": True
})
print("Click Snap to Beat:", eval_click_snap)
time.sleep(2.0)

# 4. Check for Sonner toast
eval_toast = send_cmd("Runtime.evaluate", {
    "expression": """
    (() => {
        const toasts = Array.from(document.querySelectorAll('[data-sonner-toast], [role="status"], li'));
        const toastMsg = toasts.find(t => t.textContent && (t.textContent.includes('bắt nhịp') || t.textContent.includes('khớp')));
        return {
            toast_found: Boolean(toastMsg),
            toast_text: toastMsg ? toastMsg.textContent.trim() : null
        };
    })()
    """,
    "returnByValue": True
})
print("Sonner Toast Check:", eval_toast)

# 5. Capture screenshot of the verified Timeline
ss_res = send_cmd("Page.captureScreenshot", {"format": "png"})
if "data" in ss_res:
    img_data = base64.b64decode(ss_res["data"])
    out_path = Path("/home/hieunv1/.gemini/antigravity-cli/brain/edfe7aad-59b7-4f89-ac33-6efb6125efaf/waveform_beat_sync_verified.png")
    out_path.write_bytes(img_data)
    print("Screenshot saved to:", out_path)

ws.close()
