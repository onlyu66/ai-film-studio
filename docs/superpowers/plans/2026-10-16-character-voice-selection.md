# Character Voice Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép người dùng tùy chọn trực tiếp giọng Nam / Nữ cho từng nhân vật trong kịch bản trên Web UI và cập nhật ngay vào `outputs/storyboard.json` thông qua API backend.

**Architecture:**
- Backend: Bổ sung endpoint `POST /api/storyboard/character-voice` trong `studio/server.py` nhận `{ character_id, voice }`, cập nhật trường `voice` của nhân vật trong `outputs/storyboard.json`.
- Frontend API: Khai báo service `updateCharacterVoice` trong `web/src/api/studio.ts` và hook `useUpdateCharacterVoice` với TanStack Query trong `web/src/api/queries.ts`.
- Frontend UI: Nâng cấp tab "Diễn viên" trong `web/src/components/StoryboardView.tsx` để hiển thị bộ chọn `CustomSelect` giọng Nam / Nữ theo ngôn ngữ kịch bản, tự động lưu khi chọn.

**Tech Stack:** FastAPI, Python, React 18, TypeScript, TanStack Query, Axios, Lucide Icons.

---

### Task 1: Backend Endpoint to Update Character Voice

**Files:**
- Modify: `studio/server.py`

- [ ] Tạo Pydantic model `UpdateVoiceRequest` (`character_id: str`, `voice: str`).
- [ ] Thêm endpoint `POST /api/storyboard/character-voice`.
- [ ] Đọc file `outputs/storyboard.json`, kiểm tra nhân vật và ghi đè thuộc tính `voice`.
- [ ] Lưu lại `outputs/storyboard.json`.
- [ ] Xóa cache audio tương ứng trong `outputs/audio/` nếu đã tồn tại để sẵn sàng re-render.
- [ ] Viết test hoặc kiểm tra bằng curl.
- [ ] Commit Task 1.

---

### Task 2: Frontend API Service & TanStack Query Mutation

**Files:**
- Modify: `web/src/api/studio.ts`
- Modify: `web/src/api/queries.ts`

- [ ] Thêm hàm `updateCharacterVoice(characterId: string, voice: string)` vào `web/src/api/studio.ts`.
- [ ] Thêm hook `useUpdateCharacterVoice()` vào `web/src/api/queries.ts` với cache invalidation.
- [ ] Commit Task 2.

---

### Task 3: Interactive Voice Selector in StoryboardView.tsx

**Files:**
- Modify: `web/src/components/StoryboardView.tsx`

- [ ] Định nghĩa danh sách tùy chọn giọng Nam / Nữ theo ngôn ngữ (`vi`, `en`, `ja`, `fr`).
- [ ] Trong tab "Diễn viên", thay thế nhãn hiển thị tĩnh bằng `CustomSelect` cho phép người dùng chọn giọng Nam hoặc Nữ.
- [ ] Hiển thị thông báo trạng thái cập nhật (đang lưu / đã lưu).
- [ ] Commit Task 3.

---

### Task 4: Build Verification & Live Testing

- [ ] Chạy `npm run build` (`tsc -b && vite build`) trong `web/`.
- [ ] Kiểm tra phản hồi trực tiếp từ server.
- [ ] Commit hoàn tất.
