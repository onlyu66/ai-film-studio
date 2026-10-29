from pathlib import Path
from typing import Optional, List, Dict, Any
import os
import re
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
from starlette.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from contextlib import asynccontextmanager
from studio.config import StudioConfig
from studio.storage import atomic_write_json, safe_read_json
from studio.orchestrator import run_pipeline, PipelineCancelledException
from studio.storyboard import parse_storyboard_json
from studio.export_fcpxml import generate_fcpxml
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
app.add_middleware(GZipMiddleware, minimum_size=1000)

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
    image_concurrency: Optional[int] = None
    motion_concurrency: Optional[int] = None
    tts_concurrency: Optional[int] = None
    hardware_accel: str = "auto"
    hardware_profile: Optional[str] = None
    template_id: Optional[str] = None
    image_engine: str = "pollinations"
    image_api_url: Optional[str] = None
    video_api_token: Optional[str] = None
    video_model: Optional[str] = None
    subtitle_style: Optional[str] = "tiktok_bold"
    subtitle_position: Optional[str] = "bottom"
    subtitle_karaoke: Optional[bool] = False
    bgm_preset: Optional[str] = "cinematic"
    bgm_volume: Optional[float] = 0.7
    ducking_level: Optional[str] = "medium"
    voice_volume: Optional[float] = 1.0
    color_lut: Optional[str] = "teal_and_orange"
    transition_preset: Optional[str] = "dissolve"
    transition_duration: Optional[float] = 0.6

# Global pipeline execution state & cancel event
_cancel_event = threading.Event()

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
    "current_shot_id": None,
    "current_shot_index": None,
    "shots_total": None,
    "active_action": None,
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

    # 2. Copy SRT and ASS if exists
    srt_name = None
    srt_path = final_video_path.with_suffix(".srt")
    if srt_path.exists():
        dest_srt = project_dir / srt_path.name
        shutil.copy2(str(srt_path), str(dest_srt))
        srt_name = srt_path.name

    ass_name = None
    ass_path = final_video_path.with_suffix(".ass")
    if ass_path.exists():
        dest_ass = project_dir / ass_path.name
        shutil.copy2(str(ass_path), str(dest_ass))
        ass_name = ass_path.name

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
        "ass_file": ass_name,
        "thumb_file": thumb_name,
        "shots_count": shots_count,
        "subtitle_style": getattr(req, "subtitle_style", "tiktok_bold"),
        "subtitle_position": getattr(req, "subtitle_position", "bottom"),
        "subtitle_karaoke": getattr(req, "subtitle_karaoke", False),
        "dubbed_versions": {},
    }
    atomic_write_json(project_dir / "metadata.json", metadata, backup=False)

def execute_pipeline_task(req: ProduceRequest, resume_only: bool = False):
    global pipeline_state, last_produce_request
    last_produce_request = req
    _cancel_event.clear()
    pipeline_state["status"] = "running"
    pipeline_state["topic"] = req.topic
    pipeline_state["error"] = None
    pipeline_state["current_shot_id"] = None
    pipeline_state["current_shot_index"] = None
    pipeline_state["shots_total"] = None
    pipeline_state["active_action"] = None
    broadcast_ws("status", get_status())

    try:
        if not resume_only:
            # Clean intermediate workspace for brand new production, strictly keeping outputs/projects intact!
            out_base = Path("outputs")
            if out_base.exists():
                for sub in ["audio", "images", "videos", "final"]:
                    d = out_base / sub
                    if d.exists() and d.is_dir():
                        shutil.rmtree(d, ignore_errors=True)
                for f in ["storyboard.json", "state.json"]:
                    sf = out_base / f
                    if sf.exists():
                        try:
                            sf.unlink()
                        except Exception:
                            pass

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
            image_concurrency=getattr(req, "image_concurrency", None),
            motion_concurrency=getattr(req, "motion_concurrency", None),
            tts_concurrency=getattr(req, "tts_concurrency", None),
            hardware_accel=getattr(req, "hardware_accel", "auto") or "auto",
            hardware_profile=getattr(req, "hardware_profile", None),
            template_id=getattr(req, "template_id", None),
            image_engine=getattr(req, "image_engine", "pollinations") or "pollinations",
            image_api_url=getattr(req, "image_api_url", None),
            video_api_token=getattr(req, "video_api_token", None),
            video_model=getattr(req, "video_model", "wan-video/wan-2.1-i2v-480p") or "wan-video/wan-2.1-i2v-480p",
            subtitle_style=getattr(req, "subtitle_style", "tiktok_bold") or "tiktok_bold",
            subtitle_position=getattr(req, "subtitle_position", "bottom") or "bottom",
            subtitle_karaoke=getattr(req, "subtitle_karaoke", False) or False,
            bgm_preset=getattr(req, "bgm_preset", "cinematic") or "cinematic",
            bgm_volume=float(getattr(req, "bgm_volume", 0.7) if getattr(req, "bgm_volume", None) is not None else 0.7),
            ducking_level=getattr(req, "ducking_level", "medium") or "medium",
            voice_volume=float(getattr(req, "voice_volume", 1.0) if getattr(req, "voice_volume", None) is not None else 1.0),
            color_lut=getattr(req, "color_lut", "teal_and_orange") or "teal_and_orange",
            transition_preset=getattr(req, "transition_preset", "dissolve") or "dissolve",
            transition_duration=float(getattr(req, "transition_duration", 0.6) if getattr(req, "transition_duration", None) is not None else 0.6),
        )

        def _on_progress(stage: int, stage_name: str, progress: int, log_msg: str, **kwargs):
            pipeline_state["stage"] = stage
            pipeline_state["stage_name"] = stage_name
            pipeline_state["progress"] = progress
            if "shot_id" in kwargs:
                pipeline_state["current_shot_id"] = kwargs["shot_id"]
            if "shot_idx" in kwargs:
                pipeline_state["current_shot_index"] = kwargs["shot_idx"]
            if "shots_total" in kwargs:
                pipeline_state["shots_total"] = kwargs["shots_total"]
            if "action" in kwargs:
                pipeline_state["active_action"] = kwargs["action"]
            if log_msg:
                log_message(log_msg)
            broadcast_ws("status", get_status())

        if not resume_only and req.pause_after_script:
            pipeline_state["stage"] = 1
            pipeline_state["stage_name"] = "Đang soạn kịch bản & phân cảnh..."
            pipeline_state["progress"] = 5
            broadcast_ws("status", get_status())
            log_message(f"Soạn kịch bản: {req.topic} ({req.lang}, {req.duration}m, {req.style})")

            run_pipeline(cfg, stop_after_stage=1, force_new=True, progress_callback=_on_progress, cancel_event=_cancel_event)

            pipeline_state["status"] = "script_ready"
            pipeline_state["stage"] = 1
            pipeline_state["stage_name"] = "Kịch bản đã sẵn sàng - Chờ duyệt"
            pipeline_state["progress"] = 20
            pipeline_state["current_shot_id"] = None
            broadcast_ws("status", get_status())
            log_message("Kịch bản và phân cảnh đã được tạo xong! Bạn có thể chỉnh sửa lời thoại, nhân vật và giọng đọc trước khi bấm 'Tiếp tục sản xuất phim'.")
            return

        pipeline_state["stage"] = 2 if resume_only else 1
        pipeline_state["stage_name"] = "Đang sản xuất phim..."
        pipeline_state["progress"] = 20 if resume_only else 5
        broadcast_ws("status", get_status())
        log_message("Đang thực hiện quy trình sản xuất phim...")

        final_video_path = run_pipeline(
            cfg,
            stop_after_stage=None,
            force_new=(not resume_only),
            progress_callback=_on_progress,
            cancel_event=_cancel_event,
        )

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

    except PipelineCancelledException:
        pipeline_state["status"] = "idle"
        pipeline_state["stage"] = 0
        pipeline_state["stage_name"] = "Đã dừng sản xuất"
        pipeline_state["progress"] = 0
        pipeline_state["current_shot_id"] = None
        pipeline_state["current_shot_index"] = None
        pipeline_state["shots_total"] = None
        pipeline_state["active_action"] = None
        broadcast_ws("status", get_status())
        log_message("[Pipeline] Tiến trình sản xuất đã được dừng an toàn theo yêu cầu người dùng.")
    except Exception as e:
        pipeline_state["status"] = "error"
        pipeline_state["error"] = str(e)
        broadcast_ws("status", get_status())
        log_message(f"Lỗi quy trình: {e}")

