from studio.config import load_config, StudioConfig

def test_load_config_defaults():
    cfg = load_config({"topic": "Test topic"})
    assert isinstance(cfg, StudioConfig)
    assert cfg.topic == "Test topic"
    assert cfg.lang == "en"
    assert cfg.duration == 30
    assert cfg.style == "cinematic"
    assert cfg.llm_provider == "gemini"

def test_load_config_overrides():
    cfg = load_config({"topic": "X", "lang": "vi", "duration": 45, "llm": "ollama"})
    assert cfg.lang == "vi"
    assert cfg.duration == 45
    assert cfg.llm_provider == "ollama"
