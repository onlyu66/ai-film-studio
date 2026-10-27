from pathlib import Path
import json
import shutil
from rich.console import Console
from rich.panel import Panel

from studio.config import StudioConfig
from studio.state import StateManager
from studio.llm.factory import create_llm
from studio.storyboard import Storyboard, generate_storyboard, parse_storyboard_json
from studio.tts import run_tts_stage
from studio.images import run_image_stage
from studio.motion import run_motion_stage
from studio.assembly import run_assembly_stage

console = Console()

def run_pipeline(config: StudioConfig, stop_after_stage: int | None = None) -> Path:
    """Execute the end-to-end automated film production pipeline."""
    # Step 0: Pre-flight requirement checks
    if not shutil.which("ffmpeg"):
        raise RuntimeError("FFmpeg is required but not installed or found on PATH.")

    console.print(Panel.fit(
        f"[bold cyan]AI FILM STUDIO[/bold cyan]\n"
        f"[green]Topic:[/green] {config.topic}\n"
        f"[green]Language:[/green] {config.lang} | [green]Target Duration:[/green] {config.duration}m | [green]Style:[/green] {config.style}\n"
        f"[green]LLM Provider:[/green] {config.llm_provider}\n"
        f"[green]Motion Engine:[/green] {config.motion_engine} | [green]Lip-Sync:[/green] {config.lip_sync}",
        title="🎬 Starting Production"
    ))

    config.output_dir.mkdir(parents=True, exist_ok=True)
    state = StateManager(config.output_dir / "state.json")
    storyboard_file = config.output_dir / "storyboard.json"

    # Stage 1: Storyboard Generation
    console.print("\n[bold yellow][Stage 1/5] Writing Script & Storyboard...[/bold yellow]")
    if storyboard_file.exists():
        console.print(f"  [dim]Found existing storyboard at {storyboard_file}, resuming...[/dim]")
        with open(storyboard_file, "r", encoding="utf-8") as f:
            storyboard = parse_storyboard_json(f.read())
    else:
        llm = create_llm(config.llm_provider, api_key=config.llm_api_key, model=config.llm_model)
        storyboard = generate_storyboard(config, llm)
        with open(storyboard_file, "w", encoding="utf-8") as f:
            json.dump(storyboard.to_dict(), f, indent=2, ensure_ascii=False)
        console.print(f"  [green]✓ Storyboard created with {len(storyboard.shots)} shots.[/green]")

    if stop_after_stage == 1:
        console.print(Panel.fit(
            f"[bold yellow]⏸️ Pipeline Paused After Stage 1 (Script Review Mode)[/bold yellow]\n"
            f"[green]Storyboard:[/green] {storyboard_file}\n"
            f"[dim]You can now review characters, change voices, and edit shot dialogues in the Web UI before continuing.[/dim]",
            title="📝 Script Ready for Review"
        ))
        return storyboard_file

    # Stage 2: Voice & Audio (TTS)
    console.print("\n[bold yellow][Stage 2/5] Synthesizing Voiceover (TTS)...[/bold yellow]")
    durations = run_tts_stage(storyboard, config, state)
    console.print(f"  [green]✓ Voice audio synthesized for {len(durations)} shots.[/green]")

    # Stage 3: Image Generation
    console.print("\n[bold yellow][Stage 3/5] Generating Visuals & Characters...[/bold yellow]")
    images = run_image_stage(storyboard, config, state)
    console.print(f"  [green]✓ Visuals rendered for {len(images)} shots.[/green]")

    # Stage 4: Motion & Cinematics (Ken Burns)
    console.print("\n[bold yellow][Stage 4/5] Rendering Dynamic Camera Motion...[/bold yellow]")
    video_clips = run_motion_stage(storyboard, config, state, durations)
    console.print(f"  [green]✓ Motion clips rendered for {len(video_clips)} shots.[/green]")

    # Stage 5: Assembly & Mastering
    console.print("\n[bold yellow][Stage 5/5] Assembling Master Video, BGM & Subtitles...[/bold yellow]")
    final_video = run_assembly_stage(storyboard, config, state, durations)

    console.print(Panel.fit(
        f"[bold green]✨ Film Production Complete![/bold green]\n"
        f"[cyan]Master Video:[/cyan] {final_video}\n"
        f"[cyan]Subtitles:[/cyan] {final_video.with_suffix('.srt')}",
        title="🎉 Render Finished"
    ))

    return final_video
