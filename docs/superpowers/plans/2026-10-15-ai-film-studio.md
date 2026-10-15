# AI Film Studio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-command CLI that turns a topic string into a 30+ minute narrated video with consistent characters, background music, and subtitles.

**Architecture:** A Python CLI orchestrator drives five sequential stages (script → voice → images → motion → assembly), each idempotent and checkpoint-resumable via a shared `state.json`. All external calls go through provider interfaces so backends are swappable.

**Tech Stack:** Python 3.8+, click, rich, edge-tts, pydub, requests, ffmpeg (system).

**Spec:** `docs/superpowers/specs/2026-10-15-ai-film-studio-design.md`

## Global Constraints

- Python ≥3.8, no type annotations requiring 3.10+ (no `X | Y` union syntax).
- Zero mandatory paid API keys; free-tier cloud or fully local must work.
- **Docker-first:** All dependencies (Python, FFmpeg, pydub, edge-tts, etc.) run inside a Docker container. The host machine only needs Docker installed. Project directory is bind-mounted so outputs appear on the host filesystem.
- All file paths use `pathlib.Path`; no hardcoded OS separators.
- Every module that performs network I/O retries 3× with exponential backoff (1s, 2s, 4s).
- `storyboard.json` schema from spec section 4.1 is the single source of truth between stages.

## Review Focus

1. **Network timeout during image batch** — generating 200 images sequentially; a hung HTTP request should time out (30s) and retry, not block the pipeline forever. Test: `test_image_provider_timeout`.
2. **Malformed LLM JSON output** — LLMs occasionally return markdown fences or trailing commas; the parser must strip fences and repair common JSON errors before raising. Test: `test_storyboard_json_repair`.
3. **Empty dialogue shots** — some shots are purely atmospheric (no dialogue); TTS must skip them, motion must use a default 5s duration, and assembly must handle missing audio. Test: `test_empty_dialogue_shot_pipeline`.
4. **FFmpeg not installed** — the CLI must fail fast with a clear message at startup, not mid-render at shot 150. Test: `test_ffmpeg_missing_error`.
5. **Resume after partial image failure** — state.json marks shot 80 of 200 as last completed image; re-run must skip shots 1–80 and start at 81. Test: `test_checkpoint_resume_skips_completed`.

---

### Task 1: Project Scaffolding, Docker Environment, Config Schema & CLI Entry Point

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `run.sh` (convenience wrapper)
- Create: `studio/__init__.py`
- Create: `studio/__main__.py`
- Create: `studio/config.py`
- Create: `studio/cli.py`
- Create: `config.yaml` (default config)
- Create: `requirements.txt`
- Create: `setup.py`
- Test: `tests/__init__.py`
- Test: `tests/test_cli.py`

**Interfaces:**
- Consumes: nothing (first task)
- Produces:
  - `Dockerfile` — Python 3.11-slim + FFmpeg + all pip dependencies, `WORKDIR /app`
  - `docker-compose.yml` — `studio` service with bind-mount `.:/app` and `outputs:/app/outputs`, passes `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL` from host env
  - `run.sh` — wraps `docker compose run --rm studio python -m studio "$@"` so user just types `./run.sh run --topic "..."`
  - `studio.cli.main()` — click group with `run` subcommand accepting `--topic`, `--lang`, `--duration`, `--style`, `--llm`, `--bgm`, `--output-dir`
  - `studio.config.StudioConfig` dataclass — holds all resolved config (CLI flags merged with `config.yaml` defaults)
  - `studio.config.load_config(cli_kwargs: dict) -> StudioConfig`

- [ ] **Step 1: Create `Dockerfile`**

```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENTRYPOINT ["python", "-m", "studio"]
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
services:
  studio:
    build: .
    volumes:
      - .:/app
    environment:
      - GEMINI_API_KEY
      - GROQ_API_KEY
      - OPENAI_API_KEY
      - OPENAI_BASE_URL
    entrypoint: ["python"]
```

- [ ] **Step 3: Create `run.sh`**

```bash
#!/usr/bin/env bash
set -e
docker compose run --rm studio -m studio "$@"
```

- [ ] **Step 4: Write failing test for config loading**

```python
# tests/test_cli.py
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
```

- [ ] **Step 5: Run test inside Docker to verify it fails**

