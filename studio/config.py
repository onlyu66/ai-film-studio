from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Any, Dict
import yaml

@dataclass
class StudioConfig:
    topic: str
    lang: str = "en"
    duration: int = 30
    style: str = "cinematic"
    llm_provider: str = "gemini"
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    motion_engine: str = "kenburns"
    lip_sync: str = "none"
    aspect_ratio: str = "16:9"
    hardsub: bool = False
    bgm_path: Optional[Path] = None
    output_dir: Path = field(default_factory=lambda: Path("outputs"))
    project_dir: Path = field(default_factory=lambda: Path("."))
    series_title: Optional[str] = None
    episode: int = 1
    parent_project_id: Optional[str] = None
    webhook_url: Optional[str] = None
    image_concurrency: Optional[int] = None
    motion_concurrency: Optional[int] = None
    tts_concurrency: Optional[int] = None
    hardware_accel: str = "auto"
    hardware_profile: Optional[str] = None
    template_id: Optional[str] = None

def load_config(cli_kwargs: Dict[str, Any], config_file: Optional[Path] = None) -> StudioConfig:
    """Load configuration from config.yaml merged with CLI kwargs."""
    file_cfg: Dict[str, Any] = {}
    cfg_path = config_file or Path("config.yaml")
    if cfg_path.exists():
        with open(cfg_path, "r", encoding="utf-8") as f:
            loaded = yaml.safe_load(f)
            if isinstance(loaded, dict):
                file_cfg = loaded

    # Handle alias mappings in cli_kwargs
    merged: Dict[str, Any] = dict(file_cfg)
    for k, v in cli_kwargs.items():
        if v is not None:
            if k == "llm":
                merged["llm_provider"] = v
            elif k in ("llm_model", "model"):
                merged["llm_model"] = v
            elif k in ("llm_api_key", "api_key"):
                merged["llm_api_key"] = v
            elif k in ("motion", "motion_engine"):
                merged["motion_engine"] = v
            elif k in ("lip_sync", "lipsync"):
                merged["lip_sync"] = v
            elif k in ("aspect_ratio", "aspect", "ratio"):
                merged["aspect_ratio"] = v
            elif k in ("hardsub", "burn_subtitles", "burn_subs"):
                merged["hardsub"] = bool(v)
            elif k in ("series_title", "series"):
                merged["series_title"] = str(v)
            elif k in ("episode", "ep"):
                merged["episode"] = int(v)
            elif k in ("parent_project_id", "parent_id"):
                merged["parent_project_id"] = str(v)
            elif k in ("image_concurrency", "img_workers"):
                merged["image_concurrency"] = int(v) if v else None
            elif k in ("motion_concurrency", "vid_workers"):
                merged["motion_concurrency"] = int(v) if v else None
            elif k in ("tts_concurrency", "audio_workers"):
                merged["tts_concurrency"] = int(v) if v else None
            elif k in ("hardware_accel", "accel", "gpu"):
                merged["hardware_accel"] = str(v)
            elif k in ("hardware_profile", "hw_profile", "profile"):
                merged["hardware_profile"] = str(v)
            elif k in ("webhook_url", "webhook"):
                merged["webhook_url"] = str(v)
            elif k == "bgm":
                merged["bgm_path"] = Path(v) if v else None
            elif k == "output_dir":
                merged["output_dir"] = Path(v) if v else Path("outputs")
            else:
                merged[k] = v

    # Fallback defaults
    topic = merged.get("topic", "")
    lang = merged.get("lang", "en")
    duration = int(merged.get("duration", 30))
    style = merged.get("style", "cinematic")
    llm_provider = merged.get("llm_provider", "gemini")
    llm_api_key = merged.get("llm_api_key")
    llm_model = merged.get("llm_model")
    motion_engine = merged.get("motion_engine", "kenburns")
    lip_sync = merged.get("lip_sync", "none")
    aspect_ratio = merged.get("aspect_ratio", "16:9")
    hardsub = bool(merged.get("hardsub", False))
    series_title = merged.get("series_title")
    episode = int(merged.get("episode", 1))
    parent_project_id = merged.get("parent_project_id")
    webhook_url = merged.get("webhook_url")
    bgm_path = Path(merged["bgm_path"]) if merged.get("bgm_path") else None
    output_dir = Path(merged.get("output_dir", "outputs"))
    project_dir = Path(merged.get("project_dir", "."))

    return StudioConfig(
        topic=topic,
        lang=lang,
        duration=duration,
        style=style,
        llm_provider=llm_provider,
        llm_api_key=llm_api_key,
        llm_model=llm_model,
        motion_engine=motion_engine,
        lip_sync=lip_sync,
        aspect_ratio=aspect_ratio,
        hardsub=hardsub,
        bgm_path=bgm_path,
        output_dir=output_dir,
        project_dir=project_dir,
        series_title=series_title,
        episode=episode,
        parent_project_id=parent_project_id,
        webhook_url=webhook_url,
        image_concurrency=int(merged["image_concurrency"]) if merged.get("image_concurrency") else None,
        motion_concurrency=int(merged["motion_concurrency"]) if merged.get("motion_concurrency") else None,
        tts_concurrency=int(merged["tts_concurrency"]) if merged.get("tts_concurrency") else None,
        hardware_accel=str(merged.get("hardware_accel", "auto")),
        hardware_profile=str(merged["hardware_profile"]) if merged.get("hardware_profile") else None,
    )
