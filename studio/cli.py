import click
from pathlib import Path
from studio.config import load_config

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
@click.option("--bgm", default=None, help="Path to custom background music file")
@click.option("--output-dir", default=None, help="Directory to store outputs")
def run(**kwargs):
    """Run the end-to-end studio pipeline."""
    config = load_config(kwargs)
    click.echo(f"Initialized AI Film Studio with topic: '{config.topic}' ({config.lang}, {config.duration}m, {config.style})")

if __name__ == "__main__":
    main()
