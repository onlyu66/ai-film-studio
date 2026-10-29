# Real-time A/B Color LUT Split-Screen Preview & Video Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng công cụ so sánh màu sắc A/B thời gian thực (Real-time A/B Color LUT Split-Screen Preview) với thanh trượt chia đôi màn hình 60 FPS, tích hợp vào cả Master Video Player và Storyboard Shot Inspector.

**Architecture:** Sử dụng component React chuyên dụng `ColorCompareSlider.tsx` điều khiển 2 lớp hình ảnh/video đồng bộ, sử dụng clip-path & bộ lọc CSS/SVG mô phỏng chính xác 8 LUTs điện ảnh FFmpeg mà không cần re-encode. Tích hợp vào `VideoPlayerModal.tsx` (cho phim hoàn chỉnh) và `ColorInspectorModal.tsx` (cho từng phân cảnh trong `StoryboardView.tsx`).

**Tech Stack:** React 19, TypeScript, TailwindCSS, Framer Motion, HTML5 Video & Canvas API, Pointer Events.

**Spec:** `docs/superpowers/specs/2026-10-29-realtime-color-lut-ab-compare-design.md`

---

## Global Constraints
- Toàn bộ 135 tests hiện tại PHẢI tiếp tục PASS 100% (không có bất kỳ hồi quy nào).
- Bundle Vite frontend giữ ở mức tối ưu (< 275 kB).
- Độ trễ điều khiển thanh trượt A/B đạt chuẩn 60 FPS (sử dụng CSS transform/clip-path, không gọi API server khi kéo trượt).
- Tương thích tốt trên cả chuột máy tính (mouse drag) và màn hình cảm ứng (touch pointer).

---

## Review Focus
1. **Video playback synchronization:** Khi xem video ở chế độ A/B wipe slider, layer bên dưới (bản gốc) và layer bên trên (bản LUT) phải play/pause/seek chính xác cùng thời điểm mà không bị lệch khung hình.
2. **Audio duplicate prevention:** Layer phụ của video so sánh phải luôn được đặt thuộc tính `muted` để ngăn chặn hiện tượng vọng âm/tiếng vang (audio echo).
3. **Clamping & responsiveness:** Giá trị vị trí thanh trượt chia đôi phải luôn nằm trong khoảng [0, 100]% và tự động co giãn theo tỉ lệ khung hình (16:9 hoặc 9:16).
4. **LUT filter fidelity:** Các bộ lọc CSS phải mô phỏng trực quan tương đương với các tham số FFmpeg colorbalance/eq/curves trong `studio/color_grading.py`.
5. **Persistence:** Khi người dùng chọn "Áp dụng LUT này cho toàn bộ dự án" trong Storyboard, giá trị phải được lưu ngay vào `localStorage('studio_color_lut')`.

---

## Tasks

### Task 1: Color LUT CSS Transform Engine (`web/src/utils/colorGradingStyles.ts`)
**Files:**
- Create: `web/src/utils/colorGradingStyles.ts`
- Test: Build check & unit mapping validation

- [x] **Step 1: Tạo `web/src/utils/colorGradingStyles.ts`**
  - Định nghĩa type `ColorLutStyle`.
  - Định nghĩa hàm `getColorLutCss(lutId: string): { filter: string; hasVignette: boolean }`.
  - Map chi tiết 8 bộ lọc: `teal_and_orange`, `kodachrome_1970`, `wes_anderson_pastel`, `cyberpunk_matrix`, `bleach_bypass`, `film_noir_bw`, `golden_sunset`, `nordic_cold`, và `none`.
  - Cung cấp danh sách metadata tiện ích `COLOR_LUT_PRESETS` kèm màu sắc gradient đại diện.
- [x] **Step 2: Kiểm tra biên dịch TypeScript**
  - `export PATH=$PATH:/home/hieunv1/.nvm/versions/node/v22.23.1/bin && cd web && npx tsc --noEmit`.

---

### Task 2: Component `ColorCompareSlider.tsx`
**Files:**
- Create: `web/src/components/ColorCompareSlider.tsx`
- Dependencies: `lucide-react`, `web/src/utils/colorGradingStyles.ts`

