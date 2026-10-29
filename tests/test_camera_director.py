from pathlib import Path
import pytest
from unittest.mock import patch, MagicMock

from studio.camera_director import (
    get_camera_presets,
    compose_cinematic_prompt,
    generate_multi_angle_prompts,
    render_multi_angle_coverage,
    CAMERA_ANGLES,
    CAMERA_MOTIONS,
    LENS_PRESETS,
    LIGHTING_PRESETS,
)
from studio.storyboard import Shot, Character


def test_get_camera_presets():
    presets = get_camera_presets()
    assert "angles" in presets
    assert "motions" in presets
    assert "lenses" in presets
    assert "lightings" in presets

    # Check required angles
    angle_ids = [a["id"] for a in presets["angles"]]
    for expected in ["wide", "medium", "close_up", "low_angle", "high_angle", "dutch_angle"]:
        assert expected in angle_ids

    # Check required motions
    motion_ids = [m["id"] for m in presets["motions"]]
    for expected in ["zoom_in", "pan_left", "dolly_in", "orbit_left", "fpv_drone"]:
        assert expected in motion_ids

    # Check required lenses
    lens_ids = [l["id"] for l in presets["lenses"]]
    for expected in ["anamorphic_35mm", "cinema_50mm", "portrait_85mm", "imax_70mm"]:
        assert expected in lens_ids

    # Check required lightings
    light_ids = [lt["id"] for lt in presets["lightings"]]
    for expected in ["golden_hour", "rembrandt", "volumetric_rays", "cyberpunk_neon"]:
        assert expected in light_ids


def test_compose_cinematic_prompt():
    prompt = compose_cinematic_prompt(
        base_prompt="A cyber detective searching in a rain-slicked alley",
        camera_angle="low_angle",
        lens="anamorphic_35mm",
        lighting="cyberpunk_neon",
        visual_anchor="wearing trench coat, glowing mechanical left eye",
        style="cinematic",
    )

    assert "low angle" in prompt.lower()
    assert "anamorphic" in prompt.lower()
    assert "neon" in prompt.lower()
    assert "glowing mechanical left eye" in prompt
    assert "cyber detective" in prompt


def test_generate_multi_angle_prompts():
    prompts = generate_multi_angle_prompts(
        base_prompt="Ancient warrior standing on top of a mountain cliff",
        angles=["wide", "medium", "close_up"],
        lens="portrait_85mm",
        lighting="golden_hour",
    )

    assert "wide" in prompts
    assert "medium" in prompts
    assert "close_up" in prompts

    assert "wide" in prompts["wide"].lower()
    assert "medium" in prompts["medium"].lower()
    assert "close-up" in prompts["close_up"].lower() or "close up" in prompts["close_up"].lower()


def test_render_multi_angle_coverage_mocked(tmp_path):
    shot = Shot(
        id="shot_001",
        chapter=1,
        character_id="char_1",
        dialogue="We must move fast.",
        image_prompt="Secret agent entering an underground lab",
        duration=4.0,
    )
    characters = {
        "char_1": Character(
            name="John Doe",
            visual_anchor="tall agent in dark suit",
            voice="en-US-GuyNeural",
            seed=4242,
        )
    }

    mock_generated_file = tmp_path / "mock_img.png"
    mock_generated_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"0" * 5000)

    with patch("studio.camera_director.generate_image_for_shot", return_value=mock_generated_file) as mock_gen:
        results = render_multi_angle_coverage(
            shot=shot,
            characters=characters,
            angles=["wide", "medium", "close_up"],
            output_dir=tmp_path,
            style="cinematic",
            aspect_ratio="16:9",
        )

        assert len(results) == 3
        assert "wide" in results
        assert "medium" in results
        assert "close_up" in results
        assert mock_gen.call_count == 3
