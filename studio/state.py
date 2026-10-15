from pathlib import Path
from typing import Dict, Any
import json
import os

class StateManager:
    """Tracks per-shot progress across pipeline stages for checkpointing and resuming."""

    STAGES = ["script", "audio", "image", "video"]

    def __init__(self, state_path: Path):
        self.state_path = Path(state_path)
        self._state: Dict[str, Dict[str, bool]] = {}
        if self.state_path.exists():
            self.load()

    def get_shot_status(self, shot_id: str) -> Dict[str, bool]:
        """Return stage status dict for a given shot."""
        current = self._state.get(shot_id, {})
        return {stage: current.get(stage, False) for stage in self.STAGES}

    def mark_complete(self, shot_id: str, stage: str) -> None:
        """Mark a specific stage as completed for a shot."""
        if shot_id not in self._state:
            self._state[shot_id] = {}
        self._state[shot_id][stage] = True

    def is_stage_complete(self, shot_id: str, stage: str) -> bool:
        """Check if a specific stage is completed for a shot."""
        return self._state.get(shot_id, {}).get(stage, False)

    def save(self) -> None:
        """Atomically persist state dictionary to disk."""
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = self.state_path.with_suffix(".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(self._state, f, indent=2)
        os.replace(tmp_path, self.state_path)

    def load(self) -> None:
        """Read state from disk if exists."""
        if self.state_path.exists():
            with open(self.state_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    self._state = data
