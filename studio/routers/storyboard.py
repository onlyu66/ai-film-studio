from pathlib import Path
from typing import Optional, List, Dict, Any
import os
import re
import json
import shutil
import time

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

import studio.server as srv
from studio.storage import atomic_write_json, safe_read_json
from studio.storyboard import parse_storyboard_json
from studio.export_fcpxml import generate_fcpxml

router = APIRouter(tags=["storyboard"])

# --- Request Models ---

class UpdateVoiceRequest(BaseModel):
    character_id: str
    voice: str

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
    duration: Optional[float] = None

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

class DeleteShotRequest(BaseModel):
    shot_id: str

class ReorderShotsRequest(BaseModel):
    shot_ids: List[str]

class SplitShotRequest(BaseModel):
    shot_id: str
    split_at_sec: Optional[float] = None
    project_id: Optional[str] = "current"

class MultiAngleCoverageRequest(BaseModel):
    angles: Optional[List[str]] = None
    engine: Optional[str] = None
    api_url: Optional[str] = None

class ApplyAngleRequest(BaseModel):
    angle: str
    re_render_motion: bool = False

class RerollShotRequest(BaseModel):
    shot_id: str

class UploadShotImageRequest(BaseModel):
    shot_id: str
    image_base64: str

class ApproveShotRequest(BaseModel):
    shot_id: str
    approved: bool = True

# --- Endpoints ---

@router.get("/api/storyboard/templates")
def get_storyboard_templates():
    """Return all available cinematic story templates."""
    from studio.templates import list_story_templates
    return list_story_templates()

@router.get("/api/storyboard/templates/{template_id}")
def get_single_storyboard_template(template_id: str):
    """Return a single story template by ID or 404."""
    from studio.templates import get_story_template
    tmpl = get_story_template(template_id)
    if not tmpl:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' không tồn tại.")
    return tmpl

@router.get("/api/storyboard")
def get_storyboard():
    sb_file = srv.Path("outputs/storyboard.json")
    if not sb_file.exists():
        return {"title": "", "language": "vi", "characters": {}, "shots": []}
    try:
        sb_mtime = sb_file.stat().st_mtime
        img_dir = srv.Path("outputs/images")
        audio_dir = srv.Path("outputs/audio")
        vid_dir = srv.Path("outputs/videos")

        img_count = len(os.listdir(img_dir)) if img_dir.exists() else 0
        audio_count = len(os.listdir(audio_dir)) if audio_dir.exists() else 0
        vid_count = len(os.listdir(vid_dir)) if vid_dir.exists() else 0
        current_dir_counts = (img_count, audio_count, vid_count)

        with srv._sb_lock:
            if srv._sb_cache and sb_mtime == srv._sb_cached_mtime and current_dir_counts == srv._sb_cached_dir_counts:
                return srv._sb_cache

            with open(sb_file, "r", encoding="utf-8") as f:
                data = json.load(f)

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

            srv._sb_cache = data
            srv._sb_cached_mtime = sb_mtime
            srv._sb_cached_dir_counts = current_dir_counts
            return srv._sb_cache
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/storyboard/export-timeline")
def export_storyboard_timeline(
    format: str = "fcpxml",
    aspect_ratio: str = "16:9",
    fps: int = 25,
):
    sb_file = srv.Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    try:
        raw_text = sb_file.read_text(encoding="utf-8")
        sb = parse_storyboard_json(raw_text)

        export_dir = srv.Path("outputs")
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

@router.post("/api/storyboard/character-voice")
def update_character_voice(req: UpdateVoiceRequest):
    sb_file = srv.Path("outputs/storyboard.json")
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

        audio_dir = srv.Path("outputs/audio")
        vid_dir = srv.Path("outputs/videos")
        state_file = srv.Path("outputs/state.json")
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

        srv.invalidate_storyboard_cache()
        char_name = characters[req.character_id].get("name", req.character_id)
        srv.log_message(f"Đã cập nhật giọng cho nhân vật '{char_name}': {old_voice} -> {req.voice}")

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

