# AI Film Studio - System Design Document

**Date:** 2026-10-15  
**Topic:** Automated AI Video Production System for Long-Form Videos (>30 Minutes)  
**Author:** AI Agent (Antigravity) & User  

---

## 1. Intent & Context

The goal is to build **AI Film Studio** (`ai-film-studio`), an end-to-end, automated AI film production pipeline operable entirely via the command line inside the VS Code terminal.

A user provides a topic (e.g., `python -m studio run --topic "Bí ẩn thành phố Atlantis"`), and the studio automatically orchestrates:
1. Long-form multi-chapter story generation and scene breakdown (Storyboard).
2. Character consistency tracking and prompt engineering.
3. High-quality speech synthesis (TTS) with precise timestamping.
4. Scene image generation with visual anchor consistency.
5. Dynamic video motion application (Ken Burns 2.5D cinematics + video clips).
6. Post-production assembly (audio-syncing, BGM ducking, subtitle generation).
7. Final render outputting a complete, ready-to-watch `.mp4` video with `.srt` subtitles.

The primary budget constraint is **100% free / open-source**: no mandatory paid subscriptions (like ElevenLabs, Midjourney, or Runway Gen-3).

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **One-Command Pipeline:** Input a topic or script, execute, and walk away until the final master video is rendered.
- **Configurable Runtime:** Support both Vietnamese and English (`--lang vi` / `--lang en`), selectable voice presets, customizable target duration (e.g., `--duration 30`), and style presets (Cinematic, Anime, Noir, Documentary).
- **Long-Form Architecture (>30 Minutes):** Capable of generating and assembling 150–300+ shots without memory overflow or process failure.
- **Robust Checkpoint & Resuming:** Each shot's status (script, audio, image, video clip) is stored incrementally in `project_state.json`. If a network glitch or process interruption occurs, re-running the command resumes immediately from the unfinished shot.
- **Character & Style Consistency:** Standardized character "Visual DNA" dictionary and fixed style prompts embedded into image generation.
- **Zero Cost Priority:** Utilize free-tier and open-source tools:
  - Scripting: Google Gemini API (Free tier) or Groq / Ollama / DeepSeek.
  - Speech: `edge-tts` (Microsoft Edge neural voices, free, unlimited, native Vietnamese & English).
  - Images: Pollinations.ai (Flux/SDXL free API) or Hugging Face Inference API.
  - Motion & Assembly: FFmpeg and Python MoviePy / OpenCV.

### Non-Goals
- Real-time video rendering (rendering a 30-minute film with 200 shots will naturally take 15–40 minutes depending on network and CPU).
- Complex Graphical User Interface (GUI) or electron app (strictly terminal CLI in VS Code).
- High-end local GPU training (e.g., fine-tuning local LoRAs or running heavy 24GB VRAM models locally).

### Anti-Goals
- **Fragile Monolithic Scripts:** Do not write a single script that restarts from shot 1 if shot 180 fails.
- **Character Drift:** Characters must not drastically morph between consecutive shots.
- **Silent/Static Videos:** A 30-minute video must not feel like a static slideshow; dynamic Ken Burns camera motion (pan, tilt, slow zoom) and BGM ducking must be applied.

---

## 3. System Architecture & Components

```
User CLI: python -m studio run --topic "..."
   │
   ▼
┌────────────────────────────────────────────────────────┐
│               STUDIO ORCHESTRATOR                     │
│  - Reads config.yaml & CLI flags                       │
│  - Tracks state in project_state.json                  │
└────────────────────────────────────────────────────────┘
   │
   ├─► Stage 1: Script & Storyboard Engine
   │     • Breaks topic into Chapters & Scenes
   │     • Generates shots with dialogue, character ID, & visual prompt
   │     • Output: data/storyboard.json
   │
   ├─► Stage 2: Voice & Audio Engine (TTS)
   │     • Synthesizes character dialogue via edge-tts
   │     • Measures audio duration per shot
   │     • Output: outputs/audio/shot_{scene}_{shot}.mp3
   │
   ├─► Stage 3: Visual & Character Engine
   │     • Injects character visual anchors & style DNA into prompts
   │     • Calls free image generation API (Pollinations Flux / SDXL)
   │     • Output: outputs/images/shot_{scene}_{shot}.png
   │
   ├─► Stage 4: Motion & Cinematics Engine
   │     • Applies FFmpeg Ken Burns zoom/pan/tilt to match audio duration
   │     • Output: outputs/videos/shot_{scene}_{shot}.mp4
   │
   └─► Stage 5: Assembly & Mastering Engine
         • Concatenates video clips synchronously
         • Merges and loops background music (BGM) with auto-ducking
         • Generates or converts subtitles to .srt
         • Output: outputs/final/movie_{timestamp}.mp4
```

