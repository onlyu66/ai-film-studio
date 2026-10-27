from pathlib import Path
from typing import Dict, Optional, Callable
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

def resolve_emotion_params(shot: Shot) -> Dict[str, str]:
    """Map shot mood or emotion to Edge-TTS rate, pitch, and volume adjustments."""
    mood = (getattr(shot, "mood", None) or getattr(shot, "emotion", None) or "").lower().strip()

    # Emotional acoustic profiles
    if mood in ("tense", "action", "shouting", "angry", "panic"):
        return {"rate": "+12%", "pitch": "+6Hz", "volume": "+15%"}
    elif mood in ("sad", "whisper", "whispering", "sorrow", "crying"):
        return {"rate": "-12%", "pitch": "-6Hz", "volume": "-10%"}
    elif mood in ("epic", "heroic", "triumphant"):
        return {"rate": "-4%", "pitch": "+3Hz", "volume": "+10%"}
    elif mood in ("mysterious", "suspense", "fear"):
        return {"rate": "-8%", "pitch": "-3Hz", "volume": "+0%"}
    elif mood in ("calm", "peaceful", "gentle"):
        return {"rate": "-5%", "pitch": "-1Hz", "volume": "-5%"}
    elif mood in ("joyful", "happy", "cheerful", "excited"):
        return {"rate": "+8%", "pitch": "+8Hz", "volume": "+10%"}

    return {"rate": "+0%", "pitch": "+0Hz", "volume": "+0%"}

async def _synthesize_edge_tts(
    text: str,
    voice: str,
    output_path: Path,
    rate: str = "+0%",
    pitch: str = "+0Hz",
    volume: str = "+0%"
) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, volume=volume)
    await communicate.save(str(output_path))

def generate_audio_for_shot(
    shot: Shot,
    characters: Dict[str, Character],
    output_dir: Path,
    lang: str = "en"
) -> Optional[Path]:
    """Generate audio file for a single shot dialogue with robust retry and fallback."""
    if not shot.dialogue or not shot.dialogue.strip():
        return None

    import time
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    out_file = output_dir / f"{shot.id}.mp3"

    # Reuse if already generated and non-empty
    if out_file.exists() and out_file.stat().st_size > 0:
        return out_file

    primary_voice = resolve_voice(shot, characters, default_lang=lang)
    lang_key = (lang or "en").lower().split("-")[0]

    # Ordered candidate voices to try
    candidate_voices = [primary_voice]
    for v in SUPPORTED_VOICES.get(lang_key, []):
        if v not in candidate_voices:
            candidate_voices.append(v)
    if "en-US-GuyNeural" not in candidate_voices:
        candidate_voices.append("en-US-GuyNeural")

    success = False
    emotion_params = resolve_emotion_params(shot)
    for v in candidate_voices:
        for attempt in range(1, 4):
            try:
                # Remove stale 0-byte file before attempt
                if out_file.exists():
                    out_file.unlink()
                asyncio.run(_synthesize_edge_tts(
                    shot.dialogue.strip(),
                    v,
                    out_file,
                    rate=emotion_params["rate"],
                    pitch=emotion_params["pitch"],
                    volume=emotion_params["volume"],
                ))
                if out_file.exists() and out_file.stat().st_size > 0:
                    success = True
                    break
            except Exception as exc:
                print(f"  [TTS] Attempt {attempt} for {shot.id} with '{v}' failed ({exc}), retrying...")
                time.sleep(1.0 * attempt)
        if success:
            break

    if not success:
        print(f"  [TTS] All online synthesis attempts failed for {shot.id}. Generating silent audio fallback...")
        word_count = len(shot.dialogue.strip().split())
        est_sec = max(3.0, min(15.0, word_count * 0.4))
        silence = AudioSegment.silent(duration=int(est_sec * 1000))
        silence.export(str(out_file), format="mp3")

    return out_file

def get_audio_duration(audio_path: Path) -> float:
    """Return the duration of an audio file in seconds."""
    seg = AudioSegment.from_file(str(audio_path))
    return float(seg.duration_seconds)

from concurrent.futures import ThreadPoolExecutor, as_completed

def run_tts_stage(
    storyboard: Storyboard,
    config: StudioConfig,
    state: StateManager,
    progress_callback: Optional[Callable[[int, str, int, str], None]] = None,
) -> Dict[str, float]:
    """
    Run TTS generation for all shots in storyboard in parallel.
    Returns a mapping of shot_id -> duration in seconds.
    """
    audio_dir = config.output_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    durations: Dict[str, float] = {}

    pending_shots = []
    for shot in storyboard.shots:
        audio_file = audio_dir / f"{shot.id}.mp3"
        if state.is_stage_complete(shot.id, "audio") and audio_file.exists() and audio_file.stat().st_size > 0:
            dur = get_audio_duration(audio_file)
            durations[shot.id] = dur
            shot.duration = dur
        else:
            pending_shots.append(shot)

    if pending_shots:
        total_shots = len(storyboard.shots)
        done_count = len(durations)

        def process_shot(shot: Shot):
            audio_path = generate_audio_for_shot(
                shot=shot,
                characters=storyboard.characters,
                output_dir=audio_dir,
                lang=storyboard.language or config.lang,
            )
            if audio_path and audio_path.exists():
                dur = get_audio_duration(audio_path)
            else:
                dur = 5.0
            return shot.id, dur

        max_workers = min(5, len(pending_shots))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [executor.submit(process_shot, s) for s in pending_shots]
            for future in as_completed(futures):
                shot_id, dur = future.result()
                durations[shot_id] = dur
                for s in storyboard.shots:
                    if s.id == shot_id:
                        s.duration = dur
                        break
                state.mark_complete(shot_id, "audio")
                state.save()
                done_count += 1
                if progress_callback:
                    pct = 20 + int(20 * (done_count / max(1, total_shots)))
                    progress_callback(2, "Đang tổng hợp giọng nói AI (TTS)...", min(pct, 40), f"[TTS] Đã tạo giọng nói cho phân cảnh '{shot_id}' ({dur:.1f}s)")

    return durations
