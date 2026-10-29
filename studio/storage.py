from pathlib import Path
from typing import Any, Optional, Dict
import os
import json
import shutil
import time
import threading

# Meta-lock to safely get/create per-file locks
_meta_lock = threading.Lock()
_file_locks: Dict[str, threading.Lock] = {}

def _get_file_lock(file_path: Path) -> threading.Lock:
    """Return a dedicated reentrant/threading lock for a specific canonical file path."""
    resolved = str(Path(file_path).resolve())
    with _meta_lock:
        if resolved not in _file_locks:
            _file_locks[resolved] = threading.Lock()
        return _file_locks[resolved]

def _rotate_backups(target_path: Path, max_backups: int = 2):
    """Rotate rolling backups (.bak1, .bak2, ...) before overwriting target file."""
    if not target_path.exists() or max_backups <= 0:
        return

    try:
        # Shift backups in reverse order (e.g. .bak1 -> .bak2)
        for i in range(max_backups - 1, 0, -1):
            src = target_path.with_name(f"{target_path.name}.bak{i}")
            dst = target_path.with_name(f"{target_path.name}.bak{i + 1}")
            if src.exists():
                shutil.copy2(src, dst)

        # Copy current file to .bak1
        bak1 = target_path.with_name(f"{target_path.name}.bak1")
        shutil.copy2(target_path, bak1)
    except Exception:
        # Backup failures should not abort main atomic write
        pass

def atomic_write_text(
    file_path: Path,
    content: str,
    encoding: str = "utf-8",
    backup: bool = False,
    max_backups: int = 2,
) -> bool:
    """Write text atomically using a temp file + fsync + os.replace in the same directory."""
    target_path = Path(file_path).resolve()
    target_path.parent.mkdir(parents=True, exist_ok=True)
    lock = _get_file_lock(target_path)

    with lock:
        if backup and target_path.exists():
            _rotate_backups(target_path, max_backups=max_backups)

        # Temp file must reside in the same directory for atomic POSIX rename
        temp_name = f".{target_path.name}.tmp_{os.getpid()}_{threading.get_ident()}_{time.time_ns()}"
        temp_path = target_path.parent / temp_name

        try:
            with open(temp_path, "w", encoding=encoding) as f:
                f.write(content)
                f.flush()
                os.fsync(f.fileno())

            # Atomic rename / replace
            os.replace(temp_path, target_path)
            return True
        except Exception:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except Exception:
                    pass
            raise

def atomic_write_json(
    file_path: Path,
    data: Any,
    backup: bool = False,
    max_backups: int = 2,
    indent: int = 2,
    ensure_ascii: bool = False,
) -> bool:
    """Serialize data to JSON and atomically write to disk."""
    json_str = json.dumps(data, indent=indent, ensure_ascii=ensure_ascii)
    return atomic_write_text(
        file_path=file_path,
        content=json_str,
        encoding="utf-8",
        backup=backup,
        max_backups=max_backups,
    )

def safe_read_json(file_path: Path, default: Any = None) -> Any:
    """Safely read and deserialize JSON data with fallback on missing or corrupt files."""
    target_path = Path(file_path).resolve()
    if not target_path.exists():
        return default

    lock = _get_file_lock(target_path)
    with lock:
        try:
            with open(target_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            # Fallback to backup if primary is corrupted
            bak1 = target_path.with_name(f"{target_path.name}.bak1")
            if bak1.exists():
                try:
                    with open(bak1, "r", encoding="utf-8") as f:
                        return json.load(f)
                except Exception:
                    pass
            return default
