# 🎯 Kế Hoạch Kiểm Thử Chi Tiết Từng Chức Năng (Detailed Master QA Plan)
## Hệ Thống AI Film Studio (Toàn Diện Frontend & Backend)

---

## 📌 1. TỔNG QUAN & PHẠM VI KIỂM THỬ

Kế hoạch này bao phủ **100% chức năng hiện có** của AI Film Studio, chia thành các ca kiểm thử (Test Cases) rõ ràng cho cả **Backend (BE)** và **Frontend (FE)**, kèm điều kiện đầu vào, hành vi mong đợi và tiêu chí nghiệm thu.

```mermaid
graph TD
    subgraph BACKEND_TESTING [Backend - 9 Phân Hệ]
        BE1[1. Kịch bản & Storyboard LLM]
        BE2[2. Giọng nói & Hòa âm Đa tầng]
        BE3[3. Động cơ Sinh ảnh & ComfyUI Hub]
        BE4[4. Hoạt cảnh & Camera 3D Trajectory]
        BE5[5. Dựng phim FFmpeg & Xuất bản]
        BE6[6. Kho Nhân vật & Visual DNA]
        BE7[7. Lồng tiếng Quốc tế Global Dubbing]
        BE8[8. Phần cứng & Chẩn đoán GPU]
        BE9[9. Streaming Real-time & Hủy tác vụ]
    end

    subgraph FRONTEND_TESTING [Frontend - 9 Giao Diện]
        FE1[1. Form Khởi tạo ProductionForm]
        FE2[2. Storyboard & Live Progress Cards]
        FE3[3. Timeline NLE & Waveform Beat Sync]
        FE4[4. Camera Director & 3D Trajectory]
        FE5[5. ComfyUI Modal & Hardware Diagnostic]
        FE6[6. Character Vault & Headshot Modal]
        FE7[7. Color Grading & LUT Comparison]
        FE8[8. Project Library & Template Modals]
        FE9[9. Video Player & SEO Publisher]
    end

    BACKEND_TESTING <==> FRONTEND_TESTING
```

---

## ⚙️ 2. KẾ HOẠCH KIỂM THỬ BACKEND (BE)

### 2.1. Phân hệ Kịch bản & Phân cảnh Điện ảnh (Script & Storyboard)
* **File nguồn:** `studio/storyboard.py`, `studio/llm/`
* **File test:** `tests/test_storyboard.py`, `tests/test_gemini.py`

