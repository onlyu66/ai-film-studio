from pathlib import Path
import xml.etree.ElementTree as ET
import pytest
from studio.storyboard import Storyboard, Shot, Character
from studio.export_fcpxml import generate_fcpxml

@pytest.fixture
def sample_storyboard():
    return Storyboard(
        title="Cuộc phiêu lưu vũ trụ",
        language="vi",
        characters={
            "hero": Character(name="Phi hành gia An", visual_anchor="Bộ đồ phi hành gia trắng", voice="vi-VN-Standard-B")
        },
        shots=[
            Shot(
                id="shot_1",
                chapter=1,
                character_id="hero",
                dialogue="Chúng ta đang tiếp cận sao Thổ.",
                image_prompt="Phi thuyền bay qua vành đai sao Thổ",
                sfx="Tiếng động cơ phản lực",
                duration=4.5,
                voice_volume=1.0,
                sfx_volume=0.8,
            ),
            Shot(
                id="shot_2",
                chapter=1,
                character_id="hero",
                dialogue="Mọi thông số đều ổn định.",
                image_prompt="Cận cảnh gương mặt phi hành gia An qua mũ bảo hiểm",
                sfx="Tiếng bíp máy tính",
                duration=3.5,
                voice_volume=1.2,
                sfx_volume=0.6,
            ),
        ],
    )

def test_generate_fcpxml_valid_xml(tmp_path, sample_storyboard):
    output_xml = tmp_path / "timeline.fcpxml"
    result_path = generate_fcpxml(
        storyboard=sample_storyboard,
        output_path=output_xml,
        aspect_ratio="16:9",
        fps=25,
        project_dir=tmp_path,
    )

    assert result_path.exists()
    content = result_path.read_text(encoding="utf-8")
    assert content.startswith("<?xml")

    # Validate XML parsing
    root = ET.fromstring(content)
    assert root.tag == "fcpxml"
    assert root.attrib.get("version") == "1.8"

def test_fcpxml_resources_and_formats(tmp_path, sample_storyboard):
    output_xml = tmp_path / "timeline.fcpxml"
    generate_fcpxml(sample_storyboard, output_xml, aspect_ratio="16:9", fps=25)

    root = ET.parse(output_xml).getroot()
    resources = root.find("resources")
    assert resources is not None

    formats = resources.findall("format")
    assert len(formats) >= 1
    # Check 16:9 1080p dimensions
    fmt = formats[0]
    assert fmt.attrib.get("width") == "1920"
    assert fmt.attrib.get("height") == "1080"
    assert fmt.attrib.get("frameDuration") == "1/25s"

def test_fcpxml_9_16_vertical_format(tmp_path, sample_storyboard):
    output_xml = tmp_path / "timeline_vertical.fcpxml"
    generate_fcpxml(sample_storyboard, output_xml, aspect_ratio="9:16", fps=30)

    root = ET.parse(output_xml).getroot()
    resources = root.find("resources")
    fmt = resources.find("format")
    assert fmt.attrib.get("width") == "1080"
    assert fmt.attrib.get("height") == "1920"
    assert fmt.attrib.get("frameDuration") == "1/30s"

def test_fcpxml_clips_and_timeline_structure(tmp_path, sample_storyboard):
    # Simulate existing asset files
    videos_dir = tmp_path / "videos"
    audio_dir = tmp_path / "audio"
    videos_dir.mkdir(parents=True)
    audio_dir.mkdir(parents=True)
    (videos_dir / "shot_1.mp4").touch()
    (videos_dir / "shot_2.mp4").touch()
    (audio_dir / "shot_1.mp3").touch()
    (audio_dir / "shot_2.mp3").touch()

    output_xml = tmp_path / "timeline.fcpxml"
    generate_fcpxml(
        sample_storyboard,
        output_xml,
        aspect_ratio="16:9",
        fps=25,
        project_dir=tmp_path,
        bgm_path=tmp_path / "bgm.mp3",
    )

    root = ET.parse(output_xml).getroot()
    spine = root.find(".//spine")
    assert spine is not None

    # Spine should contain video clips corresponding to shots
    clips = spine.findall("clip")
    assert len(clips) == 2

    # Check shot 1
    clip1 = clips[0]
    assert clip1.attrib.get("name") == "shot_1"
    assert clip1.attrib.get("offset") == "0s"
    assert clip1.attrib.get("duration") == "4.5s"

    # Check shot 2 starts after shot 1 (offset = 4.5s)
    clip2 = clips[1]
    assert clip2.attrib.get("name") == "shot_2"
    assert clip2.attrib.get("offset") == "4.5s"
    assert clip2.attrib.get("duration") == "3.5s"

    # Total sequence duration should be 4.5 + 3.5 = 8.0s
    sequence = root.find(".//sequence")
    assert sequence.attrib.get("duration") == "8.0s"

def test_fcpxml_dialogue_subtitles_and_audio_tracks(tmp_path, sample_storyboard):
    output_xml = tmp_path / "timeline.fcpxml"
    generate_fcpxml(sample_storyboard, output_xml, aspect_ratio="16:9", fps=25)

    root = ET.parse(output_xml).getroot()
    # Check dialogue titles / markers
    titles = root.findall(".//title")
    assert len(titles) == 2
    assert "tiếp cận sao Thổ" in titles[0].find(".//text-style").text
    assert "Mọi thông số" in titles[1].find(".//text-style").text
