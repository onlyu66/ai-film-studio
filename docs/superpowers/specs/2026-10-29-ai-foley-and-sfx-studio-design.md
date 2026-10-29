# AI Foley & Sound Effects (SFX) Studio Technical Design

**Date:** 2026-10-29  
**Status:** Draft  
**Scope:** Giai đoạn 14 (Phase 14 of 17) — AI Film Studio

---

## 1. Intent & Why

Một bộ phim điện ảnh sống động không chỉ gồm lời thoại (Voice) và nhạc nền (BGM), mà 70% cảm giác không gian và chiều sâu chân thực đến từ **tiếng động môi trường và âm thanh hiệu ứng (Foley & SFX)**:
- Tiếng mưa rơi rả rích, sấm sét ầm ầm khi căng thẳng.
- Tiếng bước chân rón rén trên sàn gỗ, tiếng cửa kẽo kẹt trong cảnh kinh dị.
- Tiếng súng nổ, kính vỡ, lốp xe rít trong các cảnh hành động.
- Tiếng gõ bàn phím, tiếng còi xe đô thị trong các cảnh sinh hoạt đời thường.

Hiện tại, hệ thống đã có bộ hòa âm BGM và lồng tiếng TTS/Dubbing, nhưng chưa có kho âm thanh Foley/SFX bài bản và chưa có cơ chế AI tự động phân tích kịch bản từng shot để gợi ý/chèn hiệu ứng âm thanh tự động. Người dùng phải tự tìm âm thanh bên ngoài hoặc video chỉ có nhạc và thoại đơn điệu.

Mục tiêu của **AI Foley & Sound Effects Studio** là cung cấp hệ thống âm thanh 3 lớp hoàn chỉnh (**Voice + BGM + SFX**):
1. **Curated Foley & SFX Library:** Kho hơn 24+ hiệu ứng âm thanh điện ảnh bản quyền mở (CC0/Royalty-Free) được phân nhóm khoa học (Hành động, Môi trường, Kinh dị/Hồi hộp, Đời thường, Viễn tưởng Sci-Fi).
2. **AI Smart Cue Auto-Detection:** Phân tích kịch bản phân cảnh (`image_prompt`, `dialogue`, `action`, `mood`) bằng LLM để tự động phát hiện và gợi ý SFX phù hợp cùng thời điểm bắt đầu (offset ms).
3. **Shot SFX Inspector & Live Soundboard:** Cho phép đạo diễn nghe thử tức thì, gán SFX cho từng cảnh, tinh chỉnh âm lượng và offset.
4. **Master 3-Track Audio Engine:** Hòa trộn tự động 3 lớp âm thanh (Voice + BGM có auto-ducking + SFX căn chỉnh thời gian) mượt mà không gây méo tiếng hay xung đột âm lượng.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1. Goals
- **Curated SFX Catalog:** Cung cấp catalog 24+ hiệu ứng âm thanh chuẩn với API stream (`GET /api/sfx/catalog`, `GET /api/assets/sfx/{sfx_id}`).
- **Procedural Tone Fallback:** Đảm bảo 100% các file SFX luôn phát được ngay cả khi ngoại tuyến hoặc chưa kịp tải từ internet thông qua FFmpeg procedural synthesis.
- **AI SFX Auto-Suggester:** Endpoint `POST /api/sfx/suggest` nhận `shot_prompt`, `dialogue`, `context` và trả về gợi ý `sfx_id`, `volume`, `offset_ms`, và giải thích lý do (reasoning).
- **Flexible Shot Metadata:** Mở rộng Shot schema để hỗ trợ `sfx` (tên SFX), `sfx_volume` (0.0 đến 2.0), `sfx_offset_ms` (mili-giây bắt đầu tiếng động trong shot).
- **Shot SFX Soundboard UI:** Giao diện trực quan tích hợp trong Storyboard Shot Inspector và Modal chọn SFX chuyên biệt kèm bộ lọc danh mục và trình nghe thử âm thanh.
- **3-Layer Master Mix:** `build_master_audio` trong `studio/assembly.py` ghép chính xác SFX vào timeline của từng shot với độ trễ `offset_ms` và cân bằng âm lượng (loudness normalization).

### 2.2. Non-Goals
- Không xây dựng trình cắt gọt audio đa kênh phức tạp (đây là nhiệm vụ của Phase 15: Interactive Timeline Editor).
- Không tự huấn luyện mô hình neural generative audio từ đầu trên máy client (sử dụng kho CC0 curated + synthesis FFmpeg + LLM semantic cue matching để đảm bảo tốc độ tức thì và nhẹ tài nguyên).