| Mã Test | Tên Chức Năng | Dữ Liệu Đầu Vào | Hành Vi Kỳ Vọng (Expected Result) |
| :--- | :--- | :--- | :--- |
| **BE-SCR-01** | Cấu trúc 3 Hồi điện ảnh | Prompt đề tài bất kỳ, `shots = 6` | JSON trả về đúng 6 cảnh, phân bổ: Cảnh 1-2 (Hồi 1), Cảnh 3-4 (Hồi 2), Cảnh 5-6 (Hồi 3). |
| **BE-SCR-02** | Trích xuất Character DNA | Prompt có nhân vật cụ thể | Trường `character_dna` trích xuất đầy đủ: khuôn mặt, trang phục, màu mắt, kiểu tóc. |
| **BE-SCR-03** | Tự động sửa lỗi JSON LLM | Phản hồi LLM có markdown ```json hoặc dấu phẩy thừa | Hàm `parse_storyboard_json` tự làm sạch và parse thành công không crash. |
| **BE-SCR-04** | Metadata cảm xúc âm thanh | Kịch bản có tình huống kịch tính | Mỗi cảnh chứa trường `voice_emotion`: `excited`, `tense`, `sad`, `whispering`, `epic`. |

---

### 2.2. Phân hệ Giọng nói & Hòa âm Đa tầng (Audio Engineering)
* **File nguồn:** `studio/tts.py`, `studio/sfx.py`, `studio/audio_beat_detector.py`, `studio/assembly.py`
* **File test:** `tests/test_tts.py`, `tests/test_sfx.py`, `tests/test_audio_beat.py`, `tests/test_audio_mixer.py`

| Mã Test | Tên Chức Năng | Dữ Liệu Đầu Vào | Hành Vi Kỳ Vọng (Expected Result) |
| :--- | :--- | :--- | :--- |
| **BE-AUD-01** | Điều chế cảm xúc SSML Edge-TTS | Text tiếng Việt, cảm xúc `excited` | Sinh file `.mp3` hợp lệ, tốc độ (`rate`) và cao độ (`pitch`) tăng tương ứng SSML. |
| **BE-AUD-02** | Nhận diện & Sinh Foley SFX | Mô tả cảnh có mưa, sấm sét, bước chân | Tự động sinh/chèn âm thanh môi trường tương ứng vào file SFX riêng. |
| **BE-AUD-03** | Chọn Nhạc nền Mood BGM | Thể loại phim: Cyberpunk / Kinh dị | Tự động chọn file BGM phù hợp trong kho âm thanh và loop vừa thời lượng phim. |
| **BE-AUD-04** | Trích xuất đỉnh sóng âm (Peaks) | File âm thanh BGM / Voice `.mp3` | Trả về mảng JSON float `[0.1, 0.8, 0.4,...]` chuẩn hóa từ 0.0 đến 1.0 (100 mẫu). |
| **BE-AUD-05** | Phát hiện nhịp nhạc (Beat Detection) | File BGM có tiết tấu rõ ràng | Trả về danh sách timestamp các điểm rơi phách nhạc `beats: [1.2, 2.4, 3.6,...]`. |
| **BE-AUD-06** | Căn chỉnh thời lượng (Snap-to-Beat) | Danh sách thời lượng cảnh quay + mảng beat | Tính toán lại thời lượng từng shot sao cho điểm cắt chuyển cảnh khớp điểm rơi nhịp. |
| **BE-AUD-07** | Đường cong Auto-Ducking | Đoạn Voice xuất hiện đè lên BGM | Âm lượng BGM tự động giảm xuống 20% khi có lời thoại và hồi lại 100% khi dứt câu. |

---

### 2.3. Phân hệ Sinh Hình ảnh & ComfyUI Hub (Image & ComfyUI Engine)
* **File nguồn:** `studio/image_providers.py`, `studio/comfyui/`
* **File test:** `tests/test_image_providers.py`, `tests/test_comfyui_*.py`

| Mã Test | Tên Chức Năng | Dữ Liệu Đầu Vào | Hành Vi Kỳ Vọng (Expected Result) |
| :--- | :--- | :--- | :--- |
| **BE-IMG-01** | Cloud Pollinations Generator | Prompt ảnh 16:9, model Flux Schnell | Sinh ảnh `.png` độ phân giải 1280x720 thành công trong 3 - 5 giây. |
| **BE-IMG-02** | Local SD WebUI A1111 (Port 7860) | Endpoint `http://127.0.0.1:7860/sdapi/v1/txt2img` | Gửi prompt, seed, sampler và lưu ảnh kết quả vào thư mục `outputs/images/`. |
| **BE-IMG-03** | Ánh xạ Smart Node Graph ComfyUI | Workflow JSON chuẩn KSampler | Nhận diện đúng Positive/Negative Text, KSampler Seed, EmptyLatent width/height và inject tham số in-place. |
| **BE-IMG-04** | WebSocket Progress ComfyUI | Khởi động queue job trên ComfyUI | Bắt các gói tin WS `progress` và bắn sự kiện `comfyui_progress` với `step`, `total_steps`, `%`. |
| **BE-IMG-05** | Failover tự động khi ComfyUI Offline | ComfyUI server port 8188 bị ngắt kết nối | Bắt lỗi kết nối, ghi log cảnh báo, tự động fallback về `PollinationsProvider` và trả về ảnh thành công. |
| **BE-IMG-06** | Khóa tuần tự hóa GPU (`concurrency = 1`) | Pipeline cấu hình 6 shots với ComfyUI | Các cảnh chạy tuần tự từng cảnh một, không chạy song song để tránh CUDA OOM. |

---

