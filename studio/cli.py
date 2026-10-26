import click
from studio.config import load_config
from studio.orchestrator import run_pipeline

@click.group()
def main():
    """AI Film Studio — Automated AI Video Production System."""
    pass

@main.command()
@click.option("--topic", required=True, help="Topic or premise of the film")
@click.option("--lang", default=None, help="Language code (e.g. en, vi)")
@click.option("--duration", default=None, type=int, help="Target duration in minutes")
@click.option("--style", default=None, help="Visual style preset (e.g. cinematic, anime, noir)")
@click.option("--llm", default=None, help="LLM provider: gemini, groq, openai, ollama")
@click.option("--motion", "motion_engine", default="kenburns", type=click.Choice(["kenburns", "vfx", "replicate"]), help="Motion engine: kenburns (free), vfx (cinematic atmosphere), replicate (AI video)")
@click.option("--lip-sync", "lip_sync", default="none", type=click.Choice(["none", "cloud"]), help="Lip-sync engine: none (default), cloud (Replicate SadTalker)")
@click.option("--aspect-ratio", "aspect_ratio", default="16:9", type=click.Choice(["16:9", "9:16"]), help="Aspect ratio: 16:9 (landscape) or 9:16 (vertical shorts/tiktok)")
@click.option("--hardsub/--no-hardsub", "hardsub", default=False, help="Burn subtitles directly into video (TikTok / Shorts style)")
@click.option("--bgm", default=None, help="Path to custom background music file")
@click.option("--output-dir", default=None, help="Directory to store outputs")
def run(**kwargs):
    """Run the end-to-end studio pipeline."""
    config = load_config(kwargs)
    run_pipeline(config)

if __name__ == "__main__":
    main()
