# Kế Hoạch Triển Khai: Waveform Audio & Beat-Sync Detection (Timeline Bắt Nhịp Âm Nhạc & Snap-to-Beat - Hướng 3.3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống phân tích hình thái sóng âm (Waveform Audio Envelope) và tự động nhận diện phách nhịp âm nhạc (Beat-Sync Onset Detection) theo kiến trúc lai (Hybrid Web Audio API + Backend Python Engine), tích hợp canvas visualizer mượt mà vào Timeline NLE cùng tính năng "Snap to Beat" giúp tự động co giãn phân cảnh khớp từng phách nhạc điện ảnh.

**Architecture:** Kết hợp giữa Client-side Web Audio API (`AudioContext.decodeAudioData`) tại trình duyệt để giải mã âm thanh 0ms latency và Backend Audio Engine (`pydub` + RMS Energy Peak Analysis) tại FastAPI router (`studio/routers/audio.py` & `studio/audio_beat_detector.py`). Dữ liệu sóng âm và phách nhịp được chuẩn hóa dưới dạng normalized peaks [0.0, 1.0] và timestamp mảng beats, trực quan hóa trên HTML5 Canvas đa tầng của `TimelineScrubber.tsx`, cho phép đạo diễn bấm một chạm để tự động gán toàn bộ cut point của storyboard khớp với cao trào tiết tấu BGM.

**Tech Stack:** Python 3.11, FastAPI, Pydantic, Pydub, Pytest, React 18, TypeScript, Web Audio API, HTML5 Canvas 2D, Lucide React, Sonner Toast, Tailwind CSS.

