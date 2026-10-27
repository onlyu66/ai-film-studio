# Kế Hoạch Kiểm Tra & Tối Ưu Hóa Logic Nghiệp Vụ Pipeline AI Film Studio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện và chuẩn hóa toàn bộ luồng nghiệp vụ end-to-end của AI Film Studio (khởi tạo, duyệt kịch bản, chỉnh sửa phân cảnh, tổng hợp giọng đọc TTS, render hình ảnh, chuyển động máy quay 2.5D, xuất bản video & auto-dubbing), loại bỏ các lỗi bất đồng bộ trạng thái, khắc phục hiện tượng đứng tiến độ và đảm bảo các luồng chạy mượt mà, ổn định.

**Architecture:** 
1. Thêm cơ chế `progress_callback` liên kết từ `orchestrator.py` vào từng giai đoạn (`tts.py`, `images.py`, `motion.py`, `assembly.py`) để truyền tiến độ và log thời gian thực về `server.py` qua WebSocket và REST API `/api/status`.
2. Sửa lỗi logic tái sử dụng kịch bản cũ khi bắt đầu dự án mới (`force_new` vs `resume_only`), đồng thời bảo vệ toàn vẹn thư viện dự án đã hoàn thành trong `outputs/projects/`.
3. Tối ưu hóa `StateManager` trong `studio/state.py` để hỗ trợ xóa/reset checkpoint khi phân cảnh được chỉnh sửa, đảm bảo âm thanh và video clip của phân cảnh sửa đổi luôn được tổng hợp lại chính xác thay vì bị bỏ qua.

**Tech Stack:** Python 3.11, FastAPI, Pydantic, FFmpeg, Edge-TTS, Pollinations/Flux, Pytest.

---

## Global Constraints

- Không làm gián đoạn hoặc phá vỡ 46/46 unit tests hiện có trong thư mục `tests/`.
- Bảo toàn dữ liệu thư viện phim đã sản xuất nằm trong `outputs/projects/`.
- Giữ nguyên cấu trúc JSON chuẩn của `storyboard.json` (tương thích cả frontend web và backend).
- Mọi câu lệnh kiểm thử và chạy thử nghiệm phải chạy an toàn trong môi trường Docker container `studio`.

---

## Review Focus (Các rủi ro logic cần kiểm soát đặc biệt)

1. **Rủi ro kịch bản bị ghi đè hoặc kẹt kịch bản cũ:** Khi người dùng tạo một phim với chủ đề mới, hệ thống không được dùng lại `outputs/storyboard.json` của phim cũ. Ngược lại, khi người dùng bấm "Tiếp tục sản xuất", hệ thống BẮT BUỘC phải kế thừa kịch bản vừa được người dùng chỉnh sửa.
2. **Rủi ro câm tiếng sau khi sửa kịch bản:** Khi người dùng sửa lời thoại hoặc đổi giọng nhân vật, file audio cũ bị xóa nhưng nếu checkpoint `state.json` vẫn ghi nhận đã xong thì TTS sẽ bỏ qua shot đó, dẫn đến phân cảnh bị câm tiếng.
3. **Rủi ro lệch thời lượng giữa video clip và âm thanh:** Khi lời thoại thay đổi, thời lượng clip chuyển động 2.5D của shot đó phải tự động co giãn theo thời lượng đọc của file audio mới.
4. **Rủi ro phân cảnh tĩnh không có lời thoại (ambient shot):** Hệ thống phải tự động gán thời lượng mặc định (5.0s), chèn khoảng lặng âm thanh và không sinh subtitle rác trong file `.srt`.
5. **Rủi ro treo tiến độ (progress bar freeze):** Giai đoạn 2 -> 5 tốn nhiều thời gian render, nếu không có cập nhật tiến độ theo từng phân cảnh thì giao diện người dùng sẽ bị kẹt ở 40% gây hoang mang cho người dùng.

---

## Danh Sách Các Task Chi Tiết

### Task 1: Khắc phục lỗi Checkpoint & Tái tổng hợp Audio khi sửa lời thoại
**Files:**
- Modify: `studio/state.py`
- Modify: `studio/tts.py`
- Test: `tests/test_tts.py`

**Mục tiêu:** Đảm bảo khi một phân cảnh bị xóa audio hoặc chỉnh sửa, hệ thống sẽ tự động tổng hợp lại giọng đọc mới thay vì bỏ qua và gán thời lượng ảo 5 giây.

