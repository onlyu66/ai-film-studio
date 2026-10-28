from pathlib import Path
from studio.subtitles import generate_srt
from studio.storyboard import Storyboard, Shot

def test_generate_srt_format(tmp_path):
    shots = [
        Shot(id="s1", chapter=1, character_id=None, dialogue="Hello world", image_prompt="x", motion="zoom_in", duration=3.0),
        Shot(id="s2", chapter=1, character_id=None, dialogue="Second line", image_prompt="x", motion="zoom_in", duration=4.0),
    ]
    sb = Storyboard(title="T", language="en", characters={}, shots=shots)
    durations = {"s1": 3.0, "s2": 4.0}
    srt = generate_srt(sb, durations, tmp_path / "out.srt")
    content = srt.read_text(encoding="utf-8")
    assert "00:00:00,000" in content
    assert "Hello world" in content
    assert "Second line" in content

def test_generate_srt_skips_empty_dialogue(tmp_path):
    shots = [
        Shot(id="s1", chapter=1, character_id=None, dialogue="", image_prompt="x", motion="zoom_in", duration=5.0),
        Shot(id="s2", chapter=1, character_id=None, dialogue="Only this", image_prompt="x", motion="zoom_in", duration=3.0),
    ]
    sb = Storyboard(title="T", language="en", characters={}, shots=shots)
    durations = {"s1": 5.0, "s2": 3.0}
    srt = generate_srt(sb, durations, tmp_path / "out.srt")
    content = srt.read_text(encoding="utf-8")
    assert "Only this" in content
    # Empty dialogue shot should not appear as a subtitle entry
    lines = [l.strip() for l in content.strip().split('\n') if l.strip()]
    assert lines[0] == "1"

def test_resolve_bgm_path(tmp_path):
    from studio.assembly import resolve_bgm_path
    custom = tmp_path / "custom.mp3"
    custom.write_text("x")
    assert resolve_bgm_path(custom) == custom
    assert resolve_bgm_path(None, "unknown_style") is None

def test_build_hardsub_filter(tmp_path):
    from studio.assembly import build_hardsub_filter
    srt = tmp_path / "sub.srt"
    f1 = build_hardsub_filter(srt, aspect_ratio="16:9")
    assert "subtitles=" in f1
    assert "PrimaryColour" in f1
    assert "FontSize=22" in f1

    f2 = build_hardsub_filter(srt, aspect_ratio="9:16")
    assert "MarginV=90" in f2

def test_resolve_mood_bgm(tmp_path, monkeypatch):
    from studio.assembly import resolve_mood_bgm
    assert resolve_mood_bgm(None) is None
    assert resolve_mood_bgm("nonexistent_mood_123") is None

def test_resolve_sfx_path():
    from studio.assembly import resolve_sfx_path
    assert resolve_sfx_path(None) is None
    assert resolve_sfx_path("") is None
    # Alias testing (mưa -> rain)
    rain_path = resolve_sfx_path("tiếng mưa rơi")
    if rain_path:
        assert "rain" in str(rain_path).lower()

    wind_path = resolve_sfx_path("tiếng gió rít")
    if wind_path:
        assert "wind" in str(wind_path).lower()

def test_mix_sfx_volume_controls(tmp_path):
    from pydub import AudioSegment
    from studio.assembly import mix_sfx_into_shot_audio

    # Create dummy speech audio
    speech_path = tmp_path / "speech.mp3"
    AudioSegment.silent(duration=1500).export(str(speech_path), format="mp3")

    out_path = tmp_path / "mixed.mp3"
    res = mix_sfx_into_shot_audio(
        speech_audio_path=speech_path,
        sfx_str="wind",
        shot_duration=2.0,
        output_path=out_path,
        voice_volume=1.5,
        sfx_volume=0.5,
    )
    assert res.exists()
    assert res.stat().st_size > 0
