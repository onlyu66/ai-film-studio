import pytest
from studio.color_grading import (
    get_color_luts,
    get_scene_transitions,
    get_color_lut_filter,
    build_xfade_filtergraph,
    COLOR_LUTS,
    SCENE_TRANSITIONS,
)


def test_get_color_luts():
    luts = get_color_luts()
    assert isinstance(luts, list)
    assert len(luts) >= 8

    lut_ids = [l["id"] for l in luts]
    for expected in [
        "teal_and_orange",
        "kodachrome_1970",
        "wes_anderson_pastel",
        "cyberpunk_matrix",
        "bleach_bypass",
        "film_noir_bw",
        "golden_sunset",
        "nordic_cold",
    ]:
        assert expected in lut_ids

    for lut in luts:
        assert "name" in lut
        assert "description" in lut
        assert "css_gradient" in lut
        assert "ffmpeg_filter" in lut


def test_get_scene_transitions():
    transitions = get_scene_transitions()
    assert isinstance(transitions, list)
    assert len(transitions) >= 8

    trans_ids = [t["id"] for t in transitions]
    for expected in [
        "cut",
        "dissolve",
        "fade_black",
        "fade_white",
        "whip_pan",
        "film_burn",
        "glitch",
        "circle_open",
    ]:
        assert expected in trans_ids

    for t in transitions:
        assert "name" in t
        assert "description" in t
        assert "xfade_name" in t
        assert "default_duration" in t


def test_get_color_lut_filter():
    f_teal = get_color_lut_filter("teal_and_orange")
    assert "colorbalance" in f_teal
    assert "eq=" in f_teal

    f_noir = get_color_lut_filter("film_noir_bw")
    assert "hue=s=0" in f_noir

    f_none = get_color_lut_filter("none")
    assert f_none == ""

    f_unknown = get_color_lut_filter("unknown_preset")
    assert f_unknown == ""


def test_build_xfade_filtergraph_single_or_empty():
    assert build_xfade_filtergraph([], "dissolve") is None
    assert build_xfade_filtergraph([5.0], "dissolve") is None
    assert build_xfade_filtergraph([5.0, 5.0], "cut") is None


def test_build_xfade_filtergraph_two_clips():
    fg = build_xfade_filtergraph([5.0, 4.0], transition="dissolve", trans_duration=0.6)
    assert fg is not None
    # Offset should be 5.0 - 0.6 = 4.4
    assert "xfade=transition=fade" in fg or "xfade=transition=dissolve" in fg
    assert "duration=0.6" in fg
    assert "offset=4.4" in fg


def test_build_xfade_filtergraph_multiple_clips():
    durations = [5.0, 4.0, 6.0]
    fg = build_xfade_filtergraph(durations, transition="fade_black", trans_duration=0.5)
    assert fg is not None
    assert "transition=fadeblack" in fg
    assert "duration=0.5" in fg
    # First transition offset: 5.0 - 0.5 = 4.5
    assert "offset=4.5" in fg
    # Second transition offset: (5.0 - 0.5) + 4.0 - 0.5 = 8.0
    assert "offset=8.0" in fg
