import pytest
import json
from pathlib import Path
from unittest.mock import patch, MagicMock

from studio.voice_clone import (
    VoiceProfile,
    save_voice_profile,
    load_voice_profiles,
    clone_voice,
    synthesize_speech,
    get_all_voices,
)

def test_voice_profile_serialization(tmp_path):
    storage_file = tmp_path / "voices.json"
    profile = VoiceProfile(
        id="voice_custom_1",
        name="Đạo Diễn Christopher",
        provider="elevenlabs",
        sample_audio_path=str(tmp_path / "sample.mp3"),
        gender="male",
        lang="vi",
        description="Giọng trầm ấm, điện ảnh",
    )
    save_voice_profile(profile, storage_file=storage_file)

    profiles = load_voice_profiles(storage_file=storage_file)
    assert len(profiles) == 1
    loaded = profiles[0]
    assert loaded.id == "voice_custom_1"
    assert loaded.name == "Đạo Diễn Christopher"
    assert loaded.provider == "elevenlabs"
    assert loaded.gender == "male"
    assert loaded.lang == "vi"

def test_clone_voice_elevenlabs(tmp_path):
    sample_file = tmp_path / "sample.mp3"
    sample_file.write_bytes(b"dummy audio content")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"voice_id": "mock_el_voice_123"}

    with patch("requests.post", return_value=mock_resp) as mock_post:
        profile = clone_voice(
            provider="elevenlabs",
            name="Nhân Vật Điệp Viên",
            audio_path=sample_file,
            api_key="sk_mock_test_key",
            description="Giọng bí ẩn, hơi thở gấp",
            storage_dir=tmp_path,
        )

        assert profile.id == "mock_el_voice_123"
        assert profile.provider == "elevenlabs"
        assert profile.name == "Nhân Vật Điệp Viên"
        mock_post.assert_called_once()
        assert "api.elevenlabs.io" in mock_post.call_args[0][0]

def test_clone_voice_local(tmp_path):
    sample_file = tmp_path / "sample_voice.wav"
    sample_file.write_bytes(b"wav sample audio")

    profile = clone_voice(
        provider="local",
        name="Giọng Nội Bộ Local XTTS",
        audio_path=sample_file,
        description="Giọng AI lồng tiếng tiếng Việt",
        storage_dir=tmp_path,
    )

    assert profile.provider == "local"
    assert profile.name == "Giọng Nội Bộ Local XTTS"
    assert profile.id.startswith("local_")
    assert Path(profile.sample_audio_path).exists()

def test_synthesize_speech_elevenlabs(tmp_path):
    out_file = tmp_path / "test_el_out.mp3"
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b"fake mp3 audio stream"

    with patch("requests.post", return_value=mock_resp):
        res_path = synthesize_speech(
            text="Xin chào khán giả yêu điện ảnh",
            voice_id="mock_el_voice_123",
            provider="elevenlabs",
            output_path=out_file,
            api_key="sk_mock_key",
        )
        assert res_path == out_file
        assert out_file.exists()
        assert out_file.read_bytes() == b"fake mp3 audio stream"

def test_get_all_voices(tmp_path):
    voices = get_all_voices(storage_dir=tmp_path)
    # Should contain built-in standard voices + default profiles
    assert len(voices) >= 8
    voice_ids = [v.id for v in voices]
    assert "vi-VN-NamMinhNeural" in voice_ids or any("NamMinh" in vid for vid in voice_ids)
