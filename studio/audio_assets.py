from pathlib import Path
import subprocess
import shutil
import urllib.request
import urllib.parse
from typing import Optional, Dict

# Curated High-Quality CC0 / Royalty-Free Audio Repositories
# 1. BGM: SoundSafari CC0 1.0 Public Domain (FreePD tracks by Kevin MacLeod & CC0 composers)
# 2. SFX: Remvze Moodist Ambient Library (CC0 & Pixabay Free License)
BGM_SOURCES: Dict[str, str] = {
    "cinematic": "https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/main/freepd.com/Epic%20Blockbuster%202.mp3",
    "default": "https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/main/freepd.com/Epic%20Blockbuster%202.mp3",
    "action": "https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/main/freepd.com/Action%20Strike.mp3",
    "dramatic": "https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/main/freepd.com/The%20Drama.mp3",
    "calm": "https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/main/freepd.com/Infinite%20Peace.mp3",
    "documentary": "https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/main/freepd.com/Ambient%20Bongos.mp3",
    "mysterious": "https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/main/freepd.com/Dark%20Hallway.mp3",
    "noir": "https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/main/freepd.com/A%20Good%20Bass%20for%20Gambling.mp3",
    "anime": "https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/main/freepd.com/Heroic%20Adventure.mp3",
}

SFX_SOURCES: Dict[str, str] = {
    "rain": "https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/rain/heavy-rain.mp3",
    "wind": "https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/nature/howling-wind.mp3",
    "thunder": "https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/rain/thunder.mp3",
    "city": "https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/urban/busy-street.mp3",
    "traffic": "https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/urban/traffic.mp3",
    "waves": "https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/nature/waves.mp3",
    "campfire": "https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/nature/campfire.mp3",
    "birds": "https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/animals/birds.mp3",
    "cyberpunk": "https://raw.githubusercontent.com/SoundSafari/CC0-1.0-Music/main/freepd.com/Alien%20Spaceship%20Atmosphere.mp3",
}

