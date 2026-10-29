import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from studio.storyboard import Storyboard, Shot, Character
from studio.dubbing import (
    translate_dialogues,
    run_dubbing_pipeline,
    LANGUAGE_NAMES,
)

def test_language_names_catalog():
    assert "en" in LANGUAGE_NAMES
    assert "ja" in LANGUAGE_NAMES
    assert "vi" in LANGUAGE_NAMES
    assert LANGUAGE_NAMES["ja"] == "Japanese"

def test_translate_dialogues_mock(tmp_path):
    shots = [
        Shot(id="shot_1", chapter=1, character_id="c1", dialogue="Bí mật này sẽ thay đổi cả nhân loại!", image_prompt="Hero looking at relic"),
        Shot(id="shot_2", chapter=1, character_id="c2", dialogue="Hãy cẩn thận phía sau bạn!", image_prompt="Danger behind"),
    ]
    storyboard = Storyboard(title="Thám hiểm", language="vi", shots=shots, characters={})

    mock_llm = MagicMock()
    mock_llm.generate.return_value = '{"shot_1": "This secret will change all of humanity!", "shot_2": "Watch out behind you!"}'

    with patch("studio.llm.factory.create_llm", return_value=mock_llm):
        res = translate_dialogues(storyboard, target_lang="en")
        assert res["shot_1"] == "This secret will change all of humanity!"
        assert res["shot_2"] == "Watch out behind you!"

def test_run_dubbing_pipeline(tmp_path):
    import json
    project_dir = tmp_path / "projects" / "proj_test_dub"
    project_dir.mkdir(parents=True, exist_ok=True)
    audio_dir = project_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    shots = [
        Shot(id="shot_001", chapter=1, character_id="char_hero", dialogue="Bình minh đã tới rồi.", image_prompt="Sunrise over ocean", duration=3.0),
    ]
    storyboard = Storyboard(title="Bình minh", language="vi", shots=shots, characters={"char_hero": Character(name="Hero", visual_anchor="man in jacket")})
    sb_file = project_dir / "storyboard.json"
    sb_file.write_text(json.dumps(storyboard.to_dict()), encoding="utf-8")

    with patch("studio.dubbing.translate_dialogues", return_value={"shot_001": "Dawn has arrived."}), \
         patch("studio.voice_clone.synthesize_speech", return_value=project_dir / "audio" / "shot_001.mp3"):
        
        result = run_dubbing_pipeline(
            project_id="proj_test_dub",
            target_lang="en",
            projects_root=tmp_path / "projects",
        )

        assert result["status"] == "completed"
        assert result["target_lang"] == "en"
        assert len(result["translated_shots"]) == 1
        assert result["translated_shots"][0]["translated_text"] == "Dawn has arrived."
        assert Path(result["subtitle_path"]).exists()
