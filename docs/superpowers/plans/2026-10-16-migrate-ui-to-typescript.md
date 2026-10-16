# Migrate AI Film Studio Web UI to TypeScript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn bộ mã nguồn frontend React Vite (`web/`) sang TypeScript với strict type checking (`tsc -b && vite build`), typing đầy đủ cho components, props, state, và API data models.

**Architecture:** Thiết lập cấu hình TypeScript chuẩn (`tsconfig.json`, `tsconfig.node.json`) với `bundler` module resolution và strict checking. Tạo module định nghĩa kiểu dữ liệu trung tâm `src/types/index.ts` cho các domain entities (ProductionParams, StudioStatus, Scene/Storyboard, UI Select options). Chuyển đổi tuần tự từ base utilities, ui primitives đến smart components, và cập nhật Vite entry point.

**Tech Stack:** React 18, TypeScript 5.x, Vite 6, Tailwind CSS, Lucide React, Framer Motion.

**Spec:** N/A (User directive: "hyax sử dụng typescript").

## Global Constraints

- Không làm gián đoạn hoặc thay đổi hành vi/chức năng hiện tại của giao diện web.
- `npm run build` phải thực hiện `tsc -b && vite build` và kết thúc với 0 lỗi (0 errors).
- Giữ nguyên các class Tailwind CSS và cấu trúc DOM đã được tối ưu hóa trước đó.
- Không sử dụng kiểu `any` tùy tiện; định nghĩa interface/type cụ thể và rõ ràng theo frontend-patterns.

---

### Task 1: Setup TypeScript Tooling & Configuration

**Files:**
- Modify: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/tsconfig.node.json`
- Modify: `web/vite.config.js` -> `web/vite.config.ts`

- [ ] Cài đặt các gói devDependencies: `typescript`, `@types/react`, `@types/react-dom`, `@types/canvas-confetti`.
- [ ] Tạo file `web/tsconfig.json` và `web/tsconfig.node.json`.
- [ ] Đổi tên `web/vite.config.js` thành `web/vite.config.ts`.
- [ ] Cập nhật npm script `build` thành `"tsc -b && vite build"`.
- [ ] Commit cấu hình nền tảng.

---

### Task 2: Core Domain Types & Utility Migration

**Files:**
- Create: `web/src/types/index.ts`
- Modify/Rename: `web/src/lib/utils.js` -> `web/src/lib/utils.ts`

- [ ] Tạo `web/src/types/index.ts` định nghĩa:
  - `StyleId`, `StyleOption`, `PresetIdea`
  - `SelectOption`
  - `ProductionFormData`
  - `StudioStatus`, `StudioLog`, `SceneItem`
- [ ] Chuyển đổi `web/src/lib/utils.js` thành `web/src/lib/utils.ts` với kiểu trả về cho `cn(...inputs: ClassValue[])`.
- [ ] Xóa `web/src/lib/utils.js`.
- [ ] Commit Task 2.

---

### Task 3: Migrate UI Primitive Components

**Files:**
- Modify/Rename: `web/src/components/ui/badge.jsx` -> `badge.tsx`
- Modify/Rename: `web/src/components/ui/button.jsx` -> `button.tsx`
- Modify/Rename: `web/src/components/ui/card.jsx` -> `card.tsx`
- Modify/Rename: `web/src/components/ui/select.jsx` -> `select.tsx`

- [ ] Chuyển đổi `badge.jsx` sang `badge.tsx` với `BadgeProps`.
- [ ] Chuyển đổi `button.jsx` sang `button.tsx` với `ButtonProps` kế thừa `React.ButtonHTMLAttributes<HTMLButtonElement>`.
- [ ] Chuyển đổi `card.jsx` sang `card.tsx` với typing cho Card, CardHeader, CardTitle, CardDescription, CardContent.
- [ ] Chuyển đổi `select.jsx` sang `select.tsx` với `CustomSelectProps` và typed `SelectOption`.
- [ ] Xóa các file `.jsx` cũ trong `web/src/components/ui/`.
- [ ] Commit Task 3.

---

### Task 4: Migrate Feature Components

**Files:**
- Modify/Rename: `web/src/components/Navbar.jsx` -> `Navbar.tsx`
- Modify/Rename: `web/src/components/ProgressStage.jsx` -> `ProgressStage.tsx`
- Modify/Rename: `web/src/components/TerminalLogs.jsx` -> `TerminalLogs.tsx`
- Modify/Rename: `web/src/components/StoryboardView.jsx` -> `StoryboardView.tsx`
- Modify/Rename: `web/src/components/VideoPlayerModal.jsx` -> `VideoPlayerModal.tsx`
- Modify/Rename: `web/src/components/ProductionForm.jsx` -> `ProductionForm.tsx`

- [ ] Chuyển đổi `Navbar.jsx` sang `Navbar.tsx`.
- [ ] Chuyển đổi `ProgressStage.jsx` sang `ProgressStage.tsx`.
- [ ] Chuyển đổi `TerminalLogs.jsx` sang `TerminalLogs.tsx`.
- [ ] Chuyển đổi `StoryboardView.jsx` sang `StoryboardView.tsx`.
- [ ] Chuyển đổi `VideoPlayerModal.jsx` sang `VideoPlayerModal.tsx`.
- [ ] Chuyển đổi `ProductionForm.jsx` sang `ProductionForm.tsx` sử dụng typed options và props.
- [ ] Xóa các file `.jsx` cũ trong `web/src/components/`.
- [ ] Commit Task 4.

---

### Task 5: Migrate App Root, Index HTML & Build Verification

**Files:**
- Modify/Rename: `web/src/App.jsx` -> `web/src/App.tsx`
- Modify/Rename: `web/src/main.jsx` -> `web/src/main.tsx`
- Modify: `web/index.html`

- [ ] Chuyển đổi `web/src/App.jsx` sang `web/src/App.tsx` với typed state và websocket/polling handlers.
- [ ] Chuyển đổi `web/src/main.jsx` sang `web/src/main.tsx`.
- [ ] Cập nhật `web/index.html` trỏ tới `/src/main.tsx`.
- [ ] Xóa các file `App.jsx`, `main.jsx`.
- [ ] Chạy `npm run build` (`tsc -b && vite build`) và xác nhận 0 lỗi.
- [ ] Commit Task 5 và nghiệm thu.