Run: `docker compose run --rm studio -m pytest tests/test_cli.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'studio'`

- [ ] **Step 6: Implement `StudioConfig` dataclass and `load_config` in `studio/config.py`**

Dataclass fields: `topic`, `lang` (default `"en"`), `duration` (default `30`), `style` (default `"cinematic"`), `llm_provider` (default `"gemini"`), `bgm_path` (default `None`), `output_dir` (default `Path("outputs")`), `project_dir` (default `Path(".")`). `load_config` merges a `config.yaml` (if present) with CLI kwargs, CLI wins.

- [ ] **Step 7: Create `requirements.txt`**

```
click>=8.0
rich>=12.0
edge-tts>=6.1
pydub>=0.25
requests>=2.28
pytest>=7.0
```

- [ ] **Step 8: Implement CLI entry point in `studio/cli.py` and `studio/__main__.py`**

`cli.py`: click group `main` with subcommand `run` wiring all flags to `load_config`. `__main__.py`: `from studio.cli import main; main()`.

- [ ] **Step 9: Create default `config.yaml`**

```yaml
lang: en
duration: 30
style: cinematic
llm_provider: gemini
```

- [ ] **Step 10: Build Docker image and run tests**

Run: `docker compose build && docker compose run --rm studio -m pytest tests/test_cli.py -v`
Expected: PASS

- [ ] **Step 11: Verify CLI runs inside container**

Run: `./run.sh run --help`
Expected: shows help with all flags listed

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding with Docker, config schema, CLI entry point"
```

---

### Task 2: State Manager (Checkpoint & Resume)

**Files:**
- Create: `studio/state.py`
- Test: `tests/test_state.py`

**Interfaces:**
- Consumes: `StudioConfig.output_dir` from Task 1
- Produces:
  - `studio.state.StateManager(state_path: Path)`
  - `.get_shot_status(shot_id: str) -> dict` — returns `{"script": bool, "audio": bool, "image": bool, "video": bool}`
  - `.mark_complete(shot_id: str, stage: str) -> None` — marks one stage done for a shot
  - `.is_stage_complete(shot_id: str, stage: str) -> bool`
  - `.save() -> None` / `.load() -> None` — persists to / reads from JSON file

- [ ] **Step 1: Write failing tests**

```python
# tests/test_state.py
from studio.state import StateManager
import tempfile, json
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose run --rm studio -m pytest tests/test_state.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `StateManager` in `studio/state.py`**

Internal dict `_state: dict[str, dict[str, bool]]`. `save()` writes JSON atomically (write to `.tmp`, then rename). `load()` reads if file exists, else empty dict.

- [ ] **Step 4: Run tests to verify they pass**

Run: `docker compose run --rm studio -m pytest tests/test_state.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add studio/state.py tests/test_state.py
git commit -m "feat: state manager with checkpoint & resume"
```

---

### Task 3: LLM Provider Interface & Storyboard Generation

**Files:**
- Create: `studio/llm/__init__.py`
- Create: `studio/llm/base.py`
- Create: `studio/llm/gemini.py`
- Create: `studio/llm/groq_provider.py`
- Create: `studio/llm/openai_compat.py`
- Create: `studio/llm/ollama.py`
- Create: `studio/llm/factory.py`
- Create: `studio/storyboard.py`
- Create: `studio/prompts.py`
- Test: `tests/test_storyboard.py`

**Interfaces:**
- Consumes: `StudioConfig` from Task 1
- Produces:
  - `studio.llm.base.LLMProvider` (ABC): `.generate(system_prompt: str, user_prompt: str) -> str`
  - `studio.llm.factory.create_llm(provider_name: str) -> LLMProvider`
  - `studio.storyboard.Storyboard` dataclass: `.title`, `.language`, `.characters: dict[str, Character]`, `.shots: list[Shot]`
  - `studio.storyboard.Character` dataclass: `.name`, `.visual_anchor`, `.voice`, `.seed`
  - `studio.storyboard.Shot` dataclass: `.id`, `.chapter`, `.character_id`, `.dialogue`, `.image_prompt`, `.motion`, `.duration`
  - `studio.storyboard.generate_storyboard(config: StudioConfig, llm: LLMProvider) -> Storyboard`
  - `studio.storyboard.parse_storyboard_json(raw: str) -> Storyboard` — strips markdown fences, repairs trailing commas, validates schema

