from typing import Dict, Any, List, Optional

STORY_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "cyberpunk_2077": {
        "id": "cyberpunk_2077",
        "name": "Cyberpunk Viễn Tưởng 2077",
        "tagline": "Đô thị bóng đêm neon, công nghệ tối tân và những số phận chìm nổi dưới đáy xã hội",
        "category": "Viễn tưởng Sci-Fi",
        "icon": "🤖",
        "style": "cinematic",
        "aspect_ratio": "16:9",
        "recommended_mood": "tense",
        "recommended_bgm": "cyberpunk",
        "default_topic": "Tại siêu đô thị Neo-Saigon năm 2077, một hacker cấy ghép cyberware bất hợp pháp tình cờ giải mã được tập tin tuyệt mật vạch trần âm mưu của tập đoàn độc tài kiểm soát ký ức người dân.",
        "characters": {
            "kael_zen": {
                "name": "Kael Zen",
                "visual_anchor": "30-year-old Vietnamese cyberpunk mercenary, short textured chrome-silver undercut hair, cybernetic glowing neon-cyan ocular implant on left eye, jawline stubble, wearing high-collar distressed techwear jacket with carbon-fiber shoulder pads and luminous neural wiring along neck",
                "voice": "vi-VN-NamMinhNeural",
                "seed": 2077,
            },
            "vesper_nyx": {
                "name": "Vesper Nyx",
                "visual_anchor": "27-year-old female rogue AI coder, sleek asymmetrical jet-black bob haircut with neon magenta tips, piercing amber eyes, subtle holographic biometric tattoos on temples, wearing matte-black insulated tactical coat with high neon-amber inner lining",
                "voice": "vi-VN-HoaiMyNeural",
                "seed": 8080,
            },
        },
        "genre_blueprint": (
            "Cyberpunk Neo-Noir aesthetic. Focus on rain-slicked asphalt reflecting vibrant neon billboards (cyan, magenta, electric amber), "
            "towering megastructures piercing through dense volumetric smog, high-contrast chiaroscuro shadows, "
            "and stark juxtaposition between cutting-edge cyberware technology and decaying street-level grunge."
        ),
    },
    "historical_epic": {
        "id": "historical_epic",
        "name": "Cổ Trang Dã Sử Hào Hùng",
        "tagline": "Khói lửa biên cương, đao kiếm giang hồ và tấm lòng trung liệt vì giang sơn",
        "category": "Cổ trang Dã sử",
        "icon": "⚔️",
        "style": "cinematic",
        "aspect_ratio": "16:9",
        "recommended_mood": "epic",
        "recommended_bgm": "epic",
        "default_topic": "Thời loạn lạc thế kỷ 13, một vị tướng trẻ thống lĩnh nghĩa quân trấn giữ ải hiểm yếu, đối đầu với vạn quân giặc phương Bắc để bảo vệ biên cương bờ cõi.",
        "characters": {
            "quoc_vu": {
                "name": "Trần Quốc Vũ",
                "visual_anchor": "32-year-old heroic Vietnamese warrior commander, rugged determined handsome face, battle scar over right cheekbone, topknot hairstyle tied with crimson silk ribbon, intense dark brown eyes, wearing ornate bronze and hammered steel lamellar dragon-scale armor with crimson battle cape",
                "voice": "vi-VN-NamMinhNeural",
                "seed": 1285,
            },
            "linh_lan": {
                "name": "Linh Lan",
                "visual_anchor": "24-year-old agile martial arts swordswoman, sharp graceful features, long flowing silky raven hair bound in high leather ponytail, alert obsidian eyes, wearing midnight-blue silk traveling robes fitted with lightweight leather vambraces and bamboo sun hat strapped on back",
                "voice": "vi-VN-HoaiMyNeural",
                "seed": 1288,
            },
        },
        "genre_blueprint": (
            "Classical Historical Epic aesthetic. Evoke ancient stone fortresses, misty river valleys, billowing war banners, "
            "dramatic backlighting piercing through dust and sparks, heroic low-angle cinematography, "
            "and authentic ancient traditional armor textures."
        ),
    },
    "anime_shonen": {
        "id": "anime_shonen",
        "name": "Anime Siêu Nhiên Shonen",
        "tagline": "Hành trình thức tỉnh sức mạnh nguyên tố, tình đồng đội và ý chí bất khuất vượt qua giới hạn",
        "category": "Anime & Kỳ ảo",
        "icon": "⚡",
        "style": "anime",
        "aspect_ratio": "16:9",
        "recommended_mood": "action",
        "recommended_bgm": "action",
        "default_topic": "Một thiếu niên mang trong mình phong ấn Long Hồn bị nguyền rủa tham gia đại hội khảo hạch ma thuật, đánh thức sức mạnh sấm sét để giải cứu học viện khỏi thế lực hắc ám.",
        "characters": {
            "ren_kuro": {
                "name": "Ren Kurogane",
                "visual_anchor": "17-year-old anime protagonist boy, spiky wild azure-blue hair with white lightning streaks, fiery determined golden eyes, wearing a black high-collar sleeveless combat tunic with glowing azure elemental runes etched across forearm bandages",
                "voice": "vi-VN-NamMinhNeural",
                "seed": 7777,
            },
            "yuki_shira": {
                "name": "Yuki Shirahime",
                "visual_anchor": "16-year-old anime sorceress prodigy, waist-length pure snow-white hair adorned with ice crystal hairpins, delicate pale skin, glowing amethyst eyes, wearing an elegant ceremonial midnight-blue scholar robe with silver embroidery",
                "voice": "vi-VN-HoaiMyNeural",
                "seed": 9999,
            },
        },
        "genre_blueprint": (
            "Vibrant cinematic anime aesthetic reminiscent of Makoto Shinkai and Ufotable. "
            "Vivid celestial skies, glowing energy particle effects, dynamic kinetic camera angles, "
            "striking lighting contrasts, and highly expressive anime character emotions."
        ),
    },
    "psychological_thriller": {
        "id": "psychological_thriller",
        "name": "Kinh Dị Tâm Lý Bí Ẩn",
        "tagline": "Bóng tối nơi góc khuất tâm trí, ảo giác đan xen và những bí mật rợn người không lối thoát",
        "category": "Kinh dị & Giật gân",
        "icon": "🕯️",
        "style": "noir",
        "aspect_ratio": "16:9",
        "recommended_mood": "tense",
        "recommended_bgm": "mysterious",
        "default_topic": "Một bác sĩ tâm thần điều tra về ngôi biệt thự cổ bỏ hoang nơi bờ biển, tình cờ phát hiện những cuốn băng ghi âm của bệnh nhân cuối cùng cảnh báo rằng chính ông ta mới là người không thể rời đi.",
        "characters": {
            "dr_minh": {
                "name": "Bác sĩ Minh",
                "visual_anchor": "42-year-old weary intellectual psychiatrist, pale stressed countenance, dark tired circles under thoughtful grey eyes, rumpled salt-and-pepper hair, wearing a worn tweed overcoat over wrinkled dress shirt and wire-rimmed circular spectacles",
                "voice": "vi-VN-NamMinhNeural",
                "seed": 1944,
            },
            "spectral_entity": {
                "name": "Bóng Đêm Quá Khứ",
                "visual_anchor": "enigmatic spectral figure veiled in deep shadow, faint hollow luminescent eyes reflecting through antique rain-streaked mirror, vintage 1940s dark silhouette",
                "voice": "vi-VN-HoaiMyNeural",
                "seed": 666,
            },
        },
        "genre_blueprint": (
            "Psychological suspense & film noir dread. Dominant deep chiaroscuro shadows, single-source warm tungsten or cold moonlight, "
            "unsettling Dutch angles, suffocating hallways, rain streaking down fogged glass, and intense psychological paranoia."
        ),
    },
    "nature_doc": {
        "id": "nature_doc",
        "name": "Tài Liệu Kỳ Quan Thiên Nhiên",
        "tagline": "Bản trường ca hùng vĩ của sự sống, hành tinh xanh và quy luật sinh tồn khắc nghiệt",
        "category": "Tài liệu Khoa học",
        "icon": "🌍",
        "style": "documentary",
        "aspect_ratio": "16:9",
        "recommended_mood": "calm",
        "recommended_bgm": "calm",
        "default_topic": "Hành trình di cư sinh tử qua hàng ngàn dặm của đàn voi rừng và báo tuyết giữa vùng núi tuyết Himalaya hùng vĩ khi mùa đông khắc nghiệt ập tới.",
        "characters": {
            "narrator": {
                "name": "Người Thuyết Minh",
                "visual_anchor": "50-year-old distinguished mature documentary narrator, calm observant warm hazel eyes, silvered beard, wearing a weather-resistant khaki field safari jacket with brass zip details",
                "voice": "vi-VN-NamMinhNeural",
                "seed": 1980,
            },
        },
        "genre_blueprint": (
            "National Geographic & BBC Earth wildlife cinematography. Vast sweeping aerial landscape vistas, golden hour natural rim lighting, "
            "telephoto depth-of-field isolating majestic animals in their raw habitat, hyperrealistic 8k textures, authentic serene documentary tone."
        ),
    },
    "viral_short_60s": {
        "id": "viral_short_60s",
        "name": "Viral Short Giật Gân 60s",
        "tagline": "Hook kích thích tò mò 3 giây đầu, nhịp dựng dồn dập, tối ưu trọn vẹn màn hình dọc 9:16",
        "category": "Shorts & Mạng xã hội",
        "icon": "📱",
        "style": "cinematic",
        "aspect_ratio": "9:16",
        "recommended_mood": "action",
        "recommended_bgm": "action",
        "default_topic": "3 sự thật rùng mình về không gian vũ trụ mà NASA chưa từng công bố: Điều gì thực sự xảy ra khi tàu thăm dò chạm tới rìa hệ mặt trời?",
        "characters": {
            "viral_host": {
                "name": "Host Trực Tuyến",
                "visual_anchor": "25-year-old charismatic science communicator, sharp expressive eyes, modern textured black hair, wearing clean minimalist dark streetwear hoodie, backlit by dynamic neon-cyan and violet accent rim lighting",
                "voice": "vi-VN-NamMinhNeural",
                "seed": 3333,
            },
        },
        "genre_blueprint": (
            "High-engagement mobile vertical format (9:16). Striking 3-second visual hook, vibrant neon rim lights, "
            "fast-paced camera moves (zoom-in, rapid tilt), high-contrast center-weighted framing optimized for smartphone screens, "
            "and punchy impactful dialogue rhythm."
        ),
    },
}

