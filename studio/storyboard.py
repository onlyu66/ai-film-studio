from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Any
import json
import re
from studio.config import StudioConfig
from studio.llm.base import LLMProvider
from studio.prompts import STORYBOARD_SYSTEM_PROMPT, get_storyboard_user_prompt

@dataclass
class Character:
    name: str
    visual_anchor: str
    voice: str = "en-US-GuyNeural"
    seed: int = 42
    headshot_url: Optional[str] = None
    face_dna: Optional[str] = None

@dataclass
class Shot:
    id: str
    chapter: int
    character_id: Optional[str]
    dialogue: str
    image_prompt: str
    motion: str = "zoom_in"
    duration: Optional[float] = None
    sfx: Optional[str] = None
    act: Optional[int] = 1
    mood: Optional[str] = None
    emotion: Optional[str] = None
    shot_size: Optional[str] = None
    camera_angle: Optional[str] = None
    lighting: Optional[str] = None
    camera_lens: Optional[str] = None
    multi_angle_options: Optional[Dict[str, str]] = None
    location_id: Optional[str] = None
    is_approved: bool = False
    voice_volume: float = 1.0
    sfx_volume: float = 1.0
    fade_in: float = 0.0
    fade_out: float = 0.0
    camera_3d_trajectory: Optional[Dict[str, Any]] = None

@dataclass
class Storyboard:
    title: str
    language: str
    characters: Dict[str, Character] = field(default_factory=dict)
    locations: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    shots: List[Shot] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "language": self.language,
            "locations": dict(self.locations),
            "characters": {
                k: {
                    "name": v.name,
                    "visual_anchor": v.visual_anchor,
                    "voice": v.voice,
                    "seed": v.seed,
                    "headshot_url": v.headshot_url,
                    "face_dna": v.face_dna,
                }
                for k, v in self.characters.items()
            },
            "shots": [
                {
                    "id": s.id,
                    "chapter": s.chapter,
                    "character_id": s.character_id,
                    "location_id": getattr(s, "location_id", None),
                    "dialogue": s.dialogue,
                    "image_prompt": s.image_prompt,
                    "motion": s.motion,
                    "duration": s.duration,
                    "sfx": s.sfx,
                    "act": s.act,
                    "mood": s.mood,
                    "emotion": s.emotion,
                    "shot_size": s.shot_size,
                    "camera_angle": s.camera_angle,
                    "lighting": s.lighting,
                    "camera_lens": getattr(s, "camera_lens", None),
                    "multi_angle_options": getattr(s, "multi_angle_options", None),
                    "is_approved": s.is_approved,
                    "voice_volume": getattr(s, "voice_volume", 1.0),
                    "sfx_volume": getattr(s, "sfx_volume", 1.0),
                    "fade_in": getattr(s, "fade_in", 0.0),
                    "fade_out": getattr(s, "fade_out", 0.0),
                    "camera_3d_trajectory": getattr(s, "camera_3d_trajectory", None),
                }
                for s in self.shots
            ],
        }

def repair_json_string(raw: str) -> str:
    """Clean markdown fences and repair common LLM JSON syntax errors."""
    text = raw.strip()
    # Strip markdown code blocks
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    # Find the outermost JSON object bounds if there's surrounding conversational text
    start_idx = text.find("{")
    end_idx = text.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        text = text[start_idx : end_idx + 1]

    # Remove trailing commas before closing braces or brackets: ,] or ,}
    text = re.sub(r",\s*([\]}])", r"\1", text)
    return text

