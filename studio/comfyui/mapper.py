"""Smart In-Place Node Graph Parameter Mapper for ComfyUI API Graphs."""

from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class DetectedNodes:
    positive_prompt_id: Optional[str] = None
    negative_prompt_id: Optional[str] = None
    sampler_id: Optional[str] = None
    latent_id: Optional[str] = None
    checkpoint_id: Optional[str] = None
    lora_id: Optional[str] = None
    load_image_id: Optional[str] = None
    output_id: Optional[str] = None
    video_output_id: Optional[str] = None


class SmartNodeMapper:
    """Intelligently detects core nodes and performs safe in-place parameter mutations."""

    SAMPLER_CLASSES = {
        "KSampler",
        "KSamplerAdvanced",
        "SamplerCustomAdvanced",
        "KSamplerSelect",
    }
    CHECKPOINT_CLASSES = {
        "CheckpointLoaderSimple",
        "CheckpointLoader",
        "UNETLoader",
    }
    LORA_CLASSES = {
        "LoraLoader",
        "LoraLoaderModelOnly",
    }
    LATENT_CLASSES = {
        "EmptyLatentImage",
        "EmptySD3LatentImage",
        "EmptyFluxLatentImage",
    }
    IMAGE_INPUT_CLASSES = {
        "LoadImage",
        "LoadImageMask",
    }
    IMAGE_OUTPUT_CLASSES = {
        "SaveImage",
        "PreviewImage",
    }
    VIDEO_OUTPUT_CLASSES = {
        "VHS_VideoCombine",
        "SaveAnimatedWEBP",
        "SaveAnimatedPNG",
    }

    def detect_nodes(self, workflow: Dict[str, Any]) -> DetectedNodes:
        """Detects key node IDs from a ComfyUI prompt graph."""
        detected = DetectedNodes()
        clip_text_nodes: List[str] = []

        for node_id, node in workflow.items():
            if not isinstance(node, dict):
                continue
            class_type = node.get("class_type", "")
            inputs = node.get("inputs", {})

            # 1. Sampler detection
            if class_type in self.SAMPLER_CLASSES:
                detected.sampler_id = node_id

                # Trace links for positive/negative prompts
                pos_link = inputs.get("positive")
                if isinstance(pos_link, list) and len(pos_link) > 0:
                    detected.positive_prompt_id = str(pos_link[0])

                neg_link = inputs.get("negative")
                if isinstance(neg_link, list) and len(neg_link) > 0:
                    detected.negative_prompt_id = str(neg_link[0])

                latent_link = inputs.get("latent_image")
                if isinstance(latent_link, list) and len(latent_link) > 0:
                    detected.latent_id = str(latent_link[0])

            # 2. Checkpoint loader
            elif class_type in self.CHECKPOINT_CLASSES:
                detected.checkpoint_id = node_id

            # 3. LoRA loader
            elif class_type in self.LORA_CLASSES:
                detected.lora_id = node_id

            # 4. Latent dimensions
            elif class_type in self.LATENT_CLASSES:
                if not detected.latent_id:
                    detected.latent_id = node_id

            # 5. Load Image (Source for Img2Img and Image-to-Video)
            elif class_type in self.IMAGE_INPUT_CLASSES:
                detected.load_image_id = node_id

            # 6. Video output
            elif class_type in self.VIDEO_OUTPUT_CLASSES:
                detected.video_output_id = node_id
                detected.output_id = node_id

            # 7. Image output
            elif class_type in self.IMAGE_OUTPUT_CLASSES:
                if not detected.video_output_id:
                    detected.output_id = node_id

            # 8. Record text nodes for fallback
            elif class_type == "CLIPTextEncode":
                clip_text_nodes.append(node_id)

        # Fallback for prompt detection if not directly linked via positive/negative
        if not detected.positive_prompt_id and clip_text_nodes:
            detected.positive_prompt_id = clip_text_nodes[0]
            if len(clip_text_nodes) > 1 and not detected.negative_prompt_id:
                detected.negative_prompt_id = clip_text_nodes[1]

        return detected

    def inject_parameters(
        self,
        workflow: Dict[str, Any],
        prompt: str,
        seed: int,
        width: int,
        height: int,
        negative_prompt: str = "",
        image_path: Optional[str] = None,
        checkpoint: Optional[str] = None,
        lora: Optional[str] = None,
        lora_weight: float = 1.0,
        steps: Optional[int] = None,
        cfg: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Performs in-place mutation on a deep copy of the workflow graph."""
        new_wf = deepcopy(workflow)
        detected = self.detect_nodes(new_wf)

        # 1. Positive Prompt
        if detected.positive_prompt_id and detected.positive_prompt_id in new_wf:
            new_wf[detected.positive_prompt_id].setdefault("inputs", {})["text"] = prompt

        # 2. Negative Prompt
        if detected.negative_prompt_id and detected.negative_prompt_id in new_wf and negative_prompt:
            new_wf[detected.negative_prompt_id].setdefault("inputs", {})["text"] = negative_prompt

        # 3. Seed, Steps, CFG on Sampler
        if detected.sampler_id and detected.sampler_id in new_wf:
            inputs = new_wf[detected.sampler_id].setdefault("inputs", {})
            if "seed" in inputs:
                inputs["seed"] = seed
            elif "noise_seed" in inputs:
                inputs["noise_seed"] = seed

            if steps is not None:
                inputs["steps"] = steps
            if cfg is not None:
                inputs["cfg"] = cfg

        # 4. Latent Dimensions (Width & Height)
        if detected.latent_id and detected.latent_id in new_wf:
            inputs = new_wf[detected.latent_id].setdefault("inputs", {})
            if "width" in inputs:
                inputs["width"] = width
            if "height" in inputs:
                inputs["height"] = height

        # 5. Checkpoint Model Name
        if checkpoint and detected.checkpoint_id and detected.checkpoint_id in new_wf:
            inputs = new_wf[detected.checkpoint_id].setdefault("inputs", {})
            if "ckpt_name" in inputs:
                inputs["ckpt_name"] = checkpoint

        # 6. LoRA Model Name & Weights
        if lora and detected.lora_id and detected.lora_id in new_wf:
            inputs = new_wf[detected.lora_id].setdefault("inputs", {})
            if "lora_name" in inputs:
                inputs["lora_name"] = lora
            inputs["strength_model"] = lora_weight
            inputs["strength_clip"] = lora_weight

        # 7. Source Image for Image-to-Video
        if image_path and detected.load_image_id and detected.load_image_id in new_wf:
            inputs = new_wf[detected.load_image_id].setdefault("inputs", {})
            inputs["image"] = image_path

        return new_wf

    def validate_workflow(
        self,
        workflow: Dict[str, Any],
        available_nodes: List[str],
    ) -> List[str]:
        """Returns a list of class_types in the workflow that are not in available_nodes."""
        missing: List[str] = []
        available_set = set(available_nodes)
        for _, node in workflow.items():
            if not isinstance(node, dict):
                continue
            class_type = node.get("class_type")
            if class_type and class_type not in available_set and class_type not in missing:
                missing.append(class_type)
        return missing
