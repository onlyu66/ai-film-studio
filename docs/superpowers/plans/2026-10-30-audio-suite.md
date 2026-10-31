# Multi-Track Audio Suite & Live Web Audio Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống Multi-Track Audio Suite toàn diện trên Timeline Scrubber, gồm 3 tầng sóng âm Canvas thực tế (Voice, SFX, BGM), bộ phát âm thanh live Web Audio trộn trực tiếp trong trình duyệt khi bấm Play, trợ lý 1-click Cut-to-Beat bảo toàn câu thoại, và núm điều khiển Fade-in / Fade-out trên từng phân cảnh.

**Architecture:**  
- **Client Web Audio**: Xây dựng singleton `WebAudioMixer.ts` dùng Web Audio API (`AudioContext`, `AudioBufferSourceNode`, `GainNode`) phát live trộn 3 luồng âm thanh theo timecode Playhead, tự động hạ âm BGM (Auto-Ducking linear ramp) khi thoại phát, và mute/solo tức thời.
- **Canvas Waveform Visualizer**: Mở rộng `AudioWaveformTrack.tsx` hỗ trợ vẽ đường dốc lõm Auto-Ducking dip curve trên track BGM, và hiển thị sóng âm đối xứng thật cho Voice (Cyan) và SFX (Amber).
- **Backend & Data Model**: Bổ sung `sfx_key` cho endpoint `/api/audio/waveform`, thêm `fade_in` và `fade_out` vào `Shot` schema, và áp dụng `pydub.fade_in().fade_out()` trong pipeline hòa âm `studio/assembly.py`.

**Tech Stack:** React 18, TypeScript, Web Audio API, HTML5 Canvas 2D, Tailwind CSS, FastAPI, Python 3.11, Pydub, Pytest.

