"""AI Foley & Sound Effects (SFX) Studio Engine.
Provides a rich catalog of 25+ curated cinematic sound effects,
semantic cue auto-detection via LLM or rule-based heuristic matching,
and seamless audio integration into film scenes.
"""

from pathlib import Path
from typing import Dict, List, Optional, Any
import re

SFX_CATALOG: List[Dict[str, Any]] = [
    # 1. Action & Combat
    {
        "id": "gunshot",
        "name": "Súng nổ điện ảnh (Gunshot)",
        "category": "action",
        "description": "Tiếng súng nổ vang dội, uy lực cao kèm tiếng vọng.",
        "stream_url": "/api/assets/sfx/gunshot",
        "default_volume": 1.0,
        "default_offset_ms": 200,
        "tags": ["tiếng súng", "bắn súng", "rút súng", "súng nổ", "súng", "gunshot", "shoot", "pistol", "rifle", "bullet", "nổ súng"],
    },
    {
        "id": "explosion",
        "name": "Cháy nổ oanh tạc (Explosion)",
        "category": "action",
        "description": "Tiếng nổ bom, lựu đạn hoặc hỏa hoạn chấn động màng nhĩ.",
        "stream_url": "/api/assets/sfx/explosion",
        "default_volume": 1.1,
        "default_offset_ms": 300,
        "tags": ["cháy nổ", "vụ nổ", "bom nổ", "oanh tạc", "sập", "explosion", "bomb", "blast", "detonation", "phát nổ"],
    },
    {
        "id": "punch",
        "name": "Cú đấm cận chiến (Punch / Hit)",
        "category": "action",
        "description": "Tiếng va chạm cơ thể, đấm đá cận chiến uy lực.",
        "stream_url": "/api/assets/sfx/punch",
        "default_volume": 1.0,
        "default_offset_ms": 150,
        "tags": ["cú đấm", "đấm", "đánh nhau", "cận chiến", "tẩn", "punch", "smack", "strike", "đánh đấm", "bạo lực"],
    },
    {
        "id": "whoosh",
        "name": "Vụt lướt tốc độ cao (Whoosh)",
        "category": "action",
        "description": "Tiếng không khí xé toạc khi di chuyển cực nhanh hoặc vung tay.",
        "stream_url": "/api/assets/sfx/whoosh",
        "default_volume": 0.9,
        "default_offset_ms": 100,
        "tags": ["vụt", "lướt", "whoosh", "swoosh", "nhanh", "speed", "dash", "bay"],
    },
    {
        "id": "sword_slash",
        "name": "Vung kiếm chém (Sword Slash)",
        "category": "action",
        "description": "Tiếng kim loại va chạm, vung kiếm sắt bén.",
        "stream_url": "/api/assets/sfx/sword_slash",
        "default_volume": 0.95,
        "default_offset_ms": 250,
        "tags": ["kiếm", "đao", "chém", "sword", "blade", "slash", "kim_loại", "parry"],
    },

    # 2. Nature & Weather
    {
        "id": "heavy_rain",
        "name": "Mưa rào nặng hạt (Heavy Rain)",
        "category": "nature",
        "description": "Tiếng mưa rơi xối xả, giọt nước rơi trên mặt đường hoặc mái tôn.",
        "stream_url": "/api/assets/sfx/heavy_rain",
        "default_volume": 0.75,
        "default_offset_ms": 0,
        "tags": ["mưa", "rain", "heavy_rain", "drizzle", "cơn_mưa", "nước_chảy", "bão_mưa"],
    },
    {
        "id": "thunder",
        "name": "Sấm sét gầm vang (Thunder Strike)",
        "category": "nature",
        "description": "Tiếng sấm giật rền vang trời báo hiệu giông bão hiểm nguy.",
        "stream_url": "/api/assets/sfx/thunder",
        "default_volume": 1.05,
        "default_offset_ms": 400,
        "tags": ["sấm", "sét", "chớp", "thunder", "lightning", "storm", "giông", "giật_sấm"],
    },
    {
        "id": "wind",
        "name": "Gió rít bão bùng (Howling Wind)",
        "category": "nature",
        "description": "Tiếng gió thổi qua khe núi, rừng cây hoặc thảo nguyên hoang vắng.",
        "stream_url": "/api/assets/sfx/wind",
        "default_volume": 0.7,
        "default_offset_ms": 0,
        "tags": ["gió", "wind", "breeze", "howling", "bão", "lốc", "gió_thổi"],
    },
    {
        "id": "waves",
        "name": "Sóng biển vỗ bờ (Ocean Waves)",
        "category": "nature",
        "description": "Tiếng sóng biển rì rào vỗ vào bờ cát, tạo không gian thư thái.",
        "stream_url": "/api/assets/sfx/waves",
        "default_volume": 0.8,
        "default_offset_ms": 0,
        "tags": ["sóng", "biển", "waves", "ocean", "sea", "bờ_biển", "hải_âu", "thủy_triều"],
    },
    {
        "id": "campfire",
        "name": "Lửa trại tí tách (Campfire)",
        "category": "nature",
        "description": "Tiếng lửa bập bùng, gỗ cháy lách tách ấm áp giữa đêm.",
        "stream_url": "/api/assets/sfx/campfire",
        "default_volume": 0.8,
        "default_offset_ms": 0,
        "tags": ["lửa", "cháy", "đốt", "campfire", "fire", "flame", "tro_tàn", "bếp_lửa"],
    },
    {
        "id": "birds",
        "name": "Tiếng chim hót (Birds Chirping)",
        "category": "nature",
        "description": "Tiếng chim hót ríu rít trong trẻo buổi sớm bình yên.",
        "stream_url": "/api/assets/sfx/birds",
        "default_volume": 0.7,
        "default_offset_ms": 0,
        "tags": ["chim", "hót", "birds", "chirp", "rừng", "buổi_sáng", "thiên_nhiên", "bình_yên"],
    },

    # 3. Horror & Suspense
    {
        "id": "creaky_door",
        "name": "Cửa kẽo kẹt (Creaky Door)",
        "category": "horror",
        "description": "Tiếng bản lề cửa gỗ rỉ sét mở từ từ rợn tóc gáy.",
        "stream_url": "/api/assets/sfx/creaky_door",
        "default_volume": 0.85,
        "default_offset_ms": 300,
        "tags": ["cửa", "kẽo_kẹt", "creak", "door", "mở_cửa", "cũ_kỹ", "rùng_rợn", "ngôi_nhà"],
    },
    {
        "id": "heartbeat",
        "name": "Nhịp tim đập dồn dập (Heartbeat)",
        "category": "horror",
        "description": "Tiếng nhịp tim đập thình thịch trong lồng ngực khi hoảng loạn, sợ hãi.",
        "stream_url": "/api/assets/sfx/heartbeat",
        "default_volume": 0.95,
        "default_offset_ms": 0,
        "tags": ["tim", "nhịp_tim", "heartbeat", "pulse", "hồi_hộp", "lo_lắng", "hoảng_loạn", "sợ_hãi"],
    },
    {
        "id": "clock_tick",
        "name": "Đồng hồ tích tắc (Clock Tick)",
        "category": "horror",
        "description": "Tiếng kim đồng hồ đếm ngược từng giây căng thẳng nghẹt thở.",
        "stream_url": "/api/assets/sfx/clock_tick",
        "default_volume": 0.8,
        "default_offset_ms": 0,
        "tags": ["đồng_hồ", "clock", "tick", "tích_tắc", "thời_gian", "đếm_ngược", "căng_thẳng"],
    },
    {
        "id": "footsteps",
        "name": "Bước chân rón rén (Footsteps)",
        "category": "horror",
        "description": "Tiếng bước chân tiến lại gần trên nền gỗ hoặc gạch lạnh.",
        "stream_url": "/api/assets/sfx/footsteps",
        "default_volume": 0.85,
        "default_offset_ms": 200,
        "tags": ["bước_chân", "bước", "footsteps", "walk", "chạy", "tiến_lại", "rình_rập"],
    },
    {
        "id": "whisper",
        "name": "Tiếng thì thầm ma mị (Eerie Whisper)",
        "category": "horror",
        "description": "Âm thanh thì thầm khó hiểu vang vọng trong tâm trí hoặc bóng tối.",
        "stream_url": "/api/assets/sfx/whisper",
        "default_volume": 0.75,
        "default_offset_ms": 500,
        "tags": ["thì_thầm", "whisper", "ma", "quỷ", "bí_ẩn", "bóng_tối", "ảo_giác"],
    },

    # 4. Sci-Fi & Technology
    {
        "id": "glitch",
        "name": "Nhiễu sóng không gian (Cyber Glitch)",
        "category": "scifi",
        "description": "Tiếng lỗi hệ thống điện tử, can nhiễu tín hiệu radar hoặc cyberpunk.",
        "stream_url": "/api/assets/sfx/glitch",
        "default_volume": 0.85,
        "default_offset_ms": 100,
        "tags": ["glitch", "nhiễu", "cyber", "lỗi", "màn_hình", "sóng", "cyberpunk", "hệ_thống"],
    },
    {
        "id": "laser",
        "name": "Tia laser bắn phá (Laser Beam)",
        "category": "scifi",
        "description": "Tiếng súng năng lượng, tia laser chớp nhoáng của tương lai.",
        "stream_url": "/api/assets/sfx/laser",
        "default_volume": 0.9,
        "default_offset_ms": 150,
        "tags": ["laser", "tia_laser", "plasma", "súng_năng_lượng", "chiến_hạm", "viễn_tưởng"],
    },
    {
        "id": "spaceship",
        "name": "Động cơ tàu vũ trụ (Spaceship Engine)",
        "category": "scifi",
        "description": "Âm rền siêu trầm của động cơ phản lực không gian.",
        "stream_url": "/api/assets/sfx/spaceship",
        "default_volume": 0.75,
        "default_offset_ms": 0,
        "tags": ["tàu_vũ_trụ", "spaceship", "phi_thuyền", "vũ_trụ", "động_cơ", "space", "không_trọng_lực"],
    },
    {
        "id": "alarm_siren",
        "name": "Còi báo động khẩn cấp (Alarm Siren)",
        "category": "scifi",
        "description": "Tiếng còi báo động khẩn cấp đỏ rực trong căn cứ quân sự hay cơ sở hạt nhân.",
        "stream_url": "/api/assets/sfx/alarm_siren",
        "default_volume": 0.95,
        "default_offset_ms": 100,
        "tags": ["còi", "báo_động", "alarm", "siren", "khẩn_cấp", "nguy_hiểm", "cảnh_báo"],
    },

    # 5. Urban & Everyday Foley
    {
        "id": "car_skid",
        "name": "Lốp xe rít phanh gấp (Car Skid)",
        "category": "urban",
        "description": "Tiếng lốp ô tô miết trên mặt đường khi phanh khẩn cấp hay drift cua.",
        "stream_url": "/api/assets/sfx/car_skid",
        "default_volume": 1.0,
        "default_offset_ms": 250,
        "tags": ["xe", "ô_tô", "phanh", "skid", "drift", "lốp_xe", "cua", "tai_nạn"],
    },
    {
        "id": "city",
        "name": "Phố thị nhộn nhịp (City Ambience)",
        "category": "urban",
        "description": "Tiếng ồn ào không gian của quảng trường và phố xá đông đúc.",
        "stream_url": "/api/assets/sfx/city",
        "default_volume": 0.7,
        "default_offset_ms": 0,
        "tags": ["phố", "đô_thị", "thành_phố", "city", "đông_đúc", "quảng_trường", "người_qua_lại"],
    },
    {
        "id": "traffic",
        "name": "Kẹt xe còi inh ỏi (Traffic Jam)",
        "category": "urban",
        "description": "Tiếng còi xe và động cơ inh ỏi giờ cao điểm tắc đường.",
        "stream_url": "/api/assets/sfx/traffic",
        "default_volume": 0.75,
        "default_offset_ms": 0,
        "tags": ["traffic", "kẹt_xe", "tắc_đường", "còi_xe", "giao_thông", "xe_cộ"],
    },
    {
        "id": "keyboard",
        "name": "Gõ phím lách cách (Keyboard Typing)",
        "category": "urban",
        "description": "Tiếng gõ phím cơ liên hồi của lập trình viên hoặc văn phòng làm việc.",
        "stream_url": "/api/assets/sfx/keyboard",
        "default_volume": 0.8,
        "default_offset_ms": 100,
        "tags": ["gõ_phím", "bàn_phím", "keyboard", "typing", "máy_tính", "văn_phòng", "hacker"],
    },
    {
        "id": "coffee_shop",
        "name": "Quán cafe râm ran (Coffee Shop)",
        "category": "urban",
        "description": "Tiếng ly cốc va chạm và người nói chuyện râm ran trong quán cafe.",
        "stream_url": "/api/assets/sfx/coffee_shop",
        "default_volume": 0.7,
        "default_offset_ms": 0,
        "tags": ["quán_cafe", "cafe", "coffee", "trò_chuyện", "ly_tách", "thư_giãn"],
    },
]

