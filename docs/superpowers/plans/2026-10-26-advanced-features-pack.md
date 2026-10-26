# Advanced Features Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai gói tính năng nâng cao toàn diện cho AI Film Studio gồm: (1) Hardsub in phụ đề trực tiếp vào video phong cách TikTok/Shorts; (2) Hệ thống âm thanh hiệu ứng môi trường tự động (SFX/Foley); (3) Biên tập Storyboard linh hoạt: Thêm cảnh mới, Xóa cảnh, Đổi thứ tự cảnh; (4) Thư viện phim & Quản lý đa dự án (Project Gallery).

**Architecture:**
- **Burn-in Hardsub:** Bổ sung cờ `hardsub` trong Config và tham số FFmpeg `-vf subtitles=...` với cấu hình style chữ (màu vàng/trắng nổi bật, viền đen dày, kích thước phù hợp với 16:9 và 9:16).
- **SFX Foley Layer:** Bổ sung trường `sfx` vào `Shot` trong kịch bản; trộn âm thanh môi trường tương ứng từ `assets/sfx/` vào dải âm thanh master audio bằng `pydub`.
- **Storyboard Editing Endpoints:** Backend FastAPI cung cấp các API thêm shot mới, xóa shot, và đổi thứ tự shots; tự động đồng bộ hóa `outputs/storyboard.json`.
- **Project Library System:** Mỗi khi sản xuất xong, snapshot dự án được lưu vào `outputs/projects/<project_id>/` kèm metadata; Web UI bổ sung modal "Thư viện phim" xem lại và tải về toàn bộ phim đã từng làm.

**Tech Stack:** FastAPI, FFmpeg, Pydub, Edge-TTS, React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, Lucide Icons.

---

### Task 1: In phụ đề trực tiếp (Burn-in Hardsub & TikTok Style)

**Files:**
- Modify: `studio/config.py`
- Modify: `studio/cli.py`
- Modify: `studio/assembly.py`
- Modify: `studio/server.py`
- Test: `tests/test_assembly.py`

- [ ] Trong `studio/config.py`: Thêm `hardsub: bool = False` vào `StudioConfig` và hàm `load_config`.
- [ ] Trong `studio/cli.py`: Thêm tùy chọn `--hardsub / --no-hardsub` (default: False).
- [ ] Trong `studio/assembly.py`: Viết hàm helper tạo bộ lọc subtitle FFmpeg với Force Style (màu vàng `PrimaryColour=&H0000FFFF`, viền đen `OutlineColour=&H00000000`, viền dày `Outline=3`, font size tự điều chỉnh theo 16:9 và 9:16).
- [ ] Áp dụng bộ lọc `subtitles` vào bước mux final movie khi `config.hardsub == True`.
- [ ] Trong `studio/server.py`: Nhận `hardsub: bool = False` trong `ProduceRequest`.
- [ ] Chạy tests `docker compose run --rm studio -m pytest tests/test_assembly.py`.
- [ ] Commit Task 1: "feat: add burn-in hardsub with custom cinematic and TikTok styling".

---

### Task 2: Hệ thống Âm thanh Môi trường Tự động (SFX / Foley)

**Files:**
- Modify: `studio/storyboard.py`
- Modify: `studio/prompts.py`
- Modify: `studio/assembly.py`
- Test: `tests/test_storyboard.py`
- Test: `tests/test_assembly.py`

- [ ] Trong `studio/storyboard.py`: Thêm trường `sfx: Optional[str] = None` vào `Shot`, `to_dict()`, và `parse_storyboard_json()`.
- [ ] Trong `studio/prompts.py`: Hướng dẫn LLM sinh trường `sfx` cho các shot nếu phù hợp (ví dụ: `rain`, `wind`, `thunder`, `waves`, `fire`, `footsteps`, `ambient`).
- [ ] Trong `studio/assembly.py`: Bổ sung logic hòa âm SFX trong `build_master_audio`: nếu shot có `sfx` và tồn tại file `assets/sfx/{sfx}.mp3` hoặc `assets/sfx/{sfx}.wav`, hòa âm vào dải âm thanh shot tương ứng ở mức `-18dB`.
- [ ] Chạy tests xác minh `docker compose run --rm studio -m pytest`.
- [ ] Commit Task 2: "feat: add automated environmental SFX/foley sound integration".

