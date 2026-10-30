from pathlib import Path
from typing import Optional, List, Dict, Any
import json
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import studio.server as srv
from studio.storage import atomic_write_json

router = APIRouter(tags=["locations"])

# --- Request Models ---

class GenerateLocationPreviewRequest(BaseModel):
    location_id: str
    environment_dna: str
    lighting: Optional[str] = "cinematic ambient lighting"
    color_palette: Optional[str] = "cinematic palette"
    seed: int = 42

class SaveVaultLocationRequest(BaseModel):
    id: Optional[str] = None
    name: str
    environment_dna: str
    lighting: Optional[str] = "Cinematic ambient lighting"
    color_palette: Optional[str] = "Natural cinematic palette"
    seed: Optional[int] = 42
    preview_url: Optional[str] = None
    tags: Optional[List[str]] = None

class ImportVaultLocationRequest(BaseModel):
    project_id: Optional[str] = "current"
    vault_loc_id: str

class AssignLocationToShotRequest(BaseModel):
    project_id: Optional[str] = "current"
    shot_id: str
    location_id: Optional[str] = None

class UploadLocationPreviewRequest(BaseModel):
    location_id: str
    image_base64: str

# --- Endpoints ---

@router.get("/api/locations/vault")
def api_get_location_vault():
    """Retrieve all locations in the Location Vault."""
    from studio.location_vault import get_vault_locations
    return get_vault_locations()

@router.post("/api/locations/vault/save")
def api_save_location_vault(req: SaveVaultLocationRequest):
    """Save or update a location in the Location Vault."""
    from studio.location_vault import save_location_to_vault
    saved = save_location_to_vault(req.model_dump())
    return {"success": True, "location": saved}

@router.delete("/api/locations/vault/{loc_id}")
def api_delete_location_vault(loc_id: str):
    """Delete a location profile from the Location Vault."""
    from studio.location_vault import delete_vault_location
    deleted = delete_vault_location(loc_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bối cảnh '{loc_id}' trong Vault")
    return {"success": True, "deleted_id": loc_id}

@router.post("/api/locations/vault/import")
def api_import_location_vault(req: ImportVaultLocationRequest):
    """Import a location from the Vault into project storyboard."""
    from studio.location_vault import import_vault_location_to_storyboard
    if req.project_id and req.project_id not in ("current", ""):
        sb_file = srv.Path(f"outputs/projects/{req.project_id}/storyboard.json")
    else:
        sb_file = srv.Path("outputs/storyboard.json")

    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy kịch bản của dự án để nhập bối cảnh.")

    imported = import_vault_location_to_storyboard(req.vault_loc_id, storyboard_path=sb_file)
    if not imported:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bối cảnh '{req.vault_loc_id}' trong Vault.")

    srv.invalidate_storyboard_cache()
    return {"success": True, "location": imported}

@router.post("/api/locations/assign-to-shot")
def api_assign_location_to_shot(req: AssignLocationToShotRequest):
    """Assign or unassign a location to a shot in the storyboard."""
    from studio.location_vault import assign_location_to_shot
    if req.project_id and req.project_id not in ("current", ""):
        sb_file = srv.Path(f"outputs/projects/{req.project_id}/storyboard.json")
    else:
        sb_file = srv.Path("outputs/storyboard.json")

    if not sb_file.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy kịch bản của dự án.")

    assigned = assign_location_to_shot(req.shot_id, req.location_id, storyboard_path=sb_file)
    if not assigned:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy phân cảnh '{req.shot_id}' để gán bối cảnh.")

    srv.invalidate_storyboard_cache()
    return {"success": True, "shot_id": req.shot_id, "location_id": req.location_id}

@router.post("/api/locations/generate-preview")
def api_generate_location_preview(req: GenerateLocationPreviewRequest):
    """Generate or synthesize an environmental preview image for a location."""
    loc_dir = srv.Path("outputs/locations")
    loc_dir.mkdir(parents=True, exist_ok=True)
    out_file = loc_dir / f"{req.location_id}.png"

    from studio.images import generate_image_for_shot, _create_fallback_image
    from studio.storyboard import Shot
    prompt = f"Wide angle cinematic architectural establishing photo of {req.environment_dna}, {req.lighting}, {req.color_palette}, photorealistic 8k masterpiece"
    dummy_shot = Shot(
        id=req.location_id,
        chapter=1,
        character_id=None,
        dialogue="",
        image_prompt=prompt,
    )

    try:
        img_path = generate_image_for_shot(
            shot=dummy_shot,
            characters={},
            style="cinematic",
            output_dir=loc_dir,
            aspect_ratio="16:9",
            seed_override=req.seed,
            prompt_override=prompt,
        )
        if not img_path or not img_path.exists():
            _create_fallback_image(out_file, width=1280, height=720, label=f"LOCATION: {req.location_id.upper()}")
    except Exception:
        _create_fallback_image(out_file, width=1280, height=720, label=f"LOCATION: {req.location_id.upper()}")

    preview_url = f"/api/outputs/locations/{req.location_id}.png"

    # Sync into vault.json if present
    vault_file = srv.Path("outputs/locations/vault.json")
    if vault_file.exists():
        try:
            with open(vault_file, "r", encoding="utf-8") as f:
                vault_locs = json.load(f)
            updated = False
            for vl in vault_locs:
                if vl.get("id") == req.location_id:
                    vl["preview_url"] = preview_url
                    updated = True
                    break
            if updated:
                atomic_write_json(vault_file, vault_locs, backup=True)
        except Exception:
            pass

    return {
        "success": True,
        "location_id": req.location_id,
        "preview_url": f"{preview_url}?t={int(time.time())}"
    }

@router.post("/api/locations/upload-preview")
def api_upload_location_preview(req: UploadLocationPreviewRequest):
    """Upload custom reference image for a location."""
    import base64
    loc_dir = srv.Path("outputs/locations")
    loc_dir.mkdir(parents=True, exist_ok=True)
    out_file = loc_dir / f"{req.location_id}.png"

    b64 = req.image_base64
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    try:
        data = base64.b64decode(b64)
        out_file.write_bytes(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi giải mã ảnh bối cảnh: {e}")

    preview_url = f"/api/outputs/locations/{req.location_id}.png"

    vault_file = srv.Path("outputs/locations/vault.json")
    if vault_file.exists():
        try:
            with open(vault_file, "r", encoding="utf-8") as f:
                vault_locs = json.load(f)
            updated = False
            for vl in vault_locs:
                if vl.get("id") == req.location_id:
                    vl["preview_url"] = preview_url
                    updated = True
                    break
            if updated:
                atomic_write_json(vault_file, vault_locs, backup=True)
        except Exception:
            pass

    return {
        "success": True,
        "location_id": req.location_id,
        "preview_url": f"{preview_url}?t={int(time.time())}"
    }
