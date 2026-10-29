# Interactive Timeline NLE Drag & Drop Editor Technical Design

**Date:** 2026-10-29  
**Status:** Draft  
**Scope:** Giai đoạn 15 (Phase 15 of 17) — AI Film Studio

---

## 1. Intent & Why

Trong sản xuất video điện ảnh, thanh thước phim đa track (Non-Linear Editor - NLE Timeline) là trái tim của phòng dựng phim (tương tự DaVinci Resolve, Adobe Premiere, CapCut Pro).
Trước đây, hệ thống có `TimelineScrubber.tsx` ở mức độ hiển thị tĩnh (chỉ cuộn xem thời gian và playhead cơ bản). Người dùng muốn thay đổi thời lượng phân cảnh, đảo vị trí các shot, hoặc cắt tỉa thì phải thao tác thủ công qua form hoặc modal riêng lẻ.

Mục tiêu của **Giai đoạn 15: Interactive Timeline NLE Drag & Drop Editor** là chuyển đổi thước phim thành một bàn dựng tương tác chuyên nghiệp:
1. **Interactive Trimming (Cắt tỉa thời lượng trực tiếp):** Kéo mép clip trên timeline để co giãn thời lượng shot (1.0s – 15.0s) với tooltip hiển thị thời gian chính xác, tự động đồng bộ hóa backend.
2. **Drag & Drop Reorder (Kéo thả hoán đổi thứ tự cảnh quay):** Kéo thả trực quan các shot trên Video Track để thay đổi nhịp điệu kể chuyện mà không cần nhập số thứ tự.
3. **Track Headers with Controls (Điều khiển từng track):** Thanh điều khiển chuyên nghiệp ở lề trái (Track 1: Video, Track 2: Dialogue, Track 3: SFX, Track 4: BGM) với nút Mute/Unmute, Volume slider và hiển thị sóng âm (Waveform visualizer).
4. **Scrubbing & Playhead Jumping:** Click hoặc kéo thả thanh playhead màu đỏ trên thước đo thời gian (Time Ruler) để tua nhanh/chậm tức thì.
5. **Split Shot Action (Cắt phân cảnh):** Nút tách cảnh tại vị trí con trỏ playhead.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1. Goals
- **Interactive Duration Trimmer:** Cung cấp handle `col-resize` ở mép clip, cho phép kéo chỉnh thời lượng theo bước 0.1s (min 1.0s, max 15.0s), hỗ trợ gọi API `POST /api/storyboard/update-shot`.
- **Drag & Drop Shot Sequencing:** Kéo thả clip để sắp xếp lại thứ tự shots, gọi `POST /api/storyboard/reorder`.
- **Track Control Headers:** Mỗi track (Video, Thoại, SFX, BGM) có header bên trái gồm icon, tên track, nút Mute và badge trạng thái.
- **Waveform & Audio Activity Visuals:** Tạo visual dải sóng âm phong cách NLE trên các đoạn có âm thanh (Voice và SFX) giúp người dựng dễ dàng canh chỉnh nhịp điệu.
- **Scrubbing & Playhead Click:** Nhấp chuột vào bất kỳ vị trí nào trên thước đo (Ruler) để di chuyển playhead đến thời điểm đó.
- **Split Shot Endpoint & UI:** `POST /api/storyboard/split-shot` tách shot thành 2 shot (Part A và Part B) với thời lượng chia đôi hoặc chia theo vị trí playhead.

### 2.2. Non-Goals
- Không thay thế phần mềm dựng phim offline hoàn chỉnh như Premiere hay DaVinci Resolve (đã có tính năng xuất tệp FCPXML ở Giai đoạn 1 để người dùng mở trực tiếp trong DaVinci Resolve).
- Không render hiệu ứng chuyển cảnh nặng 3D trực tiếp trong canvas timeline (giữ timeline mượt mà 60fps trên trình duyệt).

