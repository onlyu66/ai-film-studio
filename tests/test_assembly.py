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
