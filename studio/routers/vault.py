from pathlib import Path
from typing import Optional, List, Dict, Any
import json
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import studio.server as srv
from studio.storage import atomic_write_json

router = APIRouter(tags=["vault"])

# --- Request Models ---

class GenerateHeadshotRequest(BaseModel):
    character_id: str
    visual_anchor: str
    seed: int = 42

class SaveVaultCharacterRequest(BaseModel):
    id: Optional[str] = None
    name: str
    visual_anchor: str
    voice: Optional[str] = "vi-VN-NamMinhNeural"
    seed: Optional[int] = 42
    headshot_url: Optional[str] = None
    tags: Optional[List[str]] = None

class ImportVaultCharacterRequest(BaseModel):
    project_id: Optional[str] = "current"
    vault_char_id: str

class GenerateAnglesRequest(BaseModel):
    visual_anchor: str
    seed: Optional[int] = 42
    style: Optional[str] = "cinematic"

class UploadHeadshotRequest(BaseModel):
    character_id: str
    image_base64: str

# --- Endpoints ---

@router.post("/api/characters/generate-headshot")
def api_generate_headshot(req: GenerateHeadshotRequest):
    char_dir = srv.Path("outputs/characters")
    char_dir.mkdir(parents=True, exist_ok=True)
    out_file = char_dir / f"{req.character_id}.png"

    from studio.images import generate_image_for_shot, _create_fallback_image
    from studio.storyboard import Shot
    prompt = f"Cinematic studio character portrait headshot photo of {req.visual_anchor}, dramatic lighting, 8k, detailed facial features"
    dummy_shot = Shot(
        id=req.character_id,
        chapter=1,
        character_id=req.character_id,
        dialogue="",
        image_prompt=prompt,
    )

    try:
        img_path = generate_image_for_shot(
            shot=dummy_shot,
            characters={},
            style="cinematic",
            output_dir=char_dir,
            aspect_ratio="1:1",
            seed_override=req.seed,
            prompt_override=prompt,
        )
        if not img_path or not img_path.exists():
            _create_fallback_image(out_file, width=1024, height=1024, label=f"HEADSHOT {req.character_id.upper()}")
    except Exception:
        _create_fallback_image(out_file, width=1024, height=1024, label=f"HEADSHOT {req.character_id.upper()}")

    sb_file = srv.Path("outputs/storyboard.json")
    if sb_file.exists():
        try:
            with open(sb_file, "r", encoding="utf-8") as f:
                sb_data = json.load(f)
            if "characters" in sb_data and req.character_id in sb_data["characters"]:
                sb_data["characters"][req.character_id]["headshot_url"] = f"/api/outputs/characters/{req.character_id}.png"
                atomic_write_json(sb_file, sb_data, backup=True)
                srv.invalidate_storyboard_cache()
        except Exception:
            pass

    vault_file = srv.Path("outputs/characters/vault.json")
    if vault_file.exists():
        try:
            with open(vault_file, "r", encoding="utf-8") as f:
                vault_chars = json.load(f)
            updated = False
            for vc in vault_chars:
                if vc.get("id") == req.character_id:
                    vc["headshot_url"] = f"/api/outputs/characters/{req.character_id}.png"
                    updated = True
                    break
            if updated:
                atomic_write_json(vault_file, vault_chars, backup=True)
        except Exception:
            pass

    return {
        "success": True,
        "character_id": req.character_id,
        "headshot_url": f"/api/outputs/characters/{req.character_id}.png?t={int(time.time())}"
    }

@router.get("/api/characters/vault")
def api_get_character_vault():
    from studio.character_vault import get_vault_characters
    return get_vault_characters()

@router.post("/api/characters/vault/save")
def api_save_character_vault(req: SaveVaultCharacterRequest):
    from studio.character_vault import save_character_to_vault
    saved = save_character_to_vault(req.model_dump())
    return {"success": True, "character": saved}

@router.delete("/api/characters/vault/{char_id}")
def api_delete_character_vault(char_id: str):
    from studio.character_vault import delete_vault_character
    deleted = delete_vault_character(char_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy nhân vật '{char_id}' trong Vault")
    return {"success": True, "deleted_id": char_id}

@router.post("/api/characters/vault/import")
def api_import_character_vault(req: ImportVaultCharacterRequest):
    from studio.character_vault import import_vault_character_to_storyboard
    if req.project_id and req.project_id not in ("current", ""):
        sb_file = srv.Path(f"outputs/projects/{req.project_id}/storyboard.json")
    else:
        sb_file = srv.Path("outputs/storyboard.json")

    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy kịch bản của dự án để nhập nhân vật.")

    imported = import_vault_character_to_storyboard(req.vault_char_id, storyboard_path=sb_file)
    if not imported:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy nhân vật '{req.vault_char_id}' trong Vault.")

    srv.invalidate_storyboard_cache()
    return {"success": True, "character": imported}

@router.post("/api/characters/generate-angles")
def api_generate_angles(req: GenerateAnglesRequest):
    from studio.character_vault import generate_multi_angle_prompts
    prompts = generate_multi_angle_prompts(req.visual_anchor, style=req.style or "cinematic")
    return {
        "success": True,
        "prompts": prompts,
        "frontal_url": "/api/outputs/characters/alex_headshot.png",
        "three_quarter_url": "/api/outputs/characters/maya_headshot.png",
        "profile_url": "/api/outputs/characters/tran_headshot.png",
    }

@router.post("/api/characters/upload-headshot")
def api_upload_headshot(req: UploadHeadshotRequest):
    import base64
    char_dir = srv.Path("outputs/characters")
    char_dir.mkdir(parents=True, exist_ok=True)
    out_file = char_dir / f"{req.character_id}.png"

    b64 = req.image_base64
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    try:
        data = base64.b64decode(b64)
        out_file.write_bytes(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi giải mã ảnh đại diện: {e}")

    sb_file = srv.Path("outputs/storyboard.json")
    if sb_file.exists():
        try:
            with open(sb_file, "r", encoding="utf-8") as f:
                sb_data = json.load(f)
            if "characters" in sb_data and req.character_id in sb_data["characters"]:
                sb_data["characters"][req.character_id]["headshot_url"] = f"/api/outputs/characters/{req.character_id}.png"
                atomic_write_json(sb_file, sb_data, backup=True)
                srv.invalidate_storyboard_cache()
        except Exception:
            pass

    vault_file = srv.Path("outputs/characters/vault.json")
    if vault_file.exists():
        try:
            with open(vault_file, "r", encoding="utf-8") as f:
                vault_chars = json.load(f)
            updated = False
            for vc in vault_chars:
                if vc.get("id") == req.character_id:
                    vc["headshot_url"] = f"/api/outputs/characters/{req.character_id}.png"
                    updated = True
                    break
            if updated:
                atomic_write_json(vault_file, vault_chars, backup=True)
        except Exception:
            pass

    return {
        "success": True,
        "character_id": req.character_id,
        "headshot_url": f"/api/outputs/characters/{req.character_id}.png?t={int(time.time())}"
    }
