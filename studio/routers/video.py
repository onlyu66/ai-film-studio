from pathlib import Path
from typing import Optional, List, Dict, Any
import json
import time
import shutil
import subprocess

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import studio.server as srv
from studio.storage import atomic_write_json

router = APIRouter(tags=["video"])

# --- Request Models ---

class RemuxShotVideoRequest(BaseModel):
    shot_id: str

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

class ReframeRequest(BaseModel):
    project_id: str = "current"
    mode: str = "smart_center"
    burn_subtitles: bool = True

class EnhanceShotRequest(BaseModel):
    shot_id: str
    preset_id: Optional[str] = "4k_crisp"
    project_id: Optional[str] = "current"
    custom_scale: Optional[str] = None
    custom_fps: Optional[int] = None

class EnhanceMasterRequest(BaseModel):
    preset_id: Optional[str] = "ultra_master_4k_60fps"
    project_id: Optional[str] = "current"
    custom_scale: Optional[str] = None
    custom_fps: Optional[int] = None

# --- Endpoints ---

@router.get("/api/lut/presets")
def api_get_lut_presets():
    from studio.color_grading import get_color_luts
    return get_color_luts()

@router.get("/api/transitions/presets")
def api_get_transition_presets():
    from studio.color_grading import get_scene_transitions
    return get_scene_transitions()

@router.post("/api/storyboard/remux-shot-video")
def remux_shot_video(req: RemuxShotVideoRequest):
    vid_file = srv.Path(f"outputs/videos/{req.shot_id}.mp4")
    audio_file = srv.Path(f"outputs/audio/{req.shot_id}.mp3")
    if not vid_file.exists():
        raise HTTPException(status_code=404, detail=f"Phân cảnh '{req.shot_id}' chưa có video để ghép lại audio.")
    if not audio_file.exists() or audio_file.stat().st_size == 0:
        raise HTTPException(status_code=404, detail=f"Phân cảnh '{req.shot_id}' chưa có file audio hợp lệ để ghép vào video.")

    success = srv.fast_remux_video_audio(vid_file, audio_file)
    if not success:
        raise HTTPException(status_code=500, detail="Không thể ghép lại audio vào video clip.")

    srv.invalidate_storyboard_cache()
    srv.log_message(f"[FastRemux] Đã ghép lại âm thanh vào video clip '{req.shot_id}'.")
    return {
        "success": True,
        "shot_id": req.shot_id,
        "video_url": f"/api/outputs/videos/{req.shot_id}.mp4?t={int(time.time())}"
    }

@router.post("/api/storyboard/render-shot-video")
def render_shot_video(req: RenderShotVideoRequest):
    sb_file = srv.Path("outputs/storyboard.json")
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

        img_dir = srv.Path("outputs/images")
        audio_dir = srv.Path("outputs/audio")
        vid_dir = srv.Path("outputs/videos")
        vid_dir.mkdir(parents=True, exist_ok=True)

        aspect_ratio = getattr(srv.last_produce_request, "aspect_ratio", "16:9") if srv.last_produce_request else "16:9"
        style = getattr(srv.last_produce_request, "style", "cinematic") if srv.last_produce_request else "cinematic"
        motion_engine = req.engine or (getattr(srv.last_produce_request, "motion", "kenburns") if srv.last_produce_request else "kenburns")
        video_token = req.video_api_token or (getattr(srv.last_produce_request, "video_api_token", None) if srv.last_produce_request else None)
        video_mdl = req.video_model or (getattr(srv.last_produce_request, "video_model", "wan-video/wan-2.1-i2v-480p") if srv.last_produce_request else "wan-video/wan-2.1-i2v-480p")

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
        srv.log_message(f"[Motion] Đang render video clip cho phân cảnh '{req.shot_id}' ({dur:.1f}s)...")

        render_motion_for_shot(
            image_path=img_path,
            output_path=out_video,
            duration=dur,
            motion_type=target_shot.motion or "zoom_in",
            engine=motion_engine,
            prompt=target_shot.image_prompt,
            aspect_ratio=aspect_ratio,
            letterbox=getattr(srv.last_produce_request, "letterbox", False) if srv.last_produce_request else False,
            style=style,
            video_api_token=video_token,
            video_model=video_mdl,
        )

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
                srv.log_message(f"[Motion Warning] Không thể ghép audio vào clip: {exc}")
                if temp_vid.exists() and not out_video.exists():
                    temp_vid.rename(out_video)

        srv.invalidate_storyboard_cache()
        srv.log_message(f"[Motion] Hoàn tất clip phân cảnh '{req.shot_id}.mp4'.")
        return {
            "success": True,
            "shot_id": req.shot_id,
            "video_url": f"/api/outputs/videos/{req.shot_id}.mp4?t={int(time.time())}",
            "duration": dur,
        }
    except HTTPException:
        raise
    except Exception as e:
        srv.log_message(f"[Motion Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/storyboard/assemble-master")
