# Design Specification: Multi-Track Audio Suite & Live Web Audio Engine

**Document Path:** `docs/superpowers/specs/2026-10-30-audio-suite-design.md`  
**Date:** 2026-10-30  
**Status:** Approved for Implementation Planning  
**Target Modules:**  
- Frontend: `TimelineScrubber.tsx`, `AudioWaveformTrack.tsx`, `audioWaveform.ts`, `WebAudioMixer.ts`
- Backend: `studio/routers/audio.py`, `studio/assembly.py`, `studio/storyboard.py`

---

## 1. Intent & The Why

### Context
Trong AI Film Studio, chất lượng điện ảnh phụ thuộc lớn vào sự hòa hợp giữa hình ảnh và hòa âm (thuyết minh diễn cảm, hiệu ứng foley môi trường và nhạc nền dynamic mood). Hiện tại, component `TimelineScrubber` chỉ có thanh chạy thời gian giả lập (`requestAnimationFrame`), chưa thể hiện sóng âm thực tế và không phát âm thanh đồng bộ khi bấm nút Play trên Timeline.

### Goal
Xây dựng một **Multi-Track Audio Suite** hoàn chỉnh chuẩn phòng dựng (DAW-style) tích hợp trực tiếp trên Timeline:
1. **Multi-Track Real Waveform Visualizer**: Hiển thị 3 tầng sóng âm thực tế (Voice - SFX - BGM) vẽ bằng Canvas 2D mượt mà kèm đường biểu diễn trực quan hiệu ứng Auto-Ducking.
2. **In-Browser Live Web Audio Mixer**: Khi bấm nút Play trên Timeline, trình duyệt kích hoạt Web Audio API phát trộn trực tiếp cả 3 tầng âm thanh (Voice, SFX, BGM), đồng bộ live theo vị trí Playhead với các nút Mute / Solo và hiệu ứng Auto-Ducking thời gian thực.
3. **Cut-to-Beat Assistant**: Trợ lý 1-click tự động căn chỉnh ranh giới cắt cảnh (shot cuts) rơi trúng phách mạnh (beat markers) của bài nhạc mà vẫn bảo toàn 100% câu thoại của diễn viên.
4. **Fade-in / Fade-out Envelope Controls**: Núm kéo trực tiếp trên đầu/cuối dải âm thanh từng phân cảnh để làm mượt tiếng nói và chuyển cảnh êm ái.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
* **G-1 (Real Waveforms)**: Render sóng âm thực tế cho từng shot dialogue và hiệu ứng SFX qua Canvas 2D độ phân giải cao (`devicePixelRatio`), đồng bộ mượt mà theo tỷ lệ zoom của timeline.
* **G-2 (Live Web Audio Engine)**: Kiến trúc Web Audio API (`AudioContext`, `AudioBufferSourceNode`, `GainNode`) phát live Voice + SFX + BGM theo đúng timecode của Playhead, hỗ trợ Play/Pause, Seek/Scrub, Mute/Solo tức thời.
* **G-3 (Real-Time & Visual Auto-Ducking)**:
  * Trực quan: Sóng BGM tự động lõm xuống (dip curve) tại các đoạn có thoại.
  * Âm thanh live: `GainNode` của BGM tự động giảm âm lượng (ramp down 0.3s xuống 30-50% và ramp up 0.5s) khi giọng đọc phát lên.
* **G-4 (Cut-to-Beat Assistant)**: Nút "⚡ Snap Cuts to Beat" tự động tối ưu hóa thời lượng toàn bộ shot theo phách nhạc, áp dụng ràng buộc `duration >= dialogue_audio_duration` để không bao giờ cụt lời.
* **G-5 (Fade Handles)**: Núm tam giác kéo Fade-in và Fade-out (0.0s – 2.0s) trực quan trên dải âm thanh từng shot; đồng bộ cả Web Audio live lẫn backend `pydub` master assembly.

