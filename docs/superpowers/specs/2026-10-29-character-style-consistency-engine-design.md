# Character & Style Consistency Engine Pro Technical Design

**Date:** 2026-10-29  
**Status:** Draft  
**Scope:** Giai đoạn 16 (Phase 16 of 17) — AI Film Studio

---

## 1. Intent & Why

Thách thức lớn nhất trong việc làm phim điện ảnh bằng Trí tuệ nhân tạo (Generative AI) là **tính nhất quán của nhân vật (Character Consistency)**:
- Nhân vật ở cảnh 1 trông như một người, sang cảnh 2 góc quay cận mặt lại biến thành người khác.
- Trang phục, kiểu tóc hoặc các đặc điểm nhận dạng đặc trưng (vết sẹo, mắt điện tử, màu áo) bị thay đổi ngẫu nhiên giữa các shot.
- Người làm phim muốn tái sử dụng một dàn diễn viên quen thuộc qua nhiều tập phim/dự án khác nhau nhưng không có kho lưu trữ tập trung.

Mục tiêu của **Character & Style Consistency Engine Pro** là:
1. **Character Vault (Kho lưu trữ nhân vật tập trung):** Lưu trữ hồ sơ nhân vật vĩnh viễn (`outputs/characters/vault.json`) với đầy đủ Visual Anchor DNA, Seed, Giọng đọc, và ảnh chân dung mẫu. Cho phép nhập/xuất nhân vật giữa các dự án phim chỉ với 1 click.
2. **Triple-Lock Consistency Injection:**
   - **Lock 1: Fixed Seed & Deterministic Latent Space:** Giữ nguyên seed cố định của nhân vật cho mọi shot mà nhân vật đó xuất hiện.
   - **Lock 2: Immutable Physical DNA Anchor:** Tự động chèn Visual Anchor chuẩn hóa (tuổi, khuôn mặt, tóc, sẹo, trang phục đặc trưng) vào vị trí ưu tiên cao nhất trong prompt của shot.
   - **Lock 3: Reference Image & Face DNA Anchor:** Gắn ảnh chân dung chuẩn (Headshot Reference) làm gốc để đối chiếu và nạp vào các mô hình Image Generation (IP-Adapter / ControlNet / Seed Reference).
3. **Multi-Angle Consistency Preview Studio:** Cho phép đạo diễn xem thử chân dung nhân vật ở 3 góc máy chuẩn (Chính diện Straight, Góc nghiêng 3/4, Cận cảnh Profile) trước khi bấm sản xuất hàng loạt.
4. **UI Vault & Consistency Badge:** Tích hợp giao diện quản lý Vault và nút "Khóa nhân vật (Consistency Locked)" ngay trong tab Diễn viên của Storyboard.

---

## 2. Goals, Non-Goals & Anti-Goals

### 2.1. Goals
- **Character Vault Backend Module (`studio/character_vault.py`):**
  - Quản lý danh sách nhân vật vault: `get_vault_characters()`, `save_character_to_vault()`, `delete_vault_character()`, `import_character_to_project()`.
- **Consistency Prompt & Seed Injector:**
  - Nâng cấp `build_full_prompt()` trong `studio/images.py` để tối ưu hóa vị trí chèn Visual DNA và bảo toàn tính toàn vẹn của nhân vật.
- **REST API Endpoints trong `studio/server.py`:**
  - `GET /api/characters/vault`: Lấy danh sách nhân vật trong kho lưu trữ.
  - `POST /api/characters/vault/save`: Lưu nhân vật vào kho.
  - `DELETE /api/characters/vault/{char_id}`: Xóa nhân vật khỏi kho.
  - `POST /api/characters/vault/import`: Nhập nhân vật từ kho vào dự án hiện tại.
  - `POST /api/characters/generate-angles`: Tạo ảnh xem trước 3 góc máy (Chính diện, 3/4, Nghiêng) để kiểm tra độ nhất quán.