def assemble_master(req: AssembleMasterRequest):
    sb_file = srv.Path("outputs/storyboard.json")
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

        vid_dir = srv.Path("outputs/videos")
        missing_clips = [s.id for s in sb.shots if not (vid_dir / f"{s.id}.mp4").exists() or (vid_dir / f"{s.id}.mp4").stat().st_size < 1000]
        if missing_clips:
            raise HTTPException(
                status_code=400,
                detail=f"Còn {len(missing_clips)} phân cảnh chưa được render video: {', '.join(missing_clips[:4])}. Vui lòng bấm 'Render Clip' cho các phân cảnh này trước khi xuất bản."
            )

        eff_style = req.style or (getattr(srv.last_produce_request, "style", "cinematic") if srv.last_produce_request else "cinematic")
        eff_ratio = req.aspect_ratio or (getattr(srv.last_produce_request, "aspect_ratio", "16:9") if srv.last_produce_request else "16:9")
        eff_hardsub = req.hardsub if req.hardsub is not None else (getattr(srv.last_produce_request, "hardsub", False) if srv.last_produce_request else False)
        eff_sub_style = req.subtitle_style or (getattr(srv.last_produce_request, "subtitle_style", "tiktok_bold") if srv.last_produce_request else "tiktok_bold")
        eff_sub_pos = req.subtitle_position or (getattr(srv.last_produce_request, "subtitle_position", "bottom") if srv.last_produce_request else "bottom")
        eff_sub_karaoke = req.subtitle_karaoke if req.subtitle_karaoke is not None else (getattr(srv.last_produce_request, "subtitle_karaoke", False) if srv.last_produce_request else False)
        eff_bgm_preset = req.bgm_preset or (getattr(srv.last_produce_request, "bgm_preset", "cinematic") if srv.last_produce_request else "cinematic")
        eff_bgm_volume = req.bgm_volume if req.bgm_volume is not None else (getattr(srv.last_produce_request, "bgm_volume", 0.7) if srv.last_produce_request else 0.7)
        eff_ducking = req.ducking_level or (getattr(srv.last_produce_request, "ducking_level", "medium") if srv.last_produce_request else "medium")
        eff_voice_vol = req.voice_volume if req.voice_volume is not None else (getattr(srv.last_produce_request, "voice_volume", 1.0) if srv.last_produce_request else 1.0)
        eff_color_lut = req.color_lut if req.color_lut is not None else (getattr(srv.last_produce_request, "color_lut", "teal_and_orange") if srv.last_produce_request else "teal_and_orange")
        eff_trans = req.transition_preset if req.transition_preset is not None else (getattr(srv.last_produce_request, "transition_preset", "dissolve") if srv.last_produce_request else "dissolve")
        eff_trans_dur = req.transition_duration if req.transition_duration is not None else (getattr(srv.last_produce_request, "transition_duration", 0.6) if srv.last_produce_request else 0.6)

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
            output_dir=srv.Path("outputs"),
        )
        state_file = srv.Path("outputs/state.json")
        state = StateManager(state_file)

        audio_dir = srv.Path("outputs/audio")
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

        srv.log_message("[Assembly] Bắt đầu ghép nối các video clip và hòa âm master audio...")
        final_video = run_assembly_stage(
            storyboard=sb,
            config=cfg,
            state=state,
            durations=durations,
            progress_callback=lambda st, msg, pct, lmsg: srv.log_message(lmsg),
        )

        srv.pipeline_state["final_video"] = f"/api/outputs/final/{final_video.name}"
        srv.pipeline_state["stage"] = 5
        srv.pipeline_state["stage_name"] = "Hoàn tất"
        srv.pipeline_state["progress"] = 100

        srv.log_message(f"[Assembly] Thành công xuất bản video hoàn chỉnh: {final_video.name}")
        return {
            "success": True,
            "video_url": f"/api/outputs/final/{final_video.name}",
            "filename": final_video.name,
        }
    except HTTPException:
        raise
    except Exception as e:
        srv.log_message(f"[Assembly Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/reframe/presets")
