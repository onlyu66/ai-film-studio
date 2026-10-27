# Kế Hoạch Nâng Tầm & Tối Ưu Hóa Giao Diện Studio Điện Ảnh (UI/UX Luxury Redesign Plan)

> **Dành cho Agent/Kỹ sư thực thi:** BẮT BUỘC SỬ DỤNG SUB-SKILL: `superpowers:subagent-driven-development` hoặc `superpowers:executing-plans` để triển khai từng task theo thứ tự. Các bước sử dụng cú pháp checkbox (`- [ ]`) để theo dõi tiến độ.

**Mục tiêu:** Chuyển đổi toàn bộ giao diện AI Film Studio từ mức ứng dụng web thông thường thành một **Cinema Workstation (Trạm làm phim điện ảnh chuyên nghiệp)** mang đẳng cấp Hollywood: màu sắc OLED đen sâu, ánh sáng vàng hổ phách điện ảnh, bố cục thẻ phân cảnh dạng film reel 16:9 trực quan, hệ thống lọc thông minh và trải nghiệm điều khiển mượt mà, tiện dụng cho nhà làm phim.

**Kiến trúc:** 
1. **Design System & Visual Atmosphere:** Thiết lập theme Cinema OLED tối giản cao cấp (`#090a0f`, viền acrylic mờ `rgba(255,255,255,0.08)`, điểm nhấn Amber `#f59e0b` & Ruby `#e11d48`), chuẩn hóa typography (`Plus Jakarta Sans` và `JetBrains Mono` cho thông số kỹ thuật).
2. **Production Control Desk (Form tạo phim):** Bàn điều khiển tạo kịch bản với thanh gợi ý ý tưởng thông minh, thẻ phong cách trực quan (Cinematic, Anime, Noir, Documentary) và ngăn kéo thiết lập máy quay/âm thanh/AI gọn gàng.
3. **Filmstrip Progress & Live Console:** Tiến trình 5 giai đoạn thiết kế dạng dải phim 35mm với hiệu ứng led sóng âm, kèm console nhật ký đa chế độ (thu gọn, mở rộng, lọc sự kiện lỗi/thành công).
4. **Storyboard Pro Suite (Bàn dựng phân cảnh):** Thẻ phân cảnh anamorphic 16:9 với chip thông số góc quay/ánh sáng/chuyển động nổi bật, thanh lọc nhanh trạng thái (`Đã duyệt`, `Chờ duyệt`, `Thiếu clip`, `Theo Hồi`), hồ sơ nhân vật dạng Character Bible sang trọng và bảng xuất bản Master Movie phong cách phòng hậu kỳ.

**Tech Stack:** React 18, Vite 6, Tailwind CSS, Lucide React, Framer Motion, TanStack React Query v5.

**Tài liệu đặc tả (Spec):** Khuyến nghị từ Design Intelligence Engine `ui-ux-pro-max` (Phong cách Dark OLED Cinema + Video-First Workstation).

---

## Global Constraints

- Không làm gián đoạn hoặc thay đổi bất kỳ logic API nào đang hoạt động ổn định giữa Frontend và Backend.
- Giữ nguyên 100% các tính năng cốt lõi (nhân vật nhất quán, Ken Burns, âm thanh CC0 SFX/BGM, duyệt từng phân cảnh, xuất video master).
- Đảm bảo điểm tiếp xúc (touch target) tối thiểu 40px cho các nút bấm, hỗ trợ đầy đủ responsive từ điện thoại (375px), tablet (768px) đến màn hình desktop lớn (1440px+).
- Tiếp tục duy trì hiệu năng tải trang cao sau tối ưu (bundle chính < 200KB, lazy load các modal).

## Review Focus (Các điểm then chốt cần chú ý)

1. **Độ tương phản và dễ đọc trong phòng tối (Low-light Ergonomics):** Màu nền phải đen dịu mắt, chữ trắng ngọc (`#F8FAFC`) và xám bạc (`#94A3B8`) đạt chuẩn WCAG AAA, tuyệt đối không dùng viền trắng thô chói mắt.
2. **Trực quan hóa trạng thái phân cảnh:** Người dùng chỉ cần nhìn lướt qua thumbnail là nhận biết ngay: phân cảnh đã có ảnh chưa, đã có giọng chưa, đã có clip chưa, và đã được duyệt hay chưa.
3. **Bộ lọc kịch bản không gây mất dữ liệu:** Khi chuyển đổi bộ lọc (`Tất cả`, `Chờ duyệt`, `Hồi 1`), việc chỉnh sửa hay duyệt cảnh phải cập nhật đúng phân cảnh trong danh sách gốc.
4. **Hiệu ứng chuyển động (Motion & Micro-interactions):** Mượt mà từ 150ms đến 250ms, phản hồi xúc giác (active scale, hover glow) rõ ràng mà không gây lag trình duyệt.
5. **Giao diện không bị tràn ngang trên màn hình nhỏ:** Tất cả các thanh công cụ, bảng điều khiển và lưới phân cảnh phải co giãn linh hoạt (responsive grid).

