from pathlib import Path
import pytest
from studio.storyboard import Storyboard, Shot
from studio.subtitles import (
    format_timestamp,
    format_ass_timestamp,
    generate_srt,
    generate_ass,
    get_subtitle_presets,
    SUBTITLE_PRESETS,
)

def test_format_ass_timestamp():
    assert format_ass_timestamp(0.0) == "0:00:00.00"
    assert format_ass_timestamp(5.25) == "0:00:05.25"
    assert format_ass_timestamp(65.5) == "0:01:05.50"
    assert format_ass_timestamp(3661.123) == "1:01:01.12"

def test_get_subtitle_presets():
    presets = get_subtitle_presets()
    assert isinstance(presets, list)
    preset_ids = [p["id"] for p in presets]
    assert "tiktok_bold" in preset_ids
    assert "cinematic" in preset_ids
    assert "cyberpunk" in preset_ids
    assert "retro_vhs" in preset_ids
    assert "minimalist" in preset_ids
    assert "karaoke_pop" in preset_ids

    # Check required fields for UI rendering
    for p in presets:
        assert "name" in p
        assert "font_name" in p
        assert "primary_color_hex" in p
        assert "outline_color_hex" in p
        assert "description" in p
        assert "preview_text" in p

def test_generate_ass_basic(tmp_path):
    shots = [
        Shot(id="s1", chapter=1, character_id=None, dialogue="Chào mừng bạn đến với AI Film Studio", image_prompt="x", motion="zoom_in", duration=3.0),
        Shot(id="s2", chapter=1, character_id=None, dialogue="Tạo phim điện ảnh đỉnh cao", image_prompt="x", motion="zoom_in", duration=4.0),
    ]
    sb = Storyboard(title="Test Movie", language="vi", characters={}, shots=shots)
    durations = {"s1": 3.0, "s2": 4.0}
    ass_path = tmp_path / "movie.ass"

    res = generate_ass(
        storyboard=sb,
        audio_durations=durations,
        output_path=ass_path,
        preset_id="cinematic",
        aspect_ratio="16:9",
        position="bottom",
        karaoke=False
    )
    assert res == ass_path
    content = ass_path.read_text(encoding="utf-8")

    assert "[Script Info]" in content
    assert "[V4+ Styles]" in content
    assert "[Events]" in content
    assert "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text" in content
    assert "Dialogue: 0,0:00:00.00,0:00:03.00,Default,,0,0,40,,Chào mừng bạn đến với AI Film Studio" in content
    assert "Dialogue: 0,0:00:03.00,0:00:07.00,Default,,0,0,40,,Tạo phim điện ảnh đỉnh cao" in content

def test_generate_ass_positions(tmp_path):
    shots = [
        Shot(id="s1", chapter=1, character_id=None, dialogue="Vị trí phụ đề", image_prompt="x", motion="zoom_in", duration=2.0),
    ]
    sb = Storyboard(title="Test", language="vi", characters={}, shots=shots)
    durations = {"s1": 2.0}

    # Top position
    ass_top = tmp_path / "top.ass"
    generate_ass(sb, durations, ass_top, preset_id="tiktok_bold", position="top")
    content_top = ass_top.read_text(encoding="utf-8")
    # Alignment 8 is Top-Center in ASS
    assert ",8," in content_top

    # Middle position
    ass_mid = tmp_path / "mid.ass"
    generate_ass(sb, durations, ass_mid, preset_id="tiktok_bold", position="middle")
    content_mid = ass_mid.read_text(encoding="utf-8")
    # Alignment 5 is Middle-Center in ASS
    assert ",5," in content_mid

def test_generate_ass_karaoke(tmp_path):
    shots = [
        Shot(id="s1", chapter=1, character_id=None, dialogue="Khoa học viễn tưởng tương lai", image_prompt="x", motion="zoom_in", duration=2.5),
    ]
    sb = Storyboard(title="Test", language="vi", characters={}, shots=shots)
    durations = {"s1": 2.5}

    ass_karaoke = tmp_path / "karaoke.ass"
    generate_ass(sb, durations, ass_karaoke, preset_id="karaoke_pop", karaoke=True)
    content = ass_karaoke.read_text(encoding="utf-8")

    assert "{\\k" in content
    assert "Khoa" in content
    assert "học" in content
    assert "tương" in content

def test_generate_ass_skips_empty_dialogue(tmp_path):
    shots = [
        Shot(id="s1", chapter=1, character_id=None, dialogue="", image_prompt="x", motion="zoom_in", duration=3.0),
        Shot(id="s2", chapter=1, character_id=None, dialogue="Có thoại", image_prompt="x", motion="zoom_in", duration=2.0),
    ]
    sb = Storyboard(title="Test", language="vi", characters={}, shots=shots)
    durations = {"s1": 3.0, "s2": 2.0}

    ass_path = tmp_path / "empty_skip.ass"
    generate_ass(sb, durations, ass_path)
    content = ass_path.read_text(encoding="utf-8")

    # Only one Dialogue line in Events
    dialogue_lines = [line for line in content.splitlines() if line.startswith("Dialogue:")]
    assert len(dialogue_lines) == 1
    # Timing should start after shot 1's duration (3.0s)
    assert "Dialogue: 0,0:00:03.00,0:00:05.00" in dialogue_lines[0]