def api_get_reframe_presets():
    from studio.reframe import get_reframe_presets
    return get_reframe_presets()

@router.post("/api/reframe/create")
def api_create_reframe(req: ReframeRequest):
    from studio.reframe import reframe_video

    project_dir = srv.Path("outputs/projects") / req.project_id
    if not project_dir.exists():
        project_dir = srv.Path("outputs")

    input_video = project_dir / "master_movie.mp4"
    if not input_video.exists():
        input_video = srv.Path("outputs/master_movie.mp4")
    if not input_video.exists():
        candidates = [f for f in project_dir.glob("*.mp4") if "9_16" not in f.name]
        if candidates:
            input_video = sorted(candidates, key=lambda f: f.stat().st_size, reverse=True)[0]

    if not input_video.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp video 16:9 để chuyển đổi.")

    subtitle_path = None
    if req.burn_subtitles:
        sub_candidates = list(project_dir.glob("*.srt")) or list(srv.Path("outputs").glob("*.srt"))
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

@router.get("/api/video/enhancer/presets")
def api_get_enhancer_presets():
    from studio.video_enhancer import get_enhancer_presets
    return get_enhancer_presets()

@router.post("/api/video/enhancer/enhance-shot")
def api_enhance_shot_video(req: EnhanceShotRequest):
    from studio.video_enhancer import enhance_shot_video
    try:
        enhanced_path = enhance_shot_video(
            shot_id=req.shot_id,
            preset_id=req.preset_id or "4k_crisp",
            project_id=req.project_id,
            custom_scale=req.custom_scale,
            custom_fps=req.custom_fps,
        )
        if req.project_id and req.project_id not in ("current", ""):
            rel_url = f"/api/outputs/projects/{req.project_id}/videos/{enhanced_path.name}?t={int(time.time())}"
        else:
            rel_url = f"/api/outputs/videos/{enhanced_path.name}?t={int(time.time())}"

        return {
            "success": True,
            "shot_id": req.shot_id,
            "enhanced_url": rel_url,
            "preset": req.preset_id or "4k_crisp",
        }
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=404, detail=str(fnf))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi nâng cấp video phân cảnh: {exc}")

@router.post("/api/video/enhancer/enhance-master")
def api_enhance_master_video(req: EnhanceMasterRequest):
    from studio.video_enhancer import enhance_master_video
    try:
        enhanced_path = enhance_master_video(
            preset_id=req.preset_id or "ultra_master_4k_60fps",
            project_id=req.project_id,
            custom_scale=req.custom_scale,
            custom_fps=req.custom_fps,
        )
        if req.project_id and req.project_id not in ("current", ""):
            rel_url = f"/api/outputs/projects/{req.project_id}/{enhanced_path.name}?t={int(time.time())}"
        else:
            rel_url = f"/api/outputs/{enhanced_path.name}?t={int(time.time())}"

        return {
            "success": True,
            "project_id": req.project_id,
            "enhanced_url": rel_url,
            "preset": req.preset_id or "ultra_master_4k_60fps",
        }
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=404, detail=str(fnf))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi nâng cấp video master: {exc}")
