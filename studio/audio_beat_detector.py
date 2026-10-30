from pathlib import Path
from typing import Union, List, Dict, Any, Optional
import math
import statistics

def extract_audio_peaks(audio_input: Any, num_peaks: int = 300) -> List[float]:
    """
    Trích xuất mảng đỉnh biên độ (normalized peaks [0.0, 1.0]) từ file audio hoặc AudioSegment
    dùng cho biểu đồ dạng sóng âm (waveform).
    """
    from pydub import AudioSegment

    if isinstance(audio_input, AudioSegment):
        sound = audio_input
    else:
        path_obj = Path(audio_input)
        if not path_obj.exists():
            return [0.0] * num_peaks

        try:
            sound = AudioSegment.from_file(str(path_obj))
        except Exception:
            return [0.0] * num_peaks

    samples = sound.get_array_of_samples()
    total_samples = len(samples)
    if total_samples == 0:
        return [0.0] * num_peaks

    # Nếu stereo, lấy kênh 1 (cách đều theo channels)
    channels = sound.channels
    if channels > 1:
        samples = samples[::channels]
        total_samples = len(samples)

    chunk_size = max(1, total_samples // num_peaks)
    peaks = []

    for i in range(num_peaks):
        start = i * chunk_size
        end = min(total_samples, start + chunk_size)
        if start >= total_samples:
            peaks.append(0.0)
            continue
        chunk = samples[start:end]
        if not chunk:
            peaks.append(0.0)
            continue
        # Lấy giá trị biên độ tuyệt đối lớn nhất trong khoảng
        max_val = max(abs(s) for s in chunk)
        peaks.append(float(max_val))

    max_peak = max(peaks) if peaks else 0.0
    if max_peak > 0:
        peaks = [round(p / max_peak, 4) for p in peaks]
    else:
        peaks = [0.0] * num_peaks

    return peaks

def detect_beats(
    audio_path: Union[str, Path],
    frame_ms: int = 40,
    threshold_ratio: float = 1.35,
    min_interval_sec: float = 0.28,
) -> Dict[str, Any]:
    """
    Phát hiện nhịp điệu âm nhạc (Beat Onset Detection) bằng phân tích năng lượng RMS động.
    Ước lượng Tempo BPM và trả về danh sách timestamp các phách nhạc.
    """
    path_obj = Path(audio_path)
    if not path_obj.exists():
        return {
            "duration": 0.0,
            "tempo_bpm": 120,
            "beat_times": [],
            "peaks": [],
        }

    from pydub import AudioSegment

    try:
        sound = AudioSegment.from_file(str(path_obj))
    except Exception:
        return {
            "duration": 0.0,
            "tempo_bpm": 120,
            "beat_times": [],
            "peaks": [],
        }

    duration_sec = round(len(sound) / 1000.0, 3)
    if duration_sec <= 0:
        return {
            "duration": 0.0,
            "tempo_bpm": 120,
            "beat_times": [],
            "peaks": [],
        }

    # Tính RMS năng lượng cho từng frame ms
    frame_count = int(len(sound) // frame_ms)
    energies: List[float] = []

    for i in range(frame_count):
        start_ms = i * frame_ms
        end_ms = start_ms + frame_ms
        chunk = sound[start_ms:end_ms]
        # chunk.rms tính căn bậc 2 trung bình bình phương biên độ
        energies.append(float(chunk.rms))

    if not energies:
        return {
            "duration": duration_sec,
            "tempo_bpm": 120,
            "beat_times": [],
            "peaks": [0.0] * 100,
        }

    # Moving average để làm ngưỡng động cục bộ
    window_size = 12
    half_w = window_size // 2
    avg_energies: List[float] = []
    len_e = len(energies)

    for i in range(len_e):
        w_start = max(0, i - half_w)
        w_end = min(len_e, i + half_w + 1)
        sub = energies[w_start:w_end]
        avg_energies.append(sum(sub) / len(sub))

    # Phát hiện phách onsets
    beat_times: List[float] = []
    last_beat_sec = -10.0
    global_max_energy = max(energies) if energies else 1.0
    min_energy_gate = global_max_energy * 0.10

    for i in range(len_e):
        t_sec = (i * frame_ms) / 1000.0
        cur_e = energies[i]
        avg_e = avg_energies[i]

        # Điều kiện: năng lượng cao hơn ngưỡng moving avg và cách phách trước >= min_interval_sec
        if (
            cur_e > avg_e * threshold_ratio
            and cur_e > min_energy_gate
            and (t_sec - last_beat_sec) >= min_interval_sec
        ):
            beat_times.append(round(t_sec, 3))
            last_beat_sec = t_sec

    # Ước lượng tempo BPM từ khoảng cách phách (inter-beat intervals)
    tempo_bpm = 120
    if len(beat_times) >= 3:
        intervals = [
            beat_times[k] - beat_times[k - 1] for k in range(1, len(beat_times))
        ]
        # Lọc bớt khoảng cách quá lớn hoặc quá nhỏ
        valid_intervals = [dt for dt in intervals if 0.25 <= dt <= 1.5]
        if valid_intervals:
            med_dt = statistics.median(valid_intervals)
            raw_bpm = round(60.0 / med_dt)
            # Chuẩn hóa về tầm 70-160 BPM
            while raw_bpm < 70:
                raw_bpm *= 2
            while raw_bpm > 165:
                raw_bpm /= 2
            tempo_bpm = int(round(raw_bpm))

    # Nếu không phát hiện phách nhịp rõ ràng (nhạc tĩnh / ambient drone), sinh lưới phách đều
    if not beat_times and duration_sec > 0:
        step = round(60.0 / max(60, tempo_bpm), 2)
        count = max(1, int(duration_sec / step))
        beat_times = [round(i * step, 2) for i in range(1, count + 1)]

    # Trích xuất 200 peaks từ segment âm thanh đã nạp sẵn trong RAM (không decode lại)
    peaks = extract_audio_peaks(sound, num_peaks=200)

    return {
        "duration": duration_sec,
        "tempo_bpm": tempo_bpm,
        "beat_times": beat_times,
        "peaks": peaks,
    }

def calculate_snap_to_beats(
    shots: List[Dict[str, Any]],
    beat_times: List[float],
    min_shot_duration: float = 1.5,
    max_shot_duration: float = 12.0,
) -> List[Dict[str, Any]]:
    """
    Tính toán và co giãn thời lượng của các phân cảnh sao cho điểm nối phân cảnh (cut points)
    khớp chuẩn xác với các phách nhạc beat_times.
    """
    if not shots:
        return []

    # Nếu không có phách nhạc, giữ nguyên thời lượng hiện tại
    if not beat_times:
        return [dict(s) for s in shots]

    sorted_beats = sorted(beat_times)
    updated_shots: List[Dict[str, Any]] = []
    current_time = 0.0

    for idx, s in enumerate(shots):
        original_dur = float(s.get("duration") or 5.0)
        target_end_time = current_time + original_dur

        # Phân cảnh cuối cùng: nếu beat kết thúc gần đó, có thể snap tới beat cuối hoặc giữ nguyên
        valid_beats_ahead = [
            b for b in sorted_beats
            if b >= (current_time + min_shot_duration)
            and b <= (current_time + max_shot_duration)
        ]

        if valid_beats_ahead:
            # Chọn beat có khoảng cách gần target_end_time nhất
            closest_beat = min(valid_beats_ahead, key=lambda b: abs(b - target_end_time))
            new_dur = round(closest_beat - current_time, 2)
            current_time = closest_beat
        else:
            # Nếu không tìm thấy phách trong khoảng cho phép, giữ nguyên khoảng min_shot_duration hoặc original_dur
            new_dur = max(min_shot_duration, min(max_shot_duration, original_dur))
            current_time = round(current_time + new_dur, 2)

        new_shot = dict(s)
        new_shot["duration"] = new_dur
        updated_shots.append(new_shot)

    return updated_shots