def parse_storyboard_json(raw: str) -> Storyboard:
    """Parse raw LLM output string into a Storyboard instance."""
    cleaned = repair_json_string(raw)
    data = json.loads(cleaned)

    title = data.get("title", "Untitled Film")
    language = data.get("language", "en")

    characters: Dict[str, Character] = {}
    for char_id, char_data in data.get("characters", {}).items():
        if isinstance(char_data, dict):
            anchor_val = char_data.get("visual_anchor", "")
            if isinstance(anchor_val, dict):
                anchor_str = ", ".join(f"{k}: {v}" for k, v in anchor_val.items() if v)
            else:
                anchor_str = str(anchor_val or "")

            characters[char_id] = Character(
                name=str(char_data.get("name", char_id)),
                visual_anchor=anchor_str,
                voice=str(char_data.get("voice", "en-US-GuyNeural")),
                seed=int(char_data.get("seed", 42)),
                headshot_url=char_data.get("headshot_url"),
                face_dna=char_data.get("face_dna"),
            )

    raw_locations = data.get("locations", {})
    locations: Dict[str, Dict[str, Any]] = raw_locations if isinstance(raw_locations, dict) else {}

    shots: List[Shot] = []
    for s in data.get("shots", []):
        if isinstance(s, dict):
            img_val = s.get("image_prompt", "")
            if isinstance(img_val, dict):
                img_str = ", ".join(f"{k}: {v}" if isinstance(v, str) else str(v) for k, v in img_val.items() if v)
            else:
                img_str = str(img_val or "")

            # Derive act from 'act' field or fallback to chapter (or 1)
            raw_act = s.get("act")
            if raw_act is not None:
                try:
                    act_num = int(raw_act)
                except (ValueError, TypeError):
                    act_num = 1
            else:
                chap = int(s.get("chapter", 1))
                act_num = min(3, max(1, chap))

            shots.append(
                Shot(
                    id=str(s.get("id", f"shot_{len(shots)+1:03d}")),
                    chapter=int(s.get("chapter", 1)),
                    character_id=s.get("character_id"),
                    dialogue=str(s.get("dialogue", "") or ""),
                    image_prompt=img_str,
                    motion=s.get("motion", "zoom_in") or "zoom_in",
                    duration=float(s["duration"]) if s.get("duration") is not None else None,
                    sfx=str(s["sfx"]).strip() if s.get("sfx") else None,
                    act=act_num,
                    mood=str(s["mood"]).strip().lower() if s.get("mood") else None,
                    emotion=str(s["emotion"]).strip().lower() if s.get("emotion") else None,
                    shot_size=str(s["shot_size"]).strip().lower() if s.get("shot_size") else None,
                    camera_angle=str(s["camera_angle"]).strip().lower() if s.get("camera_angle") else None,
                    lighting=str(s["lighting"]).strip().lower() if s.get("lighting") else None,
                    camera_lens=str(s["camera_lens"]).strip() if s.get("camera_lens") else None,
                    multi_angle_options=s.get("multi_angle_options") if isinstance(s.get("multi_angle_options"), dict) else None,
                    location_id=str(s["location_id"]).strip() if s.get("location_id") else None,
                    is_approved=bool(s.get("is_approved", False)),
                    voice_volume=float(s.get("voice_volume", 1.0)) if s.get("voice_volume") is not None else 1.0,
                    sfx_volume=float(s.get("sfx_volume", 1.0)) if s.get("sfx_volume") is not None else 1.0,
                    fade_in=float(s.get("fade_in", 0.0)) if s.get("fade_in") is not None else 0.0,
                    fade_out=float(s.get("fade_out", 0.0)) if s.get("fade_out") is not None else 0.0,
                    camera_3d_trajectory=s.get("camera_3d_trajectory") if isinstance(s.get("camera_3d_trajectory"), dict) else None,
                )
            )

    return Storyboard(
        title=title,
        language=language,
        characters=characters,
        locations=locations,
        shots=shots,
    )

def generate_storyboard(config: StudioConfig, llm: LLMProvider) -> Storyboard:
    """Generate and parse a complete storyboard via LLM provider."""
    from studio.llm.ollama import OllamaProvider
    # For CPU-based Ollama, cap shots to keep generation time manageable.
    # Cloud providers (Gemini, Groq, OpenAI) can handle the full shot count.
    max_shots = 25 if isinstance(llm, OllamaProvider) else None
    if max_shots:
        print(f"  [Ollama/CPU] Capping storyboard to {max_shots} shots for performance. "
              f"Use --llm gemini or --llm groq for full {config.duration}-minute films.")

    parent_context = None
    if config.parent_project_id:
        parent_dir = Path("outputs/projects") / config.parent_project_id
        sb_path = parent_dir / "storyboard.json"
        if sb_path.exists():
            try:
                with open(sb_path, "r", encoding="utf-8") as f:
                    p_sb = json.load(f)
                chars_desc = []
                for cid, cdata in p_sb.get("characters", {}).items():
                    chars_desc.append(
                        f"- ID '{cid}': {cdata.get('name')} (Visual Anchor: {cdata.get('visual_anchor')}, "
                        f"Voice: {cdata.get('voice')}, Seed: {cdata.get('seed')})"
                    )
                prev_shots = p_sb.get("shots", [])
                ending_dialogue = prev_shots[-1].get("dialogue", "") if prev_shots else ""
                parent_context = (
                    f"Tên tập trước: {p_sb.get('title')}\n"
                    f"Danh sách nhân vật cố định bắt buộc kế thừa:\n" + "\n".join(chars_desc) + "\n"
                    f"Tình tiết kết thúc tập trước: '{ending_dialogue}'"
                )
            except Exception:
                pass

    user_prompt = get_storyboard_user_prompt(
        topic=config.topic,
        lang=config.lang,
        duration_minutes=config.duration,
        style=config.style,
        max_shots=max_shots,
        series_title=config.series_title,
        episode=config.episode,
        parent_context=parent_context,
        template_id=getattr(config, "template_id", None),
    )
    raw_response = llm.generate(STORYBOARD_SYSTEM_PROMPT, user_prompt)
    return parse_storyboard_json(raw_response)
