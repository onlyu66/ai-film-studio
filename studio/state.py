from pathlib import Path
from typing import Dict, Any, Optional
import os
import threading
from studio.storage import atomic_write_json, safe_read_json

class StateManager:
    """Tracks per-shot progress across pipeline stages for checkpointing and resuming."""

    STAGES = ["script", "audio", "image", "video"]

    def __init__(self, state_path: Path):
        self.state_path = Path(state_path)
        self._lock = threading.Lock()
        self._state: Dict[str, Dict[str, bool]] = {}
        if self.state_path.exists():
            self.load()

    def get_shot_status(self, shot_id: str) -> Dict[str, bool]:
        """Return stage status dict for a given shot."""
        with self._lock:
            current = self._state.get(shot_id, {})
            return {stage: current.get(stage, False) for stage in self.STAGES}

    def mark_complete(self, shot_id: str, stage: str) -> None:
        """Mark a specific stage as completed for a shot."""
        with self._lock:
            if shot_id not in self._state:
                self._state[shot_id] = {}
            self._state[shot_id][stage] = True

    def reset_shot(self, shot_id: str, stage: Optional[str] = None) -> None:
        """Reset completion status for a shot. If stage is None, reset all stages."""
        with self._lock:
            if shot_id in self._state:
                if stage:
                    self._state[shot_id][stage] = False
                else:
                    self._state[shot_id] = {s: False for s in self.STAGES}

    def remove_shot(self, shot_id: str) -> None:
        """Remove a shot entirely from state tracking."""
        with self._lock:
            self._state.pop(shot_id, None)

    def is_stage_complete(self, shot_id: str, stage: str) -> bool:
        """Check if a specific stage is completed for a shot."""
        with self._lock:
            return self._state.get(shot_id, {}).get(stage, False)

    def save(self) -> None:
        """Atomically persist state dictionary to disk."""
        with self._lock:
            atomic_write_json(self.state_path, self._state, backup=False)

    def load(self) -> None:
        """Read state from disk if exists."""
        with self._lock:
            data = safe_read_json(self.state_path, default={})
            if isinstance(data, dict):
                self._state = data