### 2.3. Anti-Goals
- **Không làm vỡ bố cục khi số lượng shot lớn:** Timeline phải tự động co giãn theo hệ số zoom (Zoom Scale 50% – 250%) và hỗ trợ cuộn ngang mượt mà.
- **Không gây xung đột state:** Khi kéo thả hoặc kéo tỉa, debounce lệnh lưu lên server hoặc lưu khi người dùng thả chuột (mouse up) để tránh spam request.

---

## 3. Constraints & Principles
- **100% Tests Pass:** Toàn bộ 153 tests hiện tại PHẢI tiếp tục PASS 100%. Bổ sung unit tests cho split shot và timeline endpoints (`tests/test_server.py`).
- **Touch & Mouse Ergonomics:** Thao tác kéo thả và kéo tỉa phải có visual feedback rõ ràng (cursor đổi kiểu, ghost element, highlight drop target, tooltip thời gian nổi).
- **Vite Bundle Size:** Duy trì bundle tối ưu (< 330 kB).

---

## 4. Architectural Design

```
+-----------------------------------------------------------------------------------------+
|                               INTERACTIVE TIMELINE NLE                                  |
|                                                                                         |
|  [ Play/Pause ] [ Rewind ] [ Time: 00:14.2 / 01:20.0 ] [ ✂️ Split Shot ] [ Zoom +/- ]    |
|-----------------------------------------------------------------------------------------|
| Track Controls |  Time Ruler:  |-- 0s --|-- 5s --|-- 10s --|-- 15s --|-- 20s --|        |
|----------------+------------------------------------------------------------------------|
| [🎬 Video]     |  [ #1 Wide 4.0s ]<->[ #2 Close-up 3.5s (Drag) ]<->[ #3 Zoom 5.0s ]     |
| [ Mute | Solo] |  (Kéo mép <-> để trim độ dài; Kéo cả khối để đổi vị trí)               |
|----------------+------------------------------------------------------------------------|
| [🎙️ Voice]     |  [ |||||||| "Chào em!" ]            [ |||||||||||| "Coi chừng!" ]       |
| [ Mute | Solo] |  (Mô phỏng sóng âm thoại)                                              |
|----------------+------------------------------------------------------------------------|
| [🔊 SFX Foley] |           [ ⚡ Thunder @0.5s ]                 [ 💥 Explosion @1.0s ]   |
| [ Mute | Solo] |  (Hiển thị khối tiếng động theo vị trí offset ms)                       |
|----------------+------------------------------------------------------------------------|
| [🎵 BGM Music] |  [ ~~~~~~~~~~~~~~~~~ Dynamic BGM Mood: Cinematic ~~~~~~~~~~~~~~~~~~ ]  |
| [ Mute | Solo] |  (Thanh nhạc nền trải dài toàn timeline)                                |
+-----------------------------------------------------------------------------------------+
```

---

## 5. API Endpoints

1. `POST /api/storyboard/split-shot`
   - Request: `{ "shot_id": str, "split_at_sec": Optional[float] }`
   - Response: `{ "success": bool, "new_shots": List[Shot], "message": str }`
   - Chia shot hiện tại thành 2 shot liên tiếp, cập nhật lại kịch bản `storyboard.json`.

2. Sử dụng lại các API hiện có:
   - `POST /api/storyboard/update-shot`: Cập nhật `duration`, `sfx_offset_ms`, `sfx_volume`, `voice_volume`.
   - `POST /api/storyboard/reorder`: Lưu danh sách thứ tự IDs mới khi kéo thả clip.

---

## 6. Frontend Components

1. **`TimelineScrubber.tsx` (Nâng cấp toàn diện):**
   - Chế độ kéo tỉa (Trimming handles ở cả 2 mép shot).
   - Chế độ kéo thả (HTML5 drag & drop reorder).
   - Thước đo thời gian tương tác (Click to jump / scrub playhead).
   - Nút chức năng "✂️ Cắt Shot Tại Playhead" (Split Shot).
   - Track Controls bar ở lề trái (Mute/Unmute từng track).
   - Visual sóng âm (Audio Waveform simulation).