- [ ] **Step 1: Write failing tests for JSON parsing and repair**

```python
# tests/test_storyboard.py
from studio.storyboard import parse_storyboard_json

def test_parse_clean_json():
    raw = '{"title":"T","language":"en","characters":{},"shots":[]}'
    sb = parse_storyboard_json(raw)
    assert sb.title == "T"
    assert sb.shots == []

def test_storyboard_json_repair():
    raw = '```json\n{"title":"T","language":"en","characters":{},"shots":[],}\n```'
    sb = parse_storyboard_json(raw)
    assert sb.title == "T"

def test_parse_with_characters_and_shots():
    raw = json.dumps({
        "title": "Test",
        "language": "vi",
        "characters": {"hero": {"name": "Hero", "visual_anchor": "tall man", "voice": "vi-VN-NamMinhNeural"}},
        "shots": [{"id": "shot_001_001", "chapter": 1, "character_id": "hero",
                   "dialogue": "Hello", "image_prompt": "a scene", "motion": "zoom_in", "duration": None}]
    })
    sb = parse_storyboard_json(raw)
    assert len(sb.shots) == 1
    assert sb.characters["hero"].name == "Hero"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_storyboard.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `LLMProvider` ABC in `studio/llm/base.py`**

Abstract method `generate(system_prompt: str, user_prompt: str) -> str`.

- [ ] **Step 4: Implement four providers**

Each provider's `generate` calls its respective API/endpoint. Gemini uses `google-genai`, Groq uses `groq` SDK, OpenAI-compatible uses `requests` to the chat completions endpoint, Ollama uses `requests` to `http://localhost:11434/api/generate`.

- [ ] **Step 5: Implement `create_llm(provider_name: str) -> LLMProvider` in `studio/llm/factory.py`**

Switch on provider name string, validate required env vars, raise clear error if missing.

- [ ] **Step 6: Implement dataclasses and `parse_storyboard_json` in `studio/storyboard.py`**

Stripping logic: remove leading/trailing whitespace, strip `` ```json `` / `` ``` `` fences, strip trailing commas before `]` or `}`, then `json.loads`. Map to `Storyboard`/`Character`/`Shot` dataclasses.

- [ ] **Step 7: Implement `generate_storyboard` in `studio/storyboard.py`**

Builds system+user prompts from `studio/prompts.py` templates (injecting `config.lang`, `config.duration`, `config.style`), calls `llm.generate()`, passes result through `parse_storyboard_json`. Prompt templates stored in `studio/prompts.py` as multi-line strings.

- [ ] **Step 8: Run tests to verify they pass**

Run: `python -m pytest tests/test_storyboard.py -v`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add studio/llm/ studio/storyboard.py studio/prompts.py tests/test_storyboard.py
git commit -m "feat: LLM providers and storyboard generation with JSON repair"
```

---

### Task 4: Voice & Audio Engine (TTS)

**Files:**
- Create: `studio/tts.py`
- Test: `tests/test_tts.py`

**Interfaces:**
- Consumes: `Storyboard`, `Shot` from Task 3; `StateManager` from Task 2; `StudioConfig` from Task 1
- Produces:
  - `studio.tts.generate_audio_for_shot(shot: Shot, characters: dict, output_dir: Path) -> Path` — returns path to saved `.mp3`
  - `studio.tts.get_audio_duration(audio_path: Path) -> float` — returns duration in seconds
  - `studio.tts.run_tts_stage(storyboard: Storyboard, config: StudioConfig, state: StateManager) -> None` — processes all shots, skipping completed ones, updates state

- [ ] **Step 1: Write failing tests**

```python
# tests/test_tts.py
from studio.tts import generate_audio_for_shot, get_audio_duration
from studio.storyboard import Shot, Character

def test_empty_dialogue_shot_returns_none(tmp_path):
    shot = Shot(id="s1", chapter=1, character_id=None, dialogue="", image_prompt="x", motion="zoom_in", duration=None)
    result = generate_audio_for_shot(shot, {}, tmp_path)
    assert result is None

