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
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    fontfile_arg = ""
    for fc in font_candidates:
        if os.path.exists(fc):
            fontfile_arg = f":fontfile='{fc}'"
            break

    vf_filters = [
        f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}",
        "eq=contrast=1.15:brightness=0.02:saturation=1.2",
        f"drawbox=y={box_y}:color=black@0.65:width=iw:height=ih*0.35:t=fill",
        f"drawtext=textfile='{title_file}'{fontfile_arg}:fontsize={fontsize}:fontcolor=yellow:x=(w-text_w)/2:y={text_y}:shadowcolor=black@0.9:shadowx=3:shadowy=3",
    ]
    vf_string = ",".join(vf_filters)

    cmd = [
        "ffmpeg", "-y",
        "-i", str(source_path),
        "-vf", vf_string,
        "-vframes", "1",
        "-q:v", "2",
        str(out_thumb)
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

    dest_video = project_dir / final_video_path.name
    shutil.copy2(str(final_video_path), str(dest_video))

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

    thumb_name = None
    images_dir = Path("outputs/images")
    if images_dir.exists():
        img_files = sorted(list(images_dir.glob("*.png")))
        if img_files:
            dest_thumb = project_dir / "thumb.png"
            shutil.copy2(str(img_files[0]), str(dest_thumb))
            thumb_name = "thumb.png"

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
        res = subprocess.run(mux_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        temp_vid.unlink(missing_ok=True)
        return True
    except Exception as exc:
        log_message(f"[FastRemux Warning] Không thể ghép lại audio vào video clip: {exc}")
        if temp_vid.exists() and not vid_file.exists():
            temp_vid.rename(vid_file)
        return False

# --- Core Status & System Endpoints ---

@app.get("/api/status")
def get_status():
    global _status_sb_mtime, _status_shots_count_cache
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
    from studio.image_providers import discover_image_engines
    return discover_image_engines()

class TestImageEngineRequest(BaseModel):
    engine: str = "pollinations"
    url: Optional[str] = None

@app.post("/api/settings/test-image-engine")
def test_image_engine(req: TestImageEngineRequest):
    from studio.image_providers import get_image_provider
    provider = get_image_provider(req.engine, api_url=req.url)
    return provider.check_health()

@app.get("/api/system/video-models")
def get_system_video_models():
    from studio.video_providers import get_available_video_models
    return get_available_video_models()

class TestVideoTokenRequest(BaseModel):
    token: str

@app.post("/api/settings/test-video-token")
def test_video_token_endpoint(req: TestVideoTokenRequest):
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

@app.websocket("/ws/pipeline")
async def websocket_pipeline_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_websockets.append(websocket)
    try:
        await websocket.send_json({"type": "status", "data": get_status()})
        while True:
            text = await websocket.receive_text()
            if text == "ping":
                await websocket.send_json({"type": "pong"})
    except (WebSocketDisconnect, Exception):
        if websocket in active_websockets:
            active_websockets.remove(websocket)

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

# --- Include Domain Routers ---
from studio.routers.storyboard import router as storyboard_router
from studio.routers.vault import router as vault_router
from studio.routers.audio import router as audio_router
from studio.routers.video import router as video_router
from studio.routers.projects import router as projects_router

app.include_router(storyboard_router)
app.include_router(vault_router)
app.include_router(audio_router)
app.include_router(video_router)
app.include_router(projects_router)

# --- Re-export Request Models for backwards compatibility ---
from studio.routers.storyboard import (
    UpdateShotRequest, AddShotRequest, DeleteShotRequest,
    ReorderShotsRequest, SplitShotRequest, MultiAngleCoverageRequest,
    ApplyAngleRequest, RerollShotRequest, UploadShotImageRequest,
    ApproveShotRequest, UpdateVoiceRequest
)
from studio.routers.vault import (
    GenerateHeadshotRequest, SaveVaultCharacterRequest,
    ImportVaultCharacterRequest, GenerateAnglesRequest, UploadHeadshotRequest
)
from studio.routers.audio import (
    SfxSuggestRequest, BatchSfxSuggestRequest, UploadBgmRequest,
    DubProjectRequest, CloneVoiceRequest, CreateDubbingRequest,
    RenderShotAudioRequest, AVAILABLE_SFX
)
from studio.routers.video import (
    RemuxShotVideoRequest, RenderShotVideoRequest, AssembleMasterRequest,
    ReframeRequest, EnhanceShotRequest, EnhanceMasterRequest
)
from studio.routers.projects import GenerateThumbnailRequest

# Mount frontend dist static files if built
dist_dir = Path("web/dist")
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("studio.server:app", host="0.0.0.0", port=8000, reload=True)