---

## Danh Sách Các Task Triển Khai

### Task 1: Nâng Cấp Hệ Thống Thiết Kế & Visual Theme Điện Ảnh (Design System & Navbar)

**Mục tiêu:** Xây dựng nền tảng thị giác Cinema Workstation sang trọng, hoàn thiện Navbar với nhận diện thương hiệu Studio chuyên nghiệp và chỉ báo trạng thái trực quan.

**Files:**
- Modify: `web/src/index.css`
- Modify: `web/tailwind.config.js`
- Modify: `web/src/components/Navbar.tsx`

**Chi tiết các bước thực hiện:**
- [x] **Bước 1.1:** Cập nhật bảng màu trong `web/tailwind.config.js` và `web/src/index.css`:
  - Bổ sung các biến màu Cinema OLED: `cinema-black` (`#07080b`), `cinema-surface` (`#0f1117`), `cinema-card` (`#141722`), `cinema-border` (`#1f2433`), `cinema-amber` (`#f59e0b`), `cinema-ruby` (`#e11d48`), `cinema-cyan` (`#06b6d4`).
  - Tinh chỉnh hiệu ứng ánh sáng ambient background và đổ bóng thẻ `studio-glow`.
- [x] **Bước 1.2:** Tái thiết kế `web/src/components/Navbar.tsx`:
  - Logo Studio điện ảnh với biểu tượng máy quay phát sáng vàng hổ phách tinh tế (`AI FILM STUDIO PRO`).
  - Badge trạng thái thông minh: Hiển thị viên thuốc phát sáng theo từng pha (Chờ duyệt kịch bản, Đang kết xuất, Hoàn tất, Lỗi).
  - Tích hợp cụm nút truy cập nhanh: Nút mở Thư viện dự án, nút Bật/Tắt Console với bộ đếm sự kiện trực tiếp, và nút Xem phim nổi bật.
- [x] **Bước 1.3:** Kiểm tra giao diện Navbar trên các kích thước màn hình (Mobile 375px, Desktop 1280px) đảm bảo không bị vỡ layout.

---

### Task 2: Thiết Kế Lại Bàn Điều Khiển Sáng Tác Phim (ProductionForm & Presets Hub)

**Mục tiêu:** Biến form nhập liệu thành một "Bàn điều khiển Đạo diễn" truyền cảm hứng, dễ thao tác và hiển thị trực quan các phong cách nghệ thuật.

**Files:**
- Modify: `web/src/components/ProductionForm.tsx`

**Chi tiết các bước thực hiện:**
- [x] **Bước 2.1:** Thiết kế lại Hero Prompt Workspace:
  - Khung nhập chủ đề chính với đường viền focus phát sáng vàng ấm, đếm số từ/ký tự, kèm nút bấm xóa nhanh hoặc làm mới.
  - Bổ sung thanh ý tưởng nhanh ("Spark Ideas") với các chủ đề mẫu hấp dẫn (Sci-Fi, Cyberpunk, Sử thi, Huyền bí) bấm vào là áp dụng ngay.
- [x] **Bước 2.2:** Nâng cấp Bộ chọn Phong cách Nghệ thuật (Style Grid):
  - Biến 4 phong cách (`Cinematic 35mm`, `Anime Studio`, `Film Noir`, `Documentary 8K`) thành các thẻ nghệ thuật có gradient nền rực rỡ, badge kỹ thuật ống kính và viền sáng kích hoạt khi được chọn.
- [x] **Bước 2.3:** Tối ưu hóa Ngăn kéo Thiết lập Nâng cao (Studio Drawer):
  - Phân nhóm rõ ràng theo 3 tab hoặc accordion:
    1. 🎥 **Góc máy & Khung hình**: Tỉ lệ màn ảnh (16:9 Widescreen / 9:16 Dọc TikTok), Chuyển động máy quay (Ken Burns / VFX), Bật phụ đề cứng (Hardsub).
    2. 🎙️ **Âm thanh & Diễn viên**: Ngôn ngữ thuyết minh, Công nghệ nhép môi (SadTalker).
    3. ⚡ **Trí tuệ nhân tạo (AI Engine)**: Chọn LLM (Gemini, Groq, Ollama, OpenAI) kèm kiểm tra model tự động.
- [x] **Bước 2.4:** Thiết kế nút bấm CTA chính ("KHỞI TẠO BỘ PHIM ĐIỆN ẢNH"):
  - Nút bấm lớn nổi bật với gradient vàng hổ phách, hiệu ứng phát quang nhẹ (shimmer), icon Clapperboard và trạng thái loading chuyển động khi submit.

---

### Task 3: Nâng Cấp Dải Phim Tiến Trình & Bàn Giám Sát Console (Progress & Terminal)

**Mục tiêu:** Mang lại cảm giác hồi hộp, trực quan khi theo dõi từng bước sinh phim tự động và cung cấp console theo dõi sự kiện tiện lợi.