def list_story_templates() -> List[Dict[str, Any]]:
    """Return a list of all available cinematic story templates."""
    return list(STORY_TEMPLATES.values())

def get_story_template(template_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a specific story template by ID."""
    return STORY_TEMPLATES.get(template_id)

def build_template_story_instruction(template_id: str) -> str:
    """Build special prompt guidance for LLM based on chosen genre template."""
    tmpl = get_story_template(template_id)
    if not tmpl:
        return ""

    lines = [
        f"\n[GENRE BLUEPRINT & CINEMATIC CONVENTIONS: {tmpl['name'].upper()}]",
        f"Genre Directives: {tmpl.get('genre_blueprint', '')}",
        f"Recommended Musical Mood: {tmpl.get('recommended_mood', 'epic')}",
        "\n[PREDEFINED CHARACTER VISUAL ANCHORS - MUST PRESERVE EXACTLY]:",
    ]

    for char_id, char_data in tmpl.get("characters", {}).items():
        lines.append(
            f"- Character ID: '{char_id}' | Name: '{char_data['name']}' | Voice: '{char_data['voice']}' | Seed: {char_data['seed']}\n"
            f"  Visual Anchor DNA: {char_data['visual_anchor']}"
        )

    lines.append(
        "CRITICAL REQUIREMENT: For every shot featuring these characters, use the exact character_id and incorporate their defined visual anchor seamlessly.\n"
    )

    return "\n".join(lines)