- [ ] **Step 1.1:** Mở rộng `StateManager` trong `studio/state.py` thêm phương thức `reset_shot(shot_id: str, stage: Optional[str] = None)` và `remove_shot(shot_id: str)`.
- [ ] **Step 1.2:** Cập nhật `run_tts_stage` trong `studio/tts.py` để kiểm tra cả `state.is_stage_complete(shot.id, "audio")` VÀ `audio_file.exists() and audio_file.stat().st_size > 0`. Nếu file không tồn tại, shot bắt buộc phải được đưa vào danh sách `pending_shots`.
- [ ] **Step 1.3:** Viết unit test trong `tests/test_tts.py` kiểm tra kịch bản: shot đã đánh dấu hoàn thành nhưng file audio bị xóa -> `run_tts_stage` vẫn tự động tổng hợp lại audio cho shot đó.
- [ ] **Step 1.4:** Chạy `pytest tests/test_tts.py` để xác nhận test pass.

---

### Task 2: Phân tách rõ ràng luồng "Bắt đầu dự án mới" vs "Tiếp tục kịch bản đã duyệt"
**Files:**
- Modify: `studio/orchestrator.py`
- Modify: `studio/server.py`
- Test: `tests/test_orchestrator.py`
- Test: `tests/test_server.py`

**Mục tiêu:** Khi người dùng nhập đề tài mới và bấm "Tạo Kịch Bản", hệ thống dọn dẹp sạch workspace tạm (không đụng vào thư viện `outputs/projects/`) để LLM viết kịch bản mới 100%. Khi bấm "Tiếp tục sản xuất", hệ thống giữ nguyên kịch bản người dùng đã sửa để tiếp tục render.

- [ ] **Step 2.1:** Thêm tham số `force_new: bool = False` vào hàm `run_pipeline` trong `studio/orchestrator.py`. Nếu `force_new=True`, xóa `storyboard.json` cũ để bắt buộc sinh kịch bản mới từ LLM.
- [ ] **Step 2.2:** Trong `studio/server.py`, hàm `execute_pipeline_task`:
  - Khi bắt đầu dự án mới (`resume_only=False`): dọn dẹp `outputs/storyboard.json`, `outputs/state.json`, và các thư mục tạm `outputs/audio`, `outputs/images`, `outputs/videos`, `outputs/final` (bảo tồn nguyên vẹn `outputs/projects`).
  - Khi tiếp tục (`resume_only=True`): giữ nguyên kịch bản hiện tại và tiếp tục quy trình render.
- [ ] **Step 2.3:** Viết test kiểm tra: gọi `/api/produce` dọn sạch workspace cũ và gọi `/api/continue` tái sử dụng đúng kịch bản hiện tại.
- [ ] **Step 2.4:** Chạy `pytest tests/test_server.py` xác nhận pass.

---

### Task 3: Tích hợp cơ chế Progress Callback & Log thời gian thực từng Shot
**Files:**
- Modify: `studio/orchestrator.py`
- Modify: `studio/tts.py`
- Modify: `studio/images.py`
- Modify: `studio/motion.py`
- Modify: `studio/assembly.py`
- Modify: `studio/server.py`
- Test: `tests/test_orchestrator.py`

**Mục tiêu:** Cho phép hiển thị tiến độ % mượt mà và stream log theo từng shot trong suốt các giai đoạn 2, 3, 4, 5, giúp thanh Stepper và TerminalLogs phản hồi tức thời.

- [ ] **Step 3.1:** Khai báo kiểu `ProgressCallback = Callable[[int, str, int, str], None]` (stage, stage_name, progress, message) trong `studio/orchestrator.py`.
- [ ] **Step 3.2:** Truyền `progress_callback` vào `run_tts_stage` (tiến độ từ 20% -> 40%, log từng shot hoàn tất TTS).
- [ ] **Step 3.3:** Truyền `progress_callback` vào `run_image_stage` (tiến độ từ 40% -> 65%, log từng shot hoàn tất vẽ ảnh Flux).
- [ ] **Step 3.4:** Truyền `progress_callback` vào `run_motion_stage` (tiến độ từ 65% -> 85%, log từng shot hoàn tất clip 2.5D).
- [ ] **Step 3.5:** Truyền `progress_callback` vào `run_assembly_stage` (tiến độ từ 85% -> 100%, log ghép nối, hòa âm BGM và làm phụ đề).
- [ ] **Step 3.6:** Trong `studio/server.py`, kết nối `progress_callback` với `pipeline_state`, `log_message` và `broadcast_ws("status", ...)`.
- [ ] **Step 3.7:** Viết test giả lập `progress_callback` được gọi đủ 5 stages với giá trị tăng dần từ 0 đến 100%.

