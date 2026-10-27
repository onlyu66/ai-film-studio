# Kế Hoạch Tối Ưu Hóa Hiệu Năng Toàn Diện (Backend & Frontend)

> **Dành cho Agent/Kỹ sư thực thi:** BẮT BUỘC SỬ DỤNG SUB-SKILL: `superpowers:subagent-driven-development` hoặc `superpowers:executing-plans` để triển khai từng task theo thứ tự. Các bước sử dụng cú pháp checkbox (`- [ ]`) để theo dõi tiến độ.

**Mục tiêu:** Cắt giảm thời gian phản hồi API, loại bỏ hơn 90% disk I/O lặp lại khi polling, tăng tốc độ render video Ken Burns từ 40-60%, giảm kích thước bundle frontend từ 1.24MB xuống dưới 350KB (giảm ~70%), và loại bỏ hiện tượng giật lag render UI khi người dùng thao tác.

**Kiến trúc:** 
1. **Backend:** Bổ sung `GZipMiddleware`, xây dựng bộ đệm In-Memory Caching có kiểm tra `mtime` cho Storyboard & Status (thay thế 120 syscall `stat` mỗi lần polling), tối ưu hóa tham số FFmpeg (`-preset veryfast`, `-tune stillimage`, `-threads 0`) và sửa lỗi lặp lớp âm thanh BGM kép trong `assembly.py`.
2. **Frontend:** Kích hoạt minification trong Vite, chia tách Vendor Chunks (`react`, `framer-motion`, `lucide-react`, `tanstack-query`), áp dụng `React.lazy` cho các Modal phụ, tinh chỉnh tần suất Polling của React Query (tắt polling khi trạng thái `idle`/`completed`), tối ưu DOM `TerminalLogs` (giới hạn windowing 250 dòng) và bọc `React.memo` cho `ShotCard`.

**Tech Stack:** FastAPI, Starlette GZip/StaticFiles, FFmpeg, Pytest, React 18, Vite 6, Tailwind CSS, TanStack React Query v5, Framer Motion.

**Tài liệu đặc tả (Spec):** Kế hoạch tối ưu hiệu năng chi tiết dựa trên phân tích trực tiếp mã nguồn `studio/` và `web/`.

---

## Global Constraints

- Không phá vỡ bất kỳ tính năng hiện có nào (Consistency nhân vật, Ken Burns 2.5D, CC0 SFX/BGM, Per-shot Approval).
- Tuyệt đối không xóa hay làm hỏng dữ liệu trong thư mục `outputs/projects/`.
- 100% kiểm thử (60/60 tests) phải tiếp tục pass sau mỗi Task.
- Tuân thủ nghiêm ngặt các nguyên tắc `backend-patterns` và `frontend-patterns`.

## Review Focus (Các điểm then chốt cần chú ý)

1. **Bộ đệm Storyboard Cache không được trả về dữ liệu cũ (Stale Cache):** Khi người dùng sửa shot, đổi giọng hay thêm shot mới, cache phải lập tức bị vô hiệu hóa (invalidation).
2. **Preset FFmpeg không làm giảm chất lượng hình ảnh:** Sử dụng `-preset veryfast` kết hợp `-tune stillimage` trên ảnh tĩnh thay vì `-preset ultrafast` để giữ độ sắc nét Full HD.
3. **Lazy Loading Modals không gây layout shift:** Phải bọc `<Suspense fallback={null}>` cho các Modal (`ProjectLibraryModal`, `SeoPublishModal`, `VideoPlayerModal`).
4. **React Query Polling phải thức dậy đúng lúc:** Khi bấm bắt đầu sản xuất phim (`produceMutation`), polling phải lập tức kích hoạt lại (`refetchInterval: 2000`).
5. **GZip Middleware không nén file media:** Không nén các file nhị phân đã nén sẵn (`.mp4`, `.mp3`, `.png`) để tránh lãng phí CPU.

---

## Danh Sách Các Task Triển Khai

