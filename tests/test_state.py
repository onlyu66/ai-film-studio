from studio.state import StateManager
from pathlib import Path

def test_mark_and_check(tmp_path):
    sm = StateManager(tmp_path / "state.json")
    assert sm.is_stage_complete("shot_001_001", "audio") is False
    sm.mark_complete("shot_001_001", "audio")
    assert sm.is_stage_complete("shot_001_001", "audio") is True

def test_persistence(tmp_path):
    path = tmp_path / "state.json"
    sm = StateManager(path)
    sm.mark_complete("shot_001_001", "image")
    sm.save()
    sm2 = StateManager(path)
    sm2.load()
    assert sm2.is_stage_complete("shot_001_001", "image") is True

def test_checkpoint_resume_skips_completed(tmp_path):
    path = tmp_path / "state.json"
    sm = StateManager(path)
    for i in range(1, 81):
        sm.mark_complete(f"shot_001_{i:03d}", "image")
    sm.save()
    sm2 = StateManager(path)
    sm2.load()
    assert sm2.is_stage_complete("shot_001_080", "image") is True
    assert sm2.is_stage_complete("shot_001_081", "image") is False
