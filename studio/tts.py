from pathlib import Path
from typing import Dict, Optional
import asyncio
import edge_tts
from pydub import AudioSegment

from studio.storyboard import Storyboard, Shot, Character
from studio.config import StudioConfig
from studio.state import StateManager

import re

SUPPORTED_VOICES = {
    "vi": ["vi-VN-NamMinhNeural", "vi-VN-HoaiMyNeural"],
    "en": ["en-US-GuyNeural", "en-US-JennyNeural", "en-US-AriaNeural", "en-US-ChristopherNeural"],
    "ja": ["ja-JP-NanamiNeural", "ja-JP-KeitaNeural"],
    "zh": ["zh-CN-XiaoxiaoNeural", "zh-CN-YunjianNeural"],
    "fr": ["fr-FR-DeniseNeural", "fr-FR-HenriNeural"],
    "es": ["es-ES-ElviraNeural", "es-ES-AlvaroNeural"],
    "de": ["de-DE-KatjaNeural", "de-DE-ConradNeural"],
    "ko": ["ko-KR-SunHiNeural", "ko-KR-InJoonNeural"],
}

DEFAULT_VOICES = {
    "vi": "vi-VN-NamMinhNeural",
    "en": "en-US-GuyNeural",
    "ja": "ja-JP-NanamiNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
    "fr": "fr-FR-DeniseNeural",
    "es": "es-ES-ElviraNeural",
    "de": "de-DE-KatjaNeural",
    "ko": "ko-KR-SunHiNeural",
}

def is_valid_voice_id(voice: str) -> bool:
    """Check if voice string matches standard Edge TTS voice naming pattern."""
    if not isinstance(voice, str):
        return False
    return bool(re.match(r"^[a-z]{2,3}-[A-Z]{2,3}-\w+Neural$", voice.strip()))

def resolve_voice(shot: Shot, characters: Dict[str, Character], default_lang: str = "en") -> str:
    """Resolve the appropriate TTS voice for a given shot with intelligent fallback."""
    lang = (default_lang or "en").lower().split("-")[0]
    voice_pool = SUPPORTED_VOICES.get(lang, SUPPORTED_VOICES["en"])
    default_voice = DEFAULT_VOICES.get(lang, "en-US-GuyNeural")

    if shot.character_id and shot.character_id in characters:
        char = characters[shot.character_id]
        if char.voice and is_valid_voice_id(char.voice):
            return char.voice.strip()

        # Voice string is invalid or LLM hallucinated a person name (e.g. 'Đỗ Thanh Hưng')
        # Infer gender or distribute voices across characters
        target_str = f"{char.name} {char.visual_anchor} {char.voice}".lower()
        female_cues = ["nữ", "female", "woman", "girl", "bà", "cô", "chị", "trixie", "tiên", "ánh", "my", "nhi", "hương", "trang", "lan", "linh", "hoa", "mai"]
        if any(cue in target_str for cue in female_cues) and len(voice_pool) > 1:
            # Pick first female voice (usually second in list e.g. HoaiMy, Jenny)
            return voice_pool[1]
        elif len(voice_pool) > 0:
            # Hash character id for stable voice variety
            idx = abs(hash(shot.character_id)) % len(voice_pool)
            return voice_pool[idx]

    return default_voice

async def _synthesize_edge_tts(text: str, voice: str, output_path: Path) -> None:
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(output_path))

def generate_audio_for_shot(
    shot: Shot,
    characters: Dict[str, Character],
    output_dir: Path,
    lang: str = "en"
) -> Optional[Path]:
    """Generate audio file for a single shot dialogue. Returns None if dialogue is empty."""
    if not shot.dialogue or not shot.dialogue.strip():
        return None

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    out_file = output_dir / f"{shot.id}.mp3"

    voice = resolve_voice(shot, characters, default_lang=lang)
    try:
        asyncio.run(_synthesize_edge_tts(shot.dialogue.strip(), voice, out_file))
    except Exception as exc:
        fallback_voice = DEFAULT_VOICES.get(lang.lower().split("-")[0], "en-US-GuyNeural")
        if voice != fallback_voice:
            print(f"  [TTS] Warning: voice '{voice}' failed ({exc}), falling back to '{fallback_voice}'")
            asyncio.run(_synthesize_edge_tts(shot.dialogue.strip(), fallback_voice, out_file))
        else:
            raise
    return out_file

def get_audio_duration(audio_path: Path) -> float:
    """Return the duration of an audio file in seconds."""
    seg = AudioSegment.from_file(str(audio_path))
    return float(seg.duration_seconds)

def run_tts_stage(
    storyboard: Storyboard,
    config: StudioConfig,
    state: StateManager
) -> Dict[str, float]:
    """
    Run TTS generation for all shots in storyboard.
    Returns a mapping of shot_id -> duration in seconds.
    """
    audio_dir = config.output_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    durations: Dict[str, float] = {}

    for shot in storyboard.shots:
        if state.is_stage_complete(shot.id, "audio"):
            audio_file = audio_dir / f"{shot.id}.mp3"
            if audio_file.exists():
                durations[shot.id] = get_audio_duration(audio_file)
            else:
                durations[shot.id] = 5.0
            continue

        audio_path = generate_audio_for_shot(
            shot=shot,
            characters=storyboard.characters,
            output_dir=audio_dir,
            lang=storyboard.language or config.lang,
        )

        if audio_path and audio_path.exists():
            dur = get_audio_duration(audio_path)
            durations[shot.id] = dur
            shot.duration = dur
        else:
            # Fallback duration for atmospheric/silent shots
            durations[shot.id] = 5.0
            shot.duration = 5.0

        state.mark_complete(shot.id, "audio")
        state.save()

    return durations