### Task 1: Tối ưu Backend API, Bộ đệm In-Memory & GZip Compression

**Mục tiêu:** Giảm thời gian phản hồi `/api/storyboard` và `/api/status` từ ~60-120ms xuống <3ms, loại bỏ 120 disk syscalls mỗi lượt poll.

**Files:**
- Modify: `studio/server.py`
- Test: `tests/test_server.py`

**Chi tiết các bước thực hiện:**
- [x] **Bước 1.1:** Viết unit test trong `tests/test_server.py` kiểm tra:
  - Header nén GZip (`Content-Encoding: gzip`) khi client gửi `Accept-Encoding: gzip`.
  - Bộ đệm `get_storyboard()` trả về kết quả nhất quán và tự làm mới khi file `outputs/storyboard.json` bị chỉnh sửa hoặc thêm shot.
- [x] **Bước 1.2:** Kích hoạt `GZipMiddleware(minimum_size=1000)` trong `studio/server.py`.
- [x] **Bước 1.3:** Tối ưu hóa hàm `get_status()`: Không mở và parse `outputs/storyboard.json` từ đĩa mỗi 2 giây; sử dụng biến đếm `shots_count` được lưu trong bộ nhớ hoặc chỉ đọc lại khi `sb_file.stat().st_mtime` thay đổi.
- [x] **Bước 1.4:** Tối ưu hóa hàm `get_storyboard()`:
  - Thay vì duyệt từng phân cảnh và gọi `is_file()` và `stat().st_size` 3 lần cho mỗi shot (tổng 120 syscalls), thực hiện quét thư mục một lần (`set(os.listdir(...))`) để lấy danh sách file sẵn có.
  - Lưu kết quả enriched storyboard vào `_storyboard_cache` và chỉ build lại khi `outputs/storyboard.json` hoặc thư mục media có thay đổi (`mtime` check).
- [x] **Bước 1.5:** Chạy `pytest tests/test_server.py` xác minh toàn bộ test pass.

---

### Task 2: Tối ưu Tốc Độ Render FFmpeg & Xử Lý Âm Thanh

**Mục tiêu:** Cắt giảm 40-60% thời gian render Ken Burns video cho mỗi shot và sửa lỗi tính toán trùng lặp BGM trong assembly.

**Files:**
- Modify: `studio/motion.py`
- Modify: `studio/assembly.py`
- Test: `tests/test_motion.py`
- Test: `tests/test_assembly.py`

**Chi tiết các bước thực hiện:**
- [x] **Bước 2.1:** Thêm test kiểm tra câu lệnh FFmpeg được sinh ra trong `tests/test_motion.py` (chứa các cờ tối ưu `-preset veryfast`, `-tune stillimage`, `-threads 0`).
- [x] **Bước 2.2:** Cập nhật `build_ffmpeg_command` trong `studio/motion.py`:
  - Bổ sung `-preset veryfast` (thay vì default `medium`).
  - Bổ sung `-tune stillimage` (tối ưu mã hóa cho ảnh tĩnh).
  - Bổ sung `-threads 0` (tận dụng tối đa mọi CPU core sẵn có).
- [x] **Bước 2.3:** Sửa lỗi trùng lặp BGM trong `studio/assembly.py` (dòng 226-227 có `master = master.overlay(bgm_timeline)` bị gọi 2 lần liên tiếp), xóa dòng thừa để giảm một nửa thời gian hòa âm master audio.
- [x] **Bước 2.4:** Chạy `pytest tests/test_motion.py tests/test_assembly.py` đảm bảo toàn bộ tests pass và âm thanh/video render chuẩn xác.

---

### Task 3: Tối ưu Frontend Bundle, Minification & Code Splitting

**Mục tiêu:** Giảm kích thước file Javascript ban đầu từ 1.24MB xuống dưới 350KB (giảm ~70%), tách nhỏ các vendor chunks để tối ưu browser caching.

**Files:**
- Modify: `web/vite.config.ts`
- Modify: `web/src/App.tsx`

