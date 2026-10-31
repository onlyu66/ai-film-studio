"""ComfyUI Workflow & Configuration Manager."""

import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from studio.comfyui.mapper import SmartNodeMapper

logger = logging.getLogger(__name__)


@dataclass
class WorkflowInfo:
    id: str
    name: str
    category: str  # "image" | "video"
    description: str = ""
    is_builtin: bool = True
    required_nodes: List[str] = field(default_factory=list)
    missing_nodes: List[str] = field(default_factory=list)
    is_compatible: bool = True


@dataclass
class ComfyUIConfig:
    is_image_enabled: bool = False
    is_video_enabled: bool = False
    image_workflow: str = "flux_schnell"
    video_workflow: str = "animatediff_v3"
    checkpoint: Optional[str] = None
    lora: Optional[str] = None
    lora_weight: float = 0.8
    steps: int = 20
    cfg: float = 7.0
    video_frames: int = 16
    video_fps: int = 12

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ComfyUIConfig":
        valid_fields = {f for f in cls.__dataclass_fields__}
        filtered = {k: v for k, v in data.items() if k in valid_fields}
        return cls(**filtered)


class WorkflowManager:
    """Manages built-in workflow templates, custom user workflows, and config persistence."""

    BUILTIN_METADATA = {
        "flux_schnell": {
            "name": "Flux.1 Schnell (Cinematic 4-Step)",
            "category": "image",
            "description": "Ultra fast high-fidelity text-to-image with sharp typography.",
        },
        "sdxl_cinematic": {
            "name": "SDXL Cinematic 35mm",
            "category": "image",
            "description": "Photorealistic cinematic lighting with high prompt fidelity.",
        },
        "animatediff_v3": {
            "name": "AnimateDiff v3 Motion",
            "category": "video",
            "description": "Smooth camera and character movement for 3-4s scene clips.",
        },
        "wan2_1_i2v": {
            "name": "Wan 2.1 I2V Video Generator",
            "category": "video",
            "description": "High resolution fluid video motion from shot stills.",
        },
    }

    def __init__(
        self,
        workflows_dir: Optional[Path] = None,
        custom_workflows_dir: Optional[Path] = None,
        config_dir: Optional[Path] = None,
        projects_dir: Optional[Path] = None,
    ):
        self.workflows_dir = workflows_dir or Path(__file__).parent / "workflows"
        self.custom_workflows_dir = custom_workflows_dir or Path("outputs/comfyui_workflows")
        self.config_dir = config_dir or Path("outputs")
        self.projects_dir = projects_dir or Path("outputs/projects")
        self.mapper = SmartNodeMapper()

        self.custom_workflows_dir.mkdir(parents=True, exist_ok=True)
        self.config_dir.mkdir(parents=True, exist_ok=True)

    def _extract_required_nodes(self, workflow_dict: Dict[str, Any]) -> List[str]:
        nodes: List[str] = []
        for _, node in workflow_dict.items():
            if isinstance(node, dict):
                ct = node.get("class_type")
                if ct and ct not in nodes:
                    nodes.append(ct)
        return nodes

    def list_workflows(
        self, available_nodes: Optional[List[str]] = None
    ) -> List[WorkflowInfo]:
        """Lists both built-in and custom workflows, evaluating node compatibility."""
        results: List[WorkflowInfo] = []

        # 1. Built-in workflows
        if self.workflows_dir.exists():
            for f in sorted(self.workflows_dir.glob("*.json")):
                wf_id = f.stem
                meta = self.BUILTIN_METADATA.get(
                    wf_id,
                    {"name": wf_id.replace("_", " ").title(), "category": "image", "description": ""},
                )
                try:
                    with open(f, "r", encoding="utf-8") as fp:
                        data = json.load(fp)
                    required = self._extract_required_nodes(data)
                    missing = self.mapper.validate_workflow(data, available_nodes) if available_nodes else []
                    results.append(
                        WorkflowInfo(
                            id=wf_id,
                            name=meta["name"],
                            category=meta["category"],
                            description=meta["description"],
                            is_builtin=True,
                            required_nodes=required,
                            missing_nodes=missing,
                            is_compatible=len(missing) == 0,
                        )
                    )
                except Exception as e:
                    logger.warning(f"[WorkflowManager] Error loading builtin workflow {f}: {e}")

        # 2. Custom workflows
        if self.custom_workflows_dir.exists():
            for f in sorted(self.custom_workflows_dir.glob("*.json")):
                wf_id = f.stem
                try:
                    with open(f, "r", encoding="utf-8") as fp:
                        data = json.load(fp)
                    detected = self.mapper.detect_nodes(data)
                    category = "video" if detected.video_output_id else "image"
                    required = self._extract_required_nodes(data)
                    missing = self.mapper.validate_workflow(data, available_nodes) if available_nodes else []
                    results.append(
                        WorkflowInfo(
                            id=wf_id,
                            name=f"Custom: {wf_id.replace('_', ' ').title()}",
                            category=category,
                            description="User uploaded custom workflow graph.",
                            is_builtin=False,
                            required_nodes=required,
                            missing_nodes=missing,
                            is_compatible=len(missing) == 0,
                        )
                    )
                except Exception as e:
                    logger.warning(f"[WorkflowManager] Error loading custom workflow {f}: {e}")

        return results

    def get_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Loads workflow JSON dictionary by ID (built-in or custom)."""
        # Try custom first
        custom_path = self.custom_workflows_dir / f"{workflow_id}.json"
        if custom_path.exists():
            try:
                with open(custom_path, "r", encoding="utf-8") as fp:
                    return json.load(fp)
            except Exception:
                pass

        # Try built-in
        builtin_path = self.workflows_dir / f"{workflow_id}.json"
        if builtin_path.exists():
            try:
                with open(builtin_path, "r", encoding="utf-8") as fp:
                    return json.load(fp)
            except Exception:
                pass

        return None

    def save_custom_workflow(
        self,
        name: str,
        workflow_dict: Dict[str, Any],
        category: str = "image",
        description: str = "",
    ) -> WorkflowInfo:
        """Saves a custom workflow JSON to the custom workflows directory."""
        clean_id = "".join(c if c.isalnum() or c in ("_", "-") else "_" for c in name.lower())
        target_path = self.custom_workflows_dir / f"{clean_id}.json"
        with open(target_path, "w", encoding="utf-8") as fp:
            json.dump(workflow_dict, fp, indent=2)

        required = self._extract_required_nodes(workflow_dict)
        return WorkflowInfo(
            id=clean_id,
            name=f"Custom: {name}",
            category=category,
            description=description or "User uploaded custom workflow graph.",
            is_builtin=False,
            required_nodes=required,
            missing_nodes=[],
            is_compatible=True,
        )

    def get_config(self, project_id: Optional[str] = None) -> ComfyUIConfig:
        """Gets ComfyUI configuration, evaluating project override before global default."""
        # 1. Project override in storyboard.json
        if project_id and project_id != "current":
            proj_storyboard = self.projects_dir / project_id / "storyboard.json"
            if proj_storyboard.exists():
                try:
                    with open(proj_storyboard, "r", encoding="utf-8") as fp:
                        data = json.load(fp)
                    if "comfyui" in data and isinstance(data["comfyui"], dict):
                        return ComfyUIConfig.from_dict(data["comfyui"])
                except Exception:
                    pass

        # 2. Global default
        global_path = self.config_dir / "comfyui_config.json"
        if global_path.exists():
            try:
                with open(global_path, "r", encoding="utf-8") as fp:
                    return ComfyUIConfig.from_dict(json.load(fp))
            except Exception:
                pass

        return ComfyUIConfig()

    def save_config(
        self,
        config: ComfyUIConfig,
        project_id: Optional[str] = None,
        save_as_global: bool = True,
    ) -> None:
        """Saves ComfyUI configuration either as global default or per-project override."""
        if save_as_global:
            global_path = self.config_dir / "comfyui_config.json"
            with open(global_path, "w", encoding="utf-8") as fp:
                json.dump(config.to_dict(), fp, indent=2)

        if project_id and project_id != "current":
            proj_storyboard = self.projects_dir / project_id / "storyboard.json"
            data = {}
            if proj_storyboard.exists():
                try:
                    with open(proj_storyboard, "r", encoding="utf-8") as fp:
                        data = json.load(fp)
                except Exception:
                    data = {}
            data["comfyui"] = config.to_dict()
            try:
                proj_storyboard.parent.mkdir(parents=True, exist_ok=True)
                with open(proj_storyboard, "w", encoding="utf-8") as fp:
                    json.dump(data, fp, indent=2)
            except Exception as e:
                logger.warning(f"[WorkflowManager] Failed to save project comfyui config: {e}")
