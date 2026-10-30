from pathlib import Path
from typing import Optional, List, Dict, Any
import json
import time
import shutil

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

import studio.server as srv
from studio.storage import atomic_write_json
from studio.storyboard import parse_storyboard_json
from studio.export_fcpxml import generate_fcpxml

router = APIRouter(tags=["projects"])

# --- Request Models ---

class GenerateThumbnailRequest(BaseModel):
    headline: Optional[str] = None
    shot_id: Optional[str] = None

# --- Endpoints ---

@router.get("/api/projects")
def list_projects():
    projects_dir = srv.Path("outputs/projects")
    if not projects_dir.exists():
        return []

    projects = []
    for p_dir in sorted(projects_dir.iterdir(), reverse=True):
        if p_dir.is_dir():
            meta_file = p_dir / "metadata.json"
            if meta_file.exists():
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                    p_id = meta.get("id", p_dir.name)
                    video_file = meta.get("video_file")
                    srt_file = meta.get("srt_file")
                    thumb_file = meta.get("thumb_file")
                    if not thumb_file or not (p_dir / thumb_file).exists():
                        if (p_dir / "thumbnail.jpg").exists():
                            thumb_file = "thumbnail.jpg"
                        elif (p_dir / "thumb.png").exists():
                            thumb_file = "thumb.png"

                    meta["video_url"] = f"/api/outputs/projects/{p_id}/{video_file}" if video_file else None
                    meta["srt_url"] = f"/api/outputs/projects/{p_id}/{srt_file}" if srt_file else None
                    meta["thumb_url"] = f"/api/outputs/projects/{p_id}/{thumb_file}" if thumb_file else None
                    projects.append(meta)
                except Exception:
                    pass
    return projects

