# 🎬 AI Film Studio

Hệ thống tự động sản xuất phim AI dài tập (>30 phút) hoàn chỉnh, vận hành hoàn toàn qua dòng lệnh trực tiếp trong VS Code / Docker. Ưu tiên 100% công cụ mã nguồn mở và miễn phí.

---

## 🌟 Tính năng nổi bật

- **Chạy 1 chạm (One-Command Pipeline):** Chỉ cần nhập chủ đề, Studio tự động viết kịch bản, lồng tiếng, tạo ảnh, chuyển động máy quay và render video hoàn chỉnh.
- **Duy trì nhân vật nhất quán (Character Consistency):** Tự động neo giữ "Visual Anchor DNA" (khuôn mặt, trang phục, đặc điểm nhận dạng) qua từng phân cảnh.
- **Giọng đọc tự nhiên, miễn phí:** Tích hợp `edge-tts` hỗ trợ tiếng Việt và tiếng Anh mượt mà, không giới hạn ký tự, không tốn credit.
- **Chuyển động điện ảnh 2.5D Ken Burns:** Sử dụng FFmpeg zoom/pan/tilt tự động theo thời lượng câu thoại, không tốn credit video đám mây.
- **Nhạc nền & Phụ đề tự động:** Tự động loop BGM với tính năng auto-ducking (-14dB khi có giọng đọc) và xuất kèm phụ đề `.srt` chuẩn xác theo mili-giây.
- **Docker-first:** Đóng gói toàn bộ môi trường (Python 3.11, FFmpeg, thư viện) trong Docker, không làm bẩn máy host.
- **Checkpoint & Resume:** Tự động lưu tiến độ từng shot; nếu mất mạng hoặc gián đoạn, chỉ cần chạy lại lệnh để tiếp tục từ cảnh dang dở.

---

## 🚀 Cài đặt & Khởi động nhanh (Khuyên dùng Docker)

Chỉ cần máy tính của bạn đã cài sẵn **Docker** và **Docker Compose**:

### 1. Cấu hình API Key (Nếu dùng Cloud LLM)
Tạo file `.env` hoặc export biến môi trường trên máy:
```bash
# Chọn 1 trong các nhà cung cấp (hoặc dùng Ollama không cần key)
export GEMINI_API_KEY="your-gemini-api-key"   # Miễn phí tại aistudio.google.com
export GROQ_API_KEY="your-groq-api-key"       # Miễn phí tại console.groq.com
```

### 2. Chạy sản xuất phim bằng một câu lệnh
Sử dụng script `./run.sh`:

```bash
# Phim tiếng Việt, 30 phút, phong cách điện ảnh (cinematic)
./run.sh run --topic "Bí ẩn thành phố Atlantis dưới đáy đại dương" --lang vi --duration 30 --style cinematic

# Phim tài liệu lịch sử tiếng Anh
./run.sh run --topic "The Rise and Fall of the Roman Empire" --lang en --duration 45 --style documentary

# Phim hoạt hình Anime
./run.sh run --topic "A magical adventure of a cat in Tokyo" --lang en --style anime
```

Toàn bộ file thành phẩm sẽ xuất hiện tại thư mục `outputs/final/`:
- `movie_<timestamp>.mp4`: Video phim hoàn chỉnh
- `movie_<timestamp>.srt`: File phụ đề chuẩn

---

## ⚙️ Bảng tham số dòng lệnh (CLI Reference)

| Tham số | Mặc định | Mô tả |
| :--- | :--- | :--- |
| `--topic` | *(Bắt buộc)* | Chủ đề hoặc cốt truyện của bộ phim |
| `--lang` | `en` | Ngôn ngữ thoại/kịch bản (`vi` cho tiếng Việt, `en` cho tiếng Anh) |
| `--duration` | `30` | Thời lượng phim mục tiêu tính bằng phút |
| `--style` | `cinematic` | Phong cách thị giác: `cinematic`, `anime`, `noir`, `documentary` |
| `--llm` | `gemini` | Nhà cung cấp LLM: `gemini`, `groq`, `openai`, `ollama` |
| `--motion` | `kenburns` | Bộ sinh chuyển động: `kenburns` (free), `vfx` (hiệu ứng cinema), `replicate` (AI Video I2V) |
| `--lip-sync` | `none` | Khẩu hình môi nhân vật: `none` (default), `cloud` (Replicate SadTalker) |
| `--bgm` | `None` | Đường dẫn file nhạc nền tùy chọn (`.mp3`) |
| `--output-dir`| `outputs` | Thư mục lưu trữ assets và sản phẩm |

---

## 🧩 Cấu trúc thư mục

```text
ai-film-studio/
├── Dockerfile              # Môi trường container hóa (Python 3.11 + FFmpeg)
├── docker-compose.yml      # Cấu hình container & bind-mount
├── run.sh                  # Wrapper script chạy nhanh
├── config.yaml             # Cấu hình mặc định
├── assets/
│   └── bgm/                # Nơi chứa nhạc nền bản quyền mở (CC0)
├── outputs/
│   ├── storyboard.json     # Kịch bản phân cảnh chi tiết
│   ├── state.json          # Checkpoint trạng thái từng shot
│   ├── audio/              # File lồng tiếng từng cảnh (.mp3)
│   ├── images/             # Ảnh minh họa từng phân cảnh (.png)
│   ├── videos/             # Video clip chuyển động Ken Burns (.mp4)
│   └── final/              # Phim thành phẩm (.mp4 + .srt)
└── studio/
    ├── config.py           # Quản lý cấu hình
    ├── state.py            # Quản lý checkpoint & resume
    ├── storyboard.py       # Phân rã kịch bản & sửa lỗi JSON
    ├── tts.py              # Động cơ lồng tiếng Edge-TTS
    ├── images.py           # Động cơ sinh ảnh Pollinations API
    ├── motion.py           # Động cơ chuyển động Ken Burns qua FFmpeg
    ├── subtitles.py        # Động cơ sinh phụ đề SRT
    ├── assembly.py         # Động cơ ghép nối, BGM ducking & mastering
    └── orchestrator.py     # Nhạc trưởng điều phối 5 công đoạn
```

---

## 🧪 Chạy kiểm thử tự động (Unit Tests)

Tất cả các thành phần đều được kiểm thử TDD nghiêm ngặt bên trong container:

```bash
docker compose run --rm studio -m pytest tests/ -v
```

---

## 📜 Giấy phép
Dự án được phát hành dưới giấy phép MIT License. Tự do sử dụng và tùy biến cho mục đích cá nhân lẫn thương mại.