**Spec:** [`strategic_development_roadmap_and_execution_plan.md`](file:///home/hieunv1/.gemini/antigravity-cli/brain/edfe7aad-59b7-4f89-ac33-6efb6125efaf/strategic_development_roadmap_and_execution_plan.md) — Hướng 3.3: Timeline Bắt Nhịp Âm Nhạc & Snap-to-Beat.

---

## Global Constraints
- Thuật toán nhận diện nhịp (Onset Energy Detection) tại backend không phụ thuộc vào các thư viện C/GPU nặng (như torch/librosa), sử dụng hoàn toàn `pydub` và thư viện chuẩn Python để đảm bảo tốc độ phân tích < 100ms trên CPU.
- Client-side Web Audio API phải xử lý mượt mà khi trình duyệt có chính sách Autoplay / AudioContext Suspended (yêu cầu resume on user gesture).
- Thuật toán Snap-to-Beat phải đảm bảo `min_shot_duration` (mặc định >= 1.5s) và `max_shot_duration` (mặc định <= 12.0s) để tránh trường hợp phân cảnh bị co rút quá ngắn làm hỏng nhịp thị giác.
- Tương thích 100% với 205 pytests hiện hữu, duy trì tính toàn vẹn dữ liệu của `storyboard.json` khi cập nhật `duration`.
- Toàn bộ giao diện người dùng, tooltip, thông báo toast và commit git thực hiện bằng Tiếng Việt.

---

## Review Focus
1. **Audio File Not Found hoặc Định Dạng Lạ:** Khi track BGM hoặc audio shot chưa được sinh hoặc đường dẫn không tồn tại, backend và frontend phải fallback về dạng sóng mô phỏng hoặc mảng rỗng mà không làm crash Timeline.
2. **Audio Không Có Nhịp Rõ Ràng (Ambient / Tĩnh):** Với các bản nhạc nền chậm rãi hoặc không có phách trống rõ ràng (BPM không xác định), thuật toán Snap-to-Beat phải chia đều phách theo khoảng thời gian chuẩn (ví dụ 3.0s/shot) thay vì ném lỗi chia cho 0.
3. **Canvas Hi-DPI / Retina Display Scaling:** Canvas vẽ sóng âm và phách nhịp phải tự động nhân hệ số `window.devicePixelRatio` để không bị mờ nhòe trên màn hình độ phân giải cao.
4. **Đồng Bộ Cuộn Ngang (Horizontal Scroll Sync):** Khi người dùng zoom scale (0.6x đến 2.5x) hoặc cuộn chuột ngang trên Timeline, canvas sóng âm và các vạch beat marker phải co giãn và thẳng hàng tuyệt đối với thước đo thời gian (Time Ruler).
5. **Khả Năng Hoàn Tác (Undo) hoặc Cảnh Báo Khi Snap:** Tự động điều chỉnh thời lượng toàn bộ shots cần thông báo số phân cảnh bị ảnh hưởng và cho phép lưu an toàn vào `storyboard.json`.

---

## Tasks

### Task 1: Module Phân Tích Sóng Âm & Nhận Diện Phách Nhạc Backend (`studio/audio_beat_detector.py`)

**Files:**
- Create: `studio/audio_beat_detector.py`
- Test: `tests/test_audio_beat.py`

**Interfaces:**
- Produces:
  - `extract_audio_peaks(audio_path: Union[str, Path], num_peaks: int = 300) -> List[float]`: Đọc file âm thanh qua `pydub`, downsample biên độ tuyệt đối thành danh sách `num_peaks` số thực chuẩn hóa trong đoạn `[0.0, 1.0]`.
  - `detect_beats(audio_path: Union[str, Path], frame_ms: int = 40, threshold_ratio: float = 1.35, min_interval_sec: float = 0.28) -> Dict[str, Any]`:
    Tính toán năng lượng RMS cục bộ, so sánh với moving average năng lượng để phát hiện phách onsets. Ước lượng BPM dựa trên trung vị khoảng cách giữa các phách. Trả về:
    ```python
    {
        "duration": float,
        "tempo_bpm": int,
        "beat_times": List[float],
        "peaks": List[float]
    }
    ```
  - `calculate_snap_to_beats(shots: List[Dict[str, Any]], beat_times: List[float], min_shot_duration: float = 1.5, max_shot_duration: float = 12.0) -> List[Dict[str, Any]]`:
    Thuật toán phân bổ lại thời lượng của danh sách phân cảnh: duyệt từ t=0, căn chỉnh điểm kết thúc phân cảnh khớp với phách gần nhất sao cho thời lượng phân cảnh nằm trong `[min_shot_duration, max_shot_duration]`.

- [x] **Step 1: Viết test kiểm tra phân tích sóng âm, beat detection và snap-to-beat trong `tests/test_audio_beat.py`**

```python
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
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `docker exec ai-film-studio-ui-1 pytest tests/test_audio_beat.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'studio.audio_beat_detector'`

- [x] **Step 3: Cài đặt `studio/audio_beat_detector.py`**

Triển khai logic:
- `extract_audio_peaks`: Sử dụng `pydub.AudioSegment.from_file`, chuyển đổi `get_array_of_samples()`, nhóm thành `num_peaks` khối, tính giá trị cực đại của từng khối, chuẩn hóa chia cho giá trị max amplitude.
- `detect_beats`: Chia audio thành các frame (ví dụ 40ms). Với mỗi frame tính năng lượng RMS. Sử dụng moving average qua cửa sổ 10-15 frames làm ngưỡng động (adaptive energy threshold). Điểm nào vượt `threshold_ratio * avg` và cách điểm trước tối thiểu `min_interval_sec` được đánh dấu là beat onset. Ước lượng BPM dựa trên trung vị chu kỳ `60.0 / median_interval`.
- `calculate_snap_to_beats`: Căn chỉnh tích lũy thời gian của từng shot vào beat timestamp gần nhất phù hợp.

- [x] **Step 4: Chạy test để xác nhận test pass**

Run: `docker exec ai-film-studio-ui-1 pytest tests/test_audio_beat.py -v`
Expected: PASS (4/4 tests passing)

- [x] **Step 5: Commit**

```bash
git add studio/audio_beat_detector.py tests/test_audio_beat.py
git commit -m "feat(audio): add audio waveform peak extraction and beat onset detection engine"
```

---

### Task 2: Backend Router Endpoints Cho Waveform & Beat-Sync (`studio/routers/audio.py`)

**Files:**
- Modify: `studio/routers/audio.py`
- Test: `tests/test_audio_beat_router.py`

**Interfaces:**
- Produces Endpoints:
  - `GET /api/audio/waveform`:
    Query params: `track: Optional[str] = "cinematic"`, `shot_id: Optional[str] = None`
    Trả về:
    ```json
    {
      "success": true,
      "track": "cinematic",
      "duration": 60.5,
      "tempo_bpm": 118,
      "beat_times": [0.5, 1.02, 1.54, 2.05, ...],
      "peaks": [0.12, 0.45, 0.88, ...]
    }
    ```
  - `POST /api/audio/beat-sync/snap`:
    Request payload:
    ```json
    {
      "project_id": "current",
      "bgm_track": "cinematic",
      "min_shot_duration": 1.5,
      "save_to_storyboard": true
    }
    ```
    Tính toán và tự động cập nhật `duration` của các shots trong `outputs/storyboard.json`.
    Trả về danh sách shots sau khi snap, BPM, và tổng thời lượng mới.

- [x] **Step 1: Viết test cho router endpoints trong `tests/test_audio_beat_router.py`**

```python
from fastapi.testclient import TestClient
import studio.server as srv
from studio.server import app

client = TestClient(app)

def test_api_audio_waveform_bgm_cinematic():
    resp = client.get("/api/audio/waveform?track=cinematic")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "duration" in data
    assert "tempo_bpm" in data
    assert "beat_times" in data
    assert "peaks" in data
    assert len(data["peaks"]) > 0

def test_api_audio_waveform_invalid_track():
    resp = client.get("/api/audio/waveform?track=non_existent_track_xyz")
    # Trả về fallback hợp lệ thay vì crash 500
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["tempo_bpm"] == 120
    assert len(data["peaks"]) > 0

def test_api_audio_snap_to_beats():
    resp = client.post("/api/audio/beat-sync/snap", json={
        "project_id": "current",
        "bgm_track": "cinematic",
        "min_shot_duration": 1.5,
        "save_to_storyboard": False
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "shots" in data
    assert "total_duration" in data
    assert "tempo_bpm" in data
```

- [x] **Step 2: Chạy test để xác nhận thất bại**

Run: `docker exec ai-film-studio-ui-1 pytest tests/test_audio_beat_router.py -v`
Expected: FAIL with 404 Not Found on `/api/audio/waveform`

- [x] **Step 3: Triển khai các router endpoints trong `studio/routers/audio.py`**

Thêm các endpoint:
- `GET /api/audio/waveform`: Tìm file trong `assets/bgm/{track}.mp3` hoặc `outputs/audio/{shot_id}.mp3`. Nếu tìm thấy, gọi `detect_beats`. Nếu không, tạo mảng peaks và beat_times giả định (fallback) để giao diện không bị gián đoạn.
- `POST /api/audio/beat-sync/snap`: Đọc storyboard hiện tại (hoặc từ project meta), trích xuất shots, lấy phách từ BGM chỉ định (hoặc từ `storyboard.json`), áp dụng `calculate_snap_to_beats`. Nếu `save_to_storyboard` là True, cập nhật trực tiếp vào file `outputs/storyboard.json` với `atomic_write_json`.

- [x] **Step 4: Chạy test để xác nhận thành công**

Run: `docker exec ai-film-studio-ui-1 pytest tests/test_audio_beat_router.py -v`
Expected: PASS (3/3 tests passing)

- [x] **Step 5: Commit**

```bash
git add studio/routers/audio.py tests/test_audio_beat_router.py
git commit -m "feat(audio): add GET /api/audio/waveform and POST /api/audio/beat-sync/snap endpoints"
```

---

### Task 3: Client-side Web Audio Waveform & Beat Analyzer Utility (`web/src/utils/audioWaveform.ts`)

**Files:**
- Create: `web/src/utils/audioWaveform.ts`
- Modify: `web/src/api/studio.ts`

**Interfaces:**
- Produces:
  - `interface WaveformData`:
    ```typescript
    export interface WaveformData {
      duration: number
      tempoBpm: number
      beatTimes: number[]
      peaks: number[]
    }
    ```
  - `fetchWaveformData(track: string, shotId?: string): Promise<WaveformData>`: Gọi endpoint `/api/audio/waveform` với cache in-memory.
  - `snapShotsToBeatTimes(shots: Array<{ id: string; duration: number }>, beatTimes: number[], minDur?: number): Array<{ id: string; duration: number }>`: Client-side snap utility tức thời.
  - `requestSnapToBeat(bgmTrack: string, minShotDuration?: number): Promise<{ success: boolean; shots: Array<{ id: string; duration: number }>; tempoBpm: number }>`: Gọi POST `/api/audio/beat-sync/snap`.

- [x] **Step 1: Tạo `web/src/utils/audioWaveform.ts`**

Cung cấp các hàm phân tích sóng âm:
- `fetchWaveformData(track, shotId)`: Gọi axios apiClient tới `/api/audio/waveform`.
- Caching kết quả dạng Map theo key `track_${track}_shot_${shotId}` để tránh lặp request khi người dùng scrub timeline.
- `snapShotsToBeatTimes(shots, beatTimes, minDur = 1.5)`: Tính toán snap client-side ngay lập tức để UI phản hồi 0ms trước khi backend lưu.

- [x] **Step 2: Thêm API client helper vào `web/src/api/studio.ts`**

Export hàm:
```typescript
export async function snapTimelineToBeat(params: {
  project_id?: string
  bgm_track?: string
  min_shot_duration?: number
  save_to_storyboard?: boolean
}): Promise<{
  success: boolean
  shots: Array<{ id: string; duration: number }>
  total_duration: number
  tempo_bpm: number
}> {
  const response = await apiClient.post('/api/audio/beat-sync/snap', params)
  return response.data
}
```

- [x] **Step 3: Kiểm tra TypeScript build**

Run: `npm run build` trong thư mục `web/`
Expected: 0 TS compilation errors.

- [x] **Step 4: Commit**

```bash
git add web/src/utils/audioWaveform.ts web/src/api/studio.ts
git commit -m "feat(web): add client-side audio waveform and beat-sync utilities"
```

---

### Task 4: Thành Phần HTML5 Canvas Waveform & Beat Markers Track (`web/src/components/AudioWaveformTrack.tsx`)

**Files:**
- Create: `web/src/components/AudioWaveformTrack.tsx`

**Interfaces:**
- Produces:
  - `interface AudioWaveformTrackProps`:
    ```typescript
    export interface AudioWaveformTrackProps {
      peaks: number[]
      beatTimes: number[]
      totalDuration: number
      timelineWidth: number
      playheadPositionPx?: number
      color?: 'cyan' | 'purple' | 'amber'
      showBeatMarkers?: boolean
      height?: number
      isLoading?: boolean
    }
    ```
  - Component `AudioWaveformTrack`:
    - Vẽ mirror waveform trên `<canvas>` với màu sắc theo prop (Cyan cho thoại, Purple cho BGM).
    - Vẽ các đường kẻ đứng chấm phá hoặc glowing lines tại mỗi vị trí `beatTimes` với nhãn nhịp.
    - Highlight vùng sóng âm bên trái playhead (đã phát) với độ sáng cao hơn vùng bên phải (chưa phát).
    - Tự động điều chỉnh kích thước theo Retina display qua `window.devicePixelRatio`.

- [x] **Step 1: Cài đặt component `web/src/components/AudioWaveformTrack.tsx`**

Sử dụng `useRef<HTMLCanvasElement>` và `useEffect` render canvas 2D:
- Tính tọa độ X của từng peak: `(i / peaks.length) * timelineWidth`.
- Vẽ các cột sóng đối xứng quanh trục trung tâm (mirror bars), có bo góc và gradient fill (từ màu sắc chỉ định xuống tông màu sẫm hơn).
- Nếu `showBeatMarkers = true`: Với mỗi `beat` trong `beatTimes`, tính `(beat / totalDuration) * timelineWidth`, vẽ vạch dọc màu hổ phách vàng (`#f59e0b`) tinh tế với độ trong suốt 0.6 và chấm nhỏ trên đỉnh.

- [x] **Step 2: Kiểm tra TypeScript build**

Run: `npm run build` trong thư mục `web/`
Expected: Thành công không có lỗi type.

- [x] **Step 3: Commit**

```bash
git add web/src/components/AudioWaveformTrack.tsx
git commit -m "feat(web): add high-performance HTML5 Canvas AudioWaveformTrack component"
```

---

### Task 5: Nâng Cấp `TimelineScrubber.tsx` & Đồng Bộ Hóa Storyboard ("🎵 Snap to Beat")

**Files:**
- Modify: `web/src/components/TimelineScrubber.tsx`
- Modify: `web/src/components/StoryboardView.tsx`

**Interfaces:**
- Consumes: `AudioWaveformTrack`, `fetchWaveformData`, `snapTimelineToBeat`.
- Produces:
  - Nút **"🎵 Snap to Beat"** (Bắt nhịp Âm nhạc) trên Toolbar của `TimelineScrubber`.
  - Hiển thị badge BPM nhịp điệu (ví dụ: `🎵 118 BPM`) cạnh tiêu đề Track A3 (BGM).
  - Nút toggle "Lưới Nhịp" (Beat Grid) để bật/tắt hiển thị vạch phách.
  - Tích hợp `AudioWaveformTrack` vào Track A1 (Dialogue) và Track A3 (BGM).
  - Khi click "Snap to Beat":
    - Tính toán lại thời lượng của tất cả shots.
    - Cập nhật state nội bộ và phát sự kiện `onBatchUpdateDurations` / `onUpdateShotDuration` lên `StoryboardView`.
    - Bắn thông báo `toast.success("Đã bắt nhịp thành công! X phân cảnh đã được khớp với nhịp điệu bài nhạc (BPM ~Y).")` qua Sonner.

- [x] **Step 1: Cập nhật `TimelineScrubberProps` để nhận `onBatchUpdateDurations` và `currentBgmTrack`**

Cập nhật props trong `web/src/components/TimelineScrubber.tsx`:
```typescript
export interface TimelineScrubberProps {
  shots: Shot[]
  onSelectShot?: (shotId: string) => void
  selectedShotId?: string | null
  onUpdateShotDuration?: (shotId: string, duration: number) => void
  onBatchUpdateDurations?: (updates: Array<{ id: string; duration: number }>) => void
  onReorderShots?: (newShotIds: string[]) => void
  onSplitShot?: (shotId: string, splitAtSec: number) => void
  bgmTrack?: string
}
```

- [x] **Step 2: Thêm state quản lý Waveform & Beat trong `TimelineScrubber.tsx`**

- `waveformData`: lưu kết quả từ `fetchWaveformData(bgmTrack)`.
- `showBeatGrid`: boolean toggle (mặc định true).
- `isSnapping`: boolean loading indicator khi bấm Snap.
- Hàm `handleSnapToBeat()`:
  - Gọi `snapTimelineToBeat({ bgm_track: bgmTrack, min_shot_duration: 1.5, save_to_storyboard: true })`.
  - Cập nhật các phân cảnh qua `onBatchUpdateDurations`.
  - Hiển thị `toast.success` thông báo số lượng phân cảnh đã được khớp nhịp chuẩn xác.

- [x] **Step 3: Thay thế simulated waveform ở Track A1 & A3 bằng `AudioWaveformTrack`**

- Track A3: Thay thế div tĩnh bằng component `<AudioWaveformTrack peaks={waveformData.peaks} beatTimes={waveformData.beatTimes} totalDuration={totalDuration} timelineWidth={timelineWidth} playheadPositionPx={playheadPositionPx} color="purple" showBeatMarkers={showBeatGrid} />`.
- Track Header A3: Thêm badge BPM `🎵 ${waveformData.tempoBpm} BPM` và nút toggle icon nhịp điệu.
- Thêm nút "Snap to Beat" trên Top Scrubber Control Bar bên cạnh nút "Cắt Phân Cảnh (Split)".

- [x] **Step 4: Nối `onBatchUpdateDurations` tại `StoryboardView.tsx`**

Cập nhật mutation hoặc batch handler trong `web/src/components/StoryboardView.tsx` để cập nhật query cache của storyboard khi nhận `onBatchUpdateDurations`.

- [x] **Step 5: Kiểm tra TypeScript build**

Run: `npm run build` trong thư mục `web/`
Expected: 0 errors.

- [x] **Step 6: Commit**

```bash
git add web/src/components/TimelineScrubber.tsx web/src/components/StoryboardView.tsx
git commit -m "feat(timeline): integrate real waveform tracks, beat grid and snap-to-beat button"
```

---

### Task 6: Kiểm Thử Toàn Diện & Live Chrome CDP Verification

**Files:**
- Create: `tests/verify_beat_sync_cdp.py`
- Test: Full Pytest Suite + Chrome CDP Browser Interaction

- [x] **Step 1: Khởi động lại container backend để tải route mới**

Run: `docker restart ai-film-studio-ui-1`
Expected: Container restarted, healthcheck / endpoint `/api/audio/waveform` phản hồi 200 OK.

- [x] **Step 2: Chạy toàn bộ backend pytest suite**

Run: `docker exec ai-film-studio-ui-1 pytest -v`
Expected: Toàn bộ 212+ pytests passing (100% pass rate).

- [x] **Step 3: Chạy build frontend production**

Run: `cd web && npm run build`
Expected: `✓ built in ...ms` không có bất kỳ cảnh báo hoặc lỗi TypeScript nào.

- [x] **Step 4: Chạy script Chrome CDP kiểm tra giao diện trực tiếp**

Viết script python kết nối Chrome qua cổng CDP 9222:
- Điều hướng tới `http://localhost:8080/`.
- Kiểm tra sự xuất hiện của Canvas Waveform trên Track BGM.
- Kiểm tra sự xuất hiện của nút "Snap to Beat" và badge BPM.
- Nhấp nút "Snap to Beat" và xác nhận xuất hiện thông báo toast của Sonner.
- Chụp ảnh màn hình lưu vào `.gemini/antigravity-cli/brain/edfe7aad-59b7-4f89-ac33-6efb6125efaf/waveform_beat_sync_verified.png`.

- [x] **Step 5: Commit ảnh minh chứng và hoàn tất hướng 3.3**

```bash
git add tests/verify_beat_sync_cdp.py
git commit -m "test: add live Chrome CDP verification for waveform audio & beat sync"
```