# Integration test (requires network, marked slow)
import pytest
@pytest.mark.slow
def test_generate_audio_produces_file(tmp_path):
    chars = {"hero": Character(name="Hero", visual_anchor="x", voice="en-US-GuyNeural", seed=42)}
    shot = Shot(id="s1", chapter=1, character_id="hero", dialogue="Hello world", image_prompt="x", motion="zoom_in", duration=None)
    path = generate_audio_for_shot(shot, chars, tmp_path)
    assert path is not None
    assert path.exists()
    dur = get_audio_duration(path)
    assert dur > 0.5
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_tts.py -v -k "not slow"`
Expected: FAIL

- [ ] **Step 3: Implement `studio/tts.py`**

`generate_audio_for_shot`: if `shot.dialogue` is empty or None, return `None`. Otherwise resolve voice from `characters[shot.character_id].voice`, call `edge_tts.Communicate(text, voice).save(output_path)` via `asyncio.run`. `get_audio_duration` uses `pydub.AudioSegment.from_mp3(path).duration_seconds`. `run_tts_stage` iterates shots, checks `state.is_stage_complete(shot.id, "audio")`, skips if done, calls `generate_audio_for_shot`, marks complete, saves state.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_tts.py -v -k "not slow"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add studio/tts.py tests/test_tts.py
git commit -m "feat: TTS voice engine with edge-tts"
```

---

### Task 5: Visual & Character Engine (Image Generation)

**Files:**
- Create: `studio/images.py`
- Test: `tests/test_images.py`

**Interfaces:**
- Consumes: `Storyboard`, `Shot`, `Character` from Task 3; `StateManager` from Task 2; `StudioConfig` from Task 1
- Produces:
  - `studio.images.build_full_prompt(shot: Shot, characters: dict, style: str) -> str` — prepends character visual anchor and appends style DNA
  - `studio.images.generate_image_for_shot(shot: Shot, characters: dict, style: str, output_dir: Path) -> Path`
  - `studio.images.run_image_stage(storyboard: Storyboard, config: StudioConfig, state: StateManager) -> None`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_images.py
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
    # Should not raise, should return None or a placeholder path after retries
    result = generate_image_for_shot(shot, {}, "cinematic", tmp_path)
    assert result is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_images.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `studio/images.py`**

`build_full_prompt`: if `character_id` in characters, prepend `character.visual_anchor + ", "` to `shot.image_prompt`, then append style DNA suffix string per style preset. `generate_image_for_shot`: build prompt, URL-encode it, call `requests.get(f"https://image.pollinations.ai/prompt/{encoded}?model=flux&width=1280&height=720&seed={seed}", timeout=30)` with 3× retry and exponential backoff. Save response bytes as PNG. On exhausted retries, return `None`. `run_image_stage`: iterate shots, skip completed via state, call generate, mark complete.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_images.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add studio/images.py tests/test_images.py
git commit -m "feat: image generation with Pollinations API and character injection"
```

---

### Task 6: Motion & Cinematics Engine (Ken Burns FFmpeg)

**Files:**
- Create: `studio/motion.py`
- Test: `tests/test_motion.py`

**Interfaces:**
- Consumes: `Shot` from Task 3; `StateManager` from Task 2; audio durations from Task 4; image paths from Task 5
- Produces:
  - `studio.motion.build_ffmpeg_command(image_path: Path, output_path: Path, duration: float, motion_type: str, fps: int = 25) -> list[str]` — returns FFmpeg command as list of args
  - `studio.motion.render_motion_for_shot(image_path: Path, output_path: Path, duration: float, motion_type: str) -> Path`
  - `studio.motion.run_motion_stage(storyboard: Storyboard, config: StudioConfig, state: StateManager) -> None`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_motion.py
import shutil, pytest
from studio.motion import build_ffmpeg_command
from pathlib import Path

def test_build_ffmpeg_zoom_in():
    cmd = build_ffmpeg_command(Path("in.png"), Path("out.mp4"), 5.0, "zoom_in")
    assert cmd[0] == "ffmpeg"
    assert "-t" in cmd
    idx = cmd.index("-t")
    assert cmd[idx + 1] == "5.0"
    assert "zoompan" in " ".join(cmd)

def test_build_ffmpeg_pan_left():
    cmd = build_ffmpeg_command(Path("in.png"), Path("out.mp4"), 4.0, "pan_left")
    assert "zoompan" in " ".join(cmd)

def test_ffmpeg_missing_error():
    # Simulate ffmpeg not found
    from studio.motion import render_motion_for_shot
    import subprocess
    # Temporarily make ffmpeg unfindable
    if not shutil.which("ffmpeg"):
        with pytest.raises(RuntimeError, match="[Ff][Ff]mpeg"):
            render_motion_for_shot(Path("in.png"), Path("out.mp4"), 5.0, "zoom_in")

def test_empty_dialogue_default_duration():
    cmd = build_ffmpeg_command(Path("in.png"), Path("out.mp4"), 5.0, "zoom_in")
    idx = cmd.index("-t")
    assert float(cmd[idx + 1]) == 5.0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_motion.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `studio/motion.py`**

`build_ffmpeg_command`: builds FFmpeg command with `-loop 1 -i {image}` input and `-vf` zoompan filter. Motion types map to different zoompan expressions:
- `zoom_in`: `z='min(zoom+0.0015,1.2)'` centered
- `zoom_out`: `z='if(eq(on,1),1.2,max(zoom-0.0015,1.0))'` centered
- `pan_left`: zoom fixed at 1.1, x drifts left
- `pan_right`: zoom fixed at 1.1, x drifts right

Output at 1920×1080, `-c:v libx264 -pix_fmt yuv420p`. `render_motion_for_shot`: checks `shutil.which("ffmpeg")`, raises `RuntimeError("FFmpeg not found")` if missing, then `subprocess.run(cmd, check=True)`. `run_motion_stage`: iterates shots, resolves audio duration (default 5.0 for silent shots), skips completed, renders, marks complete.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_motion.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add studio/motion.py tests/test_motion.py
git commit -m "feat: Ken Burns motion engine via FFmpeg zoompan"
```

