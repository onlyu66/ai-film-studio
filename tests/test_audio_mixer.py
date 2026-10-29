from pathlib import Path
import pytest
from pydub import AudioSegment
from studio.storyboard import Storyboard, Shot
from studio.audio_assets import get_bgm_catalog, BGM_CATALOG
from studio.assembly import build_master_audio

def test_get_bgm_catalog():
    catalog = get_bgm_catalog()
    assert isinstance(catalog, list)
    assert len(catalog) >= 8
    track_ids = [t["id"] for t in catalog]
    assert "cinematic" in track_ids
    assert "action" in track_ids
    assert "dramatic" in track_ids
    assert "calm" in track_ids
    assert "cyberpunk" in track_ids
    assert "mysterious" in track_ids

    for t in catalog:
        assert "name" in t
        assert "genre" in t
        assert "mood" in t
        assert "description" in t
        assert "stream_url" in t
        assert t["stream_url"].startswith("/api/assets/bgm/")

def test_build_master_audio_with_auto_ducking(tmp_path):
    audio_dir = tmp_path / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    # Create dummy 1s speech for shot 1 and silent gap for shot 2
    speech_1 = AudioSegment.silent(duration=1000) + 10 # small audio signal
    speech_1.export(str(audio_dir / "s1.mp3"), format="mp3")

    # Create dummy 5s BGM
    bgm_path = tmp_path / "test_bgm.mp3"
    dummy_bgm = AudioSegment.silent(duration=5000) + 5
    dummy_bgm.export(str(bgm_path), format="mp3")

    shots = [
        Shot(id="s1", chapter=1, character_id=None, dialogue="Đây là câu thoại có âm thanh", image_prompt="p1", motion="zoom_in", duration=2.0),
        Shot(id="s2", chapter=1, character_id=None, dialogue="", image_prompt="p2", motion="zoom_in", duration=2.0),
    ]
    sb = Storyboard(title="Audio Test", language="vi", characters={}, shots=shots)
    durations = {"s1": 2.0, "s2": 2.0}

    out_audio = tmp_path / "master_audio.mp3"
    res = build_master_audio(
        storyboard=sb,
        audio_dir=audio_dir,
        durations=durations,
        output_audio_path=out_audio,
        bgm_path=bgm_path,
        bgm_volume=0.8,
        ducking_level="heavy",
    )
    assert res == out_audio
    assert out_audio.exists()
    assert out_audio.stat().st_size > 1000

    # Test with different ducking levels: none, light, medium
    for level in ["none", "light", "medium"]:
        out_lvl = tmp_path / f"master_{level}.mp3"
        build_master_audio(
            storyboard=sb,
            audio_dir=audio_dir,
            durations=durations,
            output_audio_path=out_lvl,
            bgm_path=bgm_path,
            bgm_volume=1.0,
            ducking_level=level,
        )
        assert out_lvl.exists()
        assert out_lvl.stat().st_size > 1000
