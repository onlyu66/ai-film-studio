import os
import requests
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

def list_gemini_models(api_key: Optional[str] = None) -> List[Dict[str, Any]]:
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ValueError("Chưa cấu hình GEMINI_API_KEY. Vui lòng nhập API Key.")

    from google import genai
    client = genai.Client(api_key=key)

    models = []
    try:
        raw_list = client.models.list()
    except Exception as e:
        logger.error(f"Error calling Gemini list(): {e}")
        raise ValueError(f"Không thể xác thực hoặc tải danh sách model: {e}")

    for m in raw_list:
        name = m.name.replace("models/", "") if getattr(m, "name", None) else ""
        if not name:
            continue

        methods = getattr(m, "supported_generation_methods", []) or []
        # Filter to generation-capable models
        if methods and "generateContent" not in methods:
            continue

        # Exclude non-screenplay utility models (audio/tts/embedding/robotics/banana/music/agent)
        if any(bad in name.lower() for bad in [
            "tts", "embedding", "transcribe", "image", "banana",
            "computer-use", "robotics", "audio", "lyria", "aqa",
            "live", "antigravity", "deep-research"
        ]):
            continue

        # Filter out known deprecated models
        if name in ["gemini-2.5-flash", "gemini-2.5-flash-lite"]:
            continue

        display = getattr(m, "display_name", None) or name
        
        is_recommended = name in ["gemini-3.5-flash", "gemini-3.8-flash"]
        if name == "gemini-3.5-flash":
            subtext = "Khuyên dùng - Siêu tốc, ổn định tuyệt đối (0% lỗi)"
        elif name == "gemini-3.8-flash":
            subtext = "Thế hệ mới nhất của Google (Có thể gặp 503 khi cao điểm)"
        elif name == "gemini-3.5-flash-lite":
            subtext = "Siêu nhẹ, tốc độ cao, tiết kiệm token"
        elif "pro" in name:
            subtext = "Lập luận chuyên sâu, cốt truyện phức tạp"
        else:
            subtext = getattr(m, "description", "") or "Google Gemini AI"

        models.append({
            "id": name,
            "name": display,
            "description": subtext,
            "recommended": is_recommended,
        })

    def _sort_key(item):
        m_id = item["id"]
        if m_id == "gemini-3.5-flash":
            return (0, m_id)
        if m_id == "gemini-3.8-flash":
            return (1, m_id)
        if m_id == "gemini-3.5-flash-lite":
            return (2, m_id)
        if "flash" in m_id:
            return (3, m_id)
        if "pro" in m_id:
            return (4, m_id)
        return (5, m_id)

    models.sort(key=_sort_key)
    return models

def list_groq_models(api_key: Optional[str] = None) -> List[Dict[str, Any]]:
    key = api_key or os.environ.get("GROQ_API_KEY")
    if not key:
        raise ValueError("Chưa cấu hình GROQ_API_KEY. Vui lòng nhập API Key.")

    from groq import Groq
    client = Groq(api_key=key)
    try:
        res = client.models.list()
    except Exception as e:
        raise ValueError(f"Không thể xác thực Groq API Key: {e}")

    models = []
    for m in res.data:
        m_id = m.id
        # Exclude audio whisper models
        if "whisper" in m_id.lower():
            continue

        is_recommended = "llama-3.3-70b" in m_id or "mixtral-8x7b" in m_id
        if "llama-3.3-70b" in m_id:
            subtext = "Khuyên dùng - Cực thông minh, tốc độ 300+ tokens/s"
        elif "mixtral" in m_id:
            subtext = "MoE linh hoạt, sáng tạo kịch bản"
        elif "llama-3.1-8b" in m_id or "llama3-8b" in m_id:
            subtext = "Gọn nhẹ, phản hồi tức thì"
        else:
            subtext = "Groq LPU Fast Inference"

        models.append({
            "id": m_id,
            "name": m_id,
            "description": subtext,
            "recommended": is_recommended,
        })

    models.sort(key=lambda x: (0 if x["recommended"] else 1, x["id"]))
    return models

def list_openai_models(api_key: Optional[str] = None, base_url: Optional[str] = None) -> List[Dict[str, Any]]:
    key = api_key or os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ValueError("Chưa cấu hình OPENAI_API_KEY. Vui lòng nhập API Key.")

    url = (base_url or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    headers = {"Authorization": f"Bearer {key}"}
    try:
        resp = requests.get(f"{url}/models", headers=headers, timeout=12)
        resp.raise_for_status()
        data = resp.json().get("data", [])
    except Exception as e:
        raise ValueError(f"Không thể kết nối đến OpenAI API ({url}): {e}")

    models = []
    for m in data:
        m_id = m.get("id", "")
        # Filter for text chat models if it is official OpenAI or common endpoints
        if any(keyword in m_id.lower() for keyword in ["gpt", "o1", "o3", "claude", "deepseek", "qwen"]):
            if any(bad in m_id.lower() for bad in ["audio", "realtime", "tts", "whisper", "embedding", "dall-e"]):
                continue
            is_rec = m_id in ["gpt-4o", "gpt-4o-mini"]
            subtext = "Khuyên dùng - Đỉnh cao kịch bản" if m_id == "gpt-4o" else ("Tối ưu chi phí & tốc độ" if m_id == "gpt-4o-mini" else "Chat LLM")
            models.append({
                "id": m_id,
                "name": m_id,
                "description": subtext,
                "recommended": is_rec,
            })

    if not models and data:
        for m in data:
            models.append({"id": m.get("id", ""), "name": m.get("id", ""), "description": ""})

    models.sort(key=lambda x: (0 if x.get("recommended") else 1, x["id"]))
    return models

def list_ollama_models(base_url: Optional[str] = None) -> List[Dict[str, Any]]:
    url = (base_url or os.environ.get("OLLAMA_HOST") or "http://ollama:11434").rstrip("/")
    try:
        resp = requests.get(f"{url}/api/tags", timeout=5)
        resp.raise_for_status()
        raw = resp.json().get("models", [])
    except Exception as e:
        raise ValueError(f"Không thể kết nối tới Ollama Server tại {url}: {e}")

    models = []
    for m in raw:
        name = m.get("name", "")
        details = m.get("details", {})
        param_size = details.get("parameter_size", "")
        models.append({
            "id": name,
            "name": name,
            "description": f"Mô hình Local {param_size} ({details.get('quantization_level', 'Q4')})",
            "recommended": "llama3.2" in name,
        })
    return models