### Non-Goals
* Không biến timeline thành DAW độc lập có thu âm đa kênh (MIDI/Microphone recording) hay nạp VST plugin ngoài.
* Không can thiệp thay đổi cấu trúc video đã render; chỉ cập nhật metadata thời lượng shot, mốc bù âm thanh (`sfx_offset_ms`) và fade (`fade_in`, `fade_out`).

### Anti-Goals
* **Không làm giảm hiệu năng (No Lag/Stutter)**: Timeline Scrubber duy trì 60 FPS khi kéo trượt Playhead; dữ liệu sóng âm (peaks/beats) và audio buffers được cache RAM thông minh.
* **Không làm gãy luồng render hiện tại**: Các thuộc tính mới như fade hay beat-snapped duration tương thích 100% với FFmpeg master assembly và Fast Remuxing.

---

## 3. Technical Architecture & Component Design

### 3.1. Live Web Audio Engine (`WebAudioMixer.ts`)
Tạo một service singleton quản lý âm thanh Web Audio phía client:
* **Audio Graph Architecture**:
  ```
  [Voice AudioBufferSource] ---> [Voice GainNode] ----\
  [SFX AudioBufferSource]   ---> [SFX GainNode]   -----> [Master GainNode] ---> [AudioDestination]
  [BGM AudioBufferSource]   ---> [BGM GainNode]   ----/
                                        ^
                              (Auto-Ducking Automation)
  ```
* **Buffer Management & Caching**:
  * Tải trước (pre-fetch & decode) các file audio thoại `/api/outputs/audio/{shot_id}.mp3`, SFX `/api/assets/sfx/{key}.mp3` và BGM `/api/assets/bgm/{track}.mp3` qua `AudioContext.decodeAudioData`.
  * Bộ nhớ cache RAM tái sử dụng buffer đã giải mã, không fetch lặp lại.
* **Playback Scheduling & Scrubbing**:
  * Khi Playhead di chuyển hoặc Seek: Tính toán offset của từng track tại thời điểm `currentTime` và kích hoạt `source.start(0, offset)`.
  * Khi Pause: `source.stop()` và giải phóng node nguồn, giữ nguyên vị trí Playhead.
  * Live Ducking: Sử dụng `bgmGain.gain.linearRampToValueAtTime()` tự động giảm âm lượng BGM tại các khoảng thời gian Track Voice có âm thanh.
  * Mute/Solo: Đặt `gain.value = 0` ngay lập tức cho track tương ứng.

### 3.2. Multi-Track Canvas Waveform Architecture
* **Track 1 — Voice Track (Cyan `#22d3ee`)**:
  * Gọi `/api/audio/waveform?shot_id={shot_id}` lấy mảng `peaks`.
  * Vẽ waveform đối xứng. Vùng không có lời thoại (hoặc im lặng) hiển thị đường baseline nét đứt màu xám mờ.
* **Track 2 — Foley SFX Track (Amber `#fbbf24`)**:
  * Gọi `/api/audio/waveform?sfx_key={key}` lấy độ dài và sóng âm của hiệu ứng.
  * Đặt khối SFX tại tọa độ `left = (sfx_offset_ms / 1000) * pxPerSec`, độ rộng bằng đúng thời lượng file SFX.
  * Hỗ trợ kéo rê chuột (drag) khối SFX để cập nhật `sfx_offset_ms` (giới hạn `0 <= sfx_offset_ms <= shot.duration`).
* **Track 3 — BGM Track (Purple `#c084fc`)**:
  * Render sóng âm BGM trải dài suốt timeline kèm vạch phách nhịp Beat Markers màu vàng.
  * Hiển thị đường dốc Auto-Ducking Dip Curve mô phỏng chính xác mức giảm âm lượng khi có lời thoại.

### 3.3. Cut-to-Beat Assistant (Rhythm Snapping)
* **Giao diện**:
  * Nút bấm **"⚡ Snap Cuts to Beat"** trên thanh công cụ Timeline, hiển thị BPM phát hiện được.
