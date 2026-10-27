from pathlib import Path
from typing import Optional, List, Dict, Any
import os
import asyncio
import threading
import json
import shutil
import subprocess
import time
import urllib.request
import urllib.error

from fastapi import FastAPI, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from contextlib import asynccontextmanager
from studio.config import StudioConfig
from studio.orchestrator import run_pipeline
from studio.llm.discovery import (
    list_gemini_models,
    list_groq_models,
    list_openai_models,
    list_ollama_models,
)

active_websockets: List[WebSocket] = []
server_event_loop: Optional[asyncio.AbstractEventLoop] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global server_event_loop
    try:
        server_event_loop = asyncio.get_running_loop()
    except Exception:
        server_event_loop = None
    yield

app = FastAPI(title="AI Film Studio API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ProduceRequest(BaseModel):
    topic: str
    lang: str = "vi"
    duration: int = 5
    style: str = "cinematic"
    llm: str = "gemini"
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    motion: str = "kenburns"
    lip_sync: str = "none"
    aspect_ratio: str = "16:9"
    hardsub: bool = False
    pause_after_script: bool = False
    series_title: Optional[str] = None
    episode: int = 1
    parent_project_id: Optional[str] = None
    webhook_url: Optional[str] = None

# Global pipeline execution state
pipeline_state: Dict[str, Any] = {
    "status": "idle",       # idle, running, script_ready, completed, error
    "stage": 0,            # 0 to 5
    "stage_name": "Sẵn sàng",
    "progress": 0,         # 0 - 100
    "topic": "",
    "logs": [],
    "error": None,
    "final_video": None,
    "final_srt": None,
}

last_produce_request: Optional[ProduceRequest] = None

def broadcast_ws(event_type: str, data: Any):
    """Broadcast JSON message to all active WebSocket clients."""
    if not active_websockets:
        return
    msg = json.dumps({"type": event_type, "data": data}, ensure_ascii=False)
    for ws in list(active_websockets):
        try:
            if server_event_loop and server_event_loop.is_running():
                asyncio.run_coroutine_threadsafe(ws.send_text(msg), server_event_loop)
        except Exception:
            pass

def log_message(msg: str):
    timestamp = time.strftime("%H:%M:%S")
    formatted = f"[{timestamp}] {msg}"
    pipeline_state["logs"].append(formatted)
    if len(pipeline_state["logs"]) > 200:
        pipeline_state["logs"] = pipeline_state["logs"][-200:]
    broadcast_ws("log", formatted)

def send_webhook_notification(webhook_url: str, payload: dict):
    """Deliver webhook notification asynchronously in background thread."""
    if not webhook_url or not webhook_url.startswith("http"):
        return

    def _worker():
        try:
            is_discord = "discord.com" in webhook_url or "discordapp.com" in webhook_url
            if is_discord:
                body = {
                    "content": f"🎬 **[AI Film Studio] Phim đã sản xuất hoàn tất!**\n> **Tiêu đề:** {payload.get('title')}\n> **Thời lượng:** {payload.get('duration')} phút | **Tỷ lệ:** {payload.get('aspect_ratio', '16:9')}\n> **Tệp video:** `{payload.get('video_file')}`",
                }
            else:
                body = payload

            req_obj = urllib.request.Request(
                webhook_url,
                data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "AIFilmStudio/1.0"}
            )
            with urllib.request.urlopen(req_obj, timeout=10) as resp:
                pass
        except Exception as e:
            print(f"  [Webhook] Error sending notification to {webhook_url}: {e}")

    threading.Thread(target=_worker, daemon=True).start()

def generate_thumbnail_image(
    project_dir: Path,
    title: str,
    aspect_ratio: str = "16:9",
    source_img_name: Optional[str] = None
) -> Optional[str]:
    """Generate high-contrast cinematic thumbnail with bold title overlay using FFmpeg."""
    source_path = None
    if source_img_name:
        cand = project_dir / source_img_name
        if cand.exists():
            source_path = cand
    if not source_path:
        thumb_png = project_dir / "thumb.png"
        if thumb_png.exists():
            source_path = thumb_png
        else:
            candidates = sorted(list(project_dir.glob("*.png")) + list(Path("outputs/images").glob("*.png")))
            if candidates:
                source_path = candidates[0]

    if not source_path or not source_path.exists():
        return None

    out_thumb = project_dir / "thumbnail.jpg"
    w, h = (1080, 1920) if aspect_ratio == "9:16" else (1280, 720)
    fontsize = 62 if aspect_ratio == "9:16" else 46
    box_y = "ih*0.7" if aspect_ratio == "9:16" else "ih*0.65"
    text_y = "h*0.78" if aspect_ratio == "9:16" else "h*0.78"

    title_text = title.strip().upper()
    if len(title_text) > 48:
        title_text = title_text[:45] + "..."
    title_file = project_dir / "_thumb_title.txt"
    title_file.write_text(title_text, encoding="utf-8")

    font_candidates = [
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    font_arg = ""
    for f in font_candidates:
        if Path(f).exists():
            font_arg = f":fontfile='{f}'"
            break

    drawbox_filter = f"drawbox=y={box_y}:color=black@0.75:width=iw:height=ih*0.35:t=fill"
    drawtext_filter = f"drawtext=textfile='{title_file.resolve()}'{font_arg}:fontcolor=yellow:fontsize={fontsize}:x=(w-text_w)/2:y={text_y}:box=1:boxcolor=black@0.4:boxborderw=6"
    vf_filter = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},{drawbox_filter},{drawtext_filter}"

    cmd = [
        "ffmpeg", "-y",
        "-i", str(source_path.resolve()),
        "-vf", vf_filter,
        "-vframes", "1",
        str(out_thumb.resolve())
    ]
    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        if title_file.exists():
            title_file.unlink()
        return "thumbnail.jpg"
    except Exception:
        if title_file.exists():
            title_file.unlink()
        return None