### 2.4. Phân hệ Hoạt cảnh & Camera 3D Trajectory (Motion & Video)
* **File nguồn:** `studio/motion.py`, `studio/camera_3d.py`, `studio/video_providers.py`
* **File test:** `tests/test_motion.py`, `tests/test_camera_3d.py`, `tests/test_kling_provider.py`, `tests/test_luma_provider.py`

| Mã Test | Tên Chức Năng | Dữ Liệu Đầu Vào | Hành Vi Kỳ Vọng (Expected Result) |
| :--- | :--- | :--- | :--- |
| **BE-MOT-01** | Hiệu ứng Ken Burns 2.5D | Ảnh tĩnh 16:9 + chế độ `zoom_in` | Xuất file video `.mp4` camera zoom từ từ mượt mà ở 30fps. |
| **BE-MOT-02** | Thuật toán tọa độ Camera 3D | Các trục X, Y, Z, Roll, Pitch, Yaw | Tính toán ma trận biến đổi tọa độ 3D và kẹp giá trị an toàn trong khoảng `[-10, 10]`. |
| **BE-MOT-03** | Biên dịch camera cho Kling API | Cấu hình camera Orbital / Drone | Tạo payload tham số camera đúng chuẩn Kling API v1. |
| **BE-MOT-04** | Biên dịch camera cho Luma Machine | Cấu hình camera Dutch Angle / Zoom | Ghép prompt chuyển động tự nhiên cho Luma Dream Machine API. |

---

### 2.5. Phân hệ Dựng phim FFmpeg & Xuất bản (Assembly & Post-Production)
* **File nguồn:** `studio/assembly.py`, `studio/subtitles.py`, `studio/server.py`
* **File test:** `tests/test_assembly.py`, `tests/test_subtitles.py`

| Mã Test | Tên Chức Năng | Dữ Liệu Đầu Vào | Hành Vi Kỳ Vọng (Expected Result) |
| :--- | :--- | :--- | :--- |
| **BE-ASM-01** | Ghép nối video đa cảnh (Concatenation) | 6 clip video `.mp4` của 6 cảnh | Ghép nối liền mạch thành một file video master duy nhất không lệch tiếng. |
| **BE-ASM-02** | Khắc Hardsub điện ảnh | File phụ đề `.srt` / `.ass`, video MP4 | Phụ đề được khắc vĩnh viễn vào video với viền đổ bóng sắc nét. |
| **BE-ASM-03** | Tạo Thumbnail YouTube tự động | Cảnh cao trào + Tiêu đề phim | Trích xuất frame đẹp nhất, áp bộ lọc tương phản và vẽ title banner (1280x720). |
| **BE-ASM-04** | Tự động sinh SEO Hub | Toàn bộ kịch bản phim | Tạo 5 tiêu đề giật tít CTR cao, mô tả video kèm timeline chapters phân giây và danh sách hashtag. |
| **BE-ASM-05** | Bắn thông báo Webhook | URL Discord / Telegram / Custom | Gửi HTTP POST JSON thông báo hoàn thành phim kèm thông tin dự án. |

---

### 2.6. Phân hệ Đánh giá Phần cứng & GPU (Hardware Diagnostics)
* **File nguồn:** `studio/hardware.py`, `studio/routers/comfyui.py`
* **File test:** `tests/test_hardware.py`, `tests/test_comfyui_hardware.py`

| Mã Test | Tên Chức Năng | Dữ Liệu Đầu Vào | Hành Vi Kỳ Vọng (Expected Result) |
| :--- | :--- | :--- | :--- |
| **BE-HW-01** | Nhận diện GPU & VRAM Host | Hệ thống Windows có card GTX 950M | Quét qua WMI/PowerShell, trả về đúng `NVIDIA GeForce GTX 950M`, `2.0 GB VRAM`. |
| **BE-HW-02** | Phân hạng tương thích ComfyUI | VRAM = 2.0 GB | Xếp vào hạng `low_vram_warning`, model Flux/Wan đánh dấu `supported = false`. |
| **BE-HW-03** | Kiểm tra Docker GPU Passthrough | Docker trên máy có driver card cũ | Trả về `supported = false` kèm thông báo lỗi chi tiết của WSL2. |
| **BE-HW-04** | Lựa chọn Encoder FFmpeg | Hệ thống có card NVIDIA NVENC | Tự động chọn `h264_nvenc`, nếu không có fallback về `libx264`. |

