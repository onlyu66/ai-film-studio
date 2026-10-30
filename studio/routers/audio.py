from pathlib import Path
from typing import Optional, List, Dict, Any
import json
import time
import shutil
import subprocess

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

import studio.server as srv
from studio.storage import atomic_write_json, safe_read_json

router = APIRouter(tags=["audio"])

# --- Request Models ---

class VoicePreviewSimpleRequest(BaseModel):
    voice: str
    text: Optional[str] = None

class SfxSuggestRequest(BaseModel):
    prompt: str
    dialogue: Optional[str] = ""
    genre: Optional[str] = ""

class BatchSfxSuggestRequest(BaseModel):
    project_id: str
    overwrite_existing: bool = False

class UploadBgmRequest(BaseModel):
    filename: str
    audio_base64: str

class RenderShotAudioRequest(BaseModel):
    shot_id: str

class DubProjectRequest(BaseModel):
    target_lang: str
    voice: Optional[str] = None
    hardsub: bool = False

class CloneVoiceRequest(BaseModel):
    name: str
    provider: str = "local"
    audio_base64: str
    audio_filename: Optional[str] = "sample.mp3"
    description: Optional[str] = None
    api_key: Optional[str] = None
    api_url: Optional[str] = None
    lang: str = "vi"
    gender: str = "neutral"

class VoicePreviewAdvRequest(BaseModel):
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

class SnapToBeatRequest(BaseModel):
    project_id: str = "current"
    bgm_track: Optional[str] = "cinematic"
    shots: Optional[List[Dict[str, Any]]] = None
    min_shot_duration: float = 1.5
    max_shot_duration: float = 12.0
    save_to_storyboard: bool = True

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

# --- Endpoints ---

@router.post("/api/tts/preview-voice")
def preview_voice(req: VoicePreviewSimpleRequest):
    import edge_tts
    import asyncio
    preview_dir = srv.Path("outputs/previews")
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

@router.get("/api/sfx/list")
def list_sfx():
    return {"sfx": AVAILABLE_SFX}

@router.get("/api/sfx/catalog")
def api_get_sfx_catalog():
    from studio.sfx import get_sfx_catalog
    return get_sfx_catalog()

@router.post("/api/sfx/suggest")
def api_suggest_sfx(req: SfxSuggestRequest):
    from studio.sfx import suggest_sfx_for_shot
    return suggest_sfx_for_shot(
        prompt=req.prompt or "",
        dialogue=req.dialogue or "",
        genre=req.genre or "",
    )

@router.post("/api/sfx/batch-suggest")
def api_batch_suggest_sfx(req: BatchSfxSuggestRequest):
    from studio.sfx import suggest_sfx_for_shot

    if req.project_id in ("current", "", None):
        sb_path = srv.Path("outputs/storyboard.json")
    else:
        sb_path = srv.Path(f"outputs/projects/{req.project_id}/storyboard.json")

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

@router.api_route("/api/assets/sfx/{file_name}", methods=["GET", "HEAD"])
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

@router.get("/api/assets/bgm")
def api_get_bgm_catalog():
    from studio.audio_assets import get_bgm_catalog
    return get_bgm_catalog()

@router.api_route("/api/assets/bgm/{file_name}", methods=["GET", "HEAD"])
def serve_bgm_asset(file_name: str):
    clean_name = file_name.replace(".mp3", "").replace(".wav", "").lower().strip()
    bgm_dir = srv.Path("assets/bgm")
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

@router.post("/api/assets/bgm/upload")
def upload_custom_bgm(req: UploadBgmRequest):
    import base64
    ext = Path(req.filename or "").suffix.lower()
    if ext not in (".mp3", ".wav", ".m4a", ".ogg", ".aac"):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file âm thanh: .mp3, .wav, .m4a, .ogg, .aac")

    bgm_dir = srv.Path("assets/bgm")
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

@router.post("/api/storyboard/render-shot-audio")
def render_shot_audio(req: RenderShotAudioRequest):
    sb_file = srv.Path("outputs/storyboard.json")
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

        audio_dir = srv.Path("outputs/audio")
        audio_dir.mkdir(parents=True, exist_ok=True)

        srv.log_message(f"[Audio] Đang tạo giọng đọc riêng cho phân cảnh '{req.shot_id}'...")
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

        raw_copy = audio_dir / f"raw_{req.shot_id}.mp3"
        if audio_path and audio_path.exists():
            shutil.copy2(str(audio_path), str(raw_copy))

        from studio.assembly import mix_sfx_into_shot_audio
        v_vol = float(getattr(target_shot, "voice_volume", 1.0) or 1.0)
        s_vol = float(getattr(target_shot, "sfx_volume", 1.0) or 1.0)
        srv.log_message(f"[Audio] Hòa âm giọng đọc (Vol {int(v_vol*100)}%) & SFX '{getattr(target_shot, 'sfx', None)}' (Vol {int(s_vol*100)}%) vào '{req.shot_id}'...")
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

        vid_file = srv.Path(f"outputs/videos/{req.shot_id}.mp4")
        if vid_file.exists() and audio_path and audio_path.exists():
            srv.fast_remux_video_audio(vid_file, audio_path)

        srv.invalidate_storyboard_cache()
        srv.log_message(f"[Audio] Hoàn thành giọng đọc '{req.shot_id}' ({dur:.1f}s).")
        return {
            "success": True,
            "shot_id": req.shot_id,
            "audio_url": f"/api/outputs/audio/{req.shot_id}.mp3?t={int(time.time())}" if (audio_path and audio_path.exists()) else None,
            "duration": dur,
        }
    except HTTPException:
        raise
    except Exception as e:
        srv.log_message(f"[Audio Error] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/projects/{project_id}/dub")
