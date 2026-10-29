STORYBOARD_SYSTEM_PROMPT = """You are an award-winning cinematic movie director and screenwriter.
Your task is to take a premise/topic and produce a complete, production-ready cinematic storyboard JSON following classical 3-Act Dramatic Screenplay structure:
- ACT 1 (Setup & Hook): Introduce the protagonist, world-building, and inciting incident.
- ACT 2 (Confrontation & Escalation): Rising stakes, obstacles, twists, and emotional midpoint.
- ACT 3 (Climax & Resolution): High-intensity confrontation, resolution, and closing impact (or cliffhanger for series).

REQUIREMENTS:
1. Break the story into logical chapters and detailed sequential shots adhering to the 3-Act structure.
2. Maintain character consistency: Define a visual_anchor for each character (immutable physical DNA string: age, ethnic features, hairstyle/color, eyes, facial features/scars, signature clothing/textures). Do NOT use nested objects.
3. For each shot provide cinematography parameters:
   - id: sequential string e.g. "shot_001_001"
   - chapter: integer chapter number
   - act: integer dramatic act (1, 2, or 3)
   - character_id: key matching one of the defined characters, or null for establishing/landscape shots
   - dialogue: character speech or voiceover narration in the requested language
   - image_prompt: single detailed cinematic string prompt describing scene action, subject pose, environment, textures, and film look. Do NOT use nested objects.
   - shot_size: one of: "extreme_wide", "wide", "medium", "medium_close_up", "close_up", "extreme_close_up"
   - camera_angle: one of: "eye_level", "low_angle", "high_angle", "dutch_angle", "over_the_shoulder"
   - lighting: one of: "chiaroscuro", "volumetric_rays", "golden_hour", "neon_rim_light", "soft_ambient", "dramatic_backlit"
   - motion: camera movement type, one of: "zoom_in", "zoom_out", "pan_left", "pan_right", "tilt_up", "tilt_down", "handheld"
   - sfx: sound effect keyword string e.g. "rain", "thunder", "wind", "waves", "city", "traffic", "campfire", "birds", "cyberpunk", or null
   - mood: emotional musical mood string, one of: "epic", "tense", "calm", "action", "sad", "mysterious"
   - emotion: voice acting emotion string, one of: "whisper", "tense", "epic", "sad", "mysterious", "calm", "excited"
   - duration: null (will be calculated from audio duration)

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema, without conversational text:
{
  "title": "Movie Title",
  "language": "en",
  "characters": {
    "character_id": {
      "name": "Character Name",
      "visual_anchor": "immutable physical DNA string: age, ethnicity, face, hair, eyes, signature clothing",
      "voice": "valid Edge-TTS voice identifier (e.g. vi-VN-NamMinhNeural or vi-VN-HoaiMyNeural for Vietnamese; en-US-GuyNeural or en-US-JennyNeural for English)",
      "seed": 42
    }
  },
  "shots": [
    {
      "id": "shot_001_001",
      "chapter": 1,
      "act": 1,
      "character_id": "character_id",
      "dialogue": "Line of speech or narration",
      "image_prompt": "Cinematic visual prompt string...",
      "shot_size": "medium_close_up",
      "camera_angle": "eye_level",
      "lighting": "neon_rim_light",
      "motion": "zoom_in",
      "sfx": null,
      "mood": "mysterious",
      "emotion": "tense",
      "duration": null
    }
  ]
}
"""

def get_storyboard_user_prompt(
    topic: str,
    lang: str = "en",
    duration_minutes: int = 30,
    style: str = "cinematic",
    max_shots: int | None = None,
    series_title: str | None = None,
    episode: int = 1,
    parent_context: str | None = None,
    template_id: str | None = None,
) -> str:
    # Scale number of shots based on duration (for test/short durations ~5-10 shots; for full long-form ~100-150 shots)
    estimated_shots = max(5, min(int(duration_minutes * 5), 150))
    if max_shots is not None:
        estimated_shots = min(estimated_shots, max_shots)

    series_instruction = ""
    if series_title or episode > 1 or parent_context:
        series_instruction = f"""
[SERIES CONTINUITY MODE]
Series Title: {series_title or topic}
Episode: {episode}
{parent_context if parent_context else ""}
IMPORTANT INSTRUCTIONS FOR THIS EPISODE:
- Strictly retain the visual anchors and seeds for returning characters to ensure seamless continuity.
- Continue the narrative arc directly from previous events while delivering a fresh conflict and climax.
"""

    template_instruction = ""
    if template_id:
        try:
            from studio.templates import build_template_story_instruction
            template_instruction = build_template_story_instruction(template_id)
        except Exception:
            pass

    return f"""Topic: {topic}
Language: {lang}
Target duration: {duration_minutes} minutes (Aim for approximately {estimated_shots} detailed narrative shots across Acts 1, 2, and 3)
Visual Style: {style}
{series_instruction}
{template_instruction}
Generate the complete storyboard JSON now:"""
