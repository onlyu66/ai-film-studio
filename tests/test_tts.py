import pytest
from studio.tts import generate_audio_for_shot, get_audio_duration
from studio.storyboard import Shot, Character

def test_empty_dialogue_shot_returns_none(tmp_path):
    shot = Shot(id="s1", chapter=1, character_id=None, dialogue="", image_prompt="x", motion="zoom_in", duration=None)
    result = generate_audio_for_shot(shot, {}, tmp_path)
    assert result is None

@pytest.mark.slow
def test_generate_audio_produces_file(tmp_path):
    chars = {"hero": Character(name="Hero", visual_anchor="x", voice="en-US-GuyNeural", seed=42)}
    shot = Shot(id="s1", chapter=1, character_id="hero", dialogue="Hello world", image_prompt="x", motion="zoom_in", duration=None)
    path = generate_audio_for_shot(shot, chars, tmp_path)
    assert path is not None
    assert path.exists()
    dur = get_audio_duration(path)
    assert dur > 0.5

def test_resolve_voice_handles_invalid_person_name():
    from studio.tts import resolve_voice
    chars = {
        "c1": Character(name="Đỗ Thanh Hưng", visual_anchor="nam giới", voice="Đỗ Thanh Hưng", seed=42),
        "c2": Character(name="Vũ Ngọc Ánh", visual_anchor="nữ thám tử", voice="Vũ Ngọc Ánh", seed=42),
    }
    shot1 = Shot(id="s1", chapter=1, character_id="c1", dialogue="Chào bạn", image_prompt="x")
    shot2 = Shot(id="s2", chapter=1, character_id="c2", dialogue="Chào bạn", image_prompt="x")
    
    voice1 = resolve_voice(shot1, chars, default_lang="vi")
    voice2 = resolve_voice(shot2, chars, default_lang="vi")
    
    assert voice1 in ["vi-VN-NamMinhNeural", "vi-VN-HoaiMyNeural"]
    assert voice2 == "vi-VN-HoaiMyNeural"

