from pathlib import Path
from typing import Dict
from studio.storyboard import Storyboard

def format_timestamp(seconds: float) -> str:
    """Format seconds into SRT timestamp HH:MM:SS,mmm."""
    total_ms = int(round(seconds * 1000))
    hours = total_ms // 3600000
    minutes = (total_ms % 3600000) // 60000
    secs = (total_ms % 60000) // 1000
    ms = total_ms % 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"

def generate_srt(
    storyboard: Storyboard,
    audio_durations: Dict[str, float],
    output_path: Path
) -> Path:
    """Generate a standard .srt subtitle file from storyboard dialogue and shot durations."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    entries = []
    current_time = 0.0
    subtitle_index = 1

    for shot in storyboard.shots:
        duration = audio_durations.get(shot.id, shot.duration or 5.0)
        start_time = current_time
        end_time = current_time + duration
        current_time = end_time

        text = (shot.dialogue or "").strip()
        if not text:
            continue

        start_str = format_timestamp(start_time)
        end_str = format_timestamp(end_time)

        entry = f"{subtitle_index}\n{start_str} --> {end_str}\n{text}\n"
        entries.append(entry)
        subtitle_index += 1

    content = "\n".join(entries)
    output_path.write_text(content, encoding="utf-8")
    return output_path
