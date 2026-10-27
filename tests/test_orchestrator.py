import inspect
from pathlib import Path
from studio.orchestrator import run_pipeline
from studio.config import StudioConfig

def test_run_pipeline_signature():
    sig = inspect.signature(run_pipeline)
    params = list(sig.parameters.keys())
    assert "config" in params
    assert "force_new" in params
    assert "progress_callback" in params

def test_run_pipeline_force_new_clears_storyboard(tmp_path, monkeypatch):
    sb_file = tmp_path / "storyboard.json"
    sb_file.write_text("{}", encoding="utf-8")
    assert sb_file.exists()

    # Mock LLM generation to avoid network call
    from studio.storyboard import Storyboard, Shot
    mock_sb = Storyboard(
        title="Test",
        language="vi",
        characters={},
        shots=[Shot(id="s1", chapter=1, character_id=None, dialogue="Hello", image_prompt="A test prompt")]
    )

    monkeypatch.setattr("studio.orchestrator.generate_storyboard", lambda *args, **kwargs: mock_sb)

    config = StudioConfig(topic="Test Film", output_dir=tmp_path)
    # With force_new=True, existing storyboard should be replaced
    run_pipeline(config, stop_after_stage=1, force_new=True)
    assert sb_file.exists()
    content = sb_file.read_text(encoding="utf-8")
    assert "Test" in content