---

### Task 4: Đồng bộ hóa Clip chuyển động khi đổi Giọng hoặc cập nhật Phân cảnh
**Files:**
- Modify: `studio/server.py`
- Test: `tests/test_server.py`

**Mục tiêu:** Khi người dùng đổi giọng đọc diễn viên (`/api/storyboard/character-voice`) hoặc chỉnh sửa lời thoại (`/api/storyboard/update-shot`), các clip video cũ tương ứng cũng phải được làm mới để thời lượng clip khớp hoàn toàn với độ dài giọng đọc mới.

- [ ] **Step 4.1:** Trong `update_character_voice`, bên cạnh việc xóa file audio cũ, xóa thêm file video clip `outputs/videos/{shot.id}.mp4` của tất cả các shot thuộc nhân vật đó.
- [ ] **Step 4.2:** Trong `update_shot`, khi lời thoại thay đổi, xóa thêm file video clip `outputs/videos/{req.shot_id}.mp4` để chuẩn bị cho việc render lại thời lượng mới.
- [ ] **Step 4.3:** Cập nhật `state.json` đặt lại trạng thái `"video": False` cho các shot bị ảnh hưởng.
- [ ] **Step 4.4:** Chạy `pytest tests/test_server.py` xác nhận pass.

---

### Task 5: Kiểm tra và hoàn thiện xử lý Phân cảnh tĩnh không có thoại (Ambient Shot)
**Files:**
- Verify/Modify: `studio/tts.py`
- Verify/Modify: `studio/subtitles.py`
- Verify/Modify: `studio/assembly.py`
- Test: `tests/test_storyboard.py`
- Test: `tests/test_assembly.py`

**Mục tiêu:** Đảm bảo khi shot không có lời thoại (chỉ có âm thanh môi trường như tiếng sóng biển, mưa, gió), phim vẫn chạy mượt mà đúng 5.0 giây, không phát sinh file phụ đề rỗng và âm thanh SFX được lặp mượt mà.

- [ ] **Step 5.1:** Kiểm tra `subtitles.py` đảm bảo các shot không có thoại được bỏ qua trong danh sách hiển thị phụ đề nhưng vẫn giữ đúng mốc thời gian (timestamp) cho các shot tiếp theo.
- [ ] **Step 5.2:** Kiểm tra `assembly.py` đảm bảo đoạn audio silent 5.0s được chèn chính xác và hòa âm SFX thành công.
- [ ] **Step 5.3:** Viết test kiểm tra phân cảnh không có lời thoại tạo ra phụ đề và video chuẩn xác.

---

### Task 6: Kiểm tra Luồng Auto-Dubbing Đa Ngôn Ngữ (`/api/projects/{id}/dub`)
**Files:**
- Verify/Modify: `studio/server.py`
- Test: `tests/test_server.py`

**Mục tiêu:** Đảm bảo tính năng 1-Click Auto-Dubbing cho phim đã lưu trong thư viện hoạt động trơn tru: dịch kịch bản, lồng tiếng giọng bản địa (EN, VI, JA, FR, ES), hòa âm lại BGM và xuất video bản ngữ mới.

- [ ] **Step 6.1:** Kiểm tra luồng gọi `/api/projects/{project_id}/dub`, xác thực việc tải lại `storyboard.json` từ thư mục dự án và dịch kịch bản.
- [ ] **Step 6.2:** Kiểm tra việc tổng hợp audio TTS với giọng đọc đích tương ứng (`SUPPORTED_VOICES`).
- [ ] **Step 6.3:** Kiểm tra việc ghép audio mới với video cũ (hoặc burn hardsub mới) và ghi nhận vào `dubbed_versions` trong `metadata.json`.
- [ ] **Step 6.4:** Viết unit test cho endpoint `/api/projects/{project_id}/dub`.

---

### Task 7: Chạy Kiểm Thử Toàn Diện & Xác Nhận End-to-End
**Files:**
- Run test suite: `docker compose run --rm studio -m pytest tests/`
- Build frontend: `cd web && npm run build`

**Mục tiêu:** Đảm bảo toàn bộ 100% test cases (bao gồm các tests mới) đều pass và giao diện web build thành công.

- [ ] **Step 7.1:** Chạy bộ test tổng hợp qua Docker.
- [ ] **Step 7.2:** Build lại frontend để đảm bảo không có bất kỳ regression nào.
- [ ] **Step 7.3:** Tạo commit git hoàn tất.
