from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional, List, Dict, Any
import json
import uuid
import shutil
import datetime
import os
import requests

from studio.tts import SUPPORTED_VOICES, DEFAULT_VOICES, _synthesize_edge_tts

DEFAULT_VOICE_DIR = Path("outputs/voices")
DEFAULT_VOICES_FILE = DEFAULT_VOICE_DIR / "voices.json"

@dataclass
class VoiceProfile:
    id: str
    name: str
    provider: str  # "elevenlabs" | "local" | "edge"
    sample_audio_path: Optional[str] = None
    gender: str = "neutral"  # "male" | "female" | "neutral"
    lang: str = "vi"
    description: Optional[str] = None
    created_at: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "VoiceProfile":
        return cls(**data)


def load_voice_profiles(storage_file: Optional[Path] = None) -> List[VoiceProfile]:
    """Load custom voice profiles from storage file."""
    fpath = Path(storage_file or DEFAULT_VOICES_FILE)
    if not fpath.exists():
        return []
    try:
        data = json.loads(fpath.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return [VoiceProfile.from_dict(item) for item in data]
        return []
    except Exception as exc:
        print(f"[VoiceClone] Error loading voices from {fpath}: {exc}")
        return []


def save_voice_profile(profile: VoiceProfile, storage_file: Optional[Path] = None) -> None:
    """Save or update a voice profile in storage file."""
    fpath = Path(storage_file or DEFAULT_VOICES_FILE)
    fpath.parent.mkdir(parents=True, exist_ok=True)
    profiles = load_voice_profiles(fpath)

    # Replace if exists or append
    updated = False
    for i, p in enumerate(profiles):
        if p.id == profile.id:
            profiles[i] = profile
            updated = True
            break
    if not updated:
        profiles.append(profile)

    fpath.write_text(json.dumps([p.to_dict() for p in profiles], ensure_ascii=False, indent=2), encoding="utf-8")


def clone_voice(
    provider: str,
    name: str,
    audio_path: Path,
    api_key: Optional[str] = None,
    api_url: Optional[str] = None,
    description: Optional[str] = None,
    storage_dir: Optional[Path] = None,
    lang: str = "vi",
    gender: str = "neutral",
) -> VoiceProfile:
    """
    Clone a voice from an audio sample file.
    Supports 'elevenlabs' (Cloud) or 'local' (Self-hosted / Offline).
    """
    audio_path = Path(audio_path)
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio sample not found: {audio_path}")

    base_dir = Path(storage_dir or DEFAULT_VOICE_DIR)
    samples_dir = base_dir / "samples"
    samples_dir.mkdir(parents=True, exist_ok=True)

    created_iso = datetime.datetime.now().isoformat()

    if provider.lower() == "elevenlabs":
        key = api_key or os.getenv("ELEVENLABS_API_KEY", "")
        if not key:
            raise ValueError("ElevenLabs API Key is required for cloud voice cloning.")

        url = "https://api.elevenlabs.io/v1/voices/add"
        headers = {"xi-api-key": key.strip()}
        data = {
            "name": name,
            "description": description or f"Cloned voice for AI Film Studio ({lang})",
        }

        with open(audio_path, "rb") as f:
            files = {"files": (audio_path.name, f, "audio/mpeg")}
            resp = requests.post(url, headers=headers, data=data, files=files, timeout=60)

        if resp.status_code not in (200, 201):
            raise RuntimeError(f"ElevenLabs API Error ({resp.status_code}): {resp.text}")

        res_json = resp.json()
        voice_id = res_json.get("voice_id")
        if not voice_id:
            raise RuntimeError(f"ElevenLabs did not return a voice_id: {res_json}")

        # Save local copy of audio sample
        dest_audio = samples_dir / f"{voice_id}_{audio_path.name}"
        shutil.copy2(audio_path, dest_audio)

        profile = VoiceProfile(
            id=voice_id,
            name=name,
            provider="elevenlabs",
            sample_audio_path=str(dest_audio),
            gender=gender,
            lang=lang,
            description=description,
            created_at=created_iso,
            meta={"elevenlabs_voice_id": voice_id},
        )
        save_voice_profile(profile, base_dir / "voices.json")
        return profile

    else:
        # Local / Self-hosted voice clone
        voice_id = f"local_{uuid.uuid4().hex[:8]}"
        dest_audio = samples_dir / f"{voice_id}_{audio_path.name}"
        shutil.copy2(audio_path, dest_audio)

        profile = VoiceProfile(
            id=voice_id,
            name=name,
            provider="local",
            sample_audio_path=str(dest_audio),
            gender=gender,
            lang=lang,
            description=description or "Local AI Voice Clone",
            created_at=created_iso,
            meta={"local_endpoint": api_url or ""} if api_url else {},
        )
        save_voice_profile(profile, base_dir / "voices.json")
        return profile


def synthesize_speech(
    text: str,
    voice_id: str,
    provider: str,
    output_path: Path,
    lang: str = "vi",
    api_key: Optional[str] = None,
    api_url: Optional[str] = None,
) -> Path:
    """
    Synthesize speech text to an audio file using specified provider.
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if provider.lower() == "elevenlabs":
        key = api_key or os.getenv("ELEVENLABS_API_KEY", "")
        if not key:
            raise ValueError("ElevenLabs API Key required.")

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": key.strip(),
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
            },
        }
        resp = requests.post(url, headers=headers, json=payload, timeout=60)
        if resp.status_code != 200:
            raise RuntimeError(f"ElevenLabs TTS failed ({resp.status_code}): {resp.text}")

        output_path.write_bytes(resp.content)
        return output_path

    elif provider.lower() == "local" and api_url:
        # Call local custom REST server (XTTS / Kokoro / F5-TTS)
        headers = {"Content-Type": "application/json"}
        payload = {"text": text, "voice_id": voice_id, "lang": lang}
        resp = requests.post(api_url, headers=headers, json=payload, timeout=60)
        if resp.status_code == 200:
            output_path.write_bytes(resp.content)
            return output_path
        # If local server returns error, fallback below

    # Edge-TTS fallback
    import asyncio
    edge_voice = voice_id if "Neural" in voice_id else DEFAULT_VOICES.get(lang, "vi-VN-NamMinhNeural")
    try:
        asyncio.run(_synthesize_edge_tts(text, edge_voice, output_path))
        if output_path.exists() and output_path.stat().st_size > 0:
            return output_path
    except Exception as exc:
        print(f"[VoiceClone] Edge-TTS synthesis failed: {exc}")

    # Silence fallback if all else fails
    from pydub import AudioSegment
    words = len(text.split())
    sec = max(2.5, min(15.0, words * 0.4))
    silence = AudioSegment.silent(duration=int(sec * 1000))
    silence.export(str(output_path), format="mp3")
    return output_path


def get_all_voices(storage_dir: Optional[Path] = None) -> List[VoiceProfile]:
    """
    Get all available voices: built-in Edge-TTS voices + custom cloned voices.
    """
    voices: List[VoiceProfile] = []

    # 1. Standard Built-in Voices
    for lang, voice_list in SUPPORTED_VOICES.items():
        for vid in voice_list:
            gender = "female" if any(w in vid for w in ["HoaiMy", "Jenny", "Nanami", "Xiaoxiao", "Denise", "Elvira", "Katja", "SunHi"]) else "male"
            voices.append(
                VoiceProfile(
                    id=vid,
                    name=vid.replace("Neural", "").replace("-", " "),
                    provider="edge",
                    gender=gender,
                    lang=lang,
                    description=f"Giọng đọc truyền cảm chuẩn ({lang.upper()})",
                )
            )

    # 2. Custom Cloned Voices
    custom_profiles = load_voice_profiles(Path(storage_dir or DEFAULT_VOICE_DIR) / "voices.json")
    for cp in custom_profiles:
        # Ensure custom voices are placed first
        voices.insert(0, cp)

    return voices