**Spec:** [`docs/superpowers/specs/2026-10-30-audio-suite-design.md`](file:///C:/Documents/ai-film-studio/docs/superpowers/specs/2026-10-30-audio-suite-design.md)

---

## Global Constraints

- Không làm giảm tốc độ phản hồi: Timeline Scrubber phải duy trì 60 FPS khi kéo trượt Playhead; toàn bộ AudioBuffer và mảng peaks sóng âm phải được cache RAM.
- Cắt cảnh theo nhịp (Cut-to-Beat) bắt buộc tuân thủ ràng buộc: `minDur = Math.max(1.5, dialogue_audio_duration)` để không bao giờ cắt cụt câu thoại của nhân vật.
- Hòa âm Backend dùng `pydub` cho `fade_in`, `fade_out` và ducking, đảm bảo tương thích 100% với 38/38 unit tests hiện có.
- Mọi thay đổi metadata shot (`duration`, `sfx_offset_ms`, `fade_in`, `fade_out`) phải được lưu nguyên vẹn vào `storyboard.json`.

---

## Review Focus

1. **Trường hợp audio thoại chưa được tạo (`has_audio: false`)**: Web Audio Mixer bỏ qua track thoại cho shot đó mà không gây crash AudioContext, canvas hiển thị đường nét đứt mờ.
2. **Kéo Playhead liên tục (Fast Scrubbing)**: Web Audio Mixer phải hủy (`stop()`) ngay lập tức các buffer node cũ đang phát, tránh hiện tượng chồng lặp âm thanh hoặc rè giật khi người dùng kéo chuột nhanh.
3. **Phân cảnh không có thoại hoặc rỗng**: BGM không bị ducking tại phân cảnh đó; đường dốc ducking chỉ kích hoạt khi phân cảnh có dialogue thực tế.
4. **SFX bị kéo ra ngoài ranh giới phân cảnh**: `sfx_offset_ms` phải được giới hạn chặt chẽ `[0, shot.duration * 1000 - sfx_duration_ms]`.
5. **Autoplay Policy trên trình duyệt**: `AudioContext` phải được resume an toàn khi người dùng tương tác chuột lần đầu (click nút Play).

---

## Implementation Tasks

### Task 1: Backend SFX Waveform & Shot Fade Metadata

**Files:**
- Modify: `studio/storyboard.py:30-70`
- Modify: `studio/routers/audio.py:598-648`
- Modify: `studio/routers/storyboard.py:26-45`
- Test: `tests/test_server.py:1026-1095`

**Interfaces:**
- Consumes: `detect_beats` from `studio.audio_beat_detector`
- Produces:
  - `Shot.fade_in: float = 0.0`, `Shot.fade_out: float = 0.0`
  - `GET /api/audio/waveform?sfx_key={key}` returning `{ success: True, duration, peaks, beat_times }`
  - `UpdateShotRequest.fade_in`, `UpdateShotRequest.fade_out`

- [x] **Step 1: Write the failing test for SFX waveform and Shot fade fields**

Thêm test vào `tests/test_server.py`:
```python
def test_api_sfx_waveform_endpoint():
    resp = client.get("/api/audio/waveform?sfx_key=thunder")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "peaks" in data
    assert len(data["peaks"]) > 0
    assert data["duration"] > 0

def test_update_shot_fade_controls(tmp_path, monkeypatch):
    import json
    from pathlib import Path
    sb_file = tmp_path / "storyboard.json"
    sb_file.write_text(json.dumps({
        "title": "Fade Test",
        "characters": {},
        "shots": [{"id": "s1", "dialogue": "Line", "fade_in": 0.0, "fade_out": 0.0}]
    }), encoding="utf-8")
    monkeypatch.setattr("studio.server.Path", lambda arg, *rest: sb_file if str(arg) == "outputs/storyboard.json" else Path(arg, *rest))
    resp = client.post("/api/storyboard/update-shot", json={
        "shot_id": "s1",
        "fade_in": 0.5,
        "fade_out": 0.8
    })
    assert resp.status_code == 200
    updated = json.loads(sb_file.read_text(encoding="utf-8"))
    assert updated["shots"][0]["fade_in"] == 0.5
    assert updated["shots"][0]["fade_out"] == 0.8
```

- [x] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_server.py::test_api_sfx_waveform_endpoint -v`  
Expected: FAIL (tham số `sfx_key` chưa được xử lý trong endpoint `/api/audio/waveform`).

- [x] **Step 3: Implement SFX waveform support and Fade fields**

1. Cập nhật `Shot` dataclass trong `studio/storyboard.py`: thêm `fade_in: float = 0.0` và `fade_out: float = 0.0` vào constructor, `to_dict()` và `from_dict()`.
2. Cập nhật `UpdateShotRequest` trong `studio/routers/storyboard.py`: thêm `fade_in: Optional[float] = None` và `fade_out: Optional[float] = None`, cập nhật shot dict tương ứng.
3. Cập nhật `api_get_audio_waveform` trong `studio/routers/audio.py`: thêm param `sfx_key: Optional[str] = None`. Nếu có `sfx_key`, kiểm tra `assets/sfx/{sfx_key}.mp3` hoặc `.wav`, gọi `detect_beats` phân tích và trả về peaks.

- [x] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_server.py::test_api_sfx_waveform_endpoint tests/test_server.py::test_update_shot_fade_controls -v`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add studio/storyboard.py studio/routers/audio.py studio/routers/storyboard.py tests/test_server.py
git commit -m "feat(audio): add sfx waveform support and shot fade-in/fade-out fields"
```

---

### Task 2: Backend Audio Assembly Fade In & Fade Out (`studio/assembly.py`)

**Files:**
- Modify: `studio/assembly.py:150-250`
- Test: `tests/test_assembly.py`

**Interfaces:**
- Consumes: `shot.fade_in`, `shot.fade_out` from `Shot`
- Produces: `mix_sfx_into_shot_audio` & `build_master_audio` with applied `fade_in` and `fade_out`

- [x] **Step 1: Write the failing test for assembly audio fading**

Thêm test vào `tests/test_assembly.py`:
```python
def test_mix_sfx_fade_in_fade_out(tmp_path):
    from pydub import AudioSegment
    from studio.assembly import mix_sfx_into_shot_audio

    speech = tmp_path / "speech.mp3"
    AudioSegment.silent(duration=3000).export(str(speech), format="mp3")
    out = tmp_path / "faded.mp3"

    res = mix_sfx_into_shot_audio(
        speech_audio_path=speech,
        sfx_str=None,
        shot_duration=3.0,
        output_path=out,
        voice_volume=1.0,
        fade_in_sec=0.5,
        fade_out_sec=0.5,
    )
    assert res.exists()
    assert res.stat().st_size > 0
```

- [x] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_assembly.py::test_mix_sfx_fade_in_fade_out -v`  
Expected: FAIL (`mix_sfx_into_shot_audio` unexpected keyword argument `fade_in_sec`).

- [x] **Step 3: Implement Fade handling in `studio/assembly.py`**

Trong `mix_sfx_into_shot_audio`:
1. Thêm tham số `fade_in_sec: float = 0.0` và `fade_out_sec: float = 0.0`.
2. Nếu `fade_in_sec > 0`: `audio = audio.fade_in(int(fade_in_sec * 1000))`.
3. Nếu `fade_out_sec > 0`: `audio = audio.fade_out(int(fade_out_sec * 1000))`.
4. Trong `build_master_audio`: truyền `getattr(shot, 'fade_in', 0.0)` và `getattr(shot, 'fade_out', 0.0)` vào lời gọi hàm.

- [x] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_assembly.py -v`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add studio/assembly.py tests/test_assembly.py
git commit -m "feat(assembly): apply shot fade_in and fade_out in master audio mixing"
```

---

### Task 3: In-Browser Web Audio Multi-Track Mixer Service (`WebAudioMixer.ts`)

**Files:**
- Create: `web/src/utils/WebAudioMixer.ts`
- Modify: `web/src/utils/audioWaveform.ts`
- Test: `web/src/utils/WebAudioMixer.test.ts`

**Interfaces:**
- Consumes: Audio URLs (`/api/outputs/audio/{id}.mp3`, `/api/assets/sfx/{key}.mp3`, `/api/assets/bgm/{track}.mp3`)
- Produces: `WebAudioMixer` singleton with methods:
  - `play(currentTime, shots, options)`
  - `pause()`
  - `seek(timeSec)`
  - `setTrackMute(track, isMuted)`
  - `setTrackVolume(track, volume)`
  - `destroy()`

- [x] **Step 1: Write unit test for `WebAudioMixer`**

Tạo `web/src/utils/WebAudioMixer.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WebAudioMixer } from './WebAudioMixer'

describe('WebAudioMixer', () => {
  let mixer: WebAudioMixer

  beforeEach(() => {
    mixer = new WebAudioMixer()
  })

  it('initializes with default volume and unmuted tracks', () => {
    expect(mixer.getTrackState('voice').isMuted).toBe(false)
    expect(mixer.getTrackState('voice').volume).toBe(1.0)
    expect(mixer.getTrackState('bgm').volume).toBe(0.7)
  })

  it('updates mute state on track correctly', () => {
    mixer.setTrackMute('sfx', true)
    expect(mixer.getTrackState('sfx').isMuted).toBe(true)
  })

  it('calculates active shot at timecode', () => {
    const shots = [
      { id: 's1', duration: 3.0 },
      { id: 's2', duration: 4.0 },
    ]
    expect(mixer.findShotAtTime(1.5, shots)?.shot.id).toBe('s1')
    expect(mixer.findShotAtTime(4.0, shots)?.shot.id).toBe('s2')
    expect(mixer.findShotAtTime(8.0, shots)).toBeNull()
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/utils/WebAudioMixer.test.ts` (hoặc kiểm tra file tồn tại).  
Expected: FAIL (`WebAudioMixer` not defined).

- [x] **Step 3: Implement `WebAudioMixer.ts`**

Tạo `web/src/utils/WebAudioMixer.ts`:
1. Quản lý `AudioContext` singleton (tạo khi người dùng click lần đầu để pass browser Autoplay policy).
2. Tạo 3 GainNode nhánh: `voiceGain`, `sfxGain`, `bgmGain` nối vào `masterGain` -> `destination`.
3. Bộ đệm RAM cache `Map<string, AudioBuffer>` tải qua `fetch(url)` và `ctx.decodeAudioData`.
4. Phương thức `play(timeSec, shots, bgmTrack, options)`:
   - Tính toán time offset của từng shot và lập lịch phát Voice + SFX khớp với Playhead.
   - BGM phát loop hoặc stream với gain automation (ducking BGM gain xuống 30-50% tại thời điểm Voice phát).
5. Phương thức `pause()`: dừng toàn bộ source node đang chạy.
6. Hỗ trợ `setTrackMute` và `setTrackVolume`.

- [x] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/utils/WebAudioMixer.test.ts`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add web/src/utils/WebAudioMixer.ts web/src/utils/WebAudioMixer.test.ts
git commit -m "feat(audio): implement in-browser WebAudioMixer multi-track live player"
```

---

### Task 4: Auto-Ducking Canvas Waveform Visualization (`AudioWaveformTrack.tsx`)

**Files:**
- Modify: `web/src/components/AudioWaveformTrack.tsx:1-150`

**Interfaces:**
- Consumes:
  - `duckingRegions?: Array<{ startSec: number, endSec: number, duckRatio?: number }>`
- Produces: Enhanced Canvas rendering showing mirrored waveforms with smooth concave dip curves in ducking zones.

- [x] **Step 1: Write visual test / prop contract for `AudioWaveformTrack`**

Cập nhật interface `AudioWaveformTrackProps`:
```typescript
export interface DuckingRegion {
  startSec: number
  endSec: number
  duckRatio?: number // Mặc định 0.35 (giảm còn 35% biên độ)
}

export interface AudioWaveformTrackProps {
  peaks: number[]
  beatTimes: number[]
  totalDuration: number
  audioDuration?: number
  timelineWidth: number
  playheadPositionPx?: number
  color?: 'cyan' | 'purple' | 'amber'
  showBeatMarkers?: boolean
  height?: number
  isLoading?: boolean
  duckingRegions?: DuckingRegion[] // Mới
}
```

- [x] **Step 2: Verify existing build status**

Run: `cd web && npm run build`  
Expected: PASS trước khi sửa.

- [x] **Step 3: Implement Auto-Ducking curve rendering in Canvas**

Trong `useEffect` vẽ canvas của `AudioWaveformTrack.tsx`:
1. Khi vẽ từng thanh bar `x`:
   - Tính `timelineSec = (x / displayWidth) * totalDuration`.
   - Kiểm tra `timelineSec` có nằm trong bất kỳ `duckingRegion` nào không.
   - Nếu có, tính toán hệ số giảm biên độ: thêm hiệu ứng ramp-down 0.3s ở đầu vùng ducking và ramp-up 0.5s ở cuối vùng ducking để đường cong lõm mượt mà.
   - Nhân `barH = barH * currentDuckFactor`.
   - Tô màu vùng ducking với ánh tím mờ hoặc đường dốc mỏng để người dùng nhận diện ngay đây là khoảng nhạc nền đang né giọng thoại.

- [x] **Step 4: Test canvas rendering with ducking regions**

Kiểm tra build frontend không có lỗi TypeScript:
Run: `cd web && npm run build`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add web/src/components/AudioWaveformTrack.tsx
git commit -m "feat(ui): add visual auto-ducking dip curve to AudioWaveformTrack canvas"
```

---

### Task 5: Protected Cut-to-Beat Assistant Algorithm (`audioWaveform.ts`)

**Files:**
- Modify: `web/src/utils/audioWaveform.ts:70-123`
- Test: `web/src/utils/audioWaveform.test.ts`

**Interfaces:**
- Consumes: `shots` with optional `audioDuration` (độ dài thoại thực tế)
- Produces: `snapShotsToBeatTimes` enforcing `chosenDuration >= Math.max(1.5, shot.audioDuration)`

- [x] **Step 1: Write test for protected cut-to-beat snapping**

Tạo/cập nhật `web/src/utils/audioWaveform.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { snapShotsToBeatTimes } from './audioWaveform'

describe('snapShotsToBeatTimes', () => {
  it('protects dialogue audio duration from being truncated', () => {
    const shots = [
      { id: 's1', duration: 5.0, audioDuration: 3.8 }, // Thoại dài 3.8s
    ]
    const beatTimes = [1.0, 2.0, 3.0, 4.0, 5.0]

    const result = snapShotsToBeatTimes(shots, beatTimes)
    // Phách 3.0s < 3.8s thoại -> Phải chọn phách 4.0s để không cụt lời
    expect(result[0].duration).toBeGreaterThanOrEqual(3.8)
    expect(result[0].duration).toBe(4.0)
  })
})
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/utils/audioWaveform.test.ts`  
Expected: FAIL (thuật toán cũ chưa xét `audioDuration` của shot).

- [x] **Step 3: Implement protected snapping in `audioWaveform.ts`**

Trong `snapShotsToBeatTimes`:
1. Với mỗi shot, tính `minRequired = Math.max(minDur, Number(shot.audioDuration || 0))`.
2. Lọc các ứng viên phách thỏa mãn `b >= accumulatedTime + minRequired`.
3. Chọn phách gần `accumulatedTime + origDur` nhất.
4. Gán `result.push({ id: shot.id, duration: chosenDuration })`.

- [x] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/utils/audioWaveform.test.ts`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add web/src/utils/audioWaveform.ts web/src/utils/audioWaveform.test.ts
git commit -m "feat(audio): enforce speech duration protection in snapShotsToBeatTimes"
```

---

### Task 6: Full Timeline Scrubber Multi-Track UI Integration (`TimelineScrubber.tsx`)

**Files:**
- Modify: `web/src/components/TimelineScrubber.tsx`
- Modify: `web/src/types/index.ts`

**Interfaces:**
- Consumes:
  - `WebAudioMixer` from `web/src/utils/WebAudioMixer.ts`
  - `fetchWaveformData` from `web/src/utils/audioWaveform.ts`
  - `AudioWaveformTrack` with ducking regions
- Produces:
  - Multi-track timeline với 3 tầng sóng âm thật
  - Nút Snap to Beat kích hoạt `snapShotsToBeatTimes`
  - Drag handles Fade-in và Fade-out trên từng shot dialogue
  - Nút Play/Pause kích hoạt Web Audio multi-track live playback

- [x] **Step 1: Update TypeScript interfaces in `types/index.ts`**

Bổ sung `fade_in?: number` và `fade_out?: number` vào interface `Shot` trong `web/src/types/index.ts`.

- [x] **Step 2: Wire WebAudioMixer into TimelineScrubber Play/Pause loop**

Trong `TimelineScrubber.tsx`:
1. Khởi tạo instance `webAudioMixerRef = useRef(new WebAudioMixer())`.
2. Trong hàm toggle `handlePlayPause`:
   - Nếu chuyển sang `isPlaying = true`: gọi `webAudioMixerRef.current.play(currentTime, shots, bgmTrack, { isVoiceMuted, isSfxMuted, isBgmMuted })`.
   - Nếu chuyển sang `isPlaying = false`: gọi `webAudioMixerRef.current.pause()`.
3. Khi người dùng kéo Playhead (Scrubbing / Seeking): đồng bộ `webAudioMixerRef.current.seek(targetSec)`.
4. Khi toggle Mute trên từng Track Header: gọi `webAudioMixerRef.current.setTrackMute(trackType, isMuted)`.

- [x] **Step 3: Integrate Voice Real Waveform & Fade Handles on Track 2**

1. Tải sóng âm thật cho từng shot có thoại bằng `fetchWaveformData(undefined, shot.id)`.
2. Thay thế các cột sóng giả lập cứng bằng `AudioWaveformTrack` màu cyan.
3. Thêm 2 núm tam giác nhỏ ở góc trên trái (Fade In) và góc trên phải (Fade Out) của block thoại. Kéo rê chuột sang ngang để cập nhật `fade_in` và `fade_out` (0.0s – 2.0s), gọi `onUpdateShot` lưu metadata.

- [x] **Step 4: Integrate SFX Real Waveform on Track 3**

1. Khi shot có `shot.sfx`, gọi `fetchWaveformData(undefined, undefined, shot.sfx)` để lấy sóng âm hiệu ứng.
2. Vẽ waveform amber trên block SFX, đặt vị trí chính xác theo `sfx_offset_ms`.
3. Cho phép kéo chuột để dịch chuyển mốc phát trong phạm vi phân cảnh.

- [x] **Step 5: Integrate BGM Auto-Ducking Curve on Track 4**

1. Tính toán danh sách `duckingRegions` từ các shot có dialogue:
   ```typescript
   const duckingRegions = shotTimeline
     .filter(({ shot }) => Boolean(shot.dialogue && String(shot.dialogue).trim()))
     .map(({ startSec, duration }) => ({ startSec, endSec: startSec + duration, duckRatio: 0.35 }))
   ```
2. Truyền `duckingRegions` vào `AudioWaveformTrack` của track BGM.

- [x] **Step 6: Add Cut-to-Beat Assistant button on Toolbar**

Bổ sung nút bấm trên thanh công cụ Timeline:
```tsx
<button
  type="button"
  onClick={handleSnapToBeatClick}
  className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
  title="Tự động căn chỉnh ranh giới phân cảnh khớp theo phách nhạc BGM"
>
  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
  <span>⚡ Snap Cuts to Beat ({bgmWaveform?.tempoBpm || 120} BPM)</span>
</button>
```

- [x] **Step 7: Verify frontend build passes without warnings**

Run: `cd web && npm run build`  
Expected: `✓ built in ...ms` không có lỗi Type hay cú pháp.

- [x] **Step 8: Commit**

```bash
git add web/src/components/TimelineScrubber.tsx web/src/types/index.ts
git commit -m "feat(ui): complete multi-track audio visualizer, live playback, cut-to-beat and fade handles"
```

---

### Task 7: End-to-End Verification & Full Test Suite

**Files:**
- Entire workspace

- [x] **Step 1: Run complete backend pytest suite**

Run: `python -m pytest tests/test_server.py tests/test_assembly.py tests/test_storage.py -v`  
Expected: Tất cả các test cases đạt PASS 100%.

- [x] **Step 2: Run complete frontend build check**

Run: `cd web && npm run build`  
Expected: Build thành công tạo bundle `web/dist/`.

- [x] **Step 3: Verification of key flows**
1. Kiểm tra endpoint `/api/audio/waveform?sfx_key=thunder` trả về đúng peaks SFX.
2. Kiểm tra `storyboard.json` lưu thành công `fade_in` và `fade_out`.
3. Kiểm tra Web Audio Mixer khởi tạo an toàn và mute/solo hoạt động.

- [x] **Step 4: Final commit**

```bash
git commit --allow-empty -m "chore(audio-suite): complete and verify multi-track audio suite"
```