def download_free_audio(url: str, output_path: Path, timeout: int = 15) -> bool:
    """Download authentic CC0 audio file from free online repository."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = output_path.with_suffix(output_path.suffix + ".tmp")

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "AIFilmStudio/1.0 (CC0 Media Scraper; Mozilla/5.0)"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                with open(temp_path, "wb") as f:
                    shutil.copyfileobj(resp, f)
                if temp_path.stat().st_size > 5000:
                    temp_path.replace(output_path)
                    print(f"  [Audio] Successfully downloaded {output_path.name} ({output_path.stat().st_size // 1024} KB)")
                    return True
    except Exception as e:
        print(f"  [Audio] Download failed for {url}: {e}")
    finally:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass
    return False

def generate_tone_track(output_path: Path, style: str = "cinematic", duration: int = 60) -> Path:
    """Procedurally synthesize rich ambient BGM or SFX using FFmpeg audio filters with broadcast loudness."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    style = style.lower().strip()
    fade_out_start = max(1, duration - 3)

    if style in ("noir", "mysterious"):
        # Dark, suspenseful minor triad drone (D2=73.4Hz, F2=87.3Hz, A2=110Hz)
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "anoisesrc=c=pink:r=44100:a=0.015",
            "-f", "lavfi", "-i", "sine=f=73.4:r=44100",
            "-f", "lavfi", "-i", "sine=f=87.3:r=44100",
            "-f", "lavfi", "-i", "sine=f=110.0:r=44100",
            "-filter_complex",
            f"[1:a]volume=0.35[s1];[2:a]volume=0.25[s2];[3:a]volume=0.18[s3];"
            f"[0:a][s1][s2][s3]amix=inputs=4:normalize=0,lowpass=f=450,"
            f"chorus=0.7:0.9:60:0.4:0.25:2,aecho=0.8:0.88:1400:0.45,afade=t=in:ss=0:d=3,afade=t=out:st={fade_out_start}:d=3,"
            f"loudnorm=I=-18:LRA=7:tp=-1.5",
            "-t", str(duration),
            "-b:a", "192k",
            str(output_path)
        ]
    elif style == "anime":
        # Dreamy, airy, shimmering ambient pad (E3=164.8Hz, G#3=207.65Hz, B3=246.9Hz, E4=329.6Hz)
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "anoisesrc=c=pink:r=44100:a=0.010",
            "-f", "lavfi", "-i", "sine=f=164.81:r=44100",
            "-f", "lavfi", "-i", "sine=f=207.65:r=44100",
            "-f", "lavfi", "-i", "sine=f=246.94:r=44100",
            "-filter_complex",
            f"[1:a]volume=0.30[s1];[2:a]volume=0.22[s2];[3:a]volume=0.18[s3];"
            f"[0:a][s1][s2][s3]amix=inputs=4:normalize=0,lowpass=f=1200,highpass=f=120,"
            f"chorus=0.8:0.9:45:0.5:0.3:2,aecho=0.8:0.85:800:0.35,afade=t=in:ss=0:d=2.5,afade=t=out:st={fade_out_start}:d=2.5,"
            f"loudnorm=I=-18:LRA=7:tp=-1.5",
            "-t", str(duration),
            "-b:a", "192k",
            str(output_path)
        ]
    elif style in ("documentary", "calm"):
        # Organic, warm open fifth landscape drone (C3=130.8Hz, G3=196Hz)
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "anoisesrc=c=pink:r=44100:a=0.015",
            "-f", "lavfi", "-i", "sine=f=130.81:r=44100",
            "-f", "lavfi", "-i", "sine=f=196.00:r=44100",
            "-filter_complex",
            f"[1:a]volume=0.32[s1];[2:a]volume=0.24[s2];"
            f"[0:a][s1][s2]amix=inputs=3:normalize=0,lowpass=f=750,highpass=f=80,"
            f"chorus=0.6:0.85:50:0.35:0.2:2,aecho=0.75:0.85:1000:0.35,afade=t=in:ss=0:d=3,afade=t=out:st={fade_out_start}:d=3,"
            f"loudnorm=I=-18:LRA=7:tp=-1.5",
            "-t", str(duration),
            "-b:a", "192k",
            str(output_path)
        ]
    elif style in ("dramatic", "action"):
        # Tense, driving sub-bass drone with pulsating tremolo (A1=55Hz, E2=82.4Hz)
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "anoisesrc=c=brown:r=44100:a=0.025",
            "-f", "lavfi", "-i", "sine=f=55.0:r=44100",
            "-f", "lavfi", "-i", "sine=f=82.4:r=44100",
            "-filter_complex",
            f"[1:a]volume=0.38,tremolo=f=3.0:d=0.5[s1];[2:a]volume=0.25[s2];"
            f"[0:a][s1][s2]amix=inputs=3:normalize=0,lowpass=f=500,"
            f"aecho=0.8:0.88:1200:0.4,afade=t=in:ss=0:d=2,afade=t=out:st={fade_out_start}:d=2.5,"
            f"loudnorm=I=-18:LRA=7:tp=-1.5",
            "-t", str(duration),
            "-b:a", "192k",
            str(output_path)
        ]
    elif style == "rain":
        dur_sfx = duration if duration else 30
        fade_out_sfx = max(1, dur_sfx - 2)
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "anoisesrc=c=pink:r=44100:a=0.15",
            "-filter_complex", f"lowpass=f=1200,highpass=f=160,afade=t=in:ss=0:d=2,afade=t=out:st={fade_out_sfx}:d=2,loudnorm=I=-17:LRA=6:tp=-1.5",
            "-t", str(dur_sfx),
            "-b:a", "192k",
            str(output_path)
        ]
    elif style == "wind":
        dur_sfx = duration if duration else 30
        fade_out_sfx = max(1, dur_sfx - 2)
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "anoisesrc=c=brown:r=44100:a=0.20",
            "-filter_complex", f"lowpass=f=700,tremolo=f=0.4:d=0.7,afade=t=in:ss=0:d=2,afade=t=out:st={fade_out_sfx}:d=2,loudnorm=I=-17:LRA=6:tp=-1.5",
            "-t", str(dur_sfx),
            "-b:a", "192k",
            str(output_path)
        ]
    elif style == "thunder":
        dur_sfx = duration if duration else 10
        fade_out_sfx = max(1, dur_sfx - 3)
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "anoisesrc=c=brown:r=44100:a=0.45",
            "-f", "lavfi", "-i", "sine=f=45:r=44100",
            "-filter_complex",
            f"[1:a]volume=0.6[s1];[0:a][s1]amix=inputs=2:normalize=0,lowpass=f=380,aecho=0.8:0.9:800:0.6,afade=t=in:ss=0:d=0.2,afade=t=out:st={fade_out_sfx}:d=2.5,loudnorm=I=-16:LRA=6:tp=-1.5",
            "-t", str(dur_sfx),
            "-b:a", "192k",
            str(output_path)
        ]
    elif style == "cyberpunk":
        dur_sfx = duration if duration else 30
        fade_out_sfx = max(1, dur_sfx - 2)
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "anoisesrc=c=pink:r=44100:a=0.020",
            "-f", "lavfi", "-i", "sine=f=82.4:r=44100",
            "-f", "lavfi", "-i", "sine=f=123.47:r=44100",
            "-filter_complex",
            f"[1:a]volume=0.35,flanger=delay=10:depth=4:regen=50[s1];[2:a]volume=0.25[s2];"
            f"[0:a][s1][s2]amix=inputs=3:normalize=0,lowpass=f=800,aecho=0.8:0.85:1000:0.4,afade=t=in:ss=0:d=2,afade=t=out:st={fade_out_sfx}:d=2,loudnorm=I=-18:LRA=7:tp=-1.5",
            "-t", str(dur_sfx),
            "-b:a", "192k",
            str(output_path)
        ]
    elif style == "city":
        dur_sfx = duration if duration else 30
        fade_out_sfx = max(1, dur_sfx - 2)
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "anoisesrc=c=pink:r=44100:a=0.06",
            "-f", "lavfi", "-i", "sine=f=60:r=44100",
            "-filter_complex", f"[1:a]volume=0.25[s1];[0:a][s1]amix=inputs=2:normalize=0,lowpass=f=500,afade=t=in:ss=0:d=2,afade=t=out:st={fade_out_sfx}:d=2,loudnorm=I=-18:LRA=7:tp=-1.5",
            "-t", str(dur_sfx),
            "-b:a", "192k",
            str(output_path)
        ]
    else:  # cinematic default
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "anoisesrc=c=pink:r=44100:a=0.03",
            "-f", "lavfi", "-i", "sine=f=110:r=44100",
            "-f", "lavfi", "-i", "sine=f=164.81:r=44100",
            "-f", "lavfi", "-i", "sine=f=220:r=44100",
            "-filter_complex",
            f"[1:a]volume=0.35[s1];[2:a]volume=0.25[s2];[3:a]volume=0.18[s3];"
            f"[0:a][s1][s2][s3]amix=inputs=4:normalize=0,lowpass=f=800,"
            f"chorus=0.7:0.9:55:0.4:0.25:2,aecho=0.8:0.88:1200:0.4,afade=t=in:ss=0:d=2,afade=t=out:st={fade_out_start}:d=2.5,"
            f"loudnorm=I=-18:LRA=7:tp=-1.5",
            "-t", str(duration),
            "-b:a", "192k",
            str(output_path)
        ]

    try:
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return output_path
    except Exception as e:
        print(f"  [Audio] Warning: Failed to synthesize audio for style '{style}': {e}")
        return output_path