@router.post("/api/storyboard/update-shot")
def update_shot(req: UpdateShotRequest):
    sb_file = srv.Path("outputs/storyboard.json")
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

        state_file = srv.Path("outputs/state.json")
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

        if req.duration is not None:
            new_dur = round(max(1.0, min(30.0, float(req.duration))), 2)
            if new_dur != target_shot.get("duration"):
                target_shot["duration"] = new_dur
                audio_setting_changed = True

        if req.image_prompt is not None and req.image_prompt != target_shot.get("image_prompt"):
            target_shot["image_prompt"] = req.image_prompt
            image_file = srv.Path(f"outputs/images/{req.shot_id}.png")
            image_file.unlink(missing_ok=True)
            vid_file = srv.Path(f"outputs/videos/{req.shot_id}.mp4")
            vid_file.unlink(missing_ok=True)
            if state:
                state.reset_shot(req.shot_id, "image")
                state.reset_shot(req.shot_id, "video")

        if req.motion is not None and req.motion != target_shot.get("motion"):
            target_shot["motion"] = req.motion
            vid_file = srv.Path(f"outputs/videos/{req.shot_id}.mp4")
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

        target_shot["is_approved"] = False

        audio_file = srv.Path(f"outputs/audio/{req.shot_id}.mp3")
        raw_audio_file = srv.Path(f"outputs/audio/raw_{req.shot_id}.mp3")
        vid_file = srv.Path(f"outputs/videos/{req.shot_id}.mp4")

        if audio_setting_changed:
            if speech_text_or_char_changed:
                raw_audio_file.unlink(missing_ok=True)
                audio_file.unlink(missing_ok=True)
                if state:
                    state.reset_shot(req.shot_id, "audio")
            elif raw_audio_file.exists() or audio_file.exists():
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
                    if vid_file.exists():
                        srv.fast_remux_video_audio(vid_file, audio_file)
                except Exception as remux_err:
                    srv.log_message(f"[Auto-Remux Warning] {remux_err}")

        if state:
            state.save()

        atomic_write_json(sb_file, data, backup=True)
        srv.invalidate_storyboard_cache()
        srv.log_message(f"Đã cập nhật phân cảnh '{req.shot_id}'.")
        return {"success": True, "message": f"Đã cập nhật phân cảnh {req.shot_id}", "shot": target_shot}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/storyboard/add-shot")
def add_shot(req: AddShotRequest):
    sb_file = srv.Path("outputs/storyboard.json")
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
        srv.invalidate_storyboard_cache()
        srv.log_message(f"Đã chèn thêm phân cảnh mới '{new_shot_id}'.")
        return {"success": True, "message": f"Đã thêm phân cảnh mới {new_shot_id}", "shot": new_shot}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/storyboard/delete-shot")