---

### Task 3: Biên tập Storyboard: Thêm / Xóa / Đổi thứ tự phân cảnh

**Files:**
- Modify: `studio/server.py`
- Modify: `tests/test_server.py`

- [ ] Trong `studio/server.py`: Tạo model và endpoint `POST /api/storyboard/add-shot` (cho phép chèn shot mới tại vị trí chỉ định).
- [ ] Tạo model và endpoint `POST /api/storyboard/delete-shot` (xóa shot và dọn dẹp audio/image/video tương ứng).
- [ ] Tạo model và endpoint `POST /api/storyboard/reorder-shots` (cập nhật lại thứ tự danh sách shots).
- [ ] Viết unit tests trong `tests/test_server.py` xác minh các thao tác thêm, xóa, đổi thứ tự.
- [ ] Commit Task 3: "feat: add backend endpoints for adding, deleting, and reordering storyboard shots".

---

### Task 4: Quản lý Đa dự án & Thư viện Phim (Project Library System)

**Files:**
- Modify: `studio/server.py`
- Test: `tests/test_server.py`

- [ ] Trong `studio/server.py`: Khi hoàn thành sản xuất phim (`stage 5`), tự động lưu bản sao dự án vào `outputs/projects/{project_id}/` chứa `metadata.json`, video, srt, storyboard.
- [ ] Thêm endpoint `GET /api/projects`: Trả về danh sách tất cả các dự án đã lưu (id, topic, style, duration, aspect_ratio, created_at, video_url, srt_url, shots_count).
- [ ] Thêm endpoint `DELETE /api/projects/{project_id}`: Xóa một dự án trong thư viện.
- [ ] Viết unit tests trong `tests/test_server.py`.
- [ ] Commit Task 4: "feat: add project library and multi-project persistence".

---

### Task 5: Giao diện Web: Hardsub Toggle, Thao tác Shots & Thư viện Phim

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/api/studio.ts`
- Modify: `web/src/api/queries.ts`
- Modify: `web/src/components/ProductionForm.tsx`
- Modify: `web/src/components/StoryboardView.tsx`
- Modify: `web/src/components/Navbar.tsx`
- Create: `web/src/components/ProjectLibraryModal.tsx`
- Modify: `web/src/App.tsx`

- [ ] Cập nhật types trong `web/src/types/index.ts`: Thêm `ProjectItem`, `hardsub` trong `ProductionFormData`, `sfx` trong `ShotData`.
- [ ] Khai báo API services và hooks trong `web/src/api/studio.ts` & `web/src/api/queries.ts`.
- [ ] Trong `ProductionForm.tsx`: Thêm nút gạt bật/tắt "In phụ đề trực tiếp vào video (Hardsub)".
- [ ] Trong `StoryboardView.tsx`: Thêm nút "+ Thêm cảnh", "🗑️ Xóa", và "⬆️ Lên / ⬇️ Xuống" trên mỗi phân cảnh; hiển thị tag SFX.
- [ ] Tạo component `ProjectLibraryModal.tsx`: Hiển thị danh sách các phim đã sản xuất dạng gallery lưới, cho phép xem video, tải `.mp4`, `.srt`, và xóa phim.
- [ ] Trong `Navbar.tsx` & `App.tsx`: Thêm nút "Thư viện phim" mở modal gallery.
- [ ] Chạy `npm run build` trong `web/` để xác nhận TypeScript sạch lỗi.
- [ ] Commit Task 5: "feat(web): add project library modal, hardsub toggle, and storyboard shot management".
