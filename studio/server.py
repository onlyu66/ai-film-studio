from pathlib import Path
from typing import Optional, List, Dict, Any
import threading
import json
import shutil
import time

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from studio.config import StudioConfig
from studio.orchestrator import run_pipeline

app = FastAPI(title="AI Film Studio API", version="1.0.0")

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
    motion: str = "kenburns"
    lip_sync: str = "none"

# Global pipeline execution state
pipeline_state: Dict[str, Any] = {
    "status": "idle",       # idle, running, completed, error
    "stage": 0,            # 0 to 5
    "stage_name": "Sẵn sàng",
    "progress": 0,         # 0 - 100
    "topic": "",
    "logs": [],
    "error": None,
    "final_video": None,
    "final_srt": None,
}

def log_message(msg: str):
    timestamp = time.strftime("%H:%M:%S")
    formatted = f"[{timestamp}] {msg}"
    pipeline_state["logs"].append(formatted)
    if len(pipeline_state["logs"]) > 200:
        pipeline_state["logs"] = pipeline_state["logs"][-200:]

def execute_pipeline_task(req: ProduceRequest):
    global pipeline_state
    pipeline_state["status"] = "running"
    pipeline_state["stage"] = 1
    pipeline_state["stage_name"] = "Soạn kịch bản & Phân cảnh..."
    pipeline_state["progress"] = 15
    pipeline_state["topic"] = req.topic
    pipeline_state["error"] = None
    pipeline_state["final_video"] = None
    pipeline_state["final_srt"] = None
    log_message(f"Khởi động sản xuất: {req.topic} ({req.lang}, {req.duration}m, {req.style})")

    try:
        cfg = StudioConfig(
            topic=req.topic,
            lang=req.lang,
            duration=req.duration,
            style=req.style,
            llm_provider=req.llm,
            motion_engine=req.motion,
            lip_sync=req.lip_sync,
            output_dir=Path("outputs"),
        )

        pipeline_state["stage"] = 2
        pipeline_state["stage_name"] = "Đang sản xuất phim (5 giai đoạn)..."
        pipeline_state["progress"] = 40
        log_message("Đang thực hiện quy trình biên tập tự động...")

        final_video_path = run_pipeline(cfg)

        pipeline_state["status"] = "completed"
        pipeline_state["stage"] = 5
        pipeline_state["stage_name"] = "Sản xuất hoàn tất!"
        pipeline_state["progress"] = 100
        pipeline_state["final_video"] = f"/api/outputs/final/{final_video_path.name}"
        srt_path = final_video_path.with_suffix(".srt")
        if srt_path.exists():
            pipeline_state["final_srt"] = f"/api/outputs/final/{srt_path.name}"
        log_message(f"Thành công! Video đã hoàn thành: {final_video_path.name}")

    except Exception as e:
        pipeline_state["status"] = "error"
        pipeline_state["error"] = str(e)
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
