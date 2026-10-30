from pathlib import Path
import pytest
from studio.audio_beat_detector import (
    extract_audio_peaks,
    detect_beats,
    calculate_snap_to_beats,
)

def test_extract_audio_peaks_synthetic_sine(tmp_path):
    from pydub import AudioSegment
    from pydub.generators import Sine
    
    # Tạo audio 2 giây 440Hz
    sound = Sine(440).to_audio_segment(duration=2000)
    test_audio = tmp_path / "test_sine.mp3"
    sound.export(str(test_audio), format="mp3")

    peaks = extract_audio_peaks(test_audio, num_peaks=50)
    assert len(peaks) == 50
    assert all(0.0 <= p <= 1.0 for p in peaks)
    assert max(peaks) > 0.5

def test_detect_beats_synthetic_clicks(tmp_path):
    from pydub import AudioSegment
    from pydub.generators import Sine
    
    # Tạo audio 4 giây với các tiếng bíp cách nhau 500ms (120 BPM)
    silence = AudioSegment.silent(duration=450)
    beep = Sine(880).to_audio_segment(duration=50)
    combined = AudioSegment.empty()
    for _ in range(8):
        combined += silence + beep

    test_audio = tmp_path / "test_clicks.mp3"
    combined.export(str(test_audio), format="mp3")

    result = detect_beats(test_audio)
    assert result["duration"] >= 3.8
    assert len(result["beat_times"]) >= 4
    assert 100 <= result["tempo_bpm"] <= 140
    assert len(result["peaks"]) > 0

def test_calculate_snap_to_beats():
    shots = [
        {"id": "shot_1", "duration": 4.1},
        {"id": "shot_2", "duration": 4.8},
        {"id": "shot_3", "duration": 5.2},
    ]
    # Phách nhạc xuất hiện mỗi 1.0 giây
    beat_times = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 13.0, 14.0]

    snapped = calculate_snap_to_beats(shots, beat_times, min_shot_duration=2.0)
    assert len(snapped) == 3
    # Phân cảnh 1 ban đầu 4.1s -> phách gần nhất là 4.0s
    assert snapped[0]["duration"] == 4.0
    # Phân cảnh 2 ban đầu 4.8s -> bắt đầu từ 4.0, mục tiêu 8.8s -> phách gần nhất 9.0s -> duration 5.0s
    assert snapped[1]["duration"] == 5.0
    # Tổng thời gian là tích lũy chính xác trên các phách nhạc
    accum = sum(s["duration"] for s in snapped)
    assert round(accum, 1) in [round(b, 1) for b in beat_times]

def test_calculate_snap_to_beats_empty_beats_fallback():
    shots = [{"id": "s1", "duration": 4.0}, {"id": "s2", "duration": 5.0}]
    snapped = calculate_snap_to_beats(shots, [], min_shot_duration=2.0)
    assert len(snapped) == 2
    assert snapped[0]["duration"] == 4.0
    assert snapped[1]["duration"] == 5.0
