from pathlib import Path
from typing import Dict, Optional
import asyncio
import edge_tts
from pydub import AudioSegment

from studio.storyboard import Storyboard, Shot, Character
from studio.config import StudioConfig
from studio.state import StateManager

DEFAULT_VOICES = {
    "vi": "vi-VN-NamMinhNeural",
    "en": "en-US-GuyNeural",
}

def resolve_voice(shot: Shot, characters: Dict[str, Character], default_lang: str = "en") -> str:
    """Resolve the appropriate TTS voice for a given shot."""
    if shot.character_id and shot.character_id in characters:
        char = characters[shot.character_id]
        if char.voice:
            return char.voice
    return DEFAULT_VOICES.get(default_lang, "en-US-GuyNeural")

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
    asyncio.run(_synthesize_edge_tts(shot.dialogue.strip(), voice, out_file))
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