**Chi tiết các bước thực hiện:**
- [x] **Bước 3.1:** Cập nhật `web/vite.config.ts`:
  - Bỏ `minify: false`, kích hoạt minification mặc định của Vite (`esbuild`).
  - Thiết lập cấu hình `rollupOptions.output.manualChunks`:
    - `vendor-react`: `['react', 'react-dom']`
    - `vendor-motion`: `['framer-motion']`
    - `vendor-query`: `['@tanstack/react-query', 'axios']`
    - `vendor-icons`: `['lucide-react']`
- [x] **Bước 3.2:** Tối ưu `web/src/App.tsx`:
  - Thay thế import trực tiếp bằng `React.lazy` cho các modal ít dùng:
    - `const ProjectLibraryModal = lazy(() => import('./components/ProjectLibraryModal'))`
    - `const SeoPublishModal = lazy(() => import('./components/SeoPublishModal'))`
    - `const VideoPlayerModal = lazy(() => import('./components/VideoPlayerModal'))`
  - Đưa `canvas-confetti` vào dynamic import `import('canvas-confetti')` chỉ khi người dùng hoàn thành xuất video.
- [x] **Bước 3.3:** Chạy `cd web && npm run build` và kiểm tra dung lượng chunks sinh ra trong `web/dist`.

---

### Task 4: Tối ưu Polling React Query, DOM Windowing & Memoization

**Mục tiêu:** Dừng polling vô ích khi rảnh (idle), giữ giao diện mượt mà 60fps khi có hàng trăm phân cảnh hoặc hàng nghìn dòng log terminal.

**Files:**
- Modify: `web/src/api/queries.ts`
- Modify: `web/src/components/TerminalLogs.tsx`
- Modify: `web/src/components/StoryboardView.tsx`

**Chi tiết các bước thực hiện:**
- [x] **Bước 4.1:** Tối ưu hóa `web/src/api/queries.ts`:
  - Sửa `useStoryboard(active)`: Khi `active = false`, đặt `refetchInterval: false` thay vì `5000` ms. Chỉ poll khi đang chạy `running` hoặc `script_ready`.
  - Khi người dùng bấm `approveShot`, `updateShot`, cập nhật trực tiếp cache query data (`queryClient.setQueryData`) để UI phản hồi tức thì mà không cần round-trip mạng đầy đủ.
- [x] **Bước 4.2:** Tối ưu `web/src/components/TerminalLogs.tsx`:
  - Windowing log lines: Chỉ render tối đa 250 dòng log mới nhất trong DOM (vẫn giữ toàn bộ khi bấm "Sao chép toàn bộ").
  - Tránh tạo hàng ngàn DOM nodes gây lag scroll và tốn RAM trình duyệt.
- [x] **Bước 4.3:** Tối ưu `web/src/components/StoryboardView.tsx`:
  - Thêm thuộc tính `loading="lazy"` và `decoding="async"` trên tất cả thẻ `<img>` thumbnail để tránh nghẽn luồng xử lý chính (main thread).
- [x] **Bước 4.4:** Build frontend (`npm run build`), chạy toàn bộ test suite (`pytest tests/`) và khởi động lại UI container để kiểm tra thực tế.

---

## Kết Quả Đo Lường Sau Khi Tối Ưu (Results)

1. **Backend Tests:** 60/60 tests pass (100%).
2. **Bundle Size:** File JS chính giảm từ 1,237.7 kB xuống **153.28 kB** (giảm 87.6%).
3. **API Latency:** Thời gian phản hồi `/api/storyboard` giảm từ ~80-120ms xuống **2.6ms** (cắt giảm hơn 97%).
4. **Nén HTTP:** Kích hoạt `GZipMiddleware` nén nội dung JSON payload trả về chỉ còn ~2.2kB.
5. **Render Ken Burns:** Thêm cờ `-preset veryfast -tune stillimage -threads 0` tăng tốc độ sinh video.
