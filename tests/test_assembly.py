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