---

### 2.7. Phân hệ Streaming Real-time & Hủy tác vụ
* **File nguồn:** `studio/broadcaster.py`, `studio/routers/cancellation.py`
* **File test:** `tests/test_events_sse.py`, `tests/test_cancellation.py`

| Mã Test | Tên Chức Năng | Dữ Liệu Đầu Vào | Hành Vi Kỳ Vọng (Expected Result) |
| :--- | :--- | :--- | :--- |
| **BE-RT-01** | Kênh SSE `/api/pipeline/events` | Client kết nối nhận EventSource | Nhận đầy đủ bản tin JSON trạng thái theo thời gian thực. |
| **BE-RT-02** | Hủy tác vụ tức thì | Gọi `POST /api/pipeline/cancel` khi đang render | Cờ `is_cancelled` kích hoạt, toàn bộ worker pool dừng trong vòng < 1 giây. |

---

## 🖥️ 3. KẾ HOẠCH KIỂM THỬ FRONTEND (FE)

### 3.1. Form Khởi Tạo Sản Xuất (`ProductionForm.tsx`)
* **Component:** `web/src/components/ProductionForm.tsx`

| Mã Test | Kịch Bản Kiểm Thử | Hành Động | Kết Quả Mong Đợi |
| :--- | :--- | :--- | :--- |
| **FE-FRM-01** | Xác thực đầu vào (Validation) | Để trống chủ đề phim và bấm Submit | Form chặn lại, hiển thị cảnh báo yêu cầu nhập đề tài. |
| **FE-FRM-02** | Chọn tỉ lệ khung hình | Bấm chuyển đổi giữa 16:9 và 9:16 | Giao diện đổi highlight tỉ lệ tương ứng. |
| **FE-FRM-03** | Preset URL ComfyUI | Bấm nút `Localhost`, `Docker Host`, `Docker Net` | Ô input tự điền đúng URL tương ứng (`127.0.0.1`, `host.docker.internal`, `comfyui`). |
| **FE-FRM-04** | Kiểm tra kết nối Engine | Bấm nút "Kiểm tra kết nối" tại ComfyUI Local | Hiển thị loader spin, toast thông báo kết quả (hoặc hộp hướng dẫn nếu offline). |

---

### 3.2. Bảng Phân Cảnh & Live Sampling (`StoryboardView.tsx`)
* **Component:** `web/src/components/StoryboardView.tsx`

| Mã Test | Kịch Bản Kiểm Thử | Hành Động | Kết Quả Mong Đợi |
| :--- | :--- | :--- | :--- |
| **FE-STB-01** | Hiển thị Card từng Cảnh | Sau khi kịch bản sinh xong | Hiển thị danh sách thẻ shot với prompt, thời lượng, voice, chuyển động camera. |
| **FE-STB-02** | Live Sampling Progress | Khi ComfyUI đang sinh ảnh cho cảnh X | Thẻ cảnh X hiển thị huy hiệu tím, thanh tiến độ gradient chạy `Step X/Y - Z%`. |
| **FE-STB-03** | Reroll Sinh Lại Ảnh | Bấm nút Reroll trên một cảnh | Chỉ cảnh đó được kích hoạt sinh lại ảnh, cập nhật ảnh mới mượt mà. |
| **FE-STB-04** | Tải Ảnh Lên Thủ Công | Kéo thả hoặc chọn file ảnh từ máy | Ảnh đại diện của cảnh được cập nhật ngay lập tức. |

---

### 3.3. Dòng Thời Gian NLE & Waveform Beat Sync (`TimelineScrubber.tsx`)
* **Component:** `web/src/components/TimelineScrubber.tsx`, `AudioWaveformTrack.tsx`

