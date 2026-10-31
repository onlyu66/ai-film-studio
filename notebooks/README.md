# ☁️ Hướng Dẫn Sử Dụng ComfyUI Cloud Miễn Phí (Google Colab GPU T4)

Tài liệu này hướng dẫn bạn cách khởi chạy **ComfyUI trên GPU Tesla T4 (15GB VRAM) hoàn toàn miễn phí** thông qua Google Colab, sau đó kết nối trực tiếp với **AI Film Studio** trên máy tính của bạn.

---

## ⚡ 1. Mở Nhanh Trên Google Colab (1-Click)

Bấm vào huy hiệu bên dưới để mở trực tiếp Notebook trên Google Colab:

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/onlyu66/ai-film-studio/blob/main/notebooks/comfyui_colab.ipynb)

*(Hoặc truy cập https://colab.research.google.com -> chọn thẻ **Upload** -> tải lên file `notebooks/comfyui_colab.ipynb`)*.

---

## 🛠️ 2. Các Bước Thực Hiện Trên Colab (Mất ~2 phút)

1. **Bật GPU T4:**
   * Trên thanh menu Google Colab, chọn **Runtime (Thời gian chạy)** ➔ **Change runtime type (Thay đổi loại phần cứng)**.
   * Chọn **T4 GPU** ➔ Bấm **Save (Lưu)**.

2. **Chạy Toàn Bộ Cells:**
   * Chọn **Runtime** ➔ **Run all (Chạy tất cả)** hoặc nhấn tổ hợp phím **`Ctrl + F9`**.
   * Hệ thống sẽ tự động:
     * Cài đặt mã nguồn ComfyUI mới nhất và ComfyUI-Manager.
     * Tải mô hình Checkpoint điện ảnh siêu tốc **SDXL-Lightning** (ByteDance - 4 bước sinh ảnh, ~1.5 giây/ảnh trên T4).
     * Mở đường hầm bảo mật HTTPS thông qua **Cloudflare Tunnel** (miễn phí, không cần đăng ký tài khoản).

3. **Lấy Đường Link Kết Nối:**
   * Sau khi Cell cuối cùng chạy xong, màn hình sẽ hiển thị thông báo:
     ```text
     ============================================================================
     🎉 COMFYUI CLOUD ĐÃ SẴN SÀNG KẾT NỐI VỚI AI FILM STUDIO!
     ============================================================================
     👉 SAO CHÉP ĐƯỜNG LINK DƯỚI ĐÂY:

           https://random-name.trycloudflare.com

     👉 Dán vào ô 'Server URL' trong ComfyUI Modal trên AI Film Studio và bấm 'Kiểm tra'!
     ============================================================================
     ```

---

## 🎬 3. Kết Nối Vào AI Film Studio

1. Mở giao diện AI Film Studio tại `http://localhost:8080`.
2. Bấm vào nút **Cài đặt ComfyUI** (biểu tượng đám mây hoặc nút ComfyUI trên thanh tiêu đề / form sản xuất).
3. Tại ô **Server URL**, dán đường link `https://random-name.trycloudflare.com` vừa copy.
4. Bấm nút **Kiểm tra**:
   * Trạng thái sẽ lập tức chuyển thành **"ComfyUI Server: Đã kết nối"**.
   * Thanh GPU VRAM sẽ hiển thị **15.0 GB VRAM (Tesla T4)**.
   * Model `sdxl_lightning_4step_checkpoint.safetensors` sẵn sàng.
5. Bấm **Lưu cấu hình**. Bây giờ AI Film Studio sẽ tạo ảnh và video trực tiếp từ GPU Cloud Colab siêu tốc!

---

## 🔒 4. Tính Năng An Toàn & Tự Phục Hồi
* **Bảo mật:** Đường link `trycloudflare.com` được mã hóa HTTPS/WSS 2 chiều.
* **Tự phục hồi (Fail-safe):** Nếu phiên Colab bị ngắt kết nối (hết hạn sau vài tiếng không thao tác), AI Film Studio sẽ tự động chuyển sang chế độ Cloud Flux Pollinations mà không làm gián đoạn hay hỏng video đang dựng.