---

## 4. Key Design Decisions

### 4.1. Storyboard Schema (`storyboard.json`)
```json
{
  "title": "Bí ẩn thành phố Atlantis",
  "language": "vi",
  "target_duration_minutes": 30,
  "characters": {
    "Professor_John": {
      "name": "Giáo sư John",
      "visual_anchor": "elderly Caucasian male archaeologist, 60 years old, short white beard, gold-rimmed round spectacles, tweed vest over beige shirt",
      "voice": "vi-VN-NamMinhNeural"
    }
  },
  "shots": [
    {
      "id": "shot_001_001",
      "chapter": 1,
      "character_id": "Professor_John",
      "dialogue": "Truyền thuyết về Atlantis không phải là một câu chuyện hoang đường.",
      "image_prompt": "Cinematic wide shot of Professor_John in a dimly lit antique study room examining an ancient map, candle light, vintage globes, photorealistic 8k, cinematic lighting",
      "motion": "zoom_in",
      "duration": null
    }
  ]
}
```

### 4.2. Character Consistency Mechanism
- A dedicated `characters.json` catalog acts as the "Character Bible".
- Whenever a `character_id` is present in a shot, its `visual_anchor` description is automatically prefixed to the `image_prompt`.
- A consistent `seed` number can be assigned per character or per chapter to reduce random variations.

### 4.3. Video Motion Engine (Phase 1 Strategy)
- For long-form (30+ min) containing 150–250 shots, cloud AI video generation without paid credits quickly hits rate-limits and unpredictable queues.
- **Phase 1 Implementation:** The motion engine uses **100% local, deterministic Ken Burns Motion** (2.5D camera zoom, pan, tilt, subtle drift) rendered via FFmpeg filters.
- **Extensible Architecture:** Designed with a modular `VideoMotionProvider` interface so that cloud AI video services (e.g. Hugging Face Spaces, CogVideoX, Luma) can be toggled on for specific key shots in future updates without refactoring.

### 4.4. Audio, BGM, and Subtitles
- **Voice TTS:** `edge-tts` produces natural Vietnamese and English neural speech with zero API keys required.
- **BGM Sourcing Strategy:** 
  - Shipped with a curated set of lightweight CC0 royalty-free ambient music tracks in `assets/bgm/` corresponding to style presets (`cinematic.mp3`, `documentary.mp3`, `ambient.mp3`).
  - Users can override BGM using the `--bgm <path>` CLI option.
  - Automatic audio ducking (-14dB) is applied to the background track whenever character narration is playing.
- **Subtitles:** Generated synchronously from the storyboard dialogue timestamps, outputting a compliant `.srt` file.

---

## 5. Technology Stack

- **CLI & Orchestration:** Python 3.8+, `click`, `rich` (for live terminal progress bars and status panels).
- **LLM (Script Generation):** Multi-provider architecture with a unified `LLMProvider` interface:
  - **Google Gemini** (default cloud): `google-genai` SDK, requires `GEMINI_API_KEY` env var. Free tier: 15 RPM, 1M token context.
  - **Groq**: `groq` SDK, requires `GROQ_API_KEY` env var. Free tier: 30 RPM, fast inference via Llama/Mixtral.
  - **OpenAI-compatible**: Any endpoint conforming to OpenAI chat completions API (e.g., DeepSeek, Together AI). Requires `OPENAI_API_KEY` and `OPENAI_BASE_URL`.
  - **Ollama (local)**: HTTP calls to `http://localhost:11434`. Zero API keys. Requires Ollama installed with a model pulled (e.g., `llama3.1`, `qwen2.5`).
  - Provider selection via CLI flag `--llm gemini|groq|openai|ollama` or `config.yaml`.
- **TTS:** `edge-tts` (async Microsoft Edge neural TTS engine, zero API keys, unlimited).
- **Image Generation:** `requests` calling Pollinations API (`https://image.pollinations.ai/prompt/{prompt}?model=flux&width=1280&height=720&seed={seed}`). Zero API keys.
- **Video Assembly:** `ffmpeg` (system executable) for Ken Burns motion rendering and final concatenation.
- **Audio Processing:** `pydub` for audio ducking, normalization, and BGM mixing.
- **State Management:** JSON-based checkpoint tracking in `outputs/state.json`.

---

## 6. What's Left to the Builder

- Exact implementation of the FFmpeg zoompan filter formula for smooth 24/30fps rendering without jitter.
- Detailed prompt template engineering for LLM chapter breakdown.
- Graceful error handling and retry logic (exponential backoff for network calls).
- Audio volume normalization and ducking calculation (-14dB BGM ducking during voiceover).