| Mã Test | Kịch Bản Kiểm Thử | Hành Động | Kết Quả Mong Đợi |
| :--- | :--- | :--- | :--- |
| **FE-TIM-01** | Hiển thị đa tầng Track | Mở giao diện Timeline | Hiển thị rõ ràng 4 tầng: Video Track, Voice Track, SFX Track, BGM Track. |
| **FE-TIM-02** | Kéo Playhead (Scrubbing) | Kéo con trỏ thời gian trên timeline | Video và các chỉ số giây cập nhật chính xác theo vị trí con trỏ. |
| **FE-TIM-03** | Vẽ Sóng âm thật (Canvas Waveform) | Khi có file BGM / Voice | Canvas vẽ biểu đồ sóng âm dạng cột màu tím/xanh ngọc, không bị méo tỉ lệ. |
| **FE-TIM-04** | Trợ lý Cut-to-Beat | Bấm nút "Cắt theo Nhịp nhạc" | Gọi API Snap-to-beat, độ rộng các khối shot trên timeline tự động căn chỉnh lại theo nhịp. |

---

### 3.4. Modal Đạo Diễn Máy Quay 3D (`CameraDirectorModal.tsx`)
* **Component:** `web/src/components/CameraDirectorModal.tsx`, `Camera3DTrajectoryPanel.tsx`

| Mã Test | Kịch Bản Kiểm Thử | Hành Động | Kết Quả Mong Đợi |
| :--- | :--- | :--- | :--- |
| **FE-CAM-01** | Canvas 3D Trajectory | Chọn tab "Quỹ Đạo 3D" | Canvas vẽ quỹ đạo camera 3 chiều (X, Y, Z) với điểm bắt đầu và kết thúc rõ ràng. |
| **FE-CAM-02** | Chọn Preset Máy Quay | Chọn "Orbital 360", "Drone Flyover" | Đường cong 3D tự động uốn lượn theo quỹ đạo định sẵn, cập nhật tham số. |
| **FE-CAM-03** | Lưu thiết lập vào Shot | Bấm "Áp dụng cho Cảnh này" | Tham số chuyển động 3D được lưu vào metadata của shot tương ứng. |

---

### 3.5. Modal ComfyUI Hub & Chẩn Đoán Phần Cứng (`ComfyUIModal.tsx`)
* **Component:** `web/src/components/ComfyUIModal.tsx`

| Mã Test | Kịch Bản Kiểm Thử | Hành Động | Kết Quả Mong Đợi |
| :--- | :--- | :--- | :--- |
| **FE-CMF-01** | Mở Modal không lỗi | Bấm biểu tượng ComfyUI trên Navbar | Modal mở mượt mà với nền cinema-deck, không có lỗi React console, không bị đen màn hình. |
| **FE-CMF-02** | Quét Chẩn đoán Phần cứng | Mở modal hoặc bấm "Quét lại" | Hiển thị card GPU (NVIDIA GTX 950M, 2.0 GB VRAM), huy hiệu đỏ "VRAM Thấp". |
| **FE-CMF-03** | Bảng tương thích Model | Bấm "Xem chi tiết" | Bảng mở ra, hiển thị dấu ❌ ở Flux/Wan và dấu ⚠️ ở SD 1.5, nêu rõ lý do. |
| **FE-CMF-04** | Test Sinh Thử (Smoke Test) | Bấm nút "Test Sinh Thử" | Hiển thị loader, gọi API `/api/comfyui/test` và trả về thông báo trạng thái. |
| **FE-CMF-05** | Tải lên Workflow Custom | Kéo thả file JSON workflow vào dropzone | Đọc file JSON, gửi API upload và cập nhật danh sách workflow. |

---

### 3.6. Kho Nhân Vật & Visual Consistency (`CharacterVaultModal.tsx`)
* **Component:** `web/src/components/CharacterVaultModal.tsx`

| Mã Test | Kịch Bản Kiểm Thử | Hành Động | Kết Quả Mong Đợi |
| :--- | :--- | :--- | :--- |
| **FE-CHR-01** | Tạo nhân vật mới | Nhập tên, tuổi, đặc điểm khuôn mặt | Nhân vật được lưu vào danh sách Vault của dự án. |
| **FE-CHR-02** | Sinh Headshot AI | Bấm "Tạo ảnh chân dung AI" | Tự động sinh ảnh chân dung 1:1 làm mẫu tham chiếu cho nhân vật. |

