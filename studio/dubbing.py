from pathlib import Path
from typing import Dict, List, Optional, Any
import json
import os

from studio.storyboard import Storyboard, Shot, parse_storyboard_json
from studio.config import StudioConfig
from studio.tts import DEFAULT_VOICES
from studio.voice_clone import synthesize_speech

LANGUAGE_NAMES: Dict[str, str] = {
    "vi": "Vietnamese",
    "en": "English",
    "ja": "Japanese",
    "zh": "Chinese",
    "fr": "French",
    "es": "Spanish",
    "de": "German",
    "ko": "Korean",
}


def translate_dialogues(
    storyboard: Storyboard,
    target_lang: str,
    llm_provider: str = "gemini",
    api_key: Optional[str] = None,
) -> Dict[str, str]:
    """
    Translate all shot dialogues in a storyboard to target language using LLM with cinematic tone.
    Returns a mapping of shot_id -> translated_dialogue.
    """
    target_name = LANGUAGE_NAMES.get(target_lang.lower(), target_lang)

    dialogue_map: Dict[str, str] = {}
    for shot in storyboard.shots:
        if shot.dialogue and shot.dialogue.strip():
            dialogue_map[shot.id] = shot.dialogue.strip()

    if not dialogue_map:
        return {}

    prompt = f"""You are a professional Hollywood movie dialogue translator and dubbing director.
Translate the following movie dialogues into {target_name} ({target_lang}).
Maintain the cinematic emotion, intensity, and rhythm so they fit voice-over timing.

Original Dialogues:
{json.dumps(dialogue_map, ensure_ascii=False, indent=2)}

Return ONLY a JSON object mapping each shot ID to its translated dialogue:
{{
  "shot_id": "Translated dialogue in {target_name}..."
}}
"""

    try:
        from studio.llm.factory import create_llm
        from studio.storyboard import repair_json_string
        llm = create_llm(provider_name=llm_provider, api_key=api_key)
        raw_resp = llm.generate(
            system_prompt="You are a professional Hollywood movie dialogue translator and dubbing director.",
            user_prompt=prompt,
        )
        cleaned = repair_json_string(raw_resp)
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return {k: str(v) for k, v in data.items()}
    except Exception as exc:
        print(f"[Dubbing] LLM translation call failed: {exc}. Using fallback translation mapping.")

    # Fallback if LLM fails: return original with language tag
    return {k: f"[{target_lang.upper()}] {v}" for k, v in dialogue_map.items()}


def format_srt_time(seconds: float) -> str:
    """Format seconds into SRT timestamp: 00:00:00,000"""
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"


def build_dubbed_srt(shots: List[Shot], translations: Dict[str, str], srt_path: Path) -> Path:
    """Generate an SRT file for translated dialogues."""
    srt_lines = []
    current_time = 0.0

    idx = 1
    for shot in shots:
        dur = getattr(shot, "duration", 4.0) or 4.0
        start_t = current_time
        end_t = current_time + dur
        current_time = end_t

        trans_text = translations.get(shot.id, shot.dialogue or "").strip()
        if not trans_text:
            continue

        srt_lines.append(f"{idx}")
        srt_lines.append(f"{format_srt_time(start_t)} --> {format_srt_time(end_t)}")
        srt_lines.append(trans_text)
        srt_lines.append("")
        idx += 1

    srt_path.parent.mkdir(parents=True, exist_ok=True)
    srt_path.write_text("\n".join(srt_lines), encoding="utf-8")
    return srt_path


def run_dubbing_pipeline(
    project_id: str,
    target_lang: str,
    voice_mapping: Optional[Dict[str, str]] = None,
    projects_root: Optional[Path] = None,
    config: Optional[StudioConfig] = None,
) -> Dict[str, Any]:
    """
    Execute multilingual dubbing for an existing project:
    1. Reads storyboard.
    2. Translates dialogues.
    3. Synthesizes dubbed audio for all shots.
    4. Generates target language .srt subtitles.
    5. Returns status and output paths.
    """
    root = Path(projects_root or "outputs/projects")
    project_dir = root / project_id
    if not project_dir.exists():
        raise FileNotFoundError(f"Project directory not found: {project_dir}")

    sb_file = project_dir / "storyboard.json"
    if not sb_file.exists():
        raise FileNotFoundError(f"Storyboard file not found: {sb_file}")

    storyboard = parse_storyboard_json(sb_file.read_text(encoding="utf-8"))

    # 1. Translate
    llm_provider = getattr(config, "llm_provider", "gemini") if config else "gemini"
    llm_key = getattr(config, "llm_api_key", None) if config else None
    translations = translate_dialogues(storyboard, target_lang=target_lang, llm_provider=llm_provider, api_key=llm_key)

    # 2. Output directories
    dub_dir = project_dir / "dubbing" / target_lang
    audio_dir = dub_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    default_voice = DEFAULT_VOICES.get(target_lang, "en-US-GuyNeural")
    v_map = voice_mapping or {}

    translated_shots: List[Dict[str, Any]] = []

    # 3. Synthesize audio
    for shot in storyboard.shots:
        trans_text = translations.get(shot.id, shot.dialogue or "").strip()
        if not trans_text:
            continue

        # Determine voice
        voice_id = default_voice
        if shot.character_id and shot.character_id in v_map:
            voice_id = v_map[shot.character_id]

        out_audio = audio_dir / f"{shot.id}.mp3"
        provider = "elevenlabs" if voice_id.startswith("el_") or len(voice_id) == 20 else "edge"

        try:
            synthesize_speech(
                text=trans_text,
                voice_id=voice_id,
                provider=provider,
                output_path=out_audio,
                lang=target_lang,
            )
        except Exception as exc:
            print(f"[Dubbing] Synthesis error for {shot.id}: {exc}")

        translated_shots.append({
            "shot_id": shot.id,
            "original_text": shot.dialogue,
            "translated_text": trans_text,
            "voice_id": voice_id,
            "audio_file": str(out_audio),
        })

    # 4. Generate Subtitles
    srt_path = dub_dir / f"subtitles_{target_lang}.srt"
    build_dubbed_srt(storyboard.shots, translations, srt_path)

    # 5. Metadata
    meta = {
        "project_id": project_id,
        "target_lang": target_lang,
        "language_name": LANGUAGE_NAMES.get(target_lang, target_lang),
        "status": "completed",
        "translated_shots": translated_shots,
        "subtitle_path": str(srt_path),
        "audio_dir": str(audio_dir),
    }

    (dub_dir / "dubbing_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return meta
