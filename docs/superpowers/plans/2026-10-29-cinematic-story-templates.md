# Kế Hoạch Triển Khai: Thư Viện Mẫu Kịch Bản & Cốt Truyện Điện Ảnh (Cinematic Story Templates & Genre Presets)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống thư viện kịch bản và phong cách điện ảnh chuyên nghiệp (Cinematic Story Templates & Genre Presets), cung cấp các khuôn mẫu kịch bản hoàn chỉnh (Cyberpunk, Cổ trang dã sử, Anime Shonen, Thriller tâm lý, Tài liệu, Viral Shorts 9:16) nạp sẵn Visual DNA nhân vật, bố cục 3 hồi, phong cách góc máy và nhạc nền 1-click trực quan.

**Architecture:**
1. `studio/templates.py`: Module quản lý danh mục kịch bản mẫu và Genre Blueprints tiêu chuẩn điện ảnh (Cyberpunk 2077, Dã sử hào hùng, Anime siêu nhiên, Kinh dị giật gân, Kỳ quan tài liệu, Viral Short 60s), bao gồm cả danh sách nhân vật mẫu với `visual_anchor` sắc nét.
2. `studio/prompts.py`: Mở rộng để tự động tiêm Genre Blueprint và Predefined Characters vào LLM prompt khi người dùng kích hoạt template, giúp LLM tạo kịch bản bám sát tuyệt đối thể loại.
3. `studio/server.py`: Đăng ký các endpoints `GET /api/storyboard/templates`, `GET /api/storyboard/templates/{template_id}`, và hỗ trợ `template_id` trong `ProduceRequest`.
4. `web/src/components/StoryTemplateModal.tsx`: Giao diện thư viện kịch bản điện ảnh dạng Modal với bộ lọc thể loại, thẻ xem trước trực quan, dàn nhân vật mẫu và nút "Áp dụng Template".
5. `web/src/components/ProductionForm.tsx`: Tích hợp nút mở thư viện template, tự động fill các thông số cấu hình và hiển thị badge template đang được chọn.

**Tech Stack:** Python 3.11, FastAPI, Pydantic, React 18, TypeScript, Tailwind CSS, Lucide Icons, Pytest.

---

## Global Constraints
- Toàn bộ 89 unit/integration tests hiện tại PHẢI tiếp tục PASS 100% (không gây bất kỳ lỗi hồi quy nào).
- Giao diện Vite build bundle giữ ở mức tối ưu (< 200 kB).
- Tuyệt đối không làm thay đổi hoặc gián đoạn luồng sản xuất tự do (người dùng không chọn template vẫn tạo kịch bản bình thường).
- Các nhân vật mẫu trong template phải có `visual_anchor` chi tiết, tương thích 100% với Flux và các model Diffusion.

---

## Tasks

### Task 1: Module Quản Lý Thư Viện Kịch Bản Điện Ảnh (`studio/templates.py`)
- [x] **Step 1: Viết test cho module templates**
  Tạo `tests/test_templates.py` kiểm tra:
  - `list_story_templates()` trả về danh sách các template hợp lệ, có đầy đủ các trường `id`, `name`, `category`, `style`, `aspect_ratio`, `characters`, `topic_prompt`.
  - Có tối thiểu 6 thể loại phổ biến: Cyberpunk, Cổ trang, Anime, Thriller, Documentary, Viral Short.
  - `get_story_template(template_id)` trả về đúng template hoặc `None` nếu ID không tồn tại.
  - Các nhân vật trong template có định dạng `visual_anchor` hợp lệ và `voice` chuẩn Edge-TTS.
- [x] **Step 2: Chạy test xác nhận test fail**
  Chạy `docker compose run --rm studio -m pytest tests/test_templates.py`.
- [x] **Step 3: Hiện thực `studio/templates.py`**
  - Xây dựng từ điển dữ liệu `STORY_TEMPLATES` với 6 thể loại điện ảnh mẫu đặc sắc.
  - Hiện thực các hàm `list_story_templates()`, `get_story_template()`, và `build_template_story_instruction()`.