---

### Task 7: Assembly & Mastering Engine

**Files:**
- Create: `studio/assembly.py`
- Create: `studio/subtitles.py`
- Test: `tests/test_assembly.py`

**Interfaces:**
- Consumes: `Storyboard` from Task 3; `StudioConfig` from Task 1; video clips from Task 6; audio files from Task 4
- Produces:
  - `studio.subtitles.generate_srt(storyboard: Storyboard, audio_durations: dict[str, float], output_path: Path) -> Path`
  - `studio.assembly.create_concat_file(video_paths: list[Path], output_path: Path) -> Path` — writes FFmpeg concat demuxer file
  - `studio.assembly.mix_bgm(narration_path: Path, bgm_path: Path, output_path: Path, ducking_db: float = -14) -> Path`
  - `studio.assembly.run_assembly_stage(storyboard: Storyboard, config: StudioConfig, state: StateManager) -> Path` — returns path to final movie

- [ ] **Step 1: Write failing tests**

```python
# tests/test_assembly.py
from studio.subtitles import generate_srt
from studio.storyboard import Storyboard, Shot, Character
from pathlib import Path

def test_generate_srt_format(tmp_path):
    shots = [
        Shot(id="s1", chapter=1, character_id=None, dialogue="Hello world", image_prompt="x", motion="zoom_in", duration=3.0),
        Shot(id="s2", chapter=1, character_id=None, dialogue="Second line", image_prompt="x", motion="zoom_in", duration=4.0),
    ]
    sb = Storyboard(title="T", language="en", characters={}, shots=shots)
    durations = {"s1": 3.0, "s2": 4.0}
    srt = generate_srt(sb, durations, tmp_path / "out.srt")
    content = srt.read_text()
    assert "00:00:00,000" in content
    assert "Hello world" in content
    assert "Second line" in content

def test_generate_srt_skips_empty_dialogue(tmp_path):
    shots = [
        Shot(id="s1", chapter=1, character_id=None, dialogue="", image_prompt="x", motion="zoom_in", duration=5.0),
        Shot(id="s2", chapter=1, character_id=None, dialogue="Only this", image_prompt="x", motion="zoom_in", duration=3.0),
    ]
    sb = Storyboard(title="T", language="en", characters={}, shots=shots)
    durations = {"s1": 5.0, "s2": 3.0}
    srt = generate_srt(sb, durations, tmp_path / "out.srt")
    content = srt.read_text()
    assert "Only this" in content
    # Empty dialogue shot should not appear as a subtitle entry
    lines = [l.strip() for l in content.strip().split('\n') if l.strip()]
    assert lines[0] == "1"  # Only one subtitle block numbered "1"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_assembly.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `studio/subtitles.py`**

`generate_srt`: iterate shots with a running time accumulator. For each shot with non-empty dialogue, write an SRT entry (index, start timestamp `HH:MM:SS,mmm` → end timestamp, text). Skip empty-dialogue shots but still advance the time accumulator by their duration.

- [ ] **Step 4: Implement `studio/assembly.py`**

`create_concat_file`: writes a text file listing `file 'path'` lines for FFmpeg concat demuxer. `mix_bgm`: uses `pydub` to load narration and BGM, loop BGM to narration length, apply overlay with `bgm - ducking_db` volume, export. `run_assembly_stage`: collects all video clip paths in order, creates concat file, runs `ffmpeg -f concat -safe 0 -i list.txt -c copy concat.mp4`, then mixes BGM if available, burns subtitles via ffmpeg `subtitles` filter, outputs final file.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_assembly.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add studio/assembly.py studio/subtitles.py tests/test_assembly.py
git commit -m "feat: assembly engine with SRT subtitles and BGM mixing"
```