def get_sfx_catalog() -> List[Dict[str, Any]]:
    """Return the entire curated SFX library."""
    return [dict(item) for item in SFX_CATALOG]

def resolve_sfx_asset(sfx_id: str) -> Optional[Path]:
    """Resolve an SFX asset by ID, checking local files, downloads, or procedural generation."""
    if not sfx_id:
        return None
    clean = str(sfx_id).lower().strip().replace(" ", "_")
    sfx_dir = Path("assets/sfx")
    sfx_dir.mkdir(parents=True, exist_ok=True)

    # 1. Existing local file
    for ext in (".mp3", ".wav"):
        cand = sfx_dir / f"{clean}{ext}"
        if cand.exists() and cand.stat().st_size > 500:
            return cand

    # 2. Check if known in audio_assets
    try:
        from studio.audio_assets import get_or_download_sfx, generate_tone_track
        downloaded = get_or_download_sfx(clean)
        if downloaded and downloaded.exists() and downloaded.stat().st_size > 500:
            return downloaded

        # 3. Procedural generation fallback
        out_target = sfx_dir / f"{clean}.mp3"
        generate_tone_track(out_target, style=clean, duration=10)
        if out_target.exists() and out_target.stat().st_size > 500:
            return out_target
    except Exception as e:
        print(f"  [SFX] Warning during resolve_sfx_asset('{sfx_id}'): {e}")

    # Fallback to thunder/wind or rain if exists
    for fb in ("thunder", "rain", "wind", "cinematic"):
        cand = sfx_dir / f"{fb}.mp3"
        if cand.exists() and cand.stat().st_size > 500:
            return cand

    return None