- **Frontend Components:**
  - `CharacterVaultModal.tsx`: Giao diện duyệt, chọn và lưu nhân vật vào kho.
  - Multi-Angle Consistency Preview Gallery trên thẻ nhân vật trong `StoryboardView.tsx`.
  - Badge "🔒 Nhất Quán (Consistency Locked)" trên thẻ nhân vật.

### 2.2. Non-Goals
- Không tự huấn luyện LoRA riêng cho từng nhân vật (tốn hàng chục phút GPU). Thay vào đó sử dụng kết hợp Seed Locking + Visual Anchor DNA Injection + Reference Image Anchor để đạt độ nhất quán cao trong vài giây.

### 2.3. Anti-Goals
- **Không làm mất dữ liệu nhân vật cũ:** Mọi cập nhật trong Vault hoặc Storyboard đều sử dụng `atomic_write_json` an toàn.
- **Không ảnh hưởng đến thời gian tải trang:** Danh sách nhân vật Vault được tải qua React Query với cơ chế cache thông minh.

---

## 3. Constraints & Principles
- **100% Tests Pass:** Toàn bộ 154 tests hiện tại PHẢI tiếp tục PASS 100%. Bổ sung unit tests cho Vault (`tests/test_character_vault.py`) và server tests (`tests/test_server.py`).
- **Data Persistence:** Tệp `outputs/characters/vault.json` được bảo vệ độc lập, không bị xóa khi dọn dẹp các tệp tạm của project.
- **Frontend Build Size:** Duy trì bundle Vite dưới 335 kB.

---

## 4. Architectural Design

```
+-----------------------------------------------------------------------------------------+
|                               CHARACTER VAULT REPOSITORY                                |
|   outputs/characters/vault.json                                                         |
|   [ { id: "alex_spy", name: "Alex", visual_anchor: "...", seed: 4242, voice: "..." } ]  |
+-----------------------------------------------------------------------------------------+
                                         |
                       +-----------------+-----------------+
                       |                                   |
                       v                                   v
+------------------------------------+   +------------------------------------+
|     STORYBOARD CHARACTERS TAB      |   |    MULTI-ANGLE PREVIEW STUDIO      |
|  - Import from Vault               |   |  - Angle 1: Frontal (Chính diện)   |
|  - Export to Vault                 |   |  - Angle 2: 3/4 View (Nghiêng nhẹ) |
|  - 🔒 Consistency Lock Badge       |   |  - Angle 3: Side Profile (Cạnh)    |
+------------------------------------+   +------------------------------------+
                       |
                       v
+-----------------------------------------------------------------------------------------+
|                    TRIPLE-LOCK IMAGE GENERATION PIPELINE                                |
|   Lock 1: Fixed Seed (Seed = char.seed)                                                 |
|   Lock 2: Immutable Physical DNA (Age, ethnicity, scars, hair, clothing)               |
|   Lock 3: Reference Headshot Anchor Injection                                           |
|   => Output: Hình ảnh nhân vật đồng nhất 100% qua mọi Shot & Góc máy                    |
+-----------------------------------------------------------------------------------------+
```

---

## 5. API Endpoints

1. `GET /api/characters/vault`
   - Response: `List[VaultCharacter]`

2. `POST /api/characters/vault/save`
   - Request: `{ "id": str, "name": str, "visual_anchor": str, "voice": str, "seed": int, "headshot_url": Optional[str] }`
   - Response: `{ "success": bool, "character": VaultCharacter }`

3. `DELETE /api/characters/vault/{char_id}`
   - Response: `{ "success": bool, "deleted_id": str }`

4. `POST /api/characters/vault/import`
   - Request: `{ "project_id": str, "vault_char_id": str }`
   - Response: `{ "success": bool, "character": Character, "characters": Dict[str, Character] }`

5. `POST /api/characters/generate-angles`
   - Request: `{ "visual_anchor": str, "seed": int, "style": str }`
   - Response: `{ "frontal_url": str, "three_quarter_url": str, "profile_url": str }`