**Files:**
- Modify: `web/src/components/ProgressStage.tsx`
- Modify: `web/src/components/TerminalLogs.tsx`

**Chi tiết các bước thực hiện:**
- [x] **Bước 3.1:** Tái thiết kế `web/src/components/ProgressStage.tsx`:
  - Thiết kế tiến trình 5 giai đoạn dạng Dải phim điện ảnh 35mm nối tiếp nhau (1. Kịch bản → 2. Giọng nói → 3. Hình ảnh Flux → 4. Chuyển động máy → 5. Hậu kỳ & Xuất xưởng).
  - Giai đoạn đang chạy có hiệu ứng vòng sáng thở (breathing glow), thanh tiến độ phần trăm mượt mà và thông báo trạng thái phân cảnh chi tiết.
- [x] **Bước 3.2:** Nâng cấp `web/src/components/TerminalLogs.tsx`:
  - Thêm thanh công cụ lọc nhanh log: `Tất cả`, `Lỗi (Errors)`, `Giai đoạn (Stages)`, `Thành công (Success)`.
  - Giữ tính năng windowing tối ưu hiệu năng đã cài đặt, kèm nút sao chép toàn bộ nhật ký một chạm có thông báo tooltip rõ ràng.
  - Hỗ trợ chế độ thu gọn (Dock), mở rộng chiều cao và cuộn tự động (Auto-scroll toggle).

---

### Task 4: Nâng Cấp Bàn Biên Tập Phân Cảnh Chuyên Nghiệp (Storyboard Pro Suite)

**Mục tiêu:** Cung cấp trải nghiệm biên tập phân cảnh như phần mềm dựng phim DaVinci Resolve / Premiere Pro với đầy đủ công cụ duyệt, xem clip, sửa thoại và xuất bản master.

**Files:**
- Modify: `web/src/components/StoryboardView.tsx`

**Chi tiết các bước thực hiện:**
- [x] **Bước 4.1:** Bổ sung Thanh Lọc & Tìm Kiếm Đa Năng (Filter Toolbar):
  - Thanh tìm kiếm theo ID phân cảnh, lời thoại hoặc prompt.
  - Nhóm nút lọc nhanh trạng thái: `Tất cả ({total})`, `✓ Đã duyệt ({approved})`, `⏳ Chờ duyệt ({pending})`, `🎬 Có Clip ({clips})`.
- [x] **Bước 4.2:** Nâng cấp Thẻ Phân Cảnh (Cinematic Shot Card):
  - Khung hình 16:9 với lớp phủ film overlay và badge ID phân cảnh màu hổ phách sang trọng.
  - Nút trạng thái duyệt phân cảnh (`ĐÃ DUYỆT` / `CHỜ DUYỆT`) thiết kế sắc sảo, bấm chuyển đổi mượt mà.
  - Khi hover: Nút `▶ Xem Clip` Full HD hoặc nút `Render Clip` riêng lẻ nổi bật ngay trên ảnh.
  - Cụm chip thông số điện ảnh tinh tế: Khung hình (`Camera`), Góc quay (`Angle`), Ánh sáng (`Lighting`), Chuyển động (`Motion`), Âm thanh (`SFX`).
  - Thanh công cụ hành động: Đưa lên/xuống, Tạo giọng TTS, Render Clip, Tạo lại ảnh AI (Reroll), Tải ảnh lên và nút Sửa chi tiết.
- [x] **Bước 4.3:** Tái thiết kế Tab Hồ Sơ Nhân Vật (Character Bible Dossier):
  - Chuyển đổi danh sách nhân vật thành dạng thẻ hồ sơ diễn viên với ảnh chân dung tròn/bo góc lớn, mô tả Visual DNA, huy hiệu giọng đọc AI kèm nút nghe thử giọng tức thì.
- [x] **Bước 4.4:** Nâng cấp Bảng Điều Khiển Master Movie (Master Assembly HUD):
  - Thiết kế bảng xuất bản cuối trang mang phong cách bàn hòa âm Studio với 4 thanh đo trực quan (`Ảnh`, `Giọng`, `Clips`, `Đã duyệt`).
  - Nút bấm xuất bản vàng gold điện ảnh với hiệu ứng nổi bật khi toàn bộ clip đã sẵn sàng.

---

## Kế Hoạch Xác Minh & Đo Lường Kết Quả (Verification)

1. **Kiểm tra biên dịch & Bundle size:** Chạy `cd web && npm run build` đảm bảo không có lỗi TypeScript, CSS hay build error, dung lượng bundle giữ mức tối ưu.
2. **Kiểm tra hồi quy Backend:** Chạy `docker compose run --rm studio -m pytest tests/` đảm bảo 60/60 tests tiếp tục pass.
3. **Kiểm tra trực quan giao diện:** Reload UI container (`docker compose restart ui`) và kiểm tra trên trình duyệt:
   - Thử nghiệm tạo kịch bản mới.
   - Thử nghiệm duyệt cảnh, xem clip popup và xuất master video.
   - Kiểm tra hiển thị responsive trên các độ phân giải màn hình.