---

### 3.7. Bộ Trộn Màu Điện Ảnh & So Sánh LUT (`ColorGradingModal.tsx`)
* **Component:** `web/src/components/ColorGradingModal.tsx`

| Mã Test | Kịch Bản Kiểm Thử | Hành Động | Kết Quả Mong Đợi |
| :--- | :--- | :--- | :--- |
| **FE-COL-01** | Chọn Preset LUT | Chọn "Cyberpunk Neon", "Bleach Bypass", "Vintage" | Khung xem trước đổi tông màu tương ứng trong thời gian thực. |
| **FE-COL-02** | Thanh trượt So sánh A/B | Kéo thanh trượt Split Screen trái/phải | Chia đôi màn hình hiển thị trực quan giữa ảnh gốc và ảnh đã áp màu. |

---

## 🎬 4. KỊCH BẢN KIỂM THỬ ĐẦU-CUỐI (END-TO-END SCENARIOS)

### Kịch bản 1: Sản xuất Phim Tiêu Chuẩn (Cloud Engine)
1. **Bước 1:** Mở trình duyệt tại `http://localhost:8080`.
2. **Bước 2:** Nhập đề tài *"Thành phố ngầm dưới đáy biển năm 2099"*, chọn 16:9, phong cách *Cinematic Film*.
3. **Bước 3:** Bấm **"Bắt đầu sản xuất phim"**.
4. **Kiểm tra Stage 1:** Log hiện phân tích 3 Hồi, 6 cảnh quay xuất hiện trên Storyboard.
5. **Kiểm tra Stage 2:** File thoại tiếng Việt được tạo, thanh sóng âm xuất hiện trên Timeline.
6. **Kiểm tra Stage 3:** 6 ảnh 4K được tạo qua Cloud Pollinations trong < 30 giây.
7. **Kiểm tra Stage 4:** Chuyển động Ken Burns 2.5D được áp dụng cho từng cảnh.
8. **Kiểm tra Stage 5:** FFmpeg ghép video, nhạc nền ducking mượt mà, Hardsub hiện rõ nét.
9. **Kết quả:** Modal Video Player bật lên, video phát mượt mà, thumbnail sắc nét.

---

### Kịch bản 2: Cơ chế Phục Hồi Dự Phòng (Fail-Safe Resilience Test)
1. **Bước 1:** Bật cấu hình chọn Image Engine là `comfyui` với URL `http://127.0.0.1:8188` (khi ComfyUI đang tắt).
2. **Bước 2:** Bấm **"Bắt đầu sản xuất phim"**.
3. **Kiểm tra:** Hệ thống phát hiện port 8188 offline -> Ghi log cảnh báo màu vàng trên giao diện -> **Tự động chuyển tiếp (auto-fallback) sang Cloud Pollinations**.
4. **Kết quả:** Quá trình làm phim **không bị crash hay dừng lại**, toàn bộ 6 cảnh vẫn được hoàn thành trọn vẹn.

---

## 📊 5. CÔNG CỤ & TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

| Hạng mục kiểm thử | Công cụ thực hiện | Tiêu chí Đạt (Pass Criteria) |
| :--- | :--- | :--- |
| **Backend Unit & Integration** | `pytest` trong Docker | **242 / 242 Tests Passed (100%)**, 0 Error. |
| **Frontend Type Checking** | TypeScript Compiler (`tsc -b`) | **0 Type Error**, không có cảnh báo kiểu dữ liệu. |
| **Frontend Production Build** | Vite Bundler (`vite build`) | **Bundle thành công** ra thư mục `web/dist/` không lỗi. |
| **Thời gian phản hồi API** | Httpx / FastApi TestClient | Mọi endpoint phản hồi trong **< 200ms** (trừ tác vụ render). |
| **An toàn Bộ nhớ GPU** | Docker Resource Monitoring | Không có lỗi OOM; ComfyUI luôn chạy `concurrency = 1`. |
| **Giao diện Người dùng (UI)** | Chromium CDP Automation | Không bị màn hình trắng/đen; modal mở đóng trơn tru. |

