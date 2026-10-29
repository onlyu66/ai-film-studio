# Character & Style Consistency Engine Pro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống khóa nhất quán nhân vật và phong cách điện ảnh (Character & Style Consistency Engine Pro) với kho lưu trữ nhân vật Character Vault dùng chung, cơ chế khóa Seed + Visual DNA Anchor + Headshot Reference, và bộ xem trước chân dung 3 góc máy chuẩn (Chính diện, 3/4, Nghiêng).

**Architecture:** Tạo module backend `studio/character_vault.py` quản lý tệp lưu trữ `outputs/characters/vault.json`. Bổ sung các REST endpoints quản lý Vault và sinh ảnh 3 góc trong `studio/server.py`. Frontend xây dựng modal `CharacterVaultModal.tsx` và nâng cấp tab Diễn viên trong `StoryboardView.tsx` với badge khóa nhất quán và nút nhập/xuất Vault.

**Tech Stack:** Python 3.11, FastAPI, React 19, TypeScript, Tailwind CSS, Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-10-29-character-style-consistency-engine-design.md`

## Global Constraints
- Toàn bộ 154 tests hiện tại PHẢI tiếp tục PASS 100%.
- Tệp `outputs/characters/vault.json` được bảo vệ độc lập, không bị mất khi dọn dẹp dự án.
- Giữ nguyên tính tương thích 100% với Storyboard JSON hiện tại.
- Frontend build Vite giữ ở mức tối ưu (< 335 kB).

## Review Focus
1. **Vault Persistence:** Đảm bảo khi lưu, sửa, hoặc xóa nhân vật trong Vault thì các tệp json được ghi nguyên tử (atomic write).
2. **Duplicate Handling:** Nếu nhập nhân vật đã có cùng ID trong dự án, tự động gán suffix hoặc cập nhật ghi đè an toàn.
3. **Seed Determinism:** Seed của nhân vật được bảo lưu chính xác khi sinh ảnh các phân cảnh.
4. **Multi-Angle Headshot Generation:** Sinh 3 góc ảnh chân dung không làm sụp đổ tiến trình nếu offline (tự động fallback).
5. **No Regressions:** Tất cả 154 tests hiện tại tiếp tục pass 100%.

---

## Tasks

### Task 1: Module `studio/character_vault.py` & Unit Tests (`tests/test_character_vault.py`)
**Files:**
- Create: `studio/character_vault.py`
- Create: `tests/test_character_vault.py`

- [x] **Step 1: Viết test trong `tests/test_character_vault.py`**
  - Test `get_vault_characters()` trả về danh sách nhân vật.
  - Test `save_character_to_vault()` lưu nhân vật vào vault.json thành công.
  - Test `delete_vault_character()` xóa nhân vật khỏi vault.
  - Test `import_vault_character_to_storyboard()` gán nhân vật vào storyboard.
- [x] **Step 2: Chạy test xác nhận fail**
  `docker compose run --rm studio -m pytest tests/test_character_vault.py`.
- [x] **Step 3: Hiện thực `studio/character_vault.py`**
  - Quản lý tệp `outputs/characters/vault.json`.
  - Các hàm nghiệp vụ Vault: get, save, delete, import.
- [x] **Step 4: Chạy test xác nhận pass**
  `docker compose run --rm studio -m pytest tests/test_character_vault.py`.

---

### Task 2: REST Endpoints trong `studio/server.py` & Test (`tests/test_server.py`)
**Files:**
- Modify: `studio/server.py`
- Modify: `tests/test_server.py`

- [x] **Step 1: Viết test server trong `tests/test_server.py`**
  - Test `GET /api/characters/vault`.
  - Test `POST /api/characters/vault/save`.
  - Test `POST /api/characters/vault/import`.
  - Test `DELETE /api/characters/vault/{char_id}`.
- [x] **Step 2: Hiện thực endpoints trong `studio/server.py`**
  - Endpoints: `GET /api/characters/vault`, `POST /api/characters/vault/save`, `DELETE /api/characters/vault/{char_id}`, `POST /api/characters/vault/import`, `POST /api/characters/generate-angles`.
- [x] **Step 3: Chạy test server xác nhận pass**
  `docker compose run --rm studio -m pytest tests/test_server.py -k vault`.

---

### Task 3: Web API Client, Types & React Query Hooks
**Files:**
- Modify: `web/src/types/index.ts`
- Modify: `web/src/api/studio.ts`
- Modify: `web/src/api/queries.ts`

- [x] **Step 1: Cập nhật types trong `web/src/types/index.ts`**
  - `VaultCharacterItem`, `SaveVaultCharacterPayload`, `ImportVaultCharacterPayload`, `GenerateAnglesPayload`, `GenerateAnglesResponse`.
- [x] **Step 2: Thêm hàm API trong `web/src/api/studio.ts`**
  - `fetchVaultCharacters()`, `saveCharacterToVault()`, `deleteVaultCharacter()`, `importVaultCharacter()`, `generateCharacterAngles()`.
- [x] **Step 3: Thêm React Query hooks trong `web/src/api/queries.ts`**
  - `useVaultCharacters()`, `useSaveVaultCharacter()`, `useDeleteVaultCharacter()`, `useImportVaultCharacter()`, `useGenerateCharacterAngles()`.

---

### Task 4: UI Component `CharacterVaultModal.tsx` & Tab Diễn Viên Nâng Cấp
**Files:**
- Create: `web/src/components/CharacterVaultModal.tsx`
- Modify: `web/src/components/StoryboardView.tsx`

- [x] **Step 1: Tạo `CharacterVaultModal.tsx`**
  - Grid danh sách nhân vật đã lưu trong Vault kèm ảnh chân dung và DNA Anchor.
  - Nút "Nhập vào dự án này" (Import to Project).
  - Nút "Xóa khỏi Vault" (Delete from Vault).
- [x] **Step 2: Nâng cấp Tab Diễn viên trong `StoryboardView.tsx`**
  - Nút "Mở Kho Nhân Vật (Vault)" trên thanh công cụ Diễn viên.
  - Nút "Lưu vào Vault" trên từng thẻ nhân vật.
  - Badge "🔒 Nhất Quán (Consistency Locked)" với tooltip thông tin seed và DNA.
  - Nút "Xem 3 góc mặt (Angles)" để kiểm tra độ đồng nhất khuôn mặt.
- [x] **Step 3: Kiểm tra biên dịch TypeScript**
  - `cd web && npx tsc --noEmit`.

---

### Task 5: Build, Khởi Động Container & Kiểm Thử Toàn Diện
**Files:**
- Build: `web/`
- Docker: Restart UI container

- [x] **Step 1: Build hoàn chỉnh frontend**
  - `cd web && npm run build`.
- [x] **Step 2: Khởi động lại UI container**
  - `docker compose restart ui`.
- [x] **Step 3: Chạy toàn bộ test suite**
  - `docker compose run --rm studio -m pytest tests/`.
  - Xác nhận 158+ tests pass 100%.
- [x] **Step 4: Cập nhật artifact và nghiệm thu cùng người dùng.**
