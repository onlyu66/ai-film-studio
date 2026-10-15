import json
from studio.storyboard import parse_storyboard_json

def test_parse_clean_json():
    raw = '{"title":"T","language":"en","characters":{},"shots":[]}'
    sb = parse_storyboard_json(raw)
    assert sb.title == "T"
    assert sb.shots == []

def test_storyboard_json_repair():
    raw = '```json\n{"title":"T","language":"en","characters":{},"shots":[],}\n```'
    sb = parse_storyboard_json(raw)
    assert sb.title == "T"

def test_parse_with_characters_and_shots():
    raw = json.dumps({
        "title": "Test",
        "language": "vi",
        "characters": {"hero": {"name": "Hero", "visual_anchor": "tall man", "voice": "vi-VN-NamMinhNeural"}},
        "shots": [{"id": "shot_001_001", "chapter": 1, "character_id": "hero",
                   "dialogue": "Hello", "image_prompt": "a scene", "motion": "zoom_in", "duration": None}]
    })
    sb = parse_storyboard_json(raw)
    assert len(sb.shots) == 1
    assert sb.characters["hero"].name == "Hero"