# Global caching for storyboard and status
_sb_cache: Dict[str, Any] = {}
_sb_cached_mtime: float = -1.0
_sb_cached_dir_counts: tuple = (0, 0, 0)
_status_sb_mtime: float = -1.0
_status_shots_count_cache: int = 0
_sb_lock = threading.Lock()

def invalidate_storyboard_cache():
    """Invalidate in-memory storyboard and status cache on any mutation."""
    global _sb_cached_mtime, _status_sb_mtime
    with _sb_lock:
        _sb_cached_mtime = -1.0
        _status_sb_mtime = -1.0

@app.get("/api/status")
def get_status():
    global _status_sb_mtime, _status_shots_count_cache
    # Return shots count using cached mtime check to prevent disk parse thrashing
    sb_file = Path("outputs/storyboard.json")
    if sb_file.exists():
        try:
            mtime = sb_file.stat().st_mtime
            if mtime != _status_sb_mtime:
                with open(sb_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    _status_shots_count_cache = len(data.get("shots", []))
                _status_sb_mtime = mtime
        except Exception:
            pass
    else:
        _status_shots_count_cache = 0

    return {
        **pipeline_state,
        "shots_count": _status_shots_count_cache,
        "can_cancel": pipeline_state.get("status") == "running",
    }

@app.get("/api/system/hardware")
def get_system_hardware():
    from studio.hardware import detect_hardware
    return detect_hardware()

@app.get("/api/system/image-engines")
def get_system_image_engines():
    """Return status and list of all available image generation engines (cloud and local)."""
    from studio.image_providers import discover_image_engines
    return discover_image_engines()

class TestImageEngineRequest(BaseModel):
    engine: str = "pollinations"
    url: Optional[str] = None

@app.post("/api/settings/test-image-engine")
def test_image_engine(req: TestImageEngineRequest):
    """Test connection to a specific image engine URL and return its health status."""
    from studio.image_providers import get_image_provider
    provider = get_image_provider(req.engine, api_url=req.url)
    return provider.check_health()

@app.get("/api/system/video-models")
def get_system_video_models():
    """Return list of supported AI video models."""
    from studio.video_providers import get_available_video_models
    return get_available_video_models()

class TestVideoTokenRequest(BaseModel):
    token: str

@app.post("/api/settings/test-video-token")
def test_video_token_endpoint(req: TestVideoTokenRequest):
    """Validate a Replicate API token against Replicate account API."""
    from studio.video_providers import check_replicate_token
    return check_replicate_token(req.token)


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

@app.post("/api/pipeline/cancel")
@app.post("/api/cancel")
def cancel_pipeline():
    if pipeline_state.get("status") != "running":
        return {"success": False, "message": "Không có tiến trình sản xuất nào đang chạy."}

    _cancel_event.set()
    log_message("[Pipeline] Đang dừng tiến trình sản xuất theo yêu cầu...")
    pipeline_state["stage_name"] = "Đang dừng quy trình..."
    broadcast_ws("status", get_status())
    return {"success": True, "message": "Đã gửi tín hiệu dừng tiến trình thành công."}

@app.get("/api/storyboard/templates")
def get_storyboard_templates():
    """Return all available cinematic story templates."""
    from studio.templates import list_story_templates
    return list_story_templates()

@app.get("/api/storyboard/templates/{template_id}")
def get_single_storyboard_template(template_id: str):
    """Return a single story template by ID or 404."""
    from studio.templates import get_story_template
    tmpl = get_story_template(template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' không tồn tại.")
    return tmpl

@app.get("/api/storyboard")
def get_storyboard():
    global _sb_cache, _sb_cached_mtime, _sb_cached_dir_counts
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        return {"title": "", "language": "vi", "characters": {}, "shots": []}
    try:
        sb_mtime = sb_file.stat().st_mtime
        img_dir = Path("outputs/images")
        audio_dir = Path("outputs/audio")
        vid_dir = Path("outputs/videos")

        img_count = len(os.listdir(img_dir)) if img_dir.exists() else 0
        audio_count = len(os.listdir(audio_dir)) if audio_dir.exists() else 0
        vid_count = len(os.listdir(vid_dir)) if vid_dir.exists() else 0
        current_dir_counts = (img_count, audio_count, vid_count)

        with _sb_lock:
            if _sb_cache and sb_mtime == _sb_cached_mtime and current_dir_counts == _sb_cached_dir_counts:
                return _sb_cache

            with open(sb_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Batch scan existing files with size > 0 into sets (O(1) memory lookup)
            valid_imgs = {f[:-4] for f in os.listdir(img_dir) if f.endswith(".png") and (img_dir / f).stat().st_size > 0} if img_dir.exists() else set()
            valid_audios = {f[:-4] for f in os.listdir(audio_dir) if f.endswith(".mp3") and (audio_dir / f).stat().st_size > 0} if audio_dir.exists() else set()
            valid_vids = {f[:-4] for f in os.listdir(vid_dir) if f.endswith(".mp4") and (vid_dir / f).stat().st_size > 0} if vid_dir.exists() else set()

            for s in data.get("shots", []):
                sid = s.get("id")
                s["has_image"] = bool(sid and sid in valid_imgs)
                s["has_audio"] = bool(sid and sid in valid_audios)
                s["has_video"] = bool(sid and sid in valid_vids)
                s["is_approved"] = bool(s.get("is_approved", False))
                s["voice_volume"] = float(s.get("voice_volume", 1.0) if s.get("voice_volume") is not None else 1.0)
                s["sfx_volume"] = float(s.get("sfx_volume", 1.0) if s.get("sfx_volume") is not None else 1.0)
                s["image_url"] = f"/api/outputs/images/{sid}.png" if s["has_image"] else None
                s["audio_url"] = f"/api/outputs/audio/{sid}.mp3" if s["has_audio"] else None
                s["video_url"] = f"/api/outputs/videos/{sid}.mp4" if s["has_video"] else None

            _sb_cache = data
            _sb_cached_mtime = sb_mtime
            _sb_cached_dir_counts = current_dir_counts
            return _sb_cache
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/storyboard/export-timeline")
def export_storyboard_timeline(
    format: str = "fcpxml",
    aspect_ratio: str = "16:9",
    fps: int = 25,
):
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    try:
        raw_text = sb_file.read_text(encoding="utf-8")
        sb = parse_storyboard_json(raw_text)

        export_dir = Path("outputs")
        export_file = export_dir / "timeline_export.fcpxml"
        generate_fcpxml(
            storyboard=sb,
            output_path=export_file,
            aspect_ratio=aspect_ratio,
            fps=fps,
            project_dir=export_dir,
        )

        title_slug = re.sub(r'[^a-zA-Z0-9_\-]', '_', getattr(sb, "title", None) or getattr(sb, "topic", "timeline") or "timeline").strip('_') or "timeline"
        filename = f"timeline_{title_slug}.fcpxml"

        return FileResponse(
            path=export_file,
            media_type="application/xml",
            filename=filename,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xuất timeline FCPXML: {str(e)}")

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

        atomic_write_json(sb_file, data, backup=True)

        # Invalidate existing audio and motion files for this character, and reset checkpoint state
        audio_dir = Path("outputs/audio")
        vid_dir = Path("outputs/videos")
        state_file = Path("outputs/state.json")
        state = None
        if state_file.exists():
            try:
                from studio.state import StateManager
                state = StateManager(state_file)
            except Exception:
                state = None

        for shot in data.get("shots", []):
            if shot.get("character_id") == req.character_id:
                shot_id = shot.get("id")
                audio_file = audio_dir / f"{shot_id}.mp3"
                if audio_file.exists():
                    audio_file.unlink(missing_ok=True)
                vid_file = vid_dir / f"{shot_id}.mp4"
                if vid_file.exists():
                    vid_file.unlink(missing_ok=True)
                if state:
                    state.reset_shot(shot_id, "audio")
                    state.reset_shot(shot_id, "video")
        if state:
            state.save()

        invalidate_storyboard_cache()
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

def fast_remux_video_audio(vid_file: Path, audio_file: Path) -> bool:
    """Mux new audio into existing video clip in ~50ms using -c:v copy without re-rendering visual frames."""
    if not vid_file.exists() or not audio_file.exists() or audio_file.stat().st_size == 0:
        return False
    temp_vid = vid_file.parent / f"temp_remux_{vid_file.name}"
    try:
        vid_file.rename(temp_vid)
        mux_cmd = [
            "ffmpeg", "-y",
            "-i", str(temp_vid),
            "-i", str(audio_file),
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            "-movflags", "+faststart",
            str(vid_file)
        ]
        subprocess.run(mux_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        temp_vid.unlink(missing_ok=True)
        return True
    except Exception as exc:
        log_message(f"[FastRemux Warning] Không thể ghép lại audio vào video clip: {exc}")
        if temp_vid.exists() and not vid_file.exists():
            temp_vid.rename(vid_file)
        return False

class UpdateShotRequest(BaseModel):
    shot_id: str
    dialogue: Optional[str] = None
    image_prompt: Optional[str] = None
    motion: Optional[str] = None
    character_id: Optional[str] = None
    sfx: Optional[str] = None
    mood: Optional[str] = None
    emotion: Optional[str] = None
    shot_size: Optional[str] = None
    camera_angle: Optional[str] = None
    lighting: Optional[str] = None
    camera_lens: Optional[str] = None
    camera_motion: Optional[str] = None
    voice_volume: Optional[float] = None
    sfx_volume: Optional[float] = None
    sfx_offset_ms: Optional[int] = None

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

        state_file = Path("outputs/state.json")
        state = None
        if state_file.exists():
            try:
                from studio.state import StateManager
                state = StateManager(state_file)
            except Exception:
                state = None

        audio_setting_changed = False
        speech_text_or_char_changed = False

        if req.dialogue is not None:
            if req.dialogue != target_shot.get("dialogue"):
                target_shot["dialogue"] = req.dialogue
                speech_text_or_char_changed = True
                audio_setting_changed = True

        if req.character_id is not None:
            old_char = target_shot.get("character_id")
            new_char = req.character_id if req.character_id else None
            if old_char != new_char:
                target_shot["character_id"] = new_char
                speech_text_or_char_changed = True
                audio_setting_changed = True

        if req.sfx is not None:
            new_sfx = req.sfx if req.sfx else None
            if new_sfx != target_shot.get("sfx"):
                target_shot["sfx"] = new_sfx
                audio_setting_changed = True

        if req.voice_volume is not None:
            v_vol = round(max(0.0, min(2.0, float(req.voice_volume))), 2)
            if v_vol != target_shot.get("voice_volume"):
                target_shot["voice_volume"] = v_vol
                audio_setting_changed = True

        if req.sfx_volume is not None:
            s_vol = round(max(0.0, min(2.0, float(req.sfx_volume))), 2)
            if s_vol != target_shot.get("sfx_volume"):
                target_shot["sfx_volume"] = s_vol
                audio_setting_changed = True

        if req.sfx_offset_ms is not None:
            s_off = max(0, min(10000, int(req.sfx_offset_ms)))
            if s_off != target_shot.get("sfx_offset_ms"):
                target_shot["sfx_offset_ms"] = s_off
                audio_setting_changed = True

        # Visual changes reset video; audio changes PRESERVE existing video
        if req.image_prompt is not None and req.image_prompt != target_shot.get("image_prompt"):
            target_shot["image_prompt"] = req.image_prompt
            image_file = Path(f"outputs/images/{req.shot_id}.png")
            image_file.unlink(missing_ok=True)
            vid_file = Path(f"outputs/videos/{req.shot_id}.mp4")
            vid_file.unlink(missing_ok=True)
            if state:
                state.reset_shot(req.shot_id, "image")
                state.reset_shot(req.shot_id, "video")

        if req.motion is not None and req.motion != target_shot.get("motion"):
            target_shot["motion"] = req.motion
            vid_file = Path(f"outputs/videos/{req.shot_id}.mp4")
            vid_file.unlink(missing_ok=True)
            if state:
                state.reset_shot(req.shot_id, "video")

        if req.mood is not None:
            target_shot["mood"] = req.mood if req.mood else None

        if req.emotion is not None:
            target_shot["emotion"] = req.emotion if req.emotion else None

        if req.shot_size is not None:
            target_shot["shot_size"] = req.shot_size if req.shot_size else None

        if req.camera_angle is not None:
            target_shot["camera_angle"] = req.camera_angle if req.camera_angle else None

        if req.lighting is not None:
            target_shot["lighting"] = req.lighting if req.lighting else None

        if req.camera_lens is not None:
            target_shot["camera_lens"] = req.camera_lens if req.camera_lens else None

        if req.camera_motion is not None:
            target_shot["camera_motion"] = req.camera_motion if req.camera_motion else None
            if not req.motion:
                target_shot["motion"] = req.camera_motion

        # Reset approval when a shot's content or visuals are modified
        target_shot["is_approved"] = False

        # If audio settings changed (volumes or sfx) and speech raw exists, auto re-mix and fast remux into video!
        audio_file = Path(f"outputs/audio/{req.shot_id}.mp3")
        raw_audio_file = Path(f"outputs/audio/raw_{req.shot_id}.mp3")
        vid_file = Path(f"outputs/videos/{req.shot_id}.mp4")

        if audio_setting_changed:
            if speech_text_or_char_changed:
                # Text/character changed: invalidate raw speech so next audio generation fetches fresh TTS
                raw_audio_file.unlink(missing_ok=True)
                audio_file.unlink(missing_ok=True)
                if state:
                    state.reset_shot(req.shot_id, "audio")
            elif raw_audio_file.exists() or audio_file.exists():
                # Only volume or SFX changed: auto re-mix immediately without calling Edge TTS!
                try:
                    from studio.assembly import mix_sfx_into_shot_audio
                    dur = float(target_shot.get("duration") or 5.0)
                    speech_src = raw_audio_file if raw_audio_file.exists() else audio_file
                    mix_sfx_into_shot_audio(
                        speech_audio_path=speech_src,
                        sfx_str=target_shot.get("sfx"),
                        shot_duration=dur,
                        output_path=audio_file,
                        voice_volume=float(target_shot.get("voice_volume", 1.0) or 1.0),
                        sfx_volume=float(target_shot.get("sfx_volume", 1.0) or 1.0),
                    )
                    # Video is PRESERVED and remuxed with new audio in ~50ms
                    if vid_file.exists():
                        fast_remux_video_audio(vid_file, audio_file)
                except Exception as remux_err:
                    log_message(f"[Auto-Remux Warning] {remux_err}")

        if state:
            state.save()

        atomic_write_json(sb_file, data, backup=True)

        invalidate_storyboard_cache()
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
    mood: Optional[str] = None
    emotion: Optional[str] = None
    shot_size: Optional[str] = None
    camera_angle: Optional[str] = None
    lighting: Optional[str] = None
    voice_volume: Optional[float] = 1.0
    sfx_volume: Optional[float] = 1.0

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
            "mood": req.mood or "mysterious",
            "emotion": req.emotion or "tense",
            "shot_size": req.shot_size or "medium",
            "camera_angle": req.camera_angle or "eye_level",
            "lighting": req.lighting or "chiaroscuro",
            "voice_volume": float(req.voice_volume if req.voice_volume is not None else 1.0),
            "sfx_volume": float(req.sfx_volume if req.sfx_volume is not None else 1.0),
            "is_approved": False,
        }

        shots.insert(insert_idx, new_shot)
        data["shots"] = shots

        atomic_write_json(sb_file, data, backup=True)

        invalidate_storyboard_cache()
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

        state_file = Path("outputs/state.json")
        if state_file.exists():
            try:
                from studio.state import StateManager
                state = StateManager(state_file)
                state.remove_shot(req.shot_id)
                state.save()
            except Exception:
                pass

        atomic_write_json(sb_file, data, backup=True)

        invalidate_storyboard_cache()
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
        atomic_write_json(sb_file, data, backup=True)

        invalidate_storyboard_cache()
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

AVAILABLE_SFX = [
    {"key": "rain", "name": "Mưa rào (Rain)", "category": "Thời tiết", "desc": "Tiếng mưa rơi rải rác"},
    {"key": "wind", "name": "Gió rít (Wind)", "category": "Thời tiết", "desc": "Tiếng gió hú lạnh lẽo"},
    {"key": "thunder", "name": "Sấm sét (Thunder)", "category": "Thời tiết", "desc": "Tiếng sấm nổ vang trời"},
    {"key": "waves", "name": "Sóng biển (Waves)", "category": "Tự nhiên", "desc": "Tiếng sóng biển rì rào"},
    {"key": "campfire", "name": "Lửa trại (Campfire)", "category": "Tự nhiên", "desc": "Tiếng củi cháy tí tách"},
    {"key": "birds", "name": "Chim hót (Birds)", "category": "Tự nhiên", "desc": "Tiếng chim hót trong rừng"},
    {"key": "city", "name": "Phố xá (City)", "category": "Đô thị", "desc": "Âm thanh phố phường đông đúc"},
    {"key": "traffic", "name": "Giao thông (Traffic)", "category": "Đô thị", "desc": "Tiếng còi xe và động cơ"},
    {"key": "cyberpunk", "name": "Tàu không gian (Cyberpunk)", "category": "Sci-Fi", "desc": "Âm hưởng viễn tưởng, không gian"},
]

@app.get("/api/sfx/list")
def list_sfx():
    return {"sfx": AVAILABLE_SFX}

@app.get("/api/sfx/catalog")
def api_get_sfx_catalog():
    from studio.sfx import get_sfx_catalog
    return get_sfx_catalog()

class SfxSuggestRequest(BaseModel):
    prompt: str
    dialogue: Optional[str] = ""
    genre: Optional[str] = ""

@app.post("/api/sfx/suggest")
def api_suggest_sfx(req: SfxSuggestRequest):
    from studio.sfx import suggest_sfx_for_shot
    return suggest_sfx_for_shot(
        prompt=req.prompt or "",
        dialogue=req.dialogue or "",
        genre=req.genre or "",
    )

class BatchSfxSuggestRequest(BaseModel):
    project_id: str
    overwrite_existing: bool = False

@app.post("/api/sfx/batch-suggest")
def api_batch_suggest_sfx(req: BatchSfxSuggestRequest):
    from studio.storage import safe_read_json, atomic_write_json
    from studio.sfx import suggest_sfx_for_shot

    if req.project_id in ("current", "", None):
        sb_path = Path("outputs/storyboard.json")
    else:
        sb_path = Path(f"outputs/projects/{req.project_id}/storyboard.json")

    if not sb_path.exists():
        raise HTTPException(status_code=404, detail=f"Không tìm thấy dự án {req.project_id}")

    sb_data = safe_read_json(sb_path)
    if not sb_data or not isinstance(sb_data, dict):
        raise HTTPException(status_code=400, detail="Tệp storyboard bị lỗi hoặc không thể đọc.")

    assigned_count = 0
    genre = sb_data.get("genre", "")
    shots = sb_data.get("shots", [])

    for shot in shots:
        current_sfx = shot.get("sfx")
        if not current_sfx or req.overwrite_existing:
            suggestion = suggest_sfx_for_shot(
                prompt=shot.get("image_prompt", "") or "",
                dialogue=shot.get("dialogue", "") or "",
                genre=genre,
            )
            shot["sfx"] = suggestion["sfx_id"]
            shot["sfx_volume"] = suggestion["volume"]
            shot["sfx_offset_ms"] = suggestion["offset_ms"]
            assigned_count += 1

    sb_data["shots"] = shots
    atomic_write_json(sb_path, sb_data)

    return {
        "success": True,
        "assigned_count": assigned_count,
        "total_shots": len(shots),
        "shots": [
            {
                "id": s.get("id"),
                "sfx": s.get("sfx"),
                "sfx_volume": s.get("sfx_volume", 1.0),
                "sfx_offset_ms": s.get("sfx_offset_ms", 0),
            }
            for s in shots
        ],
    }

@app.api_route("/api/assets/sfx/{file_name}", methods=["GET", "HEAD"])
def serve_sfx_asset(file_name: str):
    clean_name = file_name.replace(".mp3", "").lower().strip()
    from studio.assembly import resolve_sfx_path
    sfx_path = resolve_sfx_path(clean_name)
    if not sfx_path or not sfx_path.exists():
        raise HTTPException(status_code=404, detail=f"Không tìm thấy âm thanh SFX '{clean_name}'.")
    return FileResponse(
        str(sfx_path),
        media_type="audio/mpeg",
        headers={"Cache-Control": "public, max-age=86400"}
    )

@app.get("/api/assets/bgm")
def api_get_bgm_catalog():
    from studio.audio_assets import get_bgm_catalog
    return get_bgm_catalog()

@app.api_route("/api/assets/bgm/{file_name}", methods=["GET", "HEAD"])
def serve_bgm_asset(file_name: str):
    clean_name = file_name.replace(".mp3", "").replace(".wav", "").lower().strip()
    bgm_dir = Path("assets/bgm")
    bgm_dir.mkdir(parents=True, exist_ok=True)

    candidate = bgm_dir / f"{clean_name}.mp3"
    if not candidate.exists():
        candidate_wav = bgm_dir / f"{clean_name}.wav"
        if candidate_wav.exists():
            candidate = candidate_wav

    if not candidate.exists() or candidate.stat().st_size < 1000:
        try:
            from studio.audio_assets import ensure_audio_assets, generate_tone_track, BGM_SOURCES
            if clean_name in BGM_SOURCES:
                ensure_audio_assets()
            else:
                generate_tone_track(candidate, style="cinematic", duration=30)
        except Exception:
            pass

    if not candidate.exists():
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file nhạc nền '{clean_name}'.")

    return FileResponse(
        str(candidate),
        media_type="audio/mpeg",
        headers={"Cache-Control": "public, max-age=86400"}
    )

class UploadBgmRequest(BaseModel):
    filename: str
    audio_base64: str

@app.post("/api/assets/bgm/upload")
def upload_custom_bgm(req: UploadBgmRequest):
    import base64
    ext = Path(req.filename or "").suffix.lower()
    if ext not in (".mp3", ".wav", ".m4a", ".ogg", ".aac"):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file âm thanh: .mp3, .wav, .m4a, .ogg, .aac")

    bgm_dir = Path("assets/bgm")
    bgm_dir.mkdir(parents=True, exist_ok=True)

    timestamp = int(time.time())
    safe_name = f"custom_{timestamp}"
    dest_path = bgm_dir / f"{safe_name}.mp3"

    try:
        raw_b64 = req.audio_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        content = base64.b64decode(raw_b64)
        if len(content) < 100:
            raise HTTPException(status_code=400, detail="File âm thanh quá nhỏ hoặc bị hỏng.")

        dest_path.write_bytes(content)
        return {
            "success": True,
            "id": safe_name,
            "name": req.filename or f"Custom Music {timestamp}",
            "stream_url": f"/api/assets/bgm/{safe_name}.mp3",
            "message": "Đã tải lên file nhạc nền tùy chỉnh thành công!",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu file nhạc: {e}")

@app.get("/api/camera/presets")
def api_get_camera_presets():
    from studio.camera_director import get_camera_presets
    return get_camera_presets()

@app.get("/api/lut/presets")
def api_get_lut_presets():
    from studio.color_grading import get_color_luts
    return get_color_luts()

@app.get("/api/transitions/presets")
def api_get_transition_presets():
    from studio.color_grading import get_scene_transitions
    return get_scene_transitions()

class MultiAngleCoverageRequest(BaseModel):
    angles: Optional[List[str]] = None
    engine: Optional[str] = None
    api_url: Optional[str] = None

@app.post("/api/shots/{shot_id}/multi-angle")
def generate_multi_angle_for_shot(shot_id: str, req: Optional[MultiAngleCoverageRequest] = None):
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    with open(sb_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    target_shot = None
    for s in data.get("shots", []):
        if s.get("id") == shot_id:
            target_shot = s
            break
    if not target_shot:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy phân cảnh '{shot_id}'")

    from studio.storyboard import Shot, Character
    shot = Shot(
        id=target_shot["id"],
        chapter=target_shot.get("chapter", 1),
        character_id=target_shot.get("character_id"),
        dialogue=target_shot.get("dialogue", ""),
        image_prompt=target_shot.get("image_prompt", ""),
        motion=target_shot.get("motion", "zoom_in"),
        duration=target_shot.get("duration"),
        shot_size=target_shot.get("shot_size"),
        camera_angle=target_shot.get("camera_angle"),
        lighting=target_shot.get("lighting"),
        camera_lens=target_shot.get("camera_lens"),
    )
    characters = {
        k: Character(
            name=v.get("name", k),
            visual_anchor=v.get("visual_anchor", ""),
            voice=v.get("voice", ""),
            seed=v.get("seed", 42),
        )
        for k, v in data.get("characters", {}).items()
    }

    style = getattr(last_produce_request, "style", "cinematic") if last_produce_request else "cinematic"
    aspect_ratio = getattr(last_produce_request, "aspect_ratio", "16:9") if last_produce_request else "16:9"
    engine = (req.engine if req and req.engine else None) or (getattr(last_produce_request, "image_engine", "pollinations") if last_produce_request else "pollinations")
    api_url = (req.api_url if req and req.api_url else None) or (getattr(last_produce_request, "image_api_url", None) if last_produce_request else None)
    target_angles = req.angles if (req and req.angles) else ["wide", "medium", "close_up"]

    from studio.camera_director import render_multi_angle_coverage
    results = render_multi_angle_coverage(
        shot=shot,
        characters=characters,
        angles=target_angles,
        output_dir=Path("outputs/images"),
        style=style,
        aspect_ratio=aspect_ratio,
        engine=engine,
        api_url=api_url,
    )

    # Persist multi_angle_options into storyboard.json
    target_shot["multi_angle_options"] = results
    with open(sb_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return {
        "success": True,
        "shot_id": shot_id,
        "angles": results,
    }

class ApplyAngleRequest(BaseModel):
    angle: str
    re_render_motion: bool = False

@app.post("/api/shots/{shot_id}/apply-angle")
def apply_multi_angle_for_shot(shot_id: str, req: ApplyAngleRequest):
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    with open(sb_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    target_shot = None
    for s in data.get("shots", []):
        if s.get("id") == shot_id:
            target_shot = s
            break
    if not target_shot:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy phân cảnh '{shot_id}'")

    img_dir = Path("outputs/images")
    candidate_img = img_dir / f"{shot_id}_{req.angle}.png"
    main_img = img_dir / f"{shot_id}.png"

    if not candidate_img.exists():
        raise HTTPException(status_code=400, detail=f"Chưa có ảnh góc máy '{req.angle}' cho phân cảnh này.")

    shutil.copyfile(candidate_img, main_img)

    # Update camera_angle in shot
    target_shot["camera_angle"] = req.angle
    target_shot["is_approved"] = False

    # Invalidate video or re-render
    vid_file = Path(f"outputs/videos/{shot_id}.mp4")
    if req.re_render_motion:
        from studio.motion import render_motion_for_shot
        duration = float(target_shot.get("duration") or 5.0)
        style = getattr(last_produce_request, "style", "cinematic") if last_produce_request else "cinematic"
        aspect_ratio = getattr(last_produce_request, "aspect_ratio", "16:9") if last_produce_request else "16:9"
        motion_engine = getattr(last_produce_request, "motion", "kenburns") if last_produce_request else "kenburns"
        render_motion_for_shot(
            image_path=main_img,
            output_path=vid_file,
            duration=duration,
            motion_type=target_shot.get("motion", "zoom_in"),
            engine=motion_engine,
            prompt=target_shot.get("image_prompt", ""),
            aspect_ratio=aspect_ratio,
            style=style,
        )
    else:
        vid_file.unlink(missing_ok=True)

    with open(sb_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return {
        "success": True,
        "shot_id": shot_id,
        "applied_angle": req.angle,
        "image_url": f"/outputs/images/{shot_id}.png",
    }

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

    invalidate_storyboard_cache()
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

    invalidate_storyboard_cache()
    log_message(f"Đã cập nhật ảnh tùy chỉnh cho phân cảnh '{req.shot_id}'.")
    return {
        "success": True,
        "shot_id": req.shot_id,
        "image_url": f"/api/outputs/images/{req.shot_id}.png?t={int(time.time())}"
    }

class ApproveShotRequest(BaseModel):
    shot_id: str
    approved: bool = True

@app.post("/api/storyboard/approve-shot")
def approve_shot(req: ApproveShotRequest):
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    try:
        with open(sb_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        target = None
        for s in data.get("shots", []):
            if s.get("id") == req.shot_id:
                s["is_approved"] = req.approved
                target = s
                break

        if not target:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy phân cảnh '{req.shot_id}'")

        atomic_write_json(sb_file, data, backup=True)

        invalidate_storyboard_cache()
        status_str = "Đã duyệt" if req.approved else "Đã bỏ duyệt"
        log_message(f"[Approval] {status_str} phân cảnh '{req.shot_id}'.")
        return {"success": True, "shot_id": req.shot_id, "is_approved": req.approved}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RenderShotAudioRequest(BaseModel):
    shot_id: str

@app.post("/api/storyboard/render-shot-audio")
def render_shot_audio(req: RenderShotAudioRequest):
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    try:
        from studio.storyboard import parse_storyboard_json
        from studio.tts import generate_audio_for_shot

        with open(sb_file, "r", encoding="utf-8") as f:
            raw_text = f.read()
        sb = parse_storyboard_json(raw_text)

        target_shot = None
        for s in sb.shots:
            if s.id == req.shot_id:
                target_shot = s
                break

        if not target_shot:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy phân cảnh '{req.shot_id}'")

        audio_dir = Path("outputs/audio")
        audio_dir.mkdir(parents=True, exist_ok=True)

        log_message(f"[Audio] Đang tạo giọng đọc riêng cho phân cảnh '{req.shot_id}'...")
        audio_path = generate_audio_for_shot(
            shot=target_shot,
            characters=sb.characters,
            output_dir=audio_dir,
            lang=sb.language or "vi",
            overwrite=True,
        )

        dur = 5.0
        if audio_path and audio_path.exists():
            from studio.tts import get_audio_duration
            try:
                dur = get_audio_duration(audio_path)
            except Exception:
                dur = target_shot.duration or 5.0
        else:
            dur = target_shot.duration or 5.0

        # Backup raw speech and mix ambient SFX & custom volume gains
        raw_copy = audio_dir / f"raw_{req.shot_id}.mp3"
        if audio_path and audio_path.exists():
            shutil.copy2(str(audio_path), str(raw_copy))

        from studio.assembly import mix_sfx_into_shot_audio
        v_vol = float(getattr(target_shot, "voice_volume", 1.0) or 1.0)
        s_vol = float(getattr(target_shot, "sfx_volume", 1.0) or 1.0)
        log_message(f"[Audio] Hòa âm giọng đọc (Vol {int(v_vol*100)}%) & SFX '{getattr(target_shot, 'sfx', None)}' (Vol {int(s_vol*100)}%) vào '{req.shot_id}'...")
        mix_sfx_into_shot_audio(
            speech_audio_path=raw_copy if (audio_path and raw_copy.exists()) else None,
            sfx_str=getattr(target_shot, "sfx", None),
            shot_duration=dur,
            output_path=audio_dir / f"{req.shot_id}.mp3",
            voice_volume=v_vol,
            sfx_volume=s_vol,
        )
        audio_path = audio_dir / f"{req.shot_id}.mp3"

        with open(sb_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        for s in data.get("shots", []):
            if s.get("id") == req.shot_id:
                s["duration"] = round(dur, 2)
                break
        atomic_write_json(sb_file, data, backup=True)

        # If a video clip exists, fast-remux with the new audio so video preview is updated in ~50ms
        vid_file = Path(f"outputs/videos/{req.shot_id}.mp4")
        if vid_file.exists() and audio_path and audio_path.exists():
            fast_remux_video_audio(vid_file, audio_path)

        invalidate_storyboard_cache()
        log_message(f"[Audio] Hoàn thành giọng đọc '{req.shot_id}' ({dur:.1f}s).")
        return {
            "success": True,
            "shot_id": req.shot_id,
            "audio_url": f"/api/outputs/audio/{req.shot_id}.mp3?t={int(time.time())}" if (audio_path and audio_path.exists()) else None,
            "duration": dur,
        }
    except HTTPException:
        raise
    except Exception as e:
        log_message(f"[Audio Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

class RemuxShotVideoRequest(BaseModel):
    shot_id: str

@app.post("/api/storyboard/remux-shot-video")
def remux_shot_video(req: RemuxShotVideoRequest):
    vid_file = Path(f"outputs/videos/{req.shot_id}.mp4")
    audio_file = Path(f"outputs/audio/{req.shot_id}.mp3")
    if not vid_file.exists():
        raise HTTPException(status_code=404, detail=f"Phân cảnh '{req.shot_id}' chưa có video để ghép lại audio.")
    if not audio_file.exists() or audio_file.stat().st_size == 0:
        raise HTTPException(status_code=404, detail=f"Phân cảnh '{req.shot_id}' chưa có file audio hợp lệ để ghép vào video.")

    success = fast_remux_video_audio(vid_file, audio_file)
    if not success:
        raise HTTPException(status_code=500, detail="Không thể ghép lại audio vào video clip.")

    invalidate_storyboard_cache()
    log_message(f"[FastRemux] Đã ghép lại âm thanh vào video clip '{req.shot_id}'.")
    return {
        "success": True,
        "shot_id": req.shot_id,
        "video_url": f"/api/outputs/videos/{req.shot_id}.mp4?t={int(time.time())}"
    }

class RenderShotVideoRequest(BaseModel):
    shot_id: str
    engine: Optional[str] = None
    video_api_token: Optional[str] = None
    video_model: Optional[str] = None
    subtitle_style: Optional[str] = "tiktok_bold"
    subtitle_position: Optional[str] = "bottom"
    subtitle_karaoke: Optional[bool] = False
    bgm_preset: Optional[str] = "cinematic"
    bgm_volume: Optional[float] = 0.7
    ducking_level: Optional[str] = "medium"
    voice_volume: Optional[float] = 1.0
    color_lut: Optional[str] = "teal_and_orange"
    transition_preset: Optional[str] = "dissolve"
    transition_duration: Optional[float] = 0.6

@app.post("/api/storyboard/render-shot-video")
def render_shot_video(req: RenderShotVideoRequest):
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    try:
        from studio.storyboard import parse_storyboard_json
        from studio.motion import render_motion_for_shot
        from studio.images import _create_fallback_image, generate_image_for_shot

        with open(sb_file, "r", encoding="utf-8") as f:
            raw_text = f.read()
        sb = parse_storyboard_json(raw_text)

        target_shot = None
        for s in sb.shots:
            if s.id == req.shot_id:
                target_shot = s
                break

        if not target_shot:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy phân cảnh '{req.shot_id}'")

        img_dir = Path("outputs/images")
        audio_dir = Path("outputs/audio")
        vid_dir = Path("outputs/videos")
        vid_dir.mkdir(parents=True, exist_ok=True)

        aspect_ratio = getattr(last_produce_request, "aspect_ratio", "16:9") if last_produce_request else "16:9"
        style = getattr(last_produce_request, "style", "cinematic") if last_produce_request else "cinematic"
        motion_engine = req.engine or (getattr(last_produce_request, "motion", "kenburns") if last_produce_request else "kenburns")
        video_token = req.video_api_token or (getattr(last_produce_request, "video_api_token", None) if last_produce_request else None)
        video_mdl = req.video_model or (getattr(last_produce_request, "video_model", "wan-video/wan-2.1-i2v-480p") if last_produce_request else "wan-video/wan-2.1-i2v-480p")

        img_path = img_dir / f"{target_shot.id}.png"
        if not img_path.exists() or img_path.stat().st_size < 1000:
            img_path = generate_image_for_shot(
                shot=target_shot,
                characters=sb.characters,
                style=style,
                output_dir=img_dir,
                aspect_ratio=aspect_ratio,
            )
            if not img_path or not img_path.exists():
                img_path = img_dir / f"{target_shot.id}.png"
                w, h = (720, 1280) if aspect_ratio == "9:16" else (1280, 720)
                _create_fallback_image(img_path, width=w, height=h, label=target_shot.image_prompt or target_shot.id)

        audio_path = audio_dir / f"{target_shot.id}.mp3"
        dur = target_shot.duration or 5.0
        if not audio_path.exists() or audio_path.stat().st_size == 0:
            from studio.tts import generate_audio_for_shot, get_audio_duration
            speech_path = generate_audio_for_shot(
                shot=target_shot,
                characters=sb.characters,
                output_dir=audio_dir,
                lang=sb.language or "vi",
            )
            if speech_path and speech_path.exists():
                dur = get_audio_duration(speech_path)
            raw_copy = audio_dir / f"raw_{target_shot.id}.mp3"
            if speech_path and speech_path.exists():
                shutil.copy2(str(speech_path), str(raw_copy))
            if getattr(target_shot, "sfx", None):
                from studio.assembly import mix_sfx_into_shot_audio
                mix_sfx_into_shot_audio(
                    speech_audio_path=raw_copy if raw_copy.exists() else None,
                    sfx_str=target_shot.sfx,
                    shot_duration=dur,
                    output_path=audio_path,
                )
        elif audio_path.exists():
            try:
                from pydub import AudioSegment
                seg = AudioSegment.from_file(str(audio_path))
                dur = max(2.5, len(seg) / 1000.0)
            except Exception:
                pass

        out_video = vid_dir / f"{target_shot.id}.mp4"
        log_message(f"[Motion] Đang render video clip cho phân cảnh '{req.shot_id}' ({dur:.1f}s)...")

        render_motion_for_shot(
            image_path=img_path,
            output_path=out_video,
            duration=dur,
            motion_type=target_shot.motion or "zoom_in",
            engine=motion_engine,
            prompt=target_shot.image_prompt,
            aspect_ratio=aspect_ratio,
            letterbox=getattr(last_produce_request, "letterbox", False) if last_produce_request else False,
            style=style,
            video_api_token=video_token,
            video_model=video_mdl,
        )

        # Mux with audio if available for rich shot preview
        if audio_path.exists() and audio_path.stat().st_size > 0:
            temp_vid = vid_dir / f"temp_{target_shot.id}.mp4"
            try:
                out_video.rename(temp_vid)
                mux_cmd = [
                    "ffmpeg", "-y",
                    "-i", str(temp_vid),
                    "-i", str(audio_path),
                    "-c:v", "copy",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-shortest",
                    "-movflags", "+faststart",
                    str(out_video)
                ]
                subprocess.run(mux_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                temp_vid.unlink(missing_ok=True)
            except Exception as exc:
                log_message(f"[Motion Warning] Không thể ghép audio vào clip: {exc}")
                if temp_vid.exists() and not out_video.exists():
                    temp_vid.rename(out_video)

        invalidate_storyboard_cache()
        log_message(f"[Motion] Hoàn tất clip phân cảnh '{req.shot_id}.mp4'.")
        return {
            "success": True,
            "shot_id": req.shot_id,
            "video_url": f"/api/outputs/videos/{req.shot_id}.mp4?t={int(time.time())}",
            "duration": dur,
        }
    except HTTPException:
        raise
    except Exception as e:
        log_message(f"[Motion Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

class AssembleMasterRequest(BaseModel):
    hardsub: Optional[bool] = None
    aspect_ratio: Optional[str] = None
    style: Optional[str] = None
    subtitle_style: Optional[str] = None
    subtitle_position: Optional[str] = None
    subtitle_karaoke: Optional[bool] = None
    bgm_preset: Optional[str] = None
    bgm_volume: Optional[float] = None
    ducking_level: Optional[str] = None
    voice_volume: Optional[float] = None
    color_lut: Optional[str] = None
    transition_preset: Optional[str] = None
    transition_duration: Optional[float] = None

@app.post("/api/storyboard/assemble-master")
def assemble_master(req: AssembleMasterRequest):
    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    try:
        from studio.storyboard import parse_storyboard_json
        from studio.assembly import run_assembly_stage
        from studio.config import StudioConfig
        from studio.state import StateManager

        with open(sb_file, "r", encoding="utf-8") as f:
            raw_text = f.read()
        sb = parse_storyboard_json(raw_text)

        vid_dir = Path("outputs/videos")
        missing_clips = [s.id for s in sb.shots if not (vid_dir / f"{s.id}.mp4").exists() or (vid_dir / f"{s.id}.mp4").stat().st_size < 1000]
        if missing_clips:
            raise HTTPException(
                status_code=400,
                detail=f"Còn {len(missing_clips)} phân cảnh chưa được render video: {', '.join(missing_clips[:4])}. Vui lòng bấm 'Render Clip' cho các phân cảnh này trước khi xuất bản."
            )

        eff_style = req.style or (getattr(last_produce_request, "style", "cinematic") if last_produce_request else "cinematic")
        eff_ratio = req.aspect_ratio or (getattr(last_produce_request, "aspect_ratio", "16:9") if last_produce_request else "16:9")
        eff_hardsub = req.hardsub if req.hardsub is not None else (getattr(last_produce_request, "hardsub", False) if last_produce_request else False)
        eff_sub_style = req.subtitle_style or (getattr(last_produce_request, "subtitle_style", "tiktok_bold") if last_produce_request else "tiktok_bold")
        eff_sub_pos = req.subtitle_position or (getattr(last_produce_request, "subtitle_position", "bottom") if last_produce_request else "bottom")
        eff_sub_karaoke = req.subtitle_karaoke if req.subtitle_karaoke is not None else (getattr(last_produce_request, "subtitle_karaoke", False) if last_produce_request else False)
        eff_bgm_preset = req.bgm_preset or (getattr(last_produce_request, "bgm_preset", "cinematic") if last_produce_request else "cinematic")
        eff_bgm_volume = req.bgm_volume if req.bgm_volume is not None else (getattr(last_produce_request, "bgm_volume", 0.7) if last_produce_request else 0.7)
        eff_ducking = req.ducking_level or (getattr(last_produce_request, "ducking_level", "medium") if last_produce_request else "medium")
        eff_voice_vol = req.voice_volume if req.voice_volume is not None else (getattr(last_produce_request, "voice_volume", 1.0) if last_produce_request else 1.0)
        eff_color_lut = req.color_lut if req.color_lut is not None else (getattr(last_produce_request, "color_lut", "teal_and_orange") if last_produce_request else "teal_and_orange")
        eff_trans = req.transition_preset if req.transition_preset is not None else (getattr(last_produce_request, "transition_preset", "dissolve") if last_produce_request else "dissolve")
        eff_trans_dur = req.transition_duration if req.transition_duration is not None else (getattr(last_produce_request, "transition_duration", 0.6) if last_produce_request else 0.6)

        cfg = StudioConfig(
            topic=sb.title,
            lang=sb.language,
            style=eff_style,
            aspect_ratio=eff_ratio,
            hardsub=eff_hardsub,
            subtitle_style=eff_sub_style,
            subtitle_position=eff_sub_pos,
            subtitle_karaoke=eff_sub_karaoke,
            bgm_preset=eff_bgm_preset,
            bgm_volume=float(eff_bgm_volume),
            ducking_level=eff_ducking,
            voice_volume=float(eff_voice_vol),
            color_lut=eff_color_lut,
            transition_preset=eff_trans,
            transition_duration=float(eff_trans_dur),
            output_dir=Path("outputs"),
        )
        state_file = Path("outputs/state.json")
        state = StateManager(state_file)

        audio_dir = Path("outputs/audio")
        durations = {}
        for s in sb.shots:
            a_file = audio_dir / f"{s.id}.mp3"
            if a_file.exists():
                try:
                    from pydub import AudioSegment
                    durations[s.id] = len(AudioSegment.from_file(str(a_file))) / 1000.0
                except Exception:
                    durations[s.id] = s.duration or 5.0
            else:
                durations[s.id] = s.duration or 5.0

        log_message("[Assembly] Bắt đầu ghép nối các video clip và hòa âm master audio...")
        final_video = run_assembly_stage(
            storyboard=sb,
            config=cfg,
            state=state,
            durations=durations,
            progress_callback=lambda st, msg, pct, lmsg: log_message(lmsg),
        )

        pipeline_state["final_video"] = f"/api/outputs/final/{final_video.name}"
        pipeline_state["stage"] = 5
        pipeline_state["stage_name"] = "Hoàn tất"
        pipeline_state["progress"] = 100

        log_message(f"[Assembly] Thành công xuất bản video hoàn chỉnh: {final_video.name}")
        return {
            "success": True,
            "video_url": f"/api/outputs/final/{final_video.name}",
            "filename": final_video.name,
        }
    except HTTPException:
        raise
    except Exception as e:
        log_message(f"[Assembly Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
            if item.name == "projects":
                continue
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

@app.get("/api/projects/{project_id}/export-timeline")
def export_project_timeline(
    project_id: str,
    format: str = "fcpxml",
    aspect_ratio: Optional[str] = None,
    fps: int = 25,
):
    project_dir = Path("outputs/projects") / project_id
    if not project_dir.exists() or not project_dir.is_dir():
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án trong thư viện.")

    sb_file = project_dir / "storyboard.json"
    if not sb_file.exists():
        sb_file = Path("outputs/storyboard.json")
        if not sb_file.exists():
            raise HTTPException(status_code=404, detail="Dự án không có dữ liệu storyboard.json")

    meta_file = project_dir / "metadata.json"
    resolved_aspect = aspect_ratio
    if not resolved_aspect and meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
                resolved_aspect = meta.get("aspect_ratio", "16:9")
        except Exception:
            pass
    if not resolved_aspect:
        resolved_aspect = "16:9"

    try:
        raw_text = sb_file.read_text(encoding="utf-8")
        sb = parse_storyboard_json(raw_text)

        export_file = project_dir / f"timeline_{project_id}.fcpxml"
        generate_fcpxml(
            storyboard=sb,
            output_path=export_file,
            aspect_ratio=resolved_aspect,
            fps=fps,
            project_dir=project_dir,
        )

        filename = f"timeline_{project_id}.fcpxml"
        return FileResponse(
            path=export_file,
            media_type="application/xml",
            filename=filename,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xuất timeline dự án: {str(e)}")

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
        atomic_write_json(meta_file, meta, backup=False)
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
    atomic_write_json(meta_file, meta, backup=False)

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
                atomic_write_json(sb_file, sb_data, backup=True)
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
                atomic_write_json(sb_file, sb_data, backup=True)
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

@app.get("/api/system/subtitle-presets")
def api_get_subtitle_presets():
    from studio.subtitles import get_subtitle_presets
    return get_subtitle_presets()

@app.get("/api/storyboard/subtitles/{sub_format}")
def download_active_storyboard_subtitles(sub_format: str):
    fmt = sub_format.lower().strip()
    if fmt not in ("srt", "ass"):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ định dạng phụ đề srt hoặc ass.")

    sb_file = Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    final_dir = Path("outputs/final")
    if final_dir.exists():
        candidates = list(final_dir.glob(f"*.{fmt}"))
        if candidates:
            sub_file = sorted(candidates, key=lambda f: f.stat().st_mtime, reverse=True)[0]
            media_type = "text/plain" if fmt == "srt" else "text/x-ssa"
            return FileResponse(
                str(sub_file),
                media_type=media_type,
                filename=f"movie.{fmt}",
                headers={"Content-Disposition": f'attachment; filename="movie.{fmt}"'}
            )

    from studio.storyboard import parse_storyboard_json
    from studio.subtitles import generate_srt, generate_ass
    with open(sb_file, "r", encoding="utf-8") as f:
        sb = parse_storyboard_json(f.read())

    durations = {s.id: float(s.duration or 5.0) for s in sb.shots}
    out_file = Path("outputs") / f"active_subtitles.{fmt}"
    if fmt == "srt":
        generate_srt(sb, durations, out_file)
        media_type = "text/plain"
    else:
        generate_ass(sb, durations, out_file, preset_id="tiktok_bold", aspect_ratio="16:9")
        media_type = "text/x-ssa"

    return FileResponse(
        str(out_file),
        media_type=media_type,
        filename=f"movie.{fmt}",
        headers={"Content-Disposition": f'attachment; filename="movie.{fmt}"'}
    )

@app.get("/api/projects/{project_id}/subtitles/{sub_format}")
def download_project_subtitles(project_id: str, sub_format: str):
    fmt = sub_format.lower().strip()
    if fmt not in ("srt", "ass"):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ định dạng phụ đề srt hoặc ass.")

    project_dir = Path("outputs/projects") / project_id
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")

    # 1. Search for existing srt/ass files in project directory
    candidates = list(project_dir.glob(f"*.{fmt}"))
    if candidates:
        sub_file = sorted(candidates, key=lambda f: f.stat().st_mtime, reverse=True)[0]
        media_type = "text/plain" if fmt == "srt" else "text/x-ssa"
        return FileResponse(
            str(sub_file),
            media_type=media_type,
            filename=f"{project_id}.{fmt}",
            headers={"Content-Disposition": f'attachment; filename="{project_id}.{fmt}"'}
        )

    # 2. If not pre-rendered, but storyboard.json exists, generate on-the-fly!
    sb_path = project_dir / "storyboard.json"
    if not sb_path.exists():
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file phụ đề .{fmt} hoặc kịch bản của dự án.")

    from studio.storyboard import parse_storyboard_json
    from studio.subtitles import generate_srt, generate_ass
    with open(sb_path, "r", encoding="utf-8") as f:
        sb = parse_storyboard_json(f.read())

    durations = {s.id: float(s.duration or 5.0) for s in sb.shots}
    meta_file = project_dir / "metadata.json"
    sub_style = "tiktok_bold"
    aspect_ratio = "16:9"
    if meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as mf:
                m = json.load(mf)
                sub_style = m.get("subtitle_style", "tiktok_bold")
                aspect_ratio = m.get("aspect_ratio", "16:9")
        except Exception:
            pass

    out_file = project_dir / f"generated_{fmt}.{fmt}"
    if fmt == "srt":
        generate_srt(sb, durations, out_file)
        media_type = "text/plain"
    else:
        generate_ass(sb, durations, out_file, preset_id=sub_style, aspect_ratio=aspect_ratio)
        media_type = "text/x-ssa"

    return FileResponse(
        str(out_file),
        media_type=media_type,
        filename=f"{project_id}.{fmt}",
        headers={"Content-Disposition": f'attachment; filename="{project_id}.{fmt}"'}
    )

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    p_dir = Path("outputs/projects") / project_id
    if not p_dir.exists() or not p_dir.is_dir():
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án trong thư viện.")

    shutil.rmtree(p_dir, ignore_errors=True)
    return {"success": True, "message": f"Đã xóa dự án {project_id}"}


class CloneVoiceRequest(BaseModel):
    name: str
    provider: str = "local"  # "elevenlabs" | "local"
    audio_base64: str
    audio_filename: Optional[str] = "sample.mp3"
    description: Optional[str] = None
    api_key: Optional[str] = None
    api_url: Optional[str] = None
    lang: str = "vi"
    gender: str = "neutral"


class VoicePreviewRequest(BaseModel):
    text: str
    voice_id: str
    provider: str = "edge"
    lang: str = "vi"
    api_key: Optional[str] = None
    api_url: Optional[str] = None


class CreateDubbingRequest(BaseModel):
    project_id: str
    target_lang: str
    voice_mapping: Optional[Dict[str, str]] = None


@app.get("/api/voice/list")
def api_get_voice_list():
    from studio.voice_clone import get_all_voices
    voices = get_all_voices()
    return [v.to_dict() for v in voices]


@app.post("/api/voice/clone")
def api_clone_voice(req: CloneVoiceRequest):
    import base64
    import uuid
    from studio.voice_clone import clone_voice

    b64 = req.audio_base64
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    raw_bytes = base64.b64decode(b64)

    temp_dir = Path("outputs/temp")
    temp_dir.mkdir(parents=True, exist_ok=True)
    fname = req.audio_filename or "sample.mp3"
    tmp_file = temp_dir / f"upload_{uuid.uuid4().hex[:8]}_{fname}"
    tmp_file.write_bytes(raw_bytes)

    try:
        profile = clone_voice(
            provider=req.provider,
            name=req.name,
            audio_path=tmp_file,
            api_key=req.api_key,
            api_url=req.api_url,
            description=req.description,
            lang=req.lang,
            gender=req.gender,
        )
        return profile.to_dict()
    finally:
        if tmp_file.exists():
            tmp_file.unlink(missing_ok=True)


@app.post("/api/voice/preview")
def api_preview_voice(req: VoicePreviewRequest):
    import uuid
    from studio.voice_clone import synthesize_speech

    temp_dir = Path("outputs/temp")
    temp_dir.mkdir(parents=True, exist_ok=True)
    preview_file = temp_dir / f"prev_{uuid.uuid4().hex[:8]}.mp3"

    try:
        synthesize_speech(
            text=req.text,
            voice_id=req.voice_id,
            provider=req.provider,
            output_path=preview_file,
            lang=req.lang,
            api_key=req.api_key,
            api_url=req.api_url,
        )
        return {
            "success": True,
            "audio_url": f"/api/outputs/temp/{preview_file.name}",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi thử giọng: {exc}")


@app.post("/api/dubbing/create")
def api_create_dubbing(req: CreateDubbingRequest):
    from studio.dubbing import run_dubbing_pipeline

    try:
        result = run_dubbing_pipeline(
            project_id=req.project_id,
            target_lang=req.target_lang,
            voice_mapping=req.voice_mapping,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lồng tiếng: {exc}")


class ReframeRequest(BaseModel):
    project_id: str
    mode: str = "blur_padding"  # "blur_padding" | "pan_scan" | "fit_center"
    burn_subtitles: bool = True


@app.get("/api/reframe/presets")
def api_get_reframe_presets():
    from studio.reframe import get_reframe_presets
    return get_reframe_presets()


@app.post("/api/reframe/create")
def api_create_reframe(req: ReframeRequest):
    from studio.reframe import reframe_video

    project_dir = Path("outputs/projects") / req.project_id
    if not project_dir.exists():
        project_dir = Path("outputs")

    # Locate input video (master_movie.mp4 or first mp4)
    input_video = project_dir / "master_movie.mp4"
    if not input_video.exists():
        input_video = Path("outputs/master_movie.mp4")
    if not input_video.exists():
        candidates = [f for f in project_dir.glob("*.mp4") if "9_16" not in f.name]
        if candidates:
            input_video = sorted(candidates, key=lambda f: f.stat().st_size, reverse=True)[0]

    if not input_video.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp video 16:9 để chuyển đổi.")

    # Locate subtitle if requested
    subtitle_path = None
    if req.burn_subtitles:
        sub_candidates = list(project_dir.glob("*.srt")) or list(Path("outputs").glob("*.srt"))
        if sub_candidates:
            subtitle_path = sub_candidates[0]

    out_file = project_dir / f"master_movie_9_16_{req.mode}.mp4"

    try:
        reframe_video(
            input_path=input_video,
            output_path=out_file,
            mode=req.mode,
            subtitle_path=subtitle_path,
        )
        rel_url = f"/api/outputs/projects/{req.project_id}/{out_file.name}" if req.project_id != "current" and "outputs/projects" in str(project_dir) else f"/api/outputs/{out_file.name}"
        return {
            "success": True,
            "filename": out_file.name,
            "video_url": rel_url,
            "mode": req.mode,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi chuyển đổi video dọc 9:16: {exc}")



@app.get("/api/outputs/{file_path:path}")
def serve_output_file(file_path: str):
    full_path = Path("outputs") / file_path
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="File không tồn tại",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
        )
    return FileResponse(
        str(full_path),
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
    )

# Mount frontend dist static files if built
dist_dir = Path("web/dist")
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("studio.server:app", host="0.0.0.0", port=8000, reload=True)