### 2.3. Anti-Goals
- **Tuyệt đối không để SFX lấn át tiếng nói nhân vật:** Tiếng SFX phải được giới hạn trần âm lượng (`target_dBFS`) phù hợp, tự động hạ nhỏ nhẹ nếu xuất hiện trùng lúc với lời thoại quan trọng.
- **Không gây giật lag (blocking UI):** Các tệp âm thanh nghe thử trong Soundboard phải phát trực tiếp từ static endpoint hoặc cache nhẹ, không gọi lại ffmpeg tốn kém mỗi khi bấm click nghe thử.

---

## 3. Constraints & Principles
- **Test Integrity:** Toàn bộ 148 tests hiện tại PHẢI tiếp tục PASS 100%. Bổ sung unit tests cho SFX module (`tests/test_sfx.py`) và test endpoint server (`tests/test_server.py`).
- **Zero Asset Breakage:** Cơ chế `ensure_audio_assets()` kiểm tra và tự tạo nếu thiếu, tuyệt đối không crash nếu tệp âm thanh chưa tồn tại.
- **Audio Cleanliness:** Tránh hiện tượng clipping / pops / clicks ở đầu và cuối tệp âm thanh bằng cách áp dụng micro-fade (50ms in/out).
- **Bundle Size Optimization:** Frontend bundle giữ dưới 320 kB.

---

## 4. Architectural Design

```
+-----------------------------------------------------------------------------------+
|                                 STORYBOARD SHOT                                   |
|   { id: "s1", dialogue: "Coi chừng!", image_prompt: "chiếc xe lao tới", ... }     |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        AI SFX CUE AUTO-DETECTION (LLM)                            |
|   Phân tích: "chiếc xe lao tới" -> sfx_id: "car_skid", volume: 1.0, offset: 500ms |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                         CURATED SFX CATALOG (24+ items)                           |
|   Action (gunshot, explosion, punch, whoosh)                                      |
|   Nature/Weather (heavy_rain, thunder, howling_wind, ocean_waves, fire)           |
|   Horror/Suspense (creaky_door, heartbeat, clock_tick, scary_ambience)             |
|   Sci-Fi/Modern (glitch, laser_beam, spaceship_engine, alarm_siren)               |
|   Urban/Foley (footsteps, keyboard_typing, coffee_shop, car_skid)                  |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                        3-LAYER MASTER AUDIO MIXER                                 |
|   Layer 1: Dialogue (Voice TTS) with micro-fades                                  |
|   Layer 2: SFX Track (Overlay at precise offset_ms with loudness match)           |
|   Layer 3: BGM Track (Dynamic Auto-Ducking: -12dB when speech active)             |
|   => Xuất ra Master Audio: 48kHz / 192kbps stereo MP3/AAC                         |
+-----------------------------------------------------------------------------------+
```

---

## 5. API Endpoints

1. `GET /api/sfx/catalog`
   - Response: Danh sách đầy đủ 24+ hiệu ứng âm thanh kèm `id`, `name`, `category`, `description`, `stream_url`, `duration_sec`.

2. `GET /api/assets/sfx/{sfx_id}`
   - Stream file âm thanh MP3 để phát trực tiếp trên web player.

3. `POST /api/sfx/suggest`
   - Request body: `{ "prompt": str, "dialogue": str, "genre": str }`
   - Response: `{ "sfx_id": str, "name": str, "volume": float, "offset_ms": int, "reasoning": str }`

4. `POST /api/sfx/batch-suggest`
   - Request body: `{ "project_id": str }`
   - Tự động quét toàn bộ storyboard shots và gán SFX tối ưu cho các shot chưa có.

---

## 6. Frontend Components

1. **`SFXSoundboardModal.tsx`:**
   - Modal hiển thị lưới Soundboard các nút âm thanh phân loại theo Tab danh mục (Hành động, Môi trường, Kinh dị, Viễn tưởng, Đời thường).
   - Nút Play/Stop trực tiếp với visual waveform/wave bars.
   - Nút "Áp dụng cho cảnh này" kèm thanh kéo điều chỉnh âm lượng (0% - 200%) và thời điểm xuất hiện (Offset 0.0s - 10.0s).
   - Nút "🤖 AI Gợi Ý Nhanh" dựa trên nội dung phân cảnh.

2. **Shot Inspector Integration:**
   - Trong `StoryboardShotInspector`: Hiển thị badge hiệu ứng âm thanh hiện tại (ví dụ: `🔊 Sấm Sét (Thunder) - 100% @ 0.5s`).
   - Nút mở `SFXSoundboardModal` để thay đổi hoặc gỡ bỏ.
