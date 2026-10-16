# Use TanStack Query + Axios for API Calls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn bộ việc gọi API trong frontend React Vite (`web/`) từ `fetch` thủ công sang kiến trúc chuẩn hóa với Axios và TanStack Query (@tanstack/react-query), bao gồm auto-polling thông minh, type-safe mutations, và query cache invalidation.

**Architecture:**
- Cài đặt `@tanstack/react-query` và `axios`.
- Tạo `src/api/client.ts` cấu hình instance Axios với base URL, timeout, và error handling.
- Tạo `src/api/studio.ts` định nghĩa các API functions type-safe (`getStatus`, `getStoryboard`, `produceMovie`, `cleanOutputs`).
- Tạo custom hooks (`useStudioStatus`, `useStoryboard`, `useProduceMutation`, `useCleanMutation`) trong `src/api/queries.ts` hoặc `src/hooks/useStudio.ts`.
- Bọc ứng dụng trong `QueryClientProvider` tại `main.tsx`.
- Refactor `App.tsx` sang sử dụng các hook React Query, tự động refetch theo chu kỳ trạng thái và cập nhật cache khi mutation hoàn tất.

**Tech Stack:** React 18, TypeScript, TanStack Query v5, Axios.

---

### Task 1: Install Dependencies & Axios Client

**Files:**
- Modify: `web/package.json`
- Create: `web/src/api/client.ts`

- [ ] Cài đặt `@tanstack/react-query` và `axios` trong thư mục `web/`.
- [ ] Tạo `web/src/api/client.ts` khởi tạo instance Axios với headers và error interceptor chuẩn.
- [ ] Commit Task 1.

---

### Task 2: Implement Studio API Services & Type-Safe Query/Mutation Hooks

**Files:**
- Create: `web/src/api/studio.ts`
- Create: `web/src/api/queries.ts`

- [ ] Định nghĩa các API endpoint functions trong `web/src/api/studio.ts`:
  - `fetchStatus()`: `GET /api/status` -> `StudioStatus`
  - `fetchStoryboard()`: `GET /api/storyboard` -> `StoryboardData`
  - `produceMovie(params: ProductionFormData)`: `POST /api/produce`
  - `cleanOutputs()`: `POST /api/clean`
- [ ] Định nghĩa React Query hooks trong `web/src/api/queries.ts`:
  - `useStudioStatus()`: có `refetchInterval` tự động điều chỉnh theo `status === 'running' ? 2000 : 5000`.
  - `useStoryboard()`: có `refetchInterval` đồng bộ.
  - `useProduceMovie()`: mutation với onSuccess trigger invalidateQueries.
  - `useCleanOutputs()`: mutation với onSuccess trigger invalidateQueries.
- [ ] Commit Task 2.

---

### Task 3: Setup QueryClientProvider & Integrate in App.tsx

**Files:**
- Modify: `web/src/main.tsx`
- Modify: `web/src/App.tsx`

- [ ] Thiết lập `QueryClient` và bọc `<QueryClientProvider client={queryClient}>` trong `web/src/main.tsx`.
- [ ] Cập nhật `web/src/App.tsx` sử dụng `useStudioStatus`, `useStoryboard`, `useProduceMovie`, `useCleanOutputs`.
- [ ] Giữ nguyên các hiệu ứng mừng hoàn thành (confetti) và modal phát phim.
- [ ] Commit Task 3.

---

### Task 4: Verification & Build Validation

- [ ] Chạy `npm run build` (`tsc -b && vite build`) và đảm bảo 0 lỗi type error.
- [ ] Kiểm tra phản hồi từ API qua curl hoặc docker container.
- [ ] Commit hoàn tất.
