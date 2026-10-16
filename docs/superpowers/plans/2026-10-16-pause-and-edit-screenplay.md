# Pause & Edit Screenplay Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép người dùng chọn chế độ "Tạm dừng sau khi viết kịch bản để duyệt & chỉnh sửa", dừng lại sau Giai đoạn 1 để chỉnh sửa lời thoại, prompt hình ảnh, góc quay và giọng đọc cho từng nhân vật trên Web UI, rồi bấm "Tiếp tục sản xuất phim" để render Giai đoạn 2 - 5.

**Architecture:**
- Backend:
  - `studio/orchestrator.py`: Thêm tham số `stop_after_stage: Optional[int] = None` vào `run_pipeline()`.
  - `studio/server.py`:
    - Thêm `pause_after_script: bool = False` vào `ProduceRequest`.
    - Thêm endpoint `POST /api/continue` để kích hoạt render các giai đoạn tiếp theo (Stage 2 - 5) từ `outputs/storyboard.json` hiện có.
    - Thêm endpoint `POST /api/storyboard/update-shot` để lưu chỉnh sửa của bất kỳ phân cảnh nào (`dialogue`, `image_prompt`, `motion`).
- Frontend:
  - `web/src/types/index.ts`: Cập nhật `ProductionFormData` và `StudioStatus`.
  - `web/src/api/studio.ts` & `queries.ts`: Bổ sung `continueProduction`, `updateShot` và mutations tương ứng.
  - `web/src/components/ProductionForm.tsx`: Thêm toggle "Duyệt kịch bản trước khi quay".
  - `web/src/components/Navbar.tsx`: Hiển thị badge trạng thái `script_ready`.
  - `web/src/App.tsx`: Hiển thị action banner "Tiếp tục sản xuất phim" khi `status === 'script_ready'`.
  - `web/src/components/StoryboardView.tsx`: Thêm nút và modal "Chỉnh sửa phân cảnh" cho từng shot trong danh sách.

---

### Task 1: Backend Pipeline Extension & Continue/Update Endpoints

**Files:**
- Modify: `studio/orchestrator.py`
- Modify: `studio/server.py`

- [ ] Cập nhật `run_pipeline(config, stop_after_stage=None)` trong `studio/orchestrator.py`.
- [ ] Cập nhật `ProduceRequest` và logic `execute_pipeline_task` trong `studio/server.py` để hỗ trợ `pause_after_script` và `script_ready` status.
- [ ] Thêm endpoint `POST /api/continue` trong `studio/server.py`.
- [ ] Thêm endpoint `POST /api/storyboard/update-shot` trong `studio/server.py`.
- [ ] Kiểm tra cú pháp và restart docker container UI.
- [ ] Commit Task 1.

---

### Task 2: Frontend Types & API Integration

**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/api/studio.ts`
- Modify: `web/src/api/queries.ts`

- [ ] Cập nhật `ProductionFormData` với `pause_after_script?: boolean`.
- [ ] Bổ sung `continueProduction` và `updateShot` vào `web/src/api/studio.ts`.
- [ ] Bổ sung `useContinueProduction` và `useUpdateShot` vào `web/src/api/queries.ts`.
- [ ] Commit Task 2.

---

### Task 3: UI Controls in ProductionForm, Navbar & App Action Banner

**Files:**
- Modify: `web/src/components/ProductionForm.tsx`
- Modify: `web/src/components/Navbar.tsx`
- Modify: `web/src/App.tsx`

- [ ] Thêm toggle checkbox "Duyệt kịch bản trước khi quay" trong `ProductionForm.tsx`.
- [ ] Cập nhật status badge `script_ready` trong `Navbar.tsx`.
- [ ] Thêm Banner điều hướng "Kịch bản đã sẵn sàng - Bấm Tiếp tục sản xuất" khi `status === 'script_ready'` trong `App.tsx`.
- [ ] Commit Task 3.

---

### Task 4: Interactive Shot Editing Modal in StoryboardView

**Files:**
- Modify: `web/src/components/StoryboardView.tsx`

- [ ] Thêm nút "Sửa phân cảnh" (Edit icon) trên mỗi card phân cảnh.
- [ ] Tạo modal chỉnh sửa: Lời thoại (`dialogue`), Câu lệnh hình ảnh (`image_prompt`), Góc máy quay (`motion`).
- [ ] Gọi mutation `updateShot` để lưu trực tiếp vào backend mà không làm mất dữ liệu.
- [ ] Commit Task 4.

---

### Task 5: Build Verification & Live Testing

- [ ] Chạy `npm run build` (`tsc -b && vite build`) trong `web/`.
- [ ] Kiểm tra phản hồi trực tiếp từ API.
- [ ] Commit hoàn tất.
