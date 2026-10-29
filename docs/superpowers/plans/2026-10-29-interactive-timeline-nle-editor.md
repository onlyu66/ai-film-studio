# Interactive Timeline NLE Drag & Drop Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp thước phim timeline thành bàn dựng phim NLE tương tác trực quan (kiểu CapCut/Premiere mini) với tính năng kéo tỉa thời lượng shot (trim handles), kéo thả hoán đổi thứ tự cảnh quay (drag & drop reorder), thanh điều khiển track (track headers & mute), mô phỏng sóng âm (waveforms), và tính năng cắt phân cảnh (split shot).

**Architecture:** Bổ sung endpoint `POST /api/storyboard/split-shot` trong `studio/server.py`. Nâng cấp toàn diện `web/src/components/TimelineScrubber.tsx` với các cơ chế kéo tỉa chuột mượt mà, drag & drop HTML5, scrubbing playhead tự do, và thanh điều khiển track chuyên nghiệp.

**Tech Stack:** Python 3.11, FastAPI, React 19, TypeScript, Tailwind CSS, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-10-29-interactive-timeline-nle-editor-design.md`

## Global Constraints
- Toàn bộ 153 tests hiện tại PHẢI tiếp tục PASS 100%.
- Thao tác kéo thả và kéo tỉa phải có visual feedback tức thì và debounce cập nhật lên server để không gây lag.
- Tương thích hoàn toàn với các luồng xuất Master Movie và FCPXML.
- Frontend build Vite giữ ở mức tối ưu (< 330 kB).

## Review Focus
1. **Trimming Bounds:** Không cho phép kéo thời lượng shot xuống dưới 1.0 giây hoặc vượt quá 15.0 giây.
2. **Atomic Storyboard Sync:** Khi cắt hoặc đảo thứ tự shot, tệp `storyboard.json` được cập nhật nguyên tử (atomic write).
3. **Scrubbing Precision:** Tua playhead trên thước đo thời gian (Ruler) cập nhật chính xác thời gian và phân cảnh tương ứng.
4. **No UI Layout Breaks:** Đảm bảo khi co giãn zoom (50% – 250%) hay khi danh sách có nhiều shot thì các track vẫn căn thẳng hàng với nhau.
5. **No Regressions:** Tất cả 153 unit & integration tests hiện tại giữ nguyên 100% tỷ lệ pass.

---

## Tasks

### Task 1: Backend Endpoint `POST /api/storyboard/split-shot` & Tests (`tests/test_server.py`)
**Files:**
- Modify: `studio/server.py`
- Modify: `tests/test_server.py`

- [x] **Step 1: Viết test cho endpoint trong `tests/test_server.py`**
  - Test `POST /api/storyboard/split-shot` chia 1 shot thành 2 shot hợp lệ.
- [x] **Step 2: Hiện thực endpoint trong `studio/server.py`**
  - Model `SplitShotRequest`.
  - Endpoint `POST /api/storyboard/split-shot`.
- [x] **Step 3: Chạy test xác nhận pass**
  `docker compose run --rm studio -m pytest tests/test_server.py -k split_shot`.

---

### Task 2: Web API Client & Hooks for Split Shot
**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/api/studio.ts`
- Modify: `web/src/api/queries.ts`

- [x] **Step 1: Cập nhật types trong `web/src/types/index.ts`**
  - `SplitShotRequestPayload`, `SplitShotResponse`.
- [x] **Step 2: Thêm hàm `splitShot` vào `web/src/api/studio.ts`**
- [x] **Step 3: Thêm hook `useSplitShot` vào `web/src/api/queries.ts`**

---

### Task 3: Interactive Trimming & Drag & Drop trong `TimelineScrubber.tsx`
**Files:**
- Modify: `web/src/components/TimelineScrubber.tsx`

- [x] **Step 1: Xây dựng cơ chế kéo tỉa thời lượng (Trimming handles)**
  - Handles ở mép trái & phải của clip trên Track 1.
  - Mouse move/up tracking, tooltip hiển thị thời lượng thực tế (ví dụ: `4.5s (+0.5s)`).
  - Gọi callback `onUpdateShotDuration(shotId, newDuration)` khi nhả chuột.
- [x] **Step 2: Xây dựng cơ chế kéo thả đổi thứ tự (HTML5 Drag & Drop)**
  - `draggable` trên clip cards, drag over visual drop indicators.
  - Gọi callback `onReorderShots(newOrderedIds)`.
- [x] **Step 3: Cải tiến Playhead Scrubbing trên thước đo thời gian (Ruler)**
  - Nhấp chuột hoặc kéo trên Time Ruler để nhảy playhead tới thời điểm đó.

---

### Task 4: Track Control Headers, Audio Waveform & Nút Cắt Phim (Split)
**Files:**
- Modify: `web/src/components/TimelineScrubber.tsx`
- Modify: `web/src/components/StoryboardView.tsx`

- [x] **Step 1: Thêm Track Headers ở lề trái trong `TimelineScrubber.tsx`**
  - Cột điều khiển cố định: Track 1 (🎬 Video), Track 2 (🎙️ Voice), Track 3 (🔊 SFX), Track 4 (🎵 BGM).
  - Nút Mute / Unmute từng track âm thanh.
- [x] **Step 2: Vẽ sóng âm thanh visual (Waveform bars simulation)**
  - Thanh sóng âm chuyển động trên Dialogue track và SFX track theo thời lượng & vị trí offset.
- [x] **Step 3: Nút "✂️ Cắt phân cảnh" (Split Shot) trên toolbar Timeline**
  - Tách shot đang được playhead đi qua thành 2 shot.
- [x] **Step 4: Tích hợp đầy đủ vào `StoryboardView.tsx`**

---

### Task 5: Build, Khởi Động Container & Kiểm Thử Toàn Diện
**Files:**
- Build: `web/`
- Docker: Restart UI container

- [x] **Step 1: Build hoàn chỉnh frontend**
  - `cd web && npm run build`.
- [x] **Step 2: Khởi động lại UI container**
  - `docker compose restart ui`.
- [x] **Step 3: Chạy toàn bộ test suite**
  - `docker compose run --rm studio -m pytest tests/`.
  - Xác nhận 154+ tests pass 100%.
- [x] **Step 4: Cập nhật artifact và nghiệm thu cùng người dùng.**
