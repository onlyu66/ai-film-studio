import json
from pathlib import Path
import pytest
from studio.comfyui.manager import WorkflowManager, ComfyUIConfig

def test_list_builtin_workflows():
    manager = WorkflowManager()
    workflows = manager.list_workflows()
    ids = [w.id for w in workflows]
    assert "flux_schnell" in ids
    assert "sdxl_cinematic" in ids
    assert "animatediff_v3" in ids
    assert "wan2_1_i2v" in ids

    # Image vs Video categories
    flux = next(w for w in workflows if w.id == "flux_schnell")
    assert flux.category == "image"
    assert flux.is_builtin is True

    anidiff = next(w for w in workflows if w.id == "animatediff_v3")
    assert anidiff.category == "video"
    assert anidiff.is_builtin is True

def test_workflow_compatibility_check():
    manager = WorkflowManager()
    # Missing VHS_VideoCombine for video workflows, but has standard image nodes
    available_nodes = [
        "KSampler",
        "CheckpointLoaderSimple",
        "SaveImage",
        "EmptyLatentImage",
        "CLIPTextEncode",
        "VAEDecode",
    ]
    workflows = manager.list_workflows(available_nodes=available_nodes)

    anidiff = next(w for w in workflows if w.id == "animatediff_v3")
    assert anidiff.is_compatible is False
    assert "VHS_VideoCombine" in anidiff.missing_nodes

    sdxl = next(w for w in workflows if w.id == "sdxl_cinematic")
    assert sdxl.is_compatible is True
    assert len(sdxl.missing_nodes) == 0

def test_save_and_load_custom_workflow(tmp_path):
    custom_dir = tmp_path / "custom_workflows"
    config_dir = tmp_path / "config"
    manager = WorkflowManager(custom_workflows_dir=custom_dir, config_dir=config_dir)

    sample_wf = {
        "1": {"class_type": "KSampler", "inputs": {}},
        "2": {"class_type": "SaveImage", "inputs": {}},
    }
    info = manager.save_custom_workflow("my_special_lora", sample_wf, category="image")
    assert info.id == "my_special_lora"
    assert info.is_builtin is False

    # Check persistence
    loaded = manager.get_workflow("my_special_lora")
    assert loaded is not None
    assert "1" in loaded

def test_global_and_project_config_persistence(tmp_path):
    config_dir = tmp_path / "config"
    projects_dir = tmp_path / "projects"
    manager = WorkflowManager(config_dir=config_dir, projects_dir=projects_dir)

    # 1. Global config
    cfg = ComfyUIConfig(
        is_image_enabled=True,
        is_video_enabled=False,
        image_workflow="flux_schnell",
        checkpoint="flux-schnell.safetensors",
    )
    manager.save_config(cfg, save_as_global=True)

    loaded_global = manager.get_config()
    assert loaded_global.is_image_enabled is True
    assert loaded_global.checkpoint == "flux-schnell.safetensors"

    # 2. Project-specific override
    proj_cfg = ComfyUIConfig(
        is_image_enabled=True,
        is_video_enabled=True,
        image_workflow="sdxl_cinematic",
        checkpoint="sdxl_film.safetensors",
    )
    manager.save_config(proj_cfg, project_id="proj_123", save_as_global=False)

    loaded_proj = manager.get_config(project_id="proj_123")
    assert loaded_proj.image_workflow == "sdxl_cinematic"
    assert loaded_proj.is_video_enabled is True

    # Global still unchanged
    assert manager.get_config().image_workflow == "flux_schnell"
