from pathlib import Path
import threading
import pytest
from studio.config import StudioConfig
from studio.state import StateManager
from studio.storyboard import Storyboard, Shot, Character
from studio.orchestrator import PipelineCancelledException, run_pipeline
from studio.tts import run_tts_stage
from studio.images import run_image_stage
from studio.motion import run_motion_stage

@pytest.fixture
def mock_storyboard():
    return Storyboard(
        title="Test Cancellation Film",
        language="vi",
        characters={
            "hero": Character(name="Anh Hùng", visual_anchor="Áo giáp bạc", voice="vi-VN-NamMinhNeural")
        },
        shots=[
            Shot(id="s1", chapter=1, character_id="hero", dialogue="Phân cảnh 1", image_prompt="Rừng rậm 1", duration=4.0),
            Shot(id="s2", chapter=1, character_id="hero", dialogue="Phân cảnh 2", image_prompt="Rừng rậm 2", duration=4.0),
            Shot(id="s3", chapter=1, character_id="hero", dialogue="Phân cảnh 3", image_prompt="Rừng rậm 3", duration=4.0),
        ]
    )

def test_pipeline_cancellation_exception_exists():
    assert issubclass(PipelineCancelledException, Exception)

def test_run_pipeline_cancelled_before_start(tmp_path, mock_storyboard):
    cfg = StudioConfig(topic="Test", output_dir=tmp_path)
    cancel_event = threading.Event()
    cancel_event.set()  # Cancelled beforehand

    with pytest.raises(PipelineCancelledException):
        run_pipeline(cfg, cancel_event=cancel_event)

def test_tts_stage_cancellation(tmp_path, mock_storyboard):
    cfg = StudioConfig(topic="Test", output_dir=tmp_path)
    state = StateManager(tmp_path / "state.json")
    cancel_event = threading.Event()
    cancel_event.set()

    with pytest.raises(PipelineCancelledException):
        run_tts_stage(mock_storyboard, cfg, state, cancel_event=cancel_event)

def test_image_stage_cancellation(tmp_path, mock_storyboard):
    cfg = StudioConfig(topic="Test", output_dir=tmp_path)
    state = StateManager(tmp_path / "state.json")
    cancel_event = threading.Event()
    cancel_event.set()

    with pytest.raises(PipelineCancelledException):
        run_image_stage(mock_storyboard, cfg, state, cancel_event=cancel_event)

def test_motion_stage_cancellation(tmp_path, mock_storyboard):
    cfg = StudioConfig(topic="Test", output_dir=tmp_path)
    state = StateManager(tmp_path / "state.json")
    cancel_event = threading.Event()
    cancel_event.set()

    with pytest.raises(PipelineCancelledException):
        run_motion_stage(mock_storyboard, cfg, state, durations={}, cancel_event=cancel_event)

def test_tts_stage_per_shot_progress_callback_metadata(tmp_path, mock_storyboard, monkeypatch):
    cfg = StudioConfig(topic="Test", output_dir=tmp_path)
    state = StateManager(tmp_path / "state.json")
    
    # Mock audio generation to return quickly
    monkeypatch.setattr("studio.tts.generate_audio_for_shot", lambda **kwargs: tmp_path / "dummy.mp3")
    monkeypatch.setattr("studio.tts.get_audio_duration", lambda p: 3.5)
    (tmp_path / "dummy.mp3").touch()

    callback_calls = []
    def recording_callback(stage, stage_name, progress, log_msg, **kwargs):
        callback_calls.append({
            "stage": stage,
            "progress": progress,
            "log": log_msg,
            **kwargs
        })

    run_tts_stage(mock_storyboard, cfg, state, progress_callback=recording_callback)

    assert len(callback_calls) > 0
    first_call = callback_calls[0]
    assert first_call.get("shot_id") in ["s1", "s2", "s3"]
    assert "shot_idx" in first_call
    assert first_call.get("shots_total") == 3
    assert first_call.get("action") == "tts"