---

### Task 8: Orchestrator & End-to-End Pipeline

**Files:**
- Create: `studio/orchestrator.py`
- Modify: `studio/cli.py` — wire `run` command to orchestrator
- Test: `tests/test_orchestrator.py`

**Interfaces:**
- Consumes: all modules from Tasks 1–7
- Produces:
  - `studio.orchestrator.run_pipeline(config: StudioConfig) -> Path` — executes all 5 stages in sequence, returns path to final video
  - Rich live progress display in terminal showing current stage and shot progress

- [ ] **Step 1: Write failing test**

```python
# tests/test_orchestrator.py
from studio.orchestrator import run_pipeline
from studio.config import StudioConfig

def test_run_pipeline_creates_orchestrator():
    # Verify the function exists and accepts StudioConfig
    import inspect
    sig = inspect.signature(run_pipeline)
    params = list(sig.parameters.keys())
    assert "config" in params
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_orchestrator.py -v`
Expected: FAIL

- [ ] **Step 3: Implement `studio/orchestrator.py`**

`run_pipeline`: instantiates `StateManager`, `LLMProvider` via factory, then runs stages sequentially:
1. Generate or load storyboard (skip if `storyboard.json` exists and state has all shots scripted)
2. `run_tts_stage`
3. `run_image_stage`
4. `run_motion_stage`
5. `run_assembly_stage`

Uses `rich.progress.Progress` with a task per stage and a sub-task for individual shots. Prints final output path on completion.

- [ ] **Step 4: Wire CLI `run` command to `run_pipeline` in `studio/cli.py`**

The `run` click command calls `load_config(kwargs)` then `run_pipeline(config)`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_orchestrator.py -v`
Expected: PASS

- [ ] **Step 6: Verify FFmpeg availability check at startup**

Run: `python -m studio run --topic "Test"` (with ffmpeg uninstalled or renamed)
Expected: clear error message about FFmpeg before any stage runs

- [ ] **Step 7: Commit**

```bash
git add studio/orchestrator.py studio/cli.py tests/test_orchestrator.py
git commit -m "feat: orchestrator wiring all stages with rich progress display"
```

---

### Task 9: Default BGM Assets & README

**Files:**
- Create: `assets/bgm/.gitkeep`
- Create: `README.md`

**Interfaces:**
- Consumes: final working CLI from Task 8
- Produces: user documentation and placeholder BGM directory

- [ ] **Step 1: Create `assets/bgm/.gitkeep`**

Empty file to track the BGM directory in git.

- [ ] **Step 2: Write `README.md`**

Sections: project description, prerequisites (Python 3.8+, FFmpeg), installation (`pip install -r requirements.txt`), quick start (`python -m studio run --topic "..." --lang vi`), CLI reference table (all flags), configuration (`config.yaml`), LLM provider setup (env vars for each provider), adding custom BGM, project structure diagram, license.

- [ ] **Step 3: Verify end-to-end with a short test**

Run: `python -m studio run --topic "A short story about a cat" --duration 1 --llm ollama`
Expected: pipeline runs through all 5 stages, outputs a video file to `outputs/final/`

- [ ] **Step 4: Commit**

```bash
git add assets/ README.md
git commit -m "docs: README and BGM asset directory"
```
