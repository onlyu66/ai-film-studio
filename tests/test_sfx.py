from pathlib import Path
import pytest
from pydub import AudioSegment
from studio.sfx import (
    get_sfx_catalog,
    suggest_sfx_for_shot,
    resolve_sfx_asset,
    SFX_CATALOG,
)
from studio.assembly import mix_sfx_into_shot_audio

def test_get_sfx_catalog():
    catalog = get_sfx_catalog()
    assert isinstance(catalog, list)
    assert len(catalog) >= 24

    categories = {item["category"] for item in catalog}
    assert "action" in categories
    assert "nature" in categories
    assert "horror" in categories
    assert "scifi" in categories
    assert "urban" in categories

    for item in catalog:
        assert "id" in item
        assert "name" in item
        assert "category" in item
        assert "description" in item
        assert "stream_url" in item
        assert item["stream_url"].startswith("/api/assets/sfx/")
        assert "tags" in item

def test_suggest_sfx_for_shot():
    # 1. Action test: gunshot
    s1 = suggest_sfx_for_shot(prompt="Sát thủ rút súng nổ vang trời", dialogue="Đứng lại!")
    assert s1["sfx_id"] in ("gunshot", "explosion")
    assert s1["volume"] > 0
    assert "reasoning" in s1

    # 2. Nature test: rain / thunder
    s2 = suggest_sfx_for_shot(prompt="Mưa bão lớn sấm sét đánh ngang sườn núi", dialogue="")
    assert s2["sfx_id"] in ("thunder", "heavy_rain", "wind")

    # 3. Horror test: footsteps / creaky door
    s3 = suggest_sfx_for_shot(prompt="Tiếng bước chân rón rén trước cánh cửa kẽo kẹt", dialogue="Ai đó?")
    assert s3["sfx_id"] in ("footsteps", "creaky_door", "heartbeat")

    # 4. Urban test: car skid / traffic
    s4 = suggest_sfx_for_shot(prompt="Chiếc xe ô tô phanh gấp lốp rít trên đường phố", dialogue="")
    assert s4["sfx_id"] in ("car_skid", "city", "traffic")

def test_resolve_sfx_asset(tmp_path):
    # Testing asset resolution
    res = resolve_sfx_asset("thunder")
    assert res is not None
    assert isinstance(res, Path)

def test_mix_sfx_with_offset(tmp_path):
    # Dummy speech 1.5s
    speech_path = tmp_path / "speech.mp3"
    dummy_speech = AudioSegment.silent(duration=1500) + 5
    dummy_speech.export(str(speech_path), format="mp3")

    out_path = tmp_path / "mixed.mp3"
    res = mix_sfx_into_shot_audio(
        speech_audio_path=speech_path,
        sfx_str="thunder",
        shot_duration=3.0,
        output_path=out_path,
        voice_volume=1.0,
        sfx_volume=0.8,
        sfx_offset_ms=500,
    )
    assert res == out_path
    assert out_path.exists()
    assert out_path.stat().st_size > 1000
