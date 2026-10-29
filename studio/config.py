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
    image_engine: str = "pollinations"
    image_api_url: Optional[str] = None
    video_api_token: Optional[str] = None
    video_model: str = "wan-video/wan-2.1-i2v-480p"
    subtitle_style: str = "tiktok_bold"
    subtitle_position: str = "bottom"
    subtitle_karaoke: bool = False
    bgm_preset: Optional[str] = "cinematic"
    bgm_volume: float = 0.7
    ducking_level: str = "medium"
    voice_volume: float = 1.0

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
            elif k in ("subtitle_style", "sub_style"):
                merged["subtitle_style"] = str(v)
            elif k in ("subtitle_position", "sub_pos", "sub_position"):
                merged["subtitle_position"] = str(v)
            elif k in ("subtitle_karaoke", "sub_karaoke", "karaoke"):
                merged["subtitle_karaoke"] = bool(v)
            elif k in ("bgm_preset", "bgm_track", "music_preset"):
                merged["bgm_preset"] = str(v)
            elif k in ("bgm_volume", "music_volume"):
                merged["bgm_volume"] = float(v)
            elif k in ("ducking_level", "ducking", "auto_ducking"):
                merged["ducking_level"] = str(v)
            elif k in ("voice_volume", "dialogue_volume"):
                merged["voice_volume"] = float(v)
            elif k in ("video_api_token", "replicate_token", "video_token"):
                merged["video_api_token"] = str(v)
            elif k in ("video_model", "replicate_model"):
                merged["video_model"] = str(v)
            elif k in ("template_id", "template"):
                merged["template_id"] = str(v)
            elif k in ("image_engine", "engine"):
                merged["image_engine"] = str(v)
            elif k in ("image_api_url", "local_image_url"):
                merged["image_api_url"] = str(v)
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
        template_id=merged.get("template_id"),
        image_engine=str(merged.get("image_engine", "pollinations")),
        image_api_url=merged.get("image_api_url"),
        video_api_token=merged.get("video_api_token"),
        video_model=str(merged.get("video_model", "wan-video/wan-2.1-i2v-480p")),
        subtitle_style=str(merged.get("subtitle_style", "tiktok_bold")),
        subtitle_position=str(merged.get("subtitle_position", "bottom")),
        subtitle_karaoke=bool(merged.get("subtitle_karaoke", False)),
        bgm_preset=merged.get("bgm_preset", "cinematic"),
        bgm_volume=float(merged.get("bgm_volume", 0.7)),
        ducking_level=str(merged.get("ducking_level", "medium")),
        voice_volume=float(merged.get("voice_volume", 1.0)),
    )