def delete_shot(req: DeleteShotRequest):
    sb_file = srv.Path("outputs/storyboard.json")
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

        srv.Path(f"outputs/audio/{req.shot_id}.mp3").unlink(missing_ok=True)
        srv.Path(f"outputs/images/{req.shot_id}.png").unlink(missing_ok=True)
        srv.Path(f"outputs/videos/{req.shot_id}.mp4").unlink(missing_ok=True)

        state_file = srv.Path("outputs/state.json")
        if state_file.exists():
            try:
                from studio.state import StateManager
                state = StateManager(state_file)
                state.remove_shot(req.shot_id)
                state.save()
            except Exception:
                pass

        atomic_write_json(sb_file, data, backup=True)
        srv.invalidate_storyboard_cache()
        srv.log_message(f"Đã xóa phân cảnh '{req.shot_id}'.")
        return {"success": True, "message": f"Đã xóa phân cảnh {req.shot_id}", "shot_id": req.shot_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/storyboard/reorder-shots")
def reorder_shots(req: ReorderShotsRequest):
    sb_file = srv.Path("outputs/storyboard.json")
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

        for sid, shot in shots_map.items():
            if sid not in req.shot_ids:
                reordered.append(shot)

        data["shots"] = reordered
        atomic_write_json(sb_file, data, backup=True)

        srv.invalidate_storyboard_cache()
        srv.log_message("Đã cập nhật lại thứ tự các phân cảnh trên kịch bản.")
        return {"success": True, "message": "Đã sắp xếp lại thứ tự phân cảnh", "shots_count": len(reordered)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/storyboard/split-shot")
def split_shot(req: SplitShotRequest):
    if req.project_id and req.project_id not in ("current", ""):
        sb_file = srv.Path(f"outputs/projects/{req.project_id}/storyboard.json")
    else:
        sb_file = srv.Path("outputs/storyboard.json")

    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    try:
        data = safe_read_json(sb_file)
        if not data or not isinstance(data, dict):
            raise HTTPException(status_code=400, detail="Không thể đọc tệp storyboard.json")

        shots = data.get("shots", [])
        target_idx = None
        target_shot = None
        for i, s in enumerate(shots):
            if s.get("id") == req.shot_id:
                target_idx = i
                target_shot = s
                break

        if target_shot is None or target_idx is None:
            raise HTTPException(status_code=404, detail=f"Không tìm thấy phân cảnh '{req.shot_id}'")

        total_dur = float(target_shot.get("duration", 5.0) or 5.0)
        if req.split_at_sec is not None and 0.5 <= float(req.split_at_sec) <= total_dur - 0.5:
            dur_a = round(float(req.split_at_sec), 2)
            dur_b = round(total_dur - dur_a, 2)
        else:
            dur_a = round(total_dur / 2.0, 2)
            dur_b = round(total_dur - dur_a, 2)

        target_shot["duration"] = dur_a

        shot_b = dict(target_shot)
        shot_b["id"] = f"{target_shot['id']}_b"
        shot_b["duration"] = dur_b
        shot_b["is_approved"] = False
        shot_b["has_video"] = False

        shots.insert(target_idx + 1, shot_b)
        data["shots"] = shots

        atomic_write_json(sb_file, data, backup=True)
        srv.invalidate_storyboard_cache()

        return {
            "success": True,
            "message": f"Đã chia phân cảnh {req.shot_id} thành 2 cảnh ({dur_a}s và {dur_b}s).",
            "new_shots": [target_shot, shot_b],
            "total_shots": len(shots),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/camera/presets")
def api_get_camera_presets():
    from studio.camera_director import get_camera_presets
    return get_camera_presets()

@router.post("/api/shots/{shot_id}/multi-angle")
def generate_multi_angle_for_shot(shot_id: str, req: Optional[MultiAngleCoverageRequest] = None):
    sb_file = srv.Path("outputs/storyboard.json")
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

    style = getattr(srv.last_produce_request, "style", "cinematic") if srv.last_produce_request else "cinematic"
    aspect_ratio = getattr(srv.last_produce_request, "aspect_ratio", "16:9") if srv.last_produce_request else "16:9"
    engine = (req.engine if req and req.engine else None) or (getattr(srv.last_produce_request, "image_engine", "pollinations") if srv.last_produce_request else "pollinations")
    api_url = (req.api_url if req and req.api_url else None) or (getattr(srv.last_produce_request, "image_api_url", None) if srv.last_produce_request else None)
    target_angles = req.angles if (req and req.angles) else ["wide", "medium", "close_up"]

    from studio.camera_director import render_multi_angle_coverage
    results = render_multi_angle_coverage(
        shot=shot,
        characters=characters,
        angles=target_angles,
        output_dir=srv.Path("outputs/images"),
        style=style,
        aspect_ratio=aspect_ratio,
        engine=engine,
        api_url=api_url,
    )

    target_shot["multi_angle_options"] = results
    with open(sb_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return {
        "success": True,
        "shot_id": shot_id,
        "angles": results,
    }

@router.post("/api/shots/{shot_id}/apply-angle")
def apply_multi_angle_for_shot(shot_id: str, req: ApplyAngleRequest):
    sb_file = srv.Path("outputs/storyboard.json")
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

    img_dir = srv.Path("outputs/images")
    candidate_img = img_dir / f"{shot_id}_{req.angle}.png"
    main_img = img_dir / f"{shot_id}.png"

    if not candidate_img.exists():
        raise HTTPException(status_code=400, detail=f"Chưa có ảnh góc máy '{req.angle}' cho phân cảnh này.")

    shutil.copyfile(candidate_img, main_img)
    target_shot["camera_angle"] = req.angle
    target_shot["is_approved"] = False

    vid_file = srv.Path(f"outputs/videos/{shot_id}.mp4")
    if req.re_render_motion:
        from studio.motion import render_motion_for_shot
        duration = float(target_shot.get("duration") or 5.0)
        style = getattr(srv.last_produce_request, "style", "cinematic") if srv.last_produce_request else "cinematic"
        aspect_ratio = getattr(srv.last_produce_request, "aspect_ratio", "16:9") if srv.last_produce_request else "16:9"
        motion_engine = getattr(srv.last_produce_request, "motion", "kenburns") if srv.last_produce_request else "kenburns"
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

@router.post("/api/storyboard/reroll-shot")
def reroll_shot(req: RerollShotRequest):
    import random
    from studio.images import generate_image_for_shot
    from studio.motion import render_motion_for_shot

    sb_file = srv.Path("outputs/storyboard.json")
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
    style = getattr(srv.last_produce_request, "style", "cinematic") if srv.last_produce_request else "cinematic"
    aspect_ratio = getattr(srv.last_produce_request, "aspect_ratio", "16:9") if srv.last_produce_request else "16:9"
    motion_engine = getattr(srv.last_produce_request, "motion", "kenburns") if srv.last_produce_request else "kenburns"

    img_dir = srv.Path("outputs/images")
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

    vid_dir = srv.Path("outputs/videos")
    out_vid = vid_dir / f"{req.shot_id}.mp4"
    duration = float(shot.duration or 5.0)
    audio_file = srv.Path(f"outputs/audio/{req.shot_id}.mp3")
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

    srv.invalidate_storyboard_cache()
    srv.log_message(f"Đã tạo lại ảnh và video mới cho phân cảnh '{req.shot_id}' (Seed: {new_seed}).")
    return {
        "success": True,
        "shot_id": req.shot_id,
        "image_url": f"/api/outputs/images/{req.shot_id}.png?t={int(time.time())}"
    }

@router.post("/api/storyboard/upload-shot-image")
def upload_shot_image(req: UploadShotImageRequest):
    import base64
    from studio.motion import render_motion_for_shot

    sb_file = srv.Path("outputs/storyboard.json")
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

    img_dir = srv.Path("outputs/images")
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

    vid_dir = srv.Path("outputs/videos")
    out_vid = vid_dir / f"{req.shot_id}.mp4"
    duration = float(shot_data.get("duration") or 5.0)
    audio_file = srv.Path(f"outputs/audio/{req.shot_id}.mp3")
    if audio_file.exists():
        try:
            from studio.tts import get_audio_duration
            duration = get_audio_duration(audio_file)
        except Exception:
            pass

    aspect_ratio = getattr(srv.last_produce_request, "aspect_ratio", "16:9") if srv.last_produce_request else "16:9"
    motion_engine = getattr(srv.last_produce_request, "motion", "kenburns") if srv.last_produce_request else "kenburns"

    render_motion_for_shot(
        image_path=out_img,
        output_path=out_vid,
        duration=duration,
        motion_type=shot_data.get("motion") or "zoom_in",
        engine=motion_engine,
        prompt=shot_data.get("image_prompt", ""),
        aspect_ratio=aspect_ratio
    )

    srv.invalidate_storyboard_cache()
    srv.log_message(f"Đã cập nhật ảnh tùy chỉnh cho phân cảnh '{req.shot_id}'.")
    return {
        "success": True,
        "shot_id": req.shot_id,
        "image_url": f"/api/outputs/images/{req.shot_id}.png?t={int(time.time())}"
    }

@router.post("/api/storyboard/approve-shot")
def approve_shot(req: ApproveShotRequest):
    sb_file = srv.Path("outputs/storyboard.json")
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

        srv.invalidate_storyboard_cache()
        status_str = "Đã duyệt" if req.approved else "Đã bỏ duyệt"
        srv.log_message(f"[Approval] {status_str} phân cảnh '{req.shot_id}'.")
        return {"success": True, "shot_id": req.shot_id, "is_approved": req.approved}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/storyboard/subtitles/{sub_format}")
def download_active_storyboard_subtitles(sub_format: str):
    fmt = sub_format.lower().strip()
    if fmt not in ("srt", "ass"):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ định dạng phụ đề srt hoặc ass.")

    sb_file = srv.Path("outputs/storyboard.json")
    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Chưa có kịch bản storyboard.json")

    final_dir = srv.Path("outputs/final")
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

    from studio.subtitles import generate_srt, generate_ass
    with open(sb_file, "r", encoding="utf-8") as f:
        sb = parse_storyboard_json(f.read())

    durations = {s.id: float(s.duration or 5.0) for s in sb.shots}
    out_file = srv.Path("outputs") / f"active_subtitles.{fmt}"
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
