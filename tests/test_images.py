from studio.images import build_full_prompt
from studio.storyboard import Shot, Character

def test_build_full_prompt_injects_character():
    chars = {"hero": Character(name="Hero", visual_anchor="tall man with scar", voice="x", seed=42)}
    shot = Shot(id="s1", chapter=1, character_id="hero", dialogue="Hi", image_prompt="a dark alley", motion="zoom_in", duration=None)
    prompt = build_full_prompt(shot, chars, "cinematic")
    assert "tall man with scar" in prompt
    assert "a dark alley" in prompt
    assert "cinematic" in prompt.lower() or "Cinematic" in prompt

def test_build_full_prompt_no_character():
    shot = Shot(id="s1", chapter=1, character_id=None, dialogue="", image_prompt="a sunset", motion="pan_left", duration=None)
    prompt = build_full_prompt(shot, {}, "cinematic")
    assert "a sunset" in prompt

def test_image_provider_timeout(monkeypatch, tmp_path):
    import requests
    def mock_get(*a, **kw):
        raise requests.Timeout("timed out")
    monkeypatch.setattr(requests, "get", mock_get)
    from studio.images import generate_image_for_shot
    from studio.storyboard import Shot
    shot = Shot(id="s1", chapter=1, character_id=None, dialogue="", image_prompt="test", motion="zoom_in", duration=None)
    result = generate_image_for_shot(shot, {}, "cinematic", tmp_path)
    assert result is None

def test_create_fallback_image_is_valid_resolution(tmp_path):
    from studio.images import _create_fallback_image
    p = tmp_path / "fallback.png"
    _create_fallback_image(p, width=1280, height=720, label="Test Scene")
    assert p.exists()
    assert p.stat().st_size > 5000  # Must be a full resolution image, never a 1x1 67-byte black pixel!