def save_project_to_library(final_video_path: Path, req: ProduceRequest):
    timestamp = int(time.time())
    project_id = f"proj_{timestamp}"
    project_dir = Path("outputs/projects") / project_id
    project_dir.mkdir(parents=True, exist_ok=True)

    # 1. Copy final video
    dest_video = project_dir / final_video_path.name
    shutil.copy2(str(final_video_path), str(dest_video))

    # 2. Copy SRT if exists
    srt_name = None
    srt_path = final_video_path.with_suffix(".srt")
    if srt_path.exists():
        dest_srt = project_dir / srt_path.name
        shutil.copy2(str(srt_path), str(dest_srt))
        srt_name = srt_path.name

    # 3. Copy first image as thumbnail if exists
    thumb_name = None
    images_dir = Path("outputs/images")
    if images_dir.exists():
        img_files = sorted(list(images_dir.glob("*.png")))
        if img_files:
            dest_thumb = project_dir / "thumb.png"
            shutil.copy2(str(img_files[0]), str(dest_thumb))
            thumb_name = "thumb.png"

    # 4. Read title & shots count from storyboard if exists
    title = req.topic
    shots_count = 0
    sb_file = Path("outputs/storyboard.json")
    if sb_file.exists():
        try:
            with open(sb_file, "r", encoding="utf-8") as f:
                sb_data = json.load(f)
                title = sb_data.get("title") or req.topic
                shots_count = len(sb_data.get("shots", []))
            shutil.copy2(str(sb_file), str(project_dir / "storyboard.json"))
        except Exception:
            pass

    # 5. Generate high-impact thumbnail with FFmpeg
    aspect_ratio = getattr(req, "aspect_ratio", "16:9")
    rendered_thumb = generate_thumbnail_image(project_dir, title, aspect_ratio)
    if rendered_thumb:
        thumb_name = rendered_thumb

    metadata = {
        "id": project_id,
        "title": title,
        "topic": req.topic,
        "lang": req.lang,
        "style": req.style,
        "duration": req.duration,
        "aspect_ratio": aspect_ratio,
        "hardsub": getattr(req, "hardsub", False),
        "series_title": getattr(req, "series_title", None),
        "episode": getattr(req, "episode", 1),
        "parent_project_id": getattr(req, "parent_project_id", None),
        "webhook_url": getattr(req, "webhook_url", None),
        "created_at": timestamp,
        "video_file": final_video_path.name,
        "srt_file": srt_name,
        "thumb_file": thumb_name,
        "shots_count": shots_count,
        "dubbed_versions": {},
    }
    with open(project_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

def execute_pipeline_task(req: ProduceRequest, resume_only: bool = False):
    global pipeline_state, last_produce_request
    last_produce_request = req
    pipeline_state["status"] = "running"
    pipeline_state["topic"] = req.topic
    pipeline_state["error"] = None
    broadcast_ws("status", get_status())

    try:
        cfg = StudioConfig(
            topic=req.topic,
            lang=req.lang,
            duration=req.duration,
            style=req.style,
            llm_provider=req.llm,
            llm_api_key=req.llm_api_key,
            llm_model=req.llm_model,
            motion_engine=req.motion,
            lip_sync=req.lip_sync,
            aspect_ratio=req.aspect_ratio,
            hardsub=req.hardsub,
            output_dir=Path("outputs"),
            series_title=req.series_title,
            episode=req.episode,
            parent_project_id=req.parent_project_id,
            webhook_url=req.webhook_url,
        )

        if not resume_only and req.pause_after_script:
            pipeline_state["stage"] = 1
            pipeline_state["stage_name"] = "Đang soạn kịch bản & phân cảnh..."
            pipeline_state["progress"] = 20
            broadcast_ws("status", get_status())
            log_message(f"Soạn kịch bản: {req.topic} ({req.lang}, {req.duration}m, {req.style})")

            run_pipeline(cfg, stop_after_stage=1)

            pipeline_state["status"] = "script_ready"
            pipeline_state["stage"] = 1
            pipeline_state["stage_name"] = "Kịch bản đã sẵn sàng - Chờ duyệt"
            pipeline_state["progress"] = 20
            broadcast_ws("status", get_status())
            log_message("Kịch bản và phân cảnh đã được tạo xong! Bạn có thể chỉnh sửa lời thoại, nhân vật và giọng đọc trước khi bấm 'Tiếp tục sản xuất phim'.")
            return

        pipeline_state["stage"] = 2
        pipeline_state["stage_name"] = "Đang sản xuất phim (Stages 2 - 5)..."
        pipeline_state["progress"] = 40
        broadcast_ws("status", get_status())
        log_message("Đang thực hiện quy trình sản xuất (Audio, Visuals, Motion & Assembly)...")

        final_video_path = run_pipeline(cfg)

        pipeline_state["status"] = "completed"
        pipeline_state["stage"] = 5
        pipeline_state["stage_name"] = "Sản xuất hoàn tất!"
        pipeline_state["progress"] = 100
        pipeline_state["final_video"] = f"/api/outputs/final/{final_video_path.name}"
        srt_path = final_video_path.with_suffix(".srt")
        if srt_path.exists():
            pipeline_state["final_srt"] = f"/api/outputs/final/{srt_path.name}"
        broadcast_ws("status", get_status())
        log_message(f"Thành công! Video đã hoàn thành: {final_video_path.name}")

        try:
            save_project_to_library(final_video_path, req)
        except Exception as save_err:
            log_message(f"Cảnh báo: không thể lưu vào thư viện dự án: {save_err}")

        if getattr(req, "webhook_url", None):
            try:
                webhook_data = {
                    "event": "production_completed",
                    "title": req.topic,
                    "duration": req.duration,
                    "aspect_ratio": req.aspect_ratio,
                    "video_file": final_video_path.name,
                    "timestamp": int(time.time()),
                }
                send_webhook_notification(req.webhook_url, webhook_data)
            except Exception:
                pass

    except Exception as e:
        pipeline_state["status"] = "error"
        pipeline_state["error"] = str(e)
        broadcast_ws("status", get_status())
        log_message(f"Lỗi quy trình: {e}")

@app.get("/api/status")
def get_status():
    # Check if storyboard exists to return total shots count
    sb_file = Path("outputs/storyboard.json")
    shots_count = 0
    if sb_file.exists():
        try:
            with open(sb_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                shots_count = len(data.get("shots", []))
        except Exception:
            pass

    return {
        **pipeline_state,
        "shots_count": shots_count,
    }

class LLMModelsRequest(BaseModel):
    provider: str = "gemini"
    api_key: Optional[str] = None
    base_url: Optional[str] = None

@app.post("/api/llm/models")
def get_llm_models(req: LLMModelsRequest):
    provider = (req.provider or "gemini").lower().strip()
    has_env_key = False
    if provider == "gemini":
        has_env_key = bool(os.environ.get("GEMINI_API_KEY"))
    elif provider == "groq":
        has_env_key = bool(os.environ.get("GROQ_API_KEY"))
    elif provider in ("openai", "deepseek", "together"):
        has_env_key = bool(os.environ.get("OPENAI_API_KEY"))
    elif provider == "ollama":
        has_env_key = True

    try:
        if provider == "gemini":
            models = list_gemini_models(api_key=req.api_key)
            default_model = "gemini-3.5-flash"
        elif provider == "groq":
            models = list_groq_models(api_key=req.api_key)
            default_model = "llama-3.3-70b-versatile"
        elif provider in ("openai", "deepseek", "together"):
            models = list_openai_models(api_key=req.api_key, base_url=req.base_url)
            default_model = "gpt-4o-mini"
        elif provider == "ollama":
            models = list_ollama_models(base_url=req.base_url)
            default_model = models[0]["id"] if models else "llama3.2"
        else:
            raise HTTPException(status_code=400, detail=f"Không hỗ trợ provider: '{provider}'")

        return {
            "success": True,
            "provider": provider,
            "models": models,
            "default": default_model,
            "has_env_key": has_env_key,
        }
    except Exception as e:
        return {
            "success": False,
            "provider": provider,
            "error": str(e),
            "models": [],
            "has_env_key": has_env_key,
        }

@app.post("/api/produce")
def produce_film(req: ProduceRequest, background_tasks: BackgroundTasks):
    if pipeline_state["status"] == "running":
        raise HTTPException(status_code=400, detail="Quy trình sản xuất đang chạy, vui lòng đợi hoàn tất.")

    pipeline_state["logs"] = []
    threading.Thread(target=execute_pipeline_task, args=(req,), daemon=True).start()
    return {"message": "Đã bắt đầu sản xuất phim", "status": "running"}

@app.get("/api/storyboard")
def get_storyboard():
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        return {"title": "", "language": "vi", "characters": {}, "shots": []}
    try:
        with open(sb_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UpdateVoiceRequest(BaseModel):
    character_id: str
    voice: str

@app.post("/api/storyboard/character-voice")
def update_character_voice(req: UpdateVoiceRequest):
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json để cập nhật.")

    try:
        with open(sb_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        characters = data.get("characters", {})
        if req.character_id not in characters:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy nhân vật '{req.character_id}' trong kịch bản.")

        old_voice = characters[req.character_id].get("voice", "")
        characters[req.character_id]["voice"] = req.voice
        data["characters"] = characters

        with open(sb_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        # Invalidate existing audio files for this character so TTS will regenerate if rerun
        audio_dir = Path("outputs/audio")
        if audio_dir.exists():
            for shot in data.get("shots", []):
                if shot.get("character_id") == req.character_id:
                    shot_id = shot.get("id")
                    audio_file = audio_dir / f"{shot_id}.mp3"
                    if audio_file.exists():
                        audio_file.unlink(missing_ok=True)

        char_name = characters[req.character_id].get("name", req.character_id)
        log_message(f"Đã cập nhật giọng cho nhân vật '{char_name}': {old_voice} -> {req.voice}")

        return {
            "success": True,
            "message": f"Đã cập nhật giọng cho nhân vật {char_name}",
            "character_id": req.character_id,
            "voice": req.voice,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UpdateShotRequest(BaseModel):
    shot_id: str
    dialogue: Optional[str] = None
    image_prompt: Optional[str] = None
    motion: Optional[str] = None

@app.post("/api/storyboard/update-shot")
def update_shot(req: UpdateShotRequest):
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json để cập nhật.")

    try:
        with open(sb_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        shots = data.get("shots", [])
        target_shot = None
        for s in shots:
            if s.get("id") == req.shot_id:
                target_shot = s
                break

        if not target_shot:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy phân cảnh '{req.shot_id}'")

        if req.dialogue is not None:
            target_shot["dialogue"] = req.dialogue
            audio_file = Path(f"outputs/audio/{req.shot_id}.mp3")
            if audio_file.exists():
                audio_file.unlink(missing_ok=True)

        if req.image_prompt is not None:
            target_shot["image_prompt"] = req.image_prompt
            image_file = Path(f"outputs/images/{req.shot_id}.png")
            if image_file.exists():
                image_file.unlink(missing_ok=True)

        if req.motion is not None:
            target_shot["motion"] = req.motion

        with open(sb_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        log_message(f"Đã cập nhật phân cảnh '{req.shot_id}'.")
        return {"success": True, "message": f"Đã cập nhật phân cảnh {req.shot_id}", "shot": target_shot}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AddShotRequest(BaseModel):
    after_shot_id: Optional[str] = None
    dialogue: str = ""
    image_prompt: str = ""
    character_id: Optional[str] = None
    motion: str = "zoom_in"
    sfx: Optional[str] = None

@app.post("/api/storyboard/add-shot")
def add_shot(req: AddShotRequest):
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    try:
        with open(sb_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        shots = data.get("shots", [])
        new_shot_id = f"shot_{int(time.time())}_{len(shots)+1:03d}"
        chapter = 1

        insert_idx = len(shots)
        if req.after_shot_id:
            for i, s in enumerate(shots):
                if s.get("id") == req.after_shot_id:
                    insert_idx = i + 1
                    chapter = s.get("chapter", 1)
                    break

        new_shot = {
            "id": new_shot_id,
            "chapter": chapter,
            "character_id": req.character_id,
            "dialogue": req.dialogue,
            "image_prompt": req.image_prompt or "Cinematic establishing scene, masterpiece, 8k",
            "motion": req.motion or "zoom_in",
            "duration": None,
            "sfx": req.sfx,
        }

        shots.insert(insert_idx, new_shot)
        data["shots"] = shots

        with open(sb_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        log_message(f"Đã chèn thêm phân cảnh mới '{new_shot_id}'.")
        return {"success": True, "message": f"Đã thêm phân cảnh mới {new_shot_id}", "shot": new_shot}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DeleteShotRequest(BaseModel):
    shot_id: str

@app.post("/api/storyboard/delete-shot")
def delete_shot(req: DeleteShotRequest):
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    try:
        with open(sb_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        shots = data.get("shots", [])
        original_len = len(shots)
        data["shots"] = [s for s in shots if s.get("id") != req.shot_id]

        if len(data["shots"]) == original_len:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy phân cảnh '{req.shot_id}'")

        # Cleanup artifacts for deleted shot
        Path(f"outputs/audio/{req.shot_id}.mp3").unlink(missing_ok=True)
        Path(f"outputs/images/{req.shot_id}.png").unlink(missing_ok=True)
        Path(f"outputs/videos/{req.shot_id}.mp4").unlink(missing_ok=True)

        with open(sb_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        log_message(f"Đã xóa phân cảnh '{req.shot_id}'.")
        return {"success": True, "message": f"Đã xóa phân cảnh {req.shot_id}", "shot_id": req.shot_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ReorderShotsRequest(BaseModel):
    shot_ids: List[str]

@app.post("/api/storyboard/reorder-shots")
def reorder_shots(req: ReorderShotsRequest):
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    try:
        with open(sb_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        shots_map = {s["id"]: s for s in data.get("shots", [])}
        reordered = []
        for sid in req.shot_ids:
            if sid in shots_map:
                reordered.append(shots_map[sid])

        # Append any shots that were not in the reorder request
        for sid, shot in shots_map.items():
            if sid not in req.shot_ids:
                reordered.append(shot)

        data["shots"] = reordered
        with open(sb_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        log_message("Đã cập nhật lại thứ tự các phân cảnh trên kịch bản.")
        return {"success": True, "message": "Đã sắp xếp lại thứ tự phân cảnh", "shots_count": len(reordered)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class VoicePreviewRequest(BaseModel):
    voice: str
    text: Optional[str] = None

@app.post("/api/tts/preview-voice")
def preview_voice(req: VoicePreviewRequest):
    import edge_tts
    import asyncio
    preview_dir = Path("outputs/previews")
    preview_dir.mkdir(parents=True, exist_ok=True)
    out_file = preview_dir / f"{req.voice}.mp3"

    sample_text = req.text
    if not sample_text:
        if req.voice.startswith("vi"):
            sample_text = "Xin chào, đây là giọng đọc thử nghiệm của nhân vật trong bộ phim."
        elif req.voice.startswith("ja"):
            sample_text = "こんにちは、これはキャラクターのテスト音声です。"
        elif req.voice.startswith("fr"):
            sample_text = "Bonjour, ceci est un test de voix pour le personnage."
        else:
            sample_text = "Hello, this is a voice preview for the character in the film."

    try:
        asyncio.run(edge_tts.Communicate(sample_text, req.voice).save(str(out_file)))
        return {
            "success": True,
            "voice": req.voice,
            "audio_url": f"/api/outputs/previews/{req.voice}.mp3?t={int(time.time())}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RerollShotRequest(BaseModel):
    shot_id: str

@app.post("/api/storyboard/reroll-shot")
def reroll_shot(req: RerollShotRequest):
    import random
    from studio.images import generate_image_for_shot
    from studio.motion import render_motion_for_shot

    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    with open(sb_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    shot_data = None
    for s in data.get("shots", []):
        if s.get("id") == req.shot_id:
            shot_data = s
            break
    if not shot_data:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy phân cảnh '{req.shot_id}'")

    from studio.storyboard import Shot, Character
    shot = Shot(
        id=shot_data["id"],
        chapter=shot_data.get("chapter", 1),
        character_id=shot_data.get("character_id"),
        dialogue=shot_data.get("dialogue", ""),
        image_prompt=shot_data.get("image_prompt", ""),
        motion=shot_data.get("motion", "zoom_in"),
        duration=shot_data.get("duration"),
    )
    characters = {
        k: Character(
            name=v.get("name", k),
            visual_anchor=v.get("visual_anchor", ""),
            voice=v.get("voice", ""),
            seed=v.get("seed", 42)
        )
        for k, v in data.get("characters", {}).items()
    }

    new_seed = random.randint(1000, 9999999)
    style = getattr(last_produce_request, "style", "cinematic") if last_produce_request else "cinematic"
    aspect_ratio = getattr(last_produce_request, "aspect_ratio", "16:9") if last_produce_request else "16:9"
    motion_engine = getattr(last_produce_request, "motion", "kenburns") if last_produce_request else "kenburns"

    img_dir = Path("outputs/images")
    img_path = generate_image_for_shot(
        shot=shot,
        characters=characters,
        style=style,
        output_dir=img_dir,
        aspect_ratio=aspect_ratio,
        seed_override=new_seed
    )
    if not img_path or not img_path.exists():
        raise HTTPException(status_code=500, detail="Không thể tạo ảnh mới cho phân cảnh này.")

    vid_dir = Path("outputs/videos")
    out_vid = vid_dir / f"{req.shot_id}.mp4"
    duration = float(shot.duration or 5.0)
    audio_file = Path(f"outputs/audio/{req.shot_id}.mp3")
    if audio_file.exists():
        try:
            from studio.tts import get_audio_duration
            duration = get_audio_duration(audio_file)
        except Exception:
            pass

    render_motion_for_shot(
        image_path=img_path,
        output_path=out_vid,
        duration=duration,
        motion_type=shot.motion or "zoom_in",
        engine=motion_engine,
        prompt=shot.image_prompt,
        aspect_ratio=aspect_ratio
    )

    log_message(f"Đã tạo lại ảnh và video mới cho phân cảnh '{req.shot_id}' (Seed: {new_seed}).")
    return {
        "success": True,
        "shot_id": req.shot_id,
        "image_url": f"/api/outputs/images/{req.shot_id}.png?t={int(time.time())}"
    }

class UploadShotImageRequest(BaseModel):
    shot_id: str
    image_base64: str

@app.post("/api/storyboard/upload-shot-image")
def upload_shot_image(req: UploadShotImageRequest):
    import base64
    from studio.motion import render_motion_for_shot

    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    with open(sb_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    shot_data = None
    for s in data.get("shots", []):
        if s.get("id") == req.shot_id:
            shot_data = s
            break
    if not shot_data:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy phân cảnh '{req.shot_id}'")

    img_dir = Path("outputs/images")
    img_dir.mkdir(parents=True, exist_ok=True)
    out_img = img_dir / f"{req.shot_id}.png"

    b64_data = req.image_base64
    if "," in b64_data:
        b64_data = b64_data.split(",", 1)[1]

    try:
        img_bytes = base64.b64decode(b64_data)
        with open(out_img, "wb") as f:
            f.write(img_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi giải mã ảnh: {e}")

    vid_dir = Path("outputs/videos")
    out_vid = vid_dir / f"{req.shot_id}.mp4"
    duration = float(shot_data.get("duration") or 5.0)
    audio_file = Path(f"outputs/audio/{req.shot_id}.mp3")
    if audio_file.exists():
        try:
            from studio.tts import get_audio_duration
            duration = get_audio_duration(audio_file)
        except Exception:
            pass

    aspect_ratio = getattr(last_produce_request, "aspect_ratio", "16:9") if last_produce_request else "16:9"
    motion_engine = getattr(last_produce_request, "motion", "kenburns") if last_produce_request else "kenburns"

    render_motion_for_shot(
        image_path=out_img,
        output_path=out_vid,
        duration=duration,
        motion_type=shot_data.get("motion") or "zoom_in",
        engine=motion_engine,
        prompt=shot_data.get("image_prompt", ""),
        aspect_ratio=aspect_ratio
    )

    log_message(f"Đã cập nhật ảnh tùy chỉnh cho phân cảnh '{req.shot_id}'.")
    return {
        "success": True,
        "shot_id": req.shot_id,
        "image_url": f"/api/outputs/images/{req.shot_id}.png?t={int(time.time())}"
    }

@app.post("/api/continue")
def continue_film():
    if pipeline_state["status"] == "running":
        raise HTTPException(status_code=400, detail="Quy trình sản xuất đang chạy, vui lòng đợi hoàn tất.")

    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=400, detail="Chưa có kịch bản outputs/storyboard.json để tiếp tục.")

    req = last_produce_request or ProduceRequest(topic=pipeline_state.get("topic") or "AI Cinema Project")
    threading.Thread(target=execute_pipeline_task, args=(req, True), daemon=True).start()
    return {"message": "Đang tiếp tục sản xuất từ kịch bản đã duyệt", "status": "running"}

@app.post("/api/clean")
def clean_outputs():
    if pipeline_state["status"] == "running":
        raise HTTPException(status_code=400, detail="Không thể dọn dẹp khi quy trình đang chạy.")

    out_dir = Path("outputs")
    if out_dir.exists():
        for item in out_dir.iterdir():
            if item.is_dir():
                shutil.rmtree(item, ignore_errors=True)
            else:
                item.unlink(missing_ok=True)

    pipeline_state["status"] = "idle"
    pipeline_state["stage"] = 0
    pipeline_state["stage_name"] = "Sẵn sàng"
    pipeline_state["progress"] = 0
    pipeline_state["final_video"] = None
    pipeline_state["final_srt"] = None
    pipeline_state["logs"] = ["Đã dọn dẹp sạch sẽ thư mục outputs/."]
    return {"message": "Đã dọn dẹp outputs thành công"}

@app.get("/api/projects")
def list_projects():
    projects_dir = Path("outputs/projects")
    if not projects_dir.exists():
        return []

    projects = []
    for p_dir in sorted(projects_dir.iterdir(), reverse=True):
        if p_dir.is_dir():
            meta_file = p_dir / "metadata.json"
            if meta_file.exists():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                    p_id = meta.get("id", p_dir.name)
                    video_file = meta.get("video_file")
                    srt_file = meta.get("srt_file")
                    thumb_file = meta.get("thumb_file")
                    if not thumb_file or not (p_dir / thumb_file).exists():
                        if (p_dir / "thumbnail.jpg").exists():
                            thumb_file = "thumbnail.jpg"
                        elif (p_dir / "thumb.png").exists():
                            thumb_file = "thumb.png"

                    meta["video_url"] = f"/api/outputs/projects/{p_id}/{video_file}" if video_file else None
                    meta["srt_url"] = f"/api/outputs/projects/{p_id}/{srt_file}" if srt_file else None
                    meta["thumb_url"] = f"/api/outputs/projects/{p_id}/{thumb_file}" if thumb_file else None
                    projects.append(meta)
                except Exception:
                    pass
    return projects

@app.websocket("/ws/pipeline")
async def websocket_pipeline_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    try:
        # Send current status immediately upon connection
        await websocket.send_json({"type": "status", "data": get_status()})
        while True:
            text = await websocket.receive_text()
            if text == "ping":
                await websocket.send_json({"type": "pong"})
    except (WebSocketDisconnect, Exception):
        if websocket in active_websockets:
            active_websockets.remove(websocket)

class GenerateThumbnailRequest(BaseModel):
    headline: Optional[str] = None
    shot_id: Optional[str] = None

@app.post("/api/projects/{project_id}/thumbnail")
def api_generate_thumbnail(project_id: str, req: GenerateThumbnailRequest):
    project_dir = Path("outputs/projects") / project_id
    if not project_dir.exists() or not project_dir.is_dir():
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án trong thư viện.")

    meta_file = project_dir / "metadata.json"
    title = "AI CINEMA"
    aspect_ratio = "16:9"
    meta = {}
    if meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
            title = meta.get("title") or meta.get("topic") or title
            aspect_ratio = meta.get("aspect_ratio", "16:9")
        except Exception:
            pass

    headline = req.headline.strip() if req.headline else title
    src_img = f"{req.shot_id}.png" if req.shot_id else None

    thumb_file = generate_thumbnail_image(project_dir, headline, aspect_ratio, src_img)
    if not thumb_file:
        raise HTTPException(status_code=500, detail="Không thể tạo thumbnail bằng FFmpeg.")

    # Update metadata
    meta["thumb_file"] = thumb_file
    try:
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

    return {
        "success": True,
        "thumbnail_url": f"/api/outputs/projects/{project_id}/{thumb_file}?t={int(time.time())}"
    }

@app.get("/api/projects/{project_id}/seo")
def get_project_seo(project_id: str):
    project_dir = Path("outputs/projects") / project_id
    if not project_dir.exists() or not project_dir.is_dir():
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án trong thư viện.")

    meta_file = project_dir / "metadata.json"
    sb_file = project_dir / "storyboard.json"
    if not sb_file.exists():
        sb_file = Path("outputs/storyboard.json")

    meta = {}
    if meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            pass

    title = meta.get("title") or meta.get("topic") or "Phim Ngắn AI"
    topic = meta.get("topic") or title
    style = meta.get("style", "cinematic")
    episode = meta.get("episode", 1)
    series_title = meta.get("series_title")

    shots = []
    if sb_file.exists():
        try:
            with open(sb_file, "r", encoding="utf-8") as f:
                sb_data = json.load(f)
                shots = sb_data.get("shots", [])
        except Exception:
            pass

    # Build chapters & timestamps
    current_time_sec = 0.0
    chapters = []
    seen_chapters = set()
    for s in shots:
        chap_num = s.get("chapter", 1)
        dur = float(s.get("duration") or 5.0)
        if chap_num not in seen_chapters:
            seen_chapters.add(chap_num)
            m = int(current_time_sec // 60)
            sec = int(current_time_sec % 60)
            ts = f"{m:02d}:{sec:02d}"
            chap_title = s.get("dialogue") or f"Chương {chap_num}"
            if len(chap_title) > 35:
                chap_title = chap_title[:32] + "..."
            chapters.append({
                "timestamp": ts,
                "title": f"Phần {chap_num}: {chap_title}"
            })
        current_time_sec += dur

    if not chapters:
        chapters.append({"timestamp": "00:00", "title": "Phần 1: Mở đầu câu chuyện"})

    # High-CTR Title Hooks
    ep_prefix = f"[Tập {episode}] " if series_title or episode > 1 else ""
    ctr_titles = [
        f"{ep_prefix}SỰ THẬT VỀ {title.upper()} | Phim Ngắn AI 4K",
        f"{ep_prefix}{title} - Cuộc Chiến Vô Tiền Khoáng Hậu | AI Cinema Studio",
        f"{ep_prefix}Điều Gì Đã Xảy Ra Với {topic[:40]}? | Phim Ngắn Hay Nhất",
        f"{ep_prefix}{title} (Full HD) - Siêu Phẩm AI Điện Ảnh {style.capitalize()}",
    ]

    # YouTube Description with Chapter Timestamps
    desc_lines = [
        f"🎬 {title}",
        f"Thể loại: {style.capitalize()} | Sản xuất bởi: AI Film Studio 2026",
        "",
        f"📖 TÓM TẮT NỘI DUNG:",
        f"{topic}",
        "",
        "⏱️ DẤU MỐC THỜI GIAN (CHAPTERS):",
    ]
    for ch in chapters:
        desc_lines.append(f"{ch['timestamp']} - {ch['title']}")
    desc_lines.extend([
        "",
        "🌟 CÔNG NGHỆ SẢN XUẤT:",
        "- Kịch bản & Đạo diễn: AI Director Screenwriter",
        "- Visuals & Thiết kế nhân vật: Flux Diffusion Engine",
        "- Giọng lồng tiếng: Edge-TTS Neural Cinema Voice",
        "- VFX Camera: 2.5D Ken Burns & Cinematic Motion",
        "",
        "👍 Đừng quên LIKE, BÌNH LUẬN và ĐĂNG KÝ KÊNH để đón xem các tập phim AI tiếp theo!",
        "#aifilm #phimngan #aicinema #flux #shorts #film #viral"
    ])
    description = "\n".join(desc_lines)

    tags = [
        "phim ngan ai", "ai film studio", title.lower(), style, "phim dien anh ai",
        "flux diffusion", "ai filmmaking", "phim ngan hay nhat", "shorts"
    ]
    hashtags = "#phimngan #aicinema #shortfilm #aiart #viral #xuhuong #filmmaking #fyp"

    thumb_url = None
    if (project_dir / "thumbnail.jpg").exists():
        thumb_url = f"/api/outputs/projects/{project_id}/thumbnail.jpg"
    elif (project_dir / "thumb.png").exists():
        thumb_url = f"/api/outputs/projects/{project_id}/thumb.png"

    return {
        "project_id": project_id,
        "title": title,
        "series_title": series_title,
        "episode": episode,
        "titles": ctr_titles,
        "description": description,
        "chapters": chapters,
        "tags": tags,
        "hashtags": hashtags,
        "thumbnail_url": thumb_url,
    }

class DubProjectRequest(BaseModel):
    target_lang: str
    voice: Optional[str] = None
    hardsub: bool = False

@app.post("/api/projects/{project_id}/dub")
def dub_project(project_id: str, req: DubProjectRequest):
    project_dir = Path("outputs/projects") / project_id
    if not project_dir.exists() or not project_dir.is_dir():
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án trong thư viện.")

    meta_file = project_dir / "metadata.json"
    sb_file = project_dir / "storyboard.json"
    if not sb_file.exists():
        raise HTTPException(status_code=400, detail="Dự án không có storyboard.json để lồng tiếng.")

    with open(sb_file, "r", encoding="utf-8") as f:
        sb_data = json.load(f)
    meta = {}
    if meta_file.exists():
        with open(meta_file, "r", encoding="utf-8") as f:
            meta = json.load(f)

    video_file = meta.get("video_file")
    if not video_file or not (project_dir / video_file).exists():
        raise HTTPException(status_code=400, detail="Không tìm thấy video gốc để lồng tiếng.")

    target_lang = req.target_lang.lower().strip()
    shots = sb_data.get("shots", [])
    if not shots:
        raise HTTPException(status_code=400, detail="Không có phân cảnh để lồng tiếng.")

    from studio.tts import generate_audio_for_shot, get_audio_duration, DEFAULT_VOICES
    from studio.subtitles import generate_srt
    from studio.assembly import build_master_audio, build_hardsub_filter
    from studio.storyboard import Storyboard, Shot, Character

    dubbed_audio_dir = project_dir / "dub" / target_lang
    dubbed_audio_dir.mkdir(parents=True, exist_ok=True)

    chosen_voice = req.voice or DEFAULT_VOICES.get(target_lang, "en-US-GuyNeural")

    dialogues = [s.get("dialogue", "") for s in shots]
    translated_dialogues = []
    llm_name = meta.get("llm") or "gemini"
    try:
        from studio.llm import get_provider
        provider = get_provider(llm_name)
        prompt = f"Translate the following movie dialogues into natural cinematic {target_lang}. Return ONLY a JSON list of strings, exactly {len(dialogues)} items:\n{json.dumps(dialogues, ensure_ascii=False)}"
        res = provider.generate("You are a professional film localization translator.", prompt)
        from studio.storyboard import repair_json_string
        cleaned = repair_json_string(res)
        translated_dialogues = json.loads(cleaned)
        if not isinstance(translated_dialogues, list) or len(translated_dialogues) != len(dialogues):
            translated_dialogues = dialogues
    except Exception:
        translated_dialogues = dialogues

    dubbed_shots = []
    durations = {}
    for idx, s in enumerate(shots):
        new_diag = translated_dialogues[idx] if idx < len(translated_dialogues) else s.get("dialogue", "")
        shot_obj = Shot(
            id=s.get("id", f"shot_{idx:03d}"),
            chapter=int(s.get("chapter", 1)),
            character_id=s.get("character_id"),
            dialogue=str(new_diag),
            image_prompt=s.get("image_prompt", ""),
            motion=s.get("motion", "zoom_in"),
            duration=float(s.get("duration") or 5.0),
            sfx=s.get("sfx"),
            act=int(s.get("act", 1)),
            mood=s.get("mood"),
        )
        dubbed_shots.append(shot_obj)
        chars = {
            k: Character(
                name=v.get("name", k),
                visual_anchor=v.get("visual_anchor", ""),
                voice=chosen_voice,
                seed=v.get("seed", 42)
            ) for k, v in sb_data.get("characters", {}).items()
        }
        audio_path = generate_audio_for_shot(shot_obj, chars, dubbed_audio_dir, lang=target_lang)
        if audio_path and audio_path.exists():
            durations[shot_obj.id] = get_audio_duration(audio_path)
        else:
            durations[shot_obj.id] = shot_obj.duration or 5.0

    dubbed_sb = Storyboard(
        title=f"{sb_data.get('title', 'Film')} ({target_lang.upper()})",
        language=target_lang,
        characters={},
        shots=dubbed_shots
    )

    dubbed_master_audio = project_dir / f"audio_{target_lang}.mp3"
    build_master_audio(
        storyboard=dubbed_sb,
        audio_dir=dubbed_audio_dir,
        durations=durations,
        output_audio_path=dubbed_master_audio,
        style=meta.get("style", "cinematic")
    )

    dubbed_srt = project_dir / f"movie_{target_lang}.srt"
    generate_srt(dubbed_sb, durations, dubbed_srt)

    dubbed_video_name = f"movie_{target_lang}.mp4"
    dubbed_video_path = project_dir / dubbed_video_name
    src_video_path = project_dir / video_file

    if req.hardsub:
        hardsub_filter = build_hardsub_filter(dubbed_srt, aspect_ratio=meta.get("aspect_ratio", "16:9"))
        cmd_mux = [
            "ffmpeg", "-y",
            "-i", str(src_video_path),
            "-i", str(dubbed_master_audio),
            "-vf", hardsub_filter,
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-shortest",
            str(dubbed_video_path)
        ]
    else:
        cmd_mux = [
            "ffmpeg", "-y",
            "-i", str(src_video_path),
            "-i", str(dubbed_master_audio),
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-shortest",
            str(dubbed_video_path)
        ]

    subprocess.run(cmd_mux, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

    if "dubbed_versions" not in meta:
        meta["dubbed_versions"] = {}
    meta["dubbed_versions"][target_lang] = {
        "video_file": dubbed_video_name,
        "srt_file": dubbed_srt.name,
        "video_url": f"/api/outputs/projects/{project_id}/{dubbed_video_name}",
        "srt_url": f"/api/outputs/projects/{project_id}/{dubbed_srt.name}",
    }
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    return {
        "success": True,
        "project_id": project_id,
        "target_lang": target_lang,
        "video_url": f"/api/outputs/projects/{project_id}/{dubbed_video_name}",
        "srt_url": f"/api/outputs/projects/{project_id}/{dubbed_srt.name}",
    }

class GenerateHeadshotRequest(BaseModel):
    character_id: str
    visual_anchor: str
    seed: int = 42

@app.post("/api/characters/generate-headshot")
def api_generate_headshot(req: GenerateHeadshotRequest):
    char_dir = Path("outputs/characters")
    char_dir.mkdir(parents=True, exist_ok=True)
    out_file = char_dir / f"{req.character_id}.png"

    from studio.images import generate_image_for_shot
    from studio.storyboard import Shot
    prompt = f"Cinematic studio character portrait headshot photo of {req.visual_anchor}, dramatic lighting, 8k, detailed facial features"
    dummy_shot = Shot(id=f"char_{req.character_id}", chapter=1, character_id=req.character_id, dialogue="", image_prompt=prompt)
    generate_image_for_shot(dummy_shot, out_file, engine="fallback", prompt_override=prompt, aspect_ratio="1:1")

    sb_file = Path("outputs/storyboard.json")
    if sb_file.exists():
        try:
            with open(sb_file, "r", encoding="utf-8") as f:
                sb_data = json.load(f)
            if "characters" in sb_data and req.character_id in sb_data["characters"]:
                sb_data["characters"][req.character_id]["headshot_url"] = f"/api/outputs/characters/{req.character_id}.png"
                with open(sb_file, "w", encoding="utf-8") as f:
                    json.dump(sb_data, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    return {
        "success": True,
        "character_id": req.character_id,
        "headshot_url": f"/api/outputs/characters/{req.character_id}.png?t={int(time.time())}"
    }

class UploadHeadshotRequest(BaseModel):
    character_id: str
    image_base64: str

@app.post("/api/characters/upload-headshot")
def api_upload_headshot(req: UploadHeadshotRequest):
    import base64
    char_dir = Path("outputs/characters")
    char_dir.mkdir(parents=True, exist_ok=True)
    out_file = char_dir / f"{req.character_id}.png"

    b64 = req.image_base64
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    try:
        data = base64.b64decode(b64)
        out_file.write_bytes(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi giải mã ảnh đại diện: {e}")

    sb_file = Path("outputs/storyboard.json")
    if sb_file.exists():
        try:
            with open(sb_file, "r", encoding="utf-8") as f:
                sb_data = json.load(f)
            if "characters" in sb_data and req.character_id in sb_data["characters"]:
                sb_data["characters"][req.character_id]["headshot_url"] = f"/api/outputs/characters/{req.character_id}.png"
                with open(sb_file, "w", encoding="utf-8") as f:
                    json.dump(sb_data, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    return {
        "success": True,
        "character_id": req.character_id,
        "headshot_url": f"/api/outputs/characters/{req.character_id}.png?t={int(time.time())}"
    }

class TestWebhookRequest(BaseModel):
    webhook_url: str

@app.post("/api/settings/test-webhook")
def api_test_webhook(req: TestWebhookRequest):
    test_payload = {
        "event": "test_notification",
        "title": "AI Cinema Studio",
        "duration": 5,
        "aspect_ratio": "16:9",
        "video_file": "movie.mp4",
        "message": "AI Film Studio Webhook test ping successfully delivered! 🚀",
        "timestamp": int(time.time())
    }
    send_webhook_notification(req.webhook_url, test_payload)
    return {"success": True, "message": "Đã gửi thông báo kiểm tra đến Webhook"}

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    p_dir = Path("outputs/projects") / project_id
    if not p_dir.exists() or not p_dir.is_dir():
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án trong thư viện.")

    shutil.rmtree(p_dir, ignore_errors=True)
    return {"success": True, "message": f"Đã xóa dự án {project_id}"}

@app.get("/api/outputs/{file_path:path}")
def serve_output_file(file_path: str):
    full_path = Path("outputs") / file_path
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="File không tồn tại")
    return FileResponse(str(full_path))

# Mount frontend dist static files if built
dist_dir = Path("web/dist")
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("studio.server:app", host="0.0.0.0", port=8000, reload=True)
