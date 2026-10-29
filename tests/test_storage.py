from pathlib import Path
import threading
import json
import pytest

from studio.storage import (
    atomic_write_json,
    safe_read_json,
    atomic_write_text,
)

def test_atomic_write_and_safe_read(tmp_path: Path):
    target = tmp_path / "test.json"
    data = {"status": "ok", "shots": [1, 2, 3]}

    # Write
    assert atomic_write_json(target, data)
    assert target.exists()

    # Read back
    read_data = safe_read_json(target)
    assert read_data == data

def test_safe_read_missing_file(tmp_path: Path):
    target = tmp_path / "missing.json"
    assert safe_read_json(target, default={"fallback": True}) == {"fallback": True}

def test_safe_read_corrupt_file(tmp_path: Path):
    target = tmp_path / "corrupt.json"
    target.write_text("{bad json...", encoding="utf-8")
    assert safe_read_json(target, default={"recovered": True}) == {"recovered": True}

def test_atomic_write_creates_backups(tmp_path: Path):
    target = tmp_path / "data.json"

    # Version 1
    atomic_write_json(target, {"version": 1})
    assert safe_read_json(target)["version"] == 1

    # Version 2 (triggers .bak1)
    atomic_write_json(target, {"version": 2}, backup=True)
    assert safe_read_json(target)["version"] == 2
    bak1 = target.with_suffix(".json.bak1")
    assert bak1.exists()
    assert safe_read_json(bak1)["version"] == 1

    # Version 3 (shifts .bak1 -> .bak2, writes new .bak1)
    atomic_write_json(target, {"version": 3}, backup=True)
    assert safe_read_json(target)["version"] == 3
    bak2 = target.with_suffix(".json.bak2")
    assert bak2.exists()
    assert safe_read_json(bak1)["version"] == 2
    assert safe_read_json(bak2)["version"] == 1

def test_concurrent_multithreaded_writes(tmp_path: Path):
    target = tmp_path / "concurrent.json"
    errors = []

    def writer(thread_id: int):
        try:
            for i in range(10):
                atomic_write_json(target, {"thread": thread_id, "iteration": i})
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=writer, args=(t,)) for t in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors
    # Final file must be valid JSON
    final_content = safe_read_json(target)
    assert isinstance(final_content, dict)
    assert "thread" in final_content