* **Thuật toán thông minh**:
  * Sử dụng `snapShotsToBeatTimes(shots, beatTimes, minDur, maxDur)`.
  * Ràng buộc bảo vệ: `minDur = Math.max(1.5, dialogue_audio_duration)`.
  * Tự động điều chỉnh `shot.duration` của tất cả các cảnh sao cho điểm kết thúc trùng với beat marker gần nhất.
  * Cập nhật đồng loạt vào state qua `onBatchUpdateDurations` và lưu vào `storyboard.json`.

### 3.4. Fade Handles & Volume Envelope
* **Giao diện**:
  * Trên dải âm thanh thoại của mỗi shot, xuất hiện 2 núm tam giác nhỏ ở góc trên bên trái (Fade In) và góc trên bên phải (Fade Out).
  * Kéo sang ngang để chỉnh thời gian fade từ 0.0s đến 2.0s.
  * Vẽ đường dốc mờ thể hiện trực quan độ dốc tăng/giảm âm lượng.
* **Backend Assembly**:
  * Backend `studio/assembly.py` khi ghép audio sử dụng hàm `segment.fade_in(duration_ms).fade_out(duration_ms)` của `pydub` đảm bảo mượt mà 100%.

---

## 4. Architectural Calls Settled (Reviewer Check Calls)

1. **Hòa âm Backend**: Sử dụng `pydub` cho các thao tác fade-in/fade-out và ducking thay vì viết lại FFmpeg filtergraph phức tạp, bảo đảm tính ổn định tuyệt đối và vượt qua toàn bộ 38 test suite hiện có.
2. **Bảo vệ lời thoại**: Thuật toán Cut-to-Beat bắt buộc tuân thủ cận dưới là độ dài thực tế của file âm thanh thoại, ngăn chặn việc cắt cụt câu nói của nhân vật.
3. **Phạm vi kéo SFX**: Khối SFX được kéo thả dịch chuyển mốc phát trong phạm vi thời lượng của phân cảnh chứa nó (`0 <= sfx_offset_ms <= shot.duration`).
4. **Backend SFX Waveform Support**: Mở rộng endpoint `/api/audio/waveform` để chấp nhận tham số `sfx_key`, trả về `{ duration, tempo_bpm, beat_times, peaks }` từ thư mục `assets/sfx/`.
5. **Ducking Timing**: Đường ducking áp dụng theo thời lượng câu thoại kèm thời gian dốc giảm 0.3s và dốc hồi phục 0.5s.

---

## 5. UI/UX ASCII Layout

```
+---------------------------------------------------------------------------------------------------------+
| [▶ Play / ⏸ Pause]  00:04.2 / 00:28.0   [Zoom -/+]   [⚡ Snap Cuts to Beat (120 BPM)]   [Export FCPXML]  |
+---------------------------------------------------------------------------------------------------------+
| RULER:  |...0s...|...1s...|...2s...|...3s...|...4s...|...5s...|...6s...|...7s...|...8s... (Beat dots)     |
+---------------------------------------------------------------------------------------------------------+
| [V] VIDEO   | [#1 Shot_001 (4.0s)]   | [#2 Shot_002 (3.5s)]      | [#3 Shot_003 (5.0s)]                  |
+---------------------------------------------------------------------------------------------------------+
| [A1] VOICE  | /|/\/\/\ (Fade In/Out) | /|/\/\/\/\ (Thoại cảnh 2) |  --- (Im lặng) ---                    |
| [M][S] Vol  | Cyan Waveform          | Cyan Waveform             |                                       |
+---------------------------------------------------------------------------------------------------------+
| [A2] SFX    |    [⚡ Thunder (1.8s)] |                           |    [🚗 Car Skid (1.2s)]                |
| [M][S] Vol  |    Amber Waveform      |                           |    Amber Waveform                     |
+---------------------------------------------------------------------------------------------------------+
| [A3] BGM    | |||||||____(Ducking)___||||||||||||||____(Ducking)___|||||||||||||||||||||||||||||||||||| |
| [M][S] Vol  | Purple Waveform + Live Web Audio Ducking Attenuation                                     |
+---------------------------------------------------------------------------------------------------------+
```