def suggest_sfx_for_shot(
    prompt: str,
    dialogue: str = "",
    genre: str = "",
) -> Dict[str, Any]:
    """Smart auto-detection of optimal SFX based on prompt, dialogue, and genre."""
    text_corpus = f"{prompt} {dialogue} {genre}".lower()

    # Rule-based semantic scoring based on catalog tags
    scored_items: List[tuple] = []
    for item in SFX_CATALOG:
        score = 0
        matched_tags = []
        for tag in item["tags"]:
            tag_clean = tag.replace("_", " ").strip()
            # Match word boundary or standalone syllables
            pattern = r'(?<![a-zA-Z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ])' + \
                      re.escape(tag_clean) + \
                      r'(?![a-zA-Z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ])'
            if re.search(pattern, text_corpus, re.IGNORECASE):
                word_weight = 3 + len(tag_clean.split()) * 2
                score += word_weight
                matched_tags.append(tag_clean)

        if score > 0:
            scored_items.append((score, item, matched_tags))

    if scored_items:
        scored_items.sort(key=lambda x: x[0], reverse=True)
        best_score, best_item, matched = scored_items[0]
        return {
            "sfx_id": best_item["id"],
            "name": best_item["name"],
            "category": best_item["category"],
            "volume": best_item["default_volume"],
            "offset_ms": best_item["default_offset_ms"],
            "reasoning": f"Phát hiện ngữ cảnh '{', '.join(matched)}' trong phân cảnh.",
        }

    # Default fallback based on genre
    genre_lower = str(genre).lower()
    if any(k in genre_lower for k in ("kinh dị", "horror", "mystery", "hồi hộp")):
        return {
            "sfx_id": "heartbeat",
            "name": "Nhịp tim đập dồn dập (Heartbeat)",
            "category": "horror",
            "volume": 0.85,
            "offset_ms": 0,
            "reasoning": "Thể loại phim kinh dị / hồi hộp tạo không khí căng thẳng.",
        }
    elif any(k in genre_lower for k in ("hành động", "action", "chiến tranh")):
        return {
            "sfx_id": "whoosh",
            "name": "Vụt lướt tốc độ cao (Whoosh)",
            "category": "action",
            "volume": 0.9,
            "offset_ms": 100,
            "reasoning": "Thể loại phim hành động tạo nhịp điệu dồn dập.",
        }
    elif any(k in genre_lower for k in ("sci-fi", "viễn tưởng", "tương lai")):
        return {
            "sfx_id": "glitch",
            "name": "Nhiễu sóng không gian (Cyber Glitch)",
            "category": "scifi",
            "volume": 0.8,
            "offset_ms": 100,
            "reasoning": "Thể loại phim viễn tưởng công nghệ cao.",
        }

    return {
        "sfx_id": "wind",
        "name": "Gió rít bão bùng (Howling Wind)",
        "category": "nature",
        "volume": 0.7,
        "offset_ms": 0,
        "reasoning": "Tiếng gió môi trường điện ảnh mặc định tạo chiều sâu không gian.",
    }