def dub_project(project_id: str, req: DubProjectRequest):
    project_dir = srv.Path("outputs/projects") / project_id
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

@router.get("/api/voice/list")
def api_get_voice_list():
    from studio.voice_clone import get_all_voices
    voices = get_all_voices()
    return [v.to_dict() for v in voices]

@router.post("/api/voice/clone")
def api_clone_voice(req: CloneVoiceRequest):
    import base64
    import uuid
    from studio.voice_clone import clone_voice

    b64 = req.audio_base64
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    raw_bytes = base64.b64decode(b64)

    temp_dir = srv.Path("outputs/temp")
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

@router.post("/api/voice/preview")
def api_preview_voice(req: VoicePreviewAdvRequest):
    import uuid
    from studio.voice_clone import synthesize_speech

    temp_dir = srv.Path("outputs/temp")
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

@router.post("/api/dubbing/create")
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


@router.get("/api/audio/waveform")
def api_get_audio_waveform(
    track: Optional[str] = "cinematic",
    shot_id: Optional[str] = None,
    sfx_key: Optional[str] = None,
):
    from studio.audio_beat_detector import detect_beats
    audio_path = None

    if sfx_key:
        clean_sfx = Path(sfx_key).stem.lower().strip().replace(" ", "_")
        sfx_cand = srv.Path("assets/sfx") / f"{clean_sfx}.mp3"
        if sfx_cand.exists():
            audio_path = sfx_cand
        else:
            sfx_wav = srv.Path("assets/sfx") / f"{clean_sfx}.wav"
            if sfx_wav.exists():
                audio_path = sfx_wav

    if not audio_path and shot_id:
        shot_cand = srv.Path("outputs/audio") / f"{shot_id}.mp3"
        if shot_cand.exists():
            audio_path = shot_cand
        else:
            shot_wav = srv.Path("outputs/audio") / f"{shot_id}.wav"
            if shot_wav.exists():
                audio_path = shot_wav

    if not audio_path and track:
        clean_track = Path(track).stem
        bgm_cand = srv.Path("assets/bgm") / f"{clean_track}.mp3"
        if bgm_cand.exists():
            audio_path = bgm_cand
        else:
            bgm_wav = srv.Path("assets/bgm") / f"{clean_track}.wav"
            if bgm_wav.exists():
                audio_path = bgm_wav

    if audio_path and audio_path.exists():
        result = detect_beats(audio_path)
        return {
            "success": True,
            "track": track if not sfx_key else None,
            "shot_id": shot_id,
            "sfx_key": sfx_key,
            "duration": result["duration"],
            "tempo_bpm": result["tempo_bpm"],
            "beat_times": result["beat_times"],
            "peaks": result["peaks"],
        }

    # Fallback khi audio chưa render hoặc track không tồn tại
    import math
    dummy_duration = 30.0
    dummy_peaks = [round(abs(math.sin(i * 0.15)) * 0.8 + 0.1, 3) for i in range(150)]
    dummy_beats = [round(i * 0.5, 2) for i in range(1, int(dummy_duration / 0.5))]
    return {
        "success": True,
        "track": track if not sfx_key else None,
        "shot_id": shot_id,
        "sfx_key": sfx_key,
        "duration": dummy_duration,
        "tempo_bpm": 120,
        "beat_times": dummy_beats,
        "peaks": dummy_peaks,
    }


@router.post("/api/audio/beat-sync/snap")
def api_snap_timeline_to_beats(req: SnapToBeatRequest):
    from studio.audio_beat_detector import detect_beats, calculate_snap_to_beats

    clean_track = Path(req.bgm_track or "cinematic").stem
    bgm_path = srv.Path("assets/bgm") / f"{clean_track}.mp3"
    beat_times = []
    tempo_bpm = 120

    if bgm_path.exists():
        analysis = detect_beats(bgm_path)
        beat_times = analysis["beat_times"]
        tempo_bpm = analysis["tempo_bpm"]
    else:
        beat_times = [round(i * 0.5, 2) for i in range(1, 120)]

    storyboard_path = srv.Path("outputs/storyboard.json")
    shots_to_snap = []
    full_storyboard = {}

    if req.shots:
        shots_to_snap = req.shots
    elif storyboard_path.exists():
        full_storyboard = safe_read_json(storyboard_path, default={})
        shots_to_snap = full_storyboard.get("shots", [])

    if not shots_to_snap:
        shots_to_snap = [
            {"id": "shot_001", "duration": 5.0},
            {"id": "shot_002", "duration": 5.0},
        ]

    snapped_shots = calculate_snap_to_beats(
        shots=shots_to_snap,
        beat_times=beat_times,
        min_shot_duration=req.min_shot_duration,
        max_shot_duration=req.max_shot_duration,
    )

    if req.save_to_storyboard and storyboard_path.exists():
        if not full_storyboard:
            full_storyboard = safe_read_json(storyboard_path, default={})
        if "shots" in full_storyboard:
            shot_dur_map = {s.get("id"): s.get("duration") for s in snapped_shots if s.get("id")}
            for s in full_storyboard["shots"]:
                s_id = s.get("id")
                if s_id and s_id in shot_dur_map:
                    s["duration"] = shot_dur_map[s_id]
            atomic_write_json(storyboard_path, full_storyboard, backup=True)
            if hasattr(srv, "invalidate_storyboard_cache"):
                srv.invalidate_storyboard_cache()

    total_duration = round(sum(float(s.get("duration", 0)) for s in snapped_shots), 2)
    return {
        "success": True,
        "project_id": req.project_id,
        "bgm_track": req.bgm_track,
        "tempo_bpm": tempo_bpm,
        "total_duration": total_duration,
        "shots": snapped_shots,
    }
