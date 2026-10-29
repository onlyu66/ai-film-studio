from pathlib import Path
from typing import Optional, Callable, Dict, Any
import json
import shutil
from rich.console import Console
from rich.panel import Panel

from studio.config import StudioConfig
from studio.storage import atomic_write_json
from studio.state import StateManager
from studio.llm.factory import create_llm
from studio.storyboard import Storyboard, generate_storyboard, parse_storyboard_json
from studio.tts import run_tts_stage
from studio.images import run_image_stage
from studio.motion import run_motion_stage
from studio.assembly import run_assembly_stage

console = Console()

class PipelineCancelledException(Exception):
    """Raised when the film production pipeline is cancelled by the user."""
    pass

ProgressCallback = Optional[Callable[..., None]]

def run_pipeline(
    config: StudioConfig,
    stop_after_stage: Optional[int] = None,
    force_new: bool = False,
    progress_callback: ProgressCallback = None,
    cancel_event: Optional[Any] = None,
) -> Path:
    """Execute the end-to-end automated film production pipeline with optional progress reporting."""
    def check_cancel():
        if cancel_event and cancel_event.is_set():
            raise PipelineCancelledException("Tiến trình sản xuất đã bị hủy theo yêu cầu.")

    check_cancel()

    def notify(stage: int, stage_name: str, progress: int, msg: str, **kwargs):
        if progress_callback:
            try:
                progress_callback(stage, stage_name, progress, msg, **kwargs)
            except TypeError:
                progress_callback(stage, stage_name, progress, msg)
            except Exception:
                pass

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
    notify(1, "Đang soạn kịch bản & phân cảnh...", 5, f"Bắt đầu soạn kịch bản: {config.topic}")

    if force_new and storyboard_file.exists():
        storyboard_file.unlink()

    if storyboard_file.exists():
        console.print(f"  [dim]Found existing storyboard at {storyboard_file}, resuming...[/dim]")
        with open(storyboard_file, "r", encoding="utf-8") as f:
            storyboard = parse_storyboard_json(f.read())
    else:
        llm = create_llm(config.llm_provider, api_key=config.llm_api_key, model=config.llm_model)
        storyboard = generate_storyboard(config, llm)
        atomic_write_json(storyboard_file, storyboard.to_dict(), backup=True)
        console.print(f"  [green]✓ Storyboard created with {len(storyboard.shots)} shots.[/green]")

    notify(1, "Kịch bản đã sẵn sàng", 20, f"Đã có kịch bản với {len(storyboard.shots)} phân cảnh")

    if stop_after_stage == 1:
        console.print(Panel.fit(
            f"[bold yellow]⏸️ Pipeline Paused After Stage 1 (Script Review Mode)[/bold yellow]\n"
            f"[green]Storyboard:[/green] {storyboard_file}\n"
            f"[dim]You can now review characters, change voices, and edit shot dialogues in the Web UI before continuing.[/dim]",
            title="📝 Script Ready for Review"
        ))
        return storyboard_file

    # Stage 2: Voice & Audio (TTS)
    check_cancel()
    console.print("\n[bold yellow][Stage 2/5] Synthesizing Voiceover (TTS)...[/bold yellow]")
    notify(2, "Đang tổng hợp giọng nói AI (TTS)...", 20, "Bắt đầu tổng hợp giọng đọc...")
    durations = run_tts_stage(storyboard, config, state, progress_callback=notify, cancel_event=cancel_event)
    console.print(f"  [green]✓ Voice audio synthesized for {len(durations)} shots.[/green]")
    notify(2, "Hoàn tất giọng nói", 40, f"Đã tổng hợp âm thanh cho {len(durations)} phân cảnh")

    # Stage 3: Image Generation
    check_cancel()
    console.print("\n[bold yellow][Stage 3/5] Generating Visuals & Characters...[/bold yellow]")
    notify(3, "Đang vẽ hình ảnh điện ảnh Flux...", 40, "Bắt đầu vẽ hình ảnh...")
    images = run_image_stage(storyboard, config, state, progress_callback=notify, cancel_event=cancel_event)
    console.print(f"  [green]✓ Visuals rendered for {len(images)} shots.[/green]")
    notify(3, "Hoàn tất hình ảnh", 65, f"Đã vẽ hình ảnh cho {len(images)} phân cảnh")

    # Stage 4: Motion & Cinematics (Ken Burns)
    check_cancel()
    console.print("\n[bold yellow][Stage 4/5] Rendering Dynamic Camera Motion...[/bold yellow]")
    notify(4, "Đang render chuyển động máy quay 2.5D...", 65, "Bắt đầu render chuyển động...")
    video_clips = run_motion_stage(storyboard, config, state, durations, progress_callback=notify, cancel_event=cancel_event)
    console.print(f"  [green]✓ Motion clips rendered for {len(video_clips)} shots.[/green]")
    notify(4, "Hoàn tất chuyển động", 85, f"Đã render chuyển động cho {len(video_clips)} phân cảnh")

    # Stage 5: Assembly & Mastering
    check_cancel()
    console.print("\n[bold yellow][Stage 5/5] Assembling Master Video, BGM & Subtitles...[/bold yellow]")
    notify(5, "Đang ghép nối, hòa âm BGM và làm phụ đề...", 85, "Bắt đầu hậu kỳ xuất bản...")
    final_video = run_assembly_stage(storyboard, config, state, durations, progress_callback=notify)
    notify(5, "Sản xuất hoàn tất!", 100, f"Video hoàn thành: {final_video.name}")

    console.print(Panel.fit(
        f"[bold green]✨ Film Production Complete![/bold green]\n"
        f"[cyan]Master Video:[/cyan] {final_video}\n"
        f"[cyan]Subtitles:[/cyan] {final_video.with_suffix('.srt')}",
        title="🎉 Render Finished"
    ))

    return final_video