@router.get("/api/projects/{project_id}/export-timeline")
def export_project_timeline(
    project_id: str,
    format: str = "fcpxml",
    aspect_ratio: Optional[str] = None,
    fps: int = 25,
):
    project_dir = srv.Path("outputs/projects") / project_id
    if not project_dir.exists() or not project_dir.is_dir():
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án trong thư viện.")

    sb_file = project_dir / "storyboard.json"
    if not sb_file.exists():
        sb_file = srv.Path("outputs/storyboard.json")
        if not sb_file.exists():
            raise HTTPException(status_code=404, detail="Dự án không có dữ liệu storyboard.json")

    meta_file = project_dir / "metadata.json"
    resolved_aspect = aspect_ratio
    if not resolved_aspect and meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
                resolved_aspect = meta.get("aspect_ratio", "16:9")
        except Exception:
            pass
    if not resolved_aspect:
        resolved_aspect = "16:9"

    try:
        raw_text = sb_file.read_text(encoding="utf-8")
        sb = parse_storyboard_json(raw_text)

        export_file = project_dir / f"timeline_{project_id}.fcpxml"
        generate_fcpxml(
            storyboard=sb,
            output_path=export_file,
            aspect_ratio=resolved_aspect,
            fps=fps,
            project_dir=project_dir,
        )

        filename = f"timeline_{project_id}.fcpxml"
        return FileResponse(
            path=export_file,
            media_type="application/xml",
            filename=filename,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xuất timeline dự án: {str(e)}")

@router.post("/api/projects/{project_id}/thumbnail")
def api_generate_thumbnail(project_id: str, req: GenerateThumbnailRequest):
    project_dir = srv.Path("outputs/projects") / project_id
    if not project_dir.exists() or not project_dir.is_dir():
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án trong thư viện.")

    meta_file = project_dir / "metadata.json"
    title = "AI CINEMA"
    aspect_ratio = "16:9"
    meta = {}
    if meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
            title = meta.get("title") or meta.get("topic") or title
            aspect_ratio = meta.get("aspect_ratio", "16:9")
        except Exception:
            pass

    headline = req.headline.strip() if req.headline else title
    src_img = f"{req.shot_id}.png" if req.shot_id else None

    thumb_file = srv.generate_thumbnail_image(project_dir, headline, aspect_ratio, src_img)
    if not thumb_file:
        raise HTTPException(status_code=500, detail="Không thể tạo thumbnail bằng FFmpeg.")

    meta["thumb_file"] = thumb_file
    try:
        atomic_write_json(meta_file, meta, backup=False)
    except Exception:
        pass

    return {
        "success": True,
        "thumbnail_url": f"/api/outputs/projects/{project_id}/{thumb_file}?t={int(time.time())}"
    }

@router.get("/api/projects/{project_id}/seo")
def get_project_seo(project_id: str):
    project_dir = srv.Path("outputs/projects") / project_id
    if not project_dir.exists() or not project_dir.is_dir():
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án trong thư viện.")

    meta_file = project_dir / "metadata.json"
    sb_file = project_dir / "storyboard.json"
    if not sb_file.exists():
        sb_file = srv.Path("outputs/storyboard.json")

    meta = {}
    if meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except Exception:
            pass

    title = meta.get("title") or meta.get("topic") or "Phim Ngắn AI"
    topic = meta.get("topic") or title
    style = meta.get("style", "cinematic")
    episode = meta.get("episode", 1)
    series_title = meta.get("series_title")

    shots = []
    if sb_file.exists():
        try:
            with open(sb_file, "r", encoding="utf-8") as f:
                sb_data = json.load(f)
                shots = sb_data.get("shots", [])
        except Exception:
            pass

    current_time_sec = 0.0
    chapters = []
    seen_chapters = set()
    for s in shots:
        chap_num = s.get("chapter", 1)
        dur = float(s.get("duration") or 5.0)
        if chap_num not in seen_chapters:
            seen_chapters.add(chap_num)
            m = int(current_time_sec // 60)
            sec = int(current_time_sec % 60)
            ts = f"{m:02d}:{sec:02d}"
            chap_title = s.get("dialogue") or f"Chương {chap_num}"
            if len(chap_title) > 35:
                chap_title = chap_title[:32] + "..."
            chapters.append({
                "timestamp": ts,
                "title": f"Phần {chap_num}: {chap_title}"
            })
        current_time_sec += dur

    if not chapters:
        chapters.append({"timestamp": "00:00", "title": "Phần 1: Mở đầu câu chuyện"})

    ep_prefix = f"[Tập {episode}] " if series_title or episode > 1 else ""
    ctr_titles = [
        f"{ep_prefix}SỰ THẬT VỀ {title.upper()} | Phim Ngắn AI 4K",
        f"{ep_prefix}{title} - Cuộc Chiến Vô Tiền Khoáng Hậu | AI Cinema Studio",
        f"{ep_prefix}Điều Gì Đã Xảy Ra Với {topic[:40]}? | Phim Ngắn Hay Nhất",
        f"{ep_prefix}{title} (Full HD) - Siêu Phẩm AI Điện Ảnh {style.capitalize()}",
    ]

    desc_lines = [
        f"🎬 {title}",
        f"Thể loại: {style.capitalize()} | Sản xuất bởi: AI Film Studio 2026",
        "",
        f"📖 TÓM TẮT NỘI DUNG:",
        f"{topic}",
        "",
        "⏱️ DẤU MỐC THỜI GIAN (CHAPTERS):",
    ]
    for ch in chapters:
        desc_lines.append(f"{ch['timestamp']} - {ch['title']}")
    desc_lines.extend([
        "",
        "🌟 CÔNG NGHỆ SẢN XUẤT:",
        "- Kịch bản & Đạo diễn: AI Director Screenwriter",
        "- Visuals & Thiết kế nhân vật: Flux Diffusion Engine",
        "- Giọng lồng tiếng: Edge-TTS Neural Cinema Voice",
        "- VFX Camera: 2.5D Ken Burns & Cinematic Motion",
        "",
        "👍 Đừng quên LIKE, BÌNH LUẬN và ĐĂNG KÝ KÊNH để đón xem các tập phim AI tiếp theo!",
        "#aifilm #phimngan #aicinema #flux #shorts #film #viral"
    ])
    description = "\n".join(desc_lines)

    tags = [
        "phim ngan ai", "ai film studio", title.lower(), style, "phim dien anh ai",
        "flux diffusion", "ai filmmaking", "phim ngan hay nhat", "shorts"
    ]
    hashtags = "#phimngan #aicinema #shortfilm #aiart #viral #xuhuong #filmmaking #fyp"

    thumb_url = None
    if (project_dir / "thumbnail.jpg").exists():
        thumb_url = f"/api/outputs/projects/{project_id}/thumbnail.jpg"
    elif (project_dir / "thumb.png").exists():
        thumb_url = f"/api/outputs/projects/{project_id}/thumb.png"

    return {
        "project_id": project_id,
        "title": title,
        "series_title": series_title,
        "episode": episode,
        "titles": ctr_titles,
        "description": description,
        "chapters": chapters,
        "tags": tags,
        "hashtags": hashtags,
        "thumbnail_url": thumb_url,
    }

@router.get("/api/projects/{project_id}/subtitles/{sub_format}")
def download_project_subtitles(project_id: str, sub_format: str):
    fmt = sub_format.lower().strip()
    if fmt not in ("srt", "ass"):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ định dạng phụ đề srt hoặc ass.")

    project_dir = srv.Path("outputs/projects") / project_id
    if not project_dir.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")

    candidates = list(project_dir.glob(f"*.{fmt}"))
    if candidates:
        sub_file = sorted(candidates, key=lambda f: f.stat().st_mtime, reverse=True)[0]
        media_type = "text/plain" if fmt == "srt" else "text/x-ssa"
        return FileResponse(
            str(sub_file),
            media_type=media_type,
            filename=f"{project_id}.{fmt}",
            headers={"Content-Disposition": f'attachment; filename="{project_id}.{fmt}"'}
        )

    sb_path = project_dir / "storyboard.json"
    if not sb_path.exists():
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file phụ đề .{fmt} hoặc kịch bản của dự án.")

    from studio.subtitles import generate_srt, generate_ass
    with open(sb_path, "r", encoding="utf-8") as f:
        sb = parse_storyboard_json(f.read())

    durations = {s.id: float(s.duration or 5.0) for s in sb.shots}
    meta_file = project_dir / "metadata.json"
    sub_style = "tiktok_bold"
    aspect_ratio = "16:9"
    if meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as mf:
                m = json.load(mf)
                sub_style = m.get("subtitle_style", "tiktok_bold")
                aspect_ratio = m.get("aspect_ratio", "16:9")
        except Exception:
            pass

    out_file = project_dir / f"generated_{fmt}.{fmt}"
    if fmt == "srt":
        generate_srt(sb, durations, out_file)
        media_type = "text/plain"
    else:
        generate_ass(sb, durations, out_file, preset_id=sub_style, aspect_ratio=aspect_ratio)
        media_type = "text/x-ssa"

    return FileResponse(
        str(out_file),
        media_type=media_type,
        filename=f"{project_id}.{fmt}",
        headers={"Content-Disposition": f'attachment; filename="{project_id}.{fmt}"'}
    )

@router.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    p_dir = srv.Path("outputs/projects") / project_id
    if not p_dir.exists() or not p_dir.is_dir():
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án trong thư viện.")

    shutil.rmtree(p_dir, ignore_errors=True)
    return {"success": True, "message": f"Đã xóa dự án {project_id}"}
