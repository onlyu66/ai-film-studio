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
    aspect_ratio: str = "16:9"
    hardsub: bool = False
    pause_after_script: bool = False

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

def log_message(msg: str):
    timestamp = time.strftime("%H:%M:%S")
    formatted = f"[{timestamp}] {msg}"
    pipeline_state["logs"].append(formatted)
    if len(pipeline_state["logs"]) > 200:
        pipeline_state["logs"] = pipeline_state["logs"][-200:]

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

    metadata = {
        "id": project_id,
        "title": title,
        "topic": req.topic,
        "lang": req.lang,
        "style": req.style,
        "duration": req.duration,
        "aspect_ratio": getattr(req, "aspect_ratio", "16:9"),
        "hardsub": getattr(req, "hardsub", False),
        "created_at": timestamp,
        "video_file": final_video_path.name,
        "srt_file": srt_name,
        "thumb_file": thumb_name,
        "shots_count": shots_count,
    }
    with open(project_dir / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

def execute_pipeline_task(req: ProduceRequest, resume_only: bool = False):
    global pipeline_state, last_produce_request
    last_produce_request = req
    pipeline_state["status"] = "running"
    pipeline_state["topic"] = req.topic
    pipeline_state["error"] = None

    try:
        cfg = StudioConfig(
            topic=req.topic,
            lang=req.lang,
            duration=req.duration,
            style=req.style,
            llm_provider=req.llm,
            motion_engine=req.motion,
            lip_sync=req.lip_sync,
            aspect_ratio=req.aspect_ratio,
            hardsub=req.hardsub,
            output_dir=Path("outputs"),
        )

        if not resume_only and req.pause_after_script:
            pipeline_state["stage"] = 1
            pipeline_state["stage_name"] = "Đang soạn kịch bản & phân cảnh..."
            pipeline_state["progress"] = 20
            log_message(f"Soạn kịch bản: {req.topic} ({req.lang}, {req.duration}m, {req.style})")

            run_pipeline(cfg, stop_after_stage=1)

            pipeline_state["status"] = "script_ready"
            pipeline_state["stage"] = 1
            pipeline_state["stage_name"] = "Kịch bản đã sẵn sàng - Chờ duyệt"
            pipeline_state["progress"] = 20
            log_message("Kịch bản và phân cảnh đã được tạo xong! Bạn có thể chỉnh sửa lời thoại, nhân vật và giọng đọc trước khi bấm 'Tiếp tục sản xuất phim'.")
            return

        pipeline_state["stage"] = 2
        pipeline_state["stage_name"] = "Đang sản xuất phim (Stages 2 - 5)..."
        pipeline_state["progress"] = 40
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
        log_message(f"Thành công! Video đã hoàn thành: {final_video_path.name}")

        try:
            save_project_to_library(final_video_path, req)
        except Exception as save_err:
            log_message(f"Cảnh báo: không thể lưu vào thư viện dự án: {save_err}")

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

                    meta["video_url"] = f"/api/outputs/projects/{p_id}/{video_file}" if video_file else None
                    meta["srt_url"] = f"/api/outputs/projects/{p_id}/{srt_file}" if srt_file else None
                    meta["thumb_url"] = f"/api/outputs/projects/{p_id}/{thumb_file}" if thumb_file else None
                    projects.append(meta)
                except Exception:
                    pass
    return projects

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