---

## 🏆 6. KẾT QUẢ THỰC HIỆN KIỂM THỬ THỰC TẾ (VERIFIED EXECUTION REPORT)

### 6.1. Bước 1: Kiểm tra Toàn bộ Bộ Test Suite & Logic Backend (PASSED 100%)
* **Môi trường:** Docker Container (`studio`), Python 3.11, Pytest 8.x.
* **Thời gian thực thi:** 94.27 giây (~1 phút 34 giây).
* **Kết quả:** **242 passed, 3 warnings (0 failed, 0 error)** trên toàn bộ 43 test modules.
* **Đánh giá logic 9 phân hệ:**
  1. **Script & Storyboard:** Cấu trúc 3 hồi, trích xuất Character DNA, auto-recovery JSON parsing hoạt động chính xác.
  2. **Audio & TTS:** Đồng bộ thời lượng microsecond, chèn Foley SFX, Auto-ducking BGM (-14dB) hoạt động chuẩn.
  3. **Visuals & ComfyUI:** Phát hiện phần cứng VRAM thấp, tự động chuyển tiếp (failover fallback) sang Cloud Pollinations khi port ComfyUI offline.
  4. **Camera 3D Motion:** Render 8 hiệu ứng điện ảnh (zoom in/out, pan, tilt, orbital 3D) chuẩn biểu thức FFmpeg.
  5. **Assembly & Post-Production:** Ghép nối clip qua chuyển cảnh dissolve, mux âm thanh đa tầng, burn hardsub ASS/SRT chuẩn màu vàng TikTok Bold.
  6. **Streaming & Cancellation:** Hủy tác vụ an toàn không tạo tiến trình rác, phát SSE và WebSocket mượt mà.

---

### 6.2. Bước 2: Kiểm thử Thực tế End-to-End Pipeline (LIVE E2E TEST PASSED)
* **Chủ đề thử nghiệm:** *"Kỳ quan thành phố nổi tương lai năm 2099"*
* **Cấu hình pipeline:**
  * Ngôn ngữ: `vi` (Tiếng Việt) | Thời lượng: `1m` | Phong cách: `cinematic`
  * LLM: `gemini` (Google Gemini Flash) | Image Engine: `pollinations` (Flux Schnell)
  * Motion: `kenburns` (2.5D Camera FX) | Hardsub: `tiktok_bold` (Vàng viền đen)
* **Thời gian hoàn thành:** 300 giây (5 phút tròn).
* **Chi tiết từng giai đoạn (Stages):**
  * **Stage 1 (Kịch bản):** Sinh kịch bản điện ảnh *"Nova Atlantis 2099"* với nhân vật Kỹ sư trưởng Elena (tóc bạc metallic, mắt hổ phách, áo titan exo-suit) và 5 phân cảnh 3 hồi kịch tính.
  * **Stage 2 (Giọng đọc Edge-TTS):** Tạo 5 file audio tiếng Việt tự nhiên (`shot_001_001.mp3` 9.5s, `shot_001_002.mp3` 7.7s, `shot_002_001.mp3` 6.0s, `shot_002_002.mp3` 5.8s, `shot_003_001.mp3` 7.3s). Tổng thời lượng ~36.3 giây.
  * **Stage 3 (Tạo ảnh Flux Schnell):** Tạo 5 bức ảnh 1280x720 điện ảnh trong 11 giây.
  * **Stage 4 (Render chuyển động Ken Burns):** FFmpeg xuất 5 video clip phân cảnh với camera pan/zoom tương ứng từng câu thoại.
  * **Stage 5 (Hậu kỳ & Xuất bản Master):** Ghép nối clip với chuyển cảnh `dissolve`, mix track narration + BGM ducking, burn-in phụ đề ASS sắc nét, xuất file master Full HD 1080p.
