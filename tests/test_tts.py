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
