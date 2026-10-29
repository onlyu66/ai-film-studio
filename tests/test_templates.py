import pytest
from studio.templates import (
    list_story_templates,
    get_story_template,
    build_template_story_instruction,
    STORY_TEMPLATES,
)

def test_list_story_templates():
    templates = list_story_templates()
    assert isinstance(templates, list)
    assert len(templates) >= 6

    ids = [t["id"] for t in templates]
    assert "cyberpunk_2077" in ids
    assert "historical_epic" in ids
    assert "anime_shonen" in ids
    assert "psychological_thriller" in ids
    assert "nature_doc" in ids
    assert "viral_short_60s" in ids

def test_template_schema_and_character_dna():
    for template_id, template in STORY_TEMPLATES.items():
        assert "id" in template
        assert "name" in template
        assert "tagline" in template
        assert "category" in template
        assert "style" in template
        assert template["aspect_ratio"] in ("16:9", "9:16")
        assert "default_topic" in template
        assert isinstance(template.get("characters"), dict)

        for char_id, char_data in template["characters"].items():
            assert "name" in char_data
            assert "visual_anchor" in char_data
            assert len(char_data["visual_anchor"]) > 20
            assert "voice" in char_data

def test_get_story_template():
    t = get_story_template("cyberpunk_2077")
    assert t is not None
    assert t["name"] == "Cyberpunk Viễn Tưởng 2077"
    assert t["style"] == "cinematic"

    none_t = get_story_template("invalid_template_id")
    assert none_t is None

def test_build_template_story_instruction():
    instruction = build_template_story_instruction("cyberpunk_2077")
    assert "[GENRE BLUEPRINT & CINEMATIC CONVENTIONS" in instruction
    assert "[PREDEFINED CHARACTER VISUAL ANCHORS" in instruction
    assert "Cyberpunk" in instruction

    empty = build_template_story_instruction("non_existent_id")
    assert empty == ""

def test_prompt_injects_template():
    from studio.prompts import get_storyboard_user_prompt

    prompt = get_storyboard_user_prompt(
        topic="Khám phá thành phố tương lai",
        lang="vi",
        duration_minutes=2,
        style="cinematic",
        template_id="cyberpunk_2077",
    )
    assert "Topic: Khám phá thành phố tương lai" in prompt
    assert "[GENRE BLUEPRINT & CINEMATIC CONVENTIONS" in prompt
    assert "Kael Zen" in prompt
    assert "Cyberpunk" in prompt