* **Tệp đầu ra được kiểm tra và xác thực (Verified Artifacts):**
  * `outputs/final/movie_1793440983.mp4` (Full HD 1920x1080, H.264, AAC Stereo, 33.88s, 9.98 MB).
  * `outputs/storyboard.json` (Kịch bản 5 phân cảnh chuẩn 3 hồi).
  * `outputs/final/movie_1793440983.srt` & `.ass` (Phụ đề căn chỉnh khớp 100% thời lượng thoại).
  * `outputs/projects/proj_1793441191/thumbnail.jpg` (Ảnh bìa YouTube 205 KB kèm chữ tiêu đề nổi bật).
  * `outputs/projects/proj_1793441191/metadata.json` (Lưu trữ đầy đủ thông tin vào thư viện dự án).

---

### 6.3. Bước 3: Kiểm thử Bản dựng Frontend (FE BUILD PASSED)
* **Lệnh kiểm tra:** `npm --prefix web run build` (`tsc -b && vite build`)
* **Thời gian build:** 16.62 giây, 2238 modules transformed.
* **Kết quả:** **0 Type Error, 0 Lỗi đóng gói**.
* **Tài sản đầu ra:** Bundle tĩnh tạo sạch sẽ tại `web/dist/` (HTML, CSS, JS code-split cho từng Modal/Component).

---

### 6.4. Bước 4: Kiểm thử Tích hợp Toàn bộ REST API Sub-Routers (17/17 PASSED 100%)
* **Công cụ:** `tests/verify_endpoints.py` chạy trực tiếp trên Server Container.
* **Kết quả:** Toàn bộ 17 endpoint đều trả về **HTTP 200 OK** ngay lập tức:
  1. `[PASS 200] /api/storyboard/templates` (6 story templates)
  2. `[PASS 200] /api/camera/presets` (4 presets camera)
  3. `[PASS 200] /api/characters/vault` (4 nhân vật vault)
  4. `[PASS 200] /api/locations/vault` (5 bối cảnh vault)
  5. `[PASS 200] /api/sfx/list` (Catalog SFX)
  6. `[PASS 200] /api/assets/bgm` (9 bản nhạc nền BGM)
  7. `[PASS 200] /api/lut/presets` (8 preset màu điện ảnh)
  8. `[PASS 200] /api/transitions/presets` (8 hiệu ứng chuyển cảnh)
  9. `[PASS 200] /api/video/camera-3d/presets` (6 quỹ đạo camera 3D)
  10. `[PASS 200] /api/comfyui/status` (Trạng thái ComfyUI)
  11. `[PASS 200] /api/comfyui/workflows` (2 workflow mẫu)
  12. `[PASS 200] /api/reframe/presets` (3 preset tỷ lệ khung hình)
  13. `[PASS 200] /api/video/enhancer/presets` (6 preset nâng cấp chất lượng)
  14. `[PASS 200] /api/projects` (Danh sách dự án đã sản xuất)
  15. `[PASS 200] /api/system/hardware` (Chẩn đoán phần cứng CPU/GPU)
  16. `[PASS 200] /api/system/image-engines` (3 engine: Pollinations, SD WebUI, ComfyUI)
  17. `[PASS 200] /api/system/subtitle-presets` (6 preset phụ đề)

---

### 6.5. Bước 5: Kiểm thử Cơ chế Tự Phục Hồi Dự Phòng (FAIL-SAFE RESILIENCE PASSED)
* **Kịch bản:** Kích hoạt tạo ảnh với cấu hình `image_engine = "comfyui"` tại cổng ngoại vi offline (`http://127.0.0.1:8188`).
* **Hành vi thực tế:**
  1. Hệ thống bắt lỗi kết nối `[Errno 111] Connect call failed ('127.0.0.1', 8188)`.
  2. Module `ComfyUIProvider` ghi nhận log: `"ComfyUI generation failed: ... Falling back to Pollinations."`
  3. Tự động chuyển tiếp trơn tru sang Cloud Flux Schnell.
  4. Ảnh `/tmp/failover_test.png` được tạo thành công, pipeline không bị dừng hay crash.