- [x] **Step 1: Xây dựng component `ColorCompareSlider.tsx`**
  - Nhận props: `mediaSrc`, `isVideo`, `activeLut`, `onSelectLut?`, `showLutSelector?`, `className?`.
  - State: `sliderPos` (mặc định 50), `isDragging` (boolean), `compareMode` ('wipe' | 'side_by_side' | 'toggle'), `isHoldingOriginal` (boolean).
  - Synchronized video refs: `origVideoRef` và `lutVideoRef`. Khi một video phát hoặc nhảy thời gian, video còn lại đồng bộ lập tức.
  - Xử lý PointerEvents (`handlePointerDown`, `handlePointerMove`, `handlePointerUp`) với `getBoundingClientRect()` để tính % chính xác.
  - Render 2 lớp:
    - Lớp nền: Bản gốc (Original Rec.709) với nhãn "GỐC / REC.709".
    - Lớp phủ: Bản LUT được áp dụng bộ lọc CSS với clip-path `polygon(...)` theo `sliderPos` kèm nhãn "LUT: [Tên LUT]".
    - Đường phân cách giữa phát sáng với nút tròn trung tâm có biểu tượng mũi tên 2 chiều `↔`.
  - Thanh chọn LUTs nhanh dạng pills ở phía dưới với preview màu sắc.
- [x] **Step 2: Kiểm tra biên dịch**
  - `export PATH=$PATH:/home/hieunv1/.nvm/versions/node/v22.23.1/bin && cd web && npx tsc --noEmit`.

---

### Task 3: Modal `ColorInspectorModal.tsx` & Tích Hợp Vào `StoryboardView.tsx`
**Files:**
- Create: `web/src/components/ColorInspectorModal.tsx`
- Modify: `web/src/components/StoryboardView.tsx`

- [x] **Step 1: Tạo `ColorInspectorModal.tsx`**
  - Modal pop-up mượt mà với Framer Motion.
  - Hiển thị thông tin phân cảnh (Shot number, dialogue, visual prompt).
  - Tích hợp `ColorCompareSlider` với hình ảnh hoặc video của phân cảnh đó.
  - Nút "Áp dụng LUT này cho toàn bộ dự án" để lưu vào `localStorage.setItem('studio_color_lut', selectedLut)` kèm thông báo visual toast.
- [x] **Step 2: Tích hợp vào `StoryboardView.tsx`**
  - State: `colorInspectorShot: { shot: Shot; index: number } | null`.
  - Bổ sung nút "So màu A/B" (icon `Palette`) trên thanh công cụ của từng Shot Card.
  - Render `ColorInspectorModal` khi `colorInspectorShot !== null`.
- [x] **Step 3: Kiểm tra biên dịch**
  - `export PATH=$PATH:/home/hieunv1/.nvm/versions/node/v22.23.1/bin && cd web && npx tsc --noEmit`.

---

### Task 4: Nâng Cấp `VideoPlayerModal.tsx` (Master Cut Player)
**Files:**
- Modify: `web/src/components/VideoPlayerModal.tsx`

- [x] **Step 1: Nâng cấp `VideoPlayerModal.tsx`**
  - Thêm state `isCompareMode: boolean` (mặc định false) và `selectedLut: string` (lấy từ `localStorage` hoặc 'teal_and_orange').
  - Thêm nút chuyển đổi "So màu A/B (Split-Screen)" trên header của player.
  - Khi bật A/B mode: Hiển thị `ColorCompareSlider` với `mediaSrc={videoUrl}` và `isVideo={true}`.
  - Khi tắt A/B mode: Giữ nguyên trình phát `<video>` chuẩn để xem toàn màn hình.
- [x] **Step 2: Kiểm tra biên dịch**
  - `export PATH=$PATH:/home/hieunv1/.nvm/versions/node/v22.23.1/bin && cd web && npx tsc --noEmit`.

---

### Task 5: Build Frontend, Khởi Động Container & Kiểm Thử Toàn Diện
**Files:**
- Build: `web/`
- Docker: Restart UI container

- [x] **Step 1: Build hoàn chỉnh frontend**
  - `export PATH=$PATH:/home/hieunv1/.nvm/versions/node/v22.23.1/bin && cd web && npm run build`.
  - Xác nhận 0 lỗi TypeScript và bundle size tối ưu.
- [x] **Step 2: Khởi động lại UI container**
  - `docker compose restart ui`.
- [x] **Step 3: Chạy toàn bộ backend test suite**
  - `docker compose run --rm studio -m pytest tests/`.
  - Xác nhận 135/135 tests pass không có bất kỳ lỗi hồi quy nào.
- [x] **Step 4: Cập nhật artifact và báo cáo cho người dùng.**