- [x] **Step 4: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_templates.py`.

---

### Task 2: Tích Hợp Template Vào LLM Prompt Generator (`studio/prompts.py`)
- [x] **Step 1: Viết test kiểm tra tiêm template vào prompt**
  Bổ sung vào `tests/test_templates.py` test kiểm tra `get_storyboard_user_prompt` với tham số `template_id`.
- [x] **Step 2: Cập nhật `studio/prompts.py`**
  - Nhận thêm tham số `template_id: Optional[str] = None`.
  - Tự động bổ sung `[GENRE BLUEPRINT & CHARACTER DNA ANCHORS]` vào prompt gửi tới LLM.
- [x] **Step 3: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_templates.py`.

---

### Task 3: API Endpoints Thư Viện Template Trong Backend (`studio/server.py`)
- [x] **Step 1: Viết test cho API Templates**
  Bổ sung vào `tests/test_server.py`:
  - `test_get_storyboard_templates()`: `GET /api/storyboard/templates` trả về 200 và mảng template.
  - `test_get_single_storyboard_template()`: `GET /api/storyboard/templates/{template_id}` trả về 200 và chi tiết template.
  - `test_get_invalid_template()`: trả về 404.
- [x] **Step 2: Hiện thực API endpoints trong `studio/server.py`**
  - Đăng ký `GET /api/storyboard/templates`.
  - Đăng ký `GET /api/storyboard/templates/{template_id}`.
  - Cập nhật `ProduceRequest` nhận `template_id: Optional[str] = None`.
  - Truyền `template_id` vào `generate_storyboard()` trong `execute_pipeline_task`.
- [x] **Step 3: Chạy test xác nhận pass**
  Chạy `docker compose run --rm studio -m pytest tests/test_server.py -k template`.

---

### Task 4: Giao Diện Thư Viện Kịch Bản Điện Ảnh (`StoryTemplateModal.tsx`)
- [x] **Step 1: Định nghĩa kiểu dữ liệu & API Client frontend**
  - Thêm `StoryTemplate`, `TemplateCharacter` trong `web/src/types/index.ts`.
  - Thêm `fetchStoryTemplates()` trong `web/src/api/studio.ts`.
  - Thêm hook `useStoryTemplates()` trong `web/src/api/queries.ts`.
- [x] **Step 2: Xây dựng Component `web/src/components/StoryTemplateModal.tsx`**
  - Thanh lọc thể loại (Tất cả, Viễn tưởng, Dã sử, Hoạt hình, Tài liệu, Shorts).
  - Thẻ kịch bản với ảnh banner CSS gradient điện ảnh, icon, badge tỉ lệ (16:9 / 9:16), nhạc nền đề xuất.
  - Khung xem trước dàn nhân vật có sẵn Visual DNA.
  - Nút **"Áp dụng Kịch Bản Mẫu"**.
- [x] **Step 3: Tích hợp vào `web/src/components/ProductionForm.tsx`**
  - Thêm nút `✨ Kịch Bản Điện Ảnh Mẫu` cạnh tiêu đề Ý Tưởng Phim.
  - Xử lý sự kiện khi áp dụng template: tự động điền `topic`, `style`, `aspect_ratio`, `template_id`.
  - Hiển thị badge nhận diện template đang kích hoạt kèm nút bấm gỡ bỏ (X).
- [x] **Step 4: Build Frontend xác nhận không có lỗi TypeScript**
  Chạy `npm run build` trong `web/`.

---

### Task 5: Kiểm Tra Toàn Diện & Nghiệm Thu
- [x] Chạy toàn bộ backend test suite (`pytest tests/`) xác nhận 100% pass không có hồi quy.
- [x] Khởi động lại container UI và kiểm tra live API `GET /api/storyboard/templates`.
- [x] Báo cáo kết quả chi tiết cho người dùng.