def ensure_audio_assets(force: bool = False) -> None:
    """Ensure all background music and environmental SFX exist on disk with authentic CC0 audio or calibrated synthesis."""
    bgm_dir = Path("assets/bgm")
    bgm_dir.mkdir(parents=True, exist_ok=True)
    sfx_dir = Path("assets/sfx")
    sfx_dir.mkdir(parents=True, exist_ok=True)

    # 1. Background Music
    for style, url in BGM_SOURCES.items():
        file_path = bgm_dir / f"{style}.mp3"
        # Download if missing, too small, or force
        if force or not file_path.exists() or file_path.stat().st_size < 50000:
            success = download_free_audio(url, file_path)
            if not success and (not file_path.exists() or file_path.stat().st_size < 1000):
                # Fallback to procedural synthesis
                generate_tone_track(file_path, style=style, duration=60)

    # Ensure default.mp3 exists
    def_path = bgm_dir / "default.mp3"
    if not def_path.exists() or def_path.stat().st_size < 50000:
        cinematic_path = bgm_dir / "cinematic.mp3"
        if cinematic_path.exists() and cinematic_path.stat().st_size > 50000:
            shutil.copy2(str(cinematic_path), str(def_path))

    # 2. Environmental Sound Effects
    for sfx_name, url in SFX_SOURCES.items():
        file_path = sfx_dir / f"{sfx_name}.mp3"
        if force or not file_path.exists() or file_path.stat().st_size < 20000:
            success = download_free_audio(url, file_path)
            if not success and (not file_path.exists() or file_path.stat().st_size < 1000):
                generate_tone_track(file_path, style=sfx_name, duration=30)

def get_or_download_sfx(sfx_key: str) -> Optional[Path]:
    """Retrieve an SFX asset by key or download on-demand if supported."""
    sfx_dir = Path("assets/sfx")
    sfx_dir.mkdir(parents=True, exist_ok=True)
    clean_key = sfx_key.lower().strip().replace(" ", "_")

    local_path = sfx_dir / f"{clean_key}.mp3"
    if local_path.exists() and local_path.stat().st_size > 5000:
        return local_path

    # Check if we have an online source for it
    if clean_key in SFX_SOURCES:
        if download_free_audio(SFX_SOURCES[clean_key], local_path):
            return local_path

    return None
