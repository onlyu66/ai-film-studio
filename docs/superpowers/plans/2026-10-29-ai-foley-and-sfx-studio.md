# AI Foley & Sound Effects (SFX) Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống âm thanh 3 lớp hoàn chỉnh (Voice + BGM + SFX) với kho 24+ âm thanh Foley/SFX điện ảnh, thuật toán AI tự động nhận diện và gán tiếng động vào kịch bản từng shot, kèm SFX Soundboard modal trực quan.

**Architecture:** Mở rộng `studio/sfx.py` và `studio/audio_assets.py` cung cấp kho âm thanh 24+ SFX, tính năng synthesis âm thanh dự phòng FFmpeg, module gợi ý AI cue tự động. Backend cung cấp các endpoint catalog, streaming và suggest trong `studio/server.py`. Frontend cung cấp `SFXSoundboardModal.tsx` và tích hợp sâu vào Storyboard Shot Inspector.

**Tech Stack:** Python 3.11, Pydub, FFmpeg 7.1 procedural audio filter, FastAPI, React 19, TypeScript, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-10-29-ai-foley-and-sfx-studio-design.md`

## Global Constraints
- Toàn bộ 148 tests hiện tại PHẢI tiếp tục PASS 100%.
- Tự động fallback synthesis âm thanh dự phòng procedural nếu file âm thanh chưa tải về máy.
- Không để âm thanh SFX lấn át tiếng nói (tự động cân bằng loudness và micro-fade 50ms).
- Frontend build Vite duy trì tối ưu (< 320 kB).

## Review Focus
1. **Catalog Integrity:** 24+ hiệu ứng âm thanh thuộc 5 chủ đề (Action, Nature, Horror, Sci-Fi, Urban) đều có thể phát hoặc sinh âm tức thì.
2. **Timing Offset:** Tiếng động có thể xuất hiện tại mili-giây mong muốn trong shot (`sfx_offset_ms`) thay vì chỉ bắt đầu từ 0.
3. **AI Fallback Resilience:** Gợi ý AI SFX hoạt động chính xác cả khi có LLM lẫn fallback rule-based khi offline.
4. **Volume Scaling:** Hệ số âm lượng `sfx_volume` (0.0 đến 2.0) hoạt động trơn tru không gây méo biên độ âm thanh.
5. **No Regressions:** Tương thích 100% với Storyboard JSON hiện tại và các luồng xuất FCPXML / Video Master Cut.

---

## Tasks

### Task 1: Module `studio/sfx.py` & Unit Tests (`tests/test_sfx.py`)
**Files:**
- Create: `studio/sfx.py`
- Modify: `studio/audio_assets.py`
- Modify: `studio/assembly.py`
- Create: `tests/test_sfx.py`

- [x] **Step 1: Viết unit tests trong `tests/test_sfx.py`**
  - Test `get_sfx_catalog()` trả về 24+ items kèm category và duration.
  - Test `resolve_sfx_asset(sfx_id)` trả về file âm thanh khả dụng (hoặc tự động sinh tone).
  - Test `suggest_sfx_for_shot(prompt, dialogue)` phát hiện từ khóa hành động chính xác.
  - Test `mix_sfx_into_shot_audio` với tham số `sfx_offset_ms`.
- [x] **Step 2: Chạy test xác nhận fail**
  `docker compose run --rm studio -m pytest tests/test_sfx.py`.
- [x] **Step 3: Hiện thực `studio/sfx.py` & nâng cấp `studio/audio_assets.py`**
  - Định nghĩa `SFX_CATALOG` 24+ mục (Action, Nature, Horror, Sci-Fi, Urban).
  - Thêm synthesis procedural tone generator cho các SFX mới vào `studio/audio_assets.py`.
  - Cập nhật `mix_sfx_into_shot_audio` trong `studio/assembly.py` hỗ trợ `sfx_offset_ms`.
- [x] **Step 4: Chạy test xác nhận pass**
  `docker compose run --rm studio -m pytest tests/test_sfx.py`.

---

### Task 2: REST API Endpoints trong `studio/server.py` & Test (`tests/test_server.py`)
**Files:**
- Modify: `studio/server.py`
- Modify: `tests/test_server.py`

- [x] **Step 1: Viết test server trong `tests/test_server.py`**
  - Test `GET /api/sfx/catalog`.
  - Test `GET /api/assets/sfx/{sfx_id}`.
  - Test `POST /api/sfx/suggest`.
- [x] **Step 2: Hiện thực endpoints trong `studio/server.py`**
  - Endpoint `GET /api/sfx/catalog`.
  - Endpoint `GET /api/assets/sfx/{sfx_id}`.
  - Endpoint `POST /api/sfx/suggest`.
  - Endpoint `POST /api/sfx/batch-suggest`.
- [x] **Step 3: Chạy test server xác nhận pass**
  `docker compose run --rm studio -m pytest tests/test_server.py -k sfx`.

---

### Task 3: Frontend Types, API Client & React Query Hooks
**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/api/studio.ts`
- Modify: `web/src/api/queries.ts`

- [x] **Step 1: Cập nhật types trong `web/src/types/index.ts`**
  - Thêm `SfxItem`, `SfxSuggestRequest`, `SfxSuggestResponse`, `BatchSfxSuggestRequest`.
  - Bổ sung `sfx_offset_ms?: number` vào `Shot` interface.
- [x] **Step 2: Cập nhật API client trong `web/src/api/studio.ts`**
  - Thêm `fetchSfxCatalog()`, `suggestSfx()`, `batchSuggestSfx()`.
- [x] **Step 3: Cập nhật React Query hooks trong `web/src/api/queries.ts`**
  - Thêm `useSfxCatalog()`, `useSuggestSfx()`, `useBatchSuggestSfx()`.

---

### Task 4: UI Component: `SFXSoundboardModal.tsx` & Shot Inspector
**Files:**
- Create: `web/src/components/SFXSoundboardModal.tsx`
- Modify: `web/src/components/StoryboardView.tsx`

- [x] **Step 1: Tạo `SFXSoundboardModal.tsx`**
  - Tabs bộ lọc: Tất cả, Hành động (Action), Thời tiết/Môi trường (Nature), Kinh dị/Hồi hộp (Horror), Viễn tưởng (Sci-Fi), Đời thường (Urban).
  - Soundboard cards với nút Play/Stop nghe thử âm thanh trực quan.
  - Thanh trượt âm lượng (Volume 0% - 200%) và thời điểm xuất hiện (Offset 0s - 10s).
  - Nút "AI Gợi Ý Nhanh" tự động chọn SFX dựa trên nội dung phân cảnh.
- [x] **Step 2: Tích hợp vào `StoryboardView.tsx`**
  - Hiển thị badge SFX trên mỗi Shot card: click mở `SFXSoundboardModal`.
  - Nút "Gợi ý toàn bộ SFX bằng AI" trên thanh công cụ Storyboard.
- [x] **Step 3: Kiểm tra biên dịch TypeScript**
  - `cd web && npx tsc --noEmit`.

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
  - Đảm bảo 151+ tests pass 100%.
- [x] **Step 4: Cập nhật artifact và nghiệm thu cùng người dùng.**
