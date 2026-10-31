import pytest
from studio.comfyui.mapper import SmartNodeMapper, DetectedNodes

def test_detect_nodes_standard_graph():
    sample_workflow = {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "cfg": 8,
                "denoise": 1,
                "latent_image": ["5", 0],
                "model": ["4", 0],
                "negative": ["7", 0],
                "positive": ["6", 0],
                "sampler_name": "euler",
                "scheduler": "normal",
                "seed": 42,
                "steps": 20,
            },
        },
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "v1-5-pruned-emaonly.safetensors"},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"batch_size": 1, "height": 512, "width": 512},
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {"clip": ["4", 1], "text": "initial prompt"},
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {"clip": ["4", 1], "text": "blurry, low quality"},
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["3", 0], "vae": ["4", 2]},
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": "Studio", "images": ["8", 0]},
        },
    }
    mapper = SmartNodeMapper()
    detected = mapper.detect_nodes(sample_workflow)
    assert detected.positive_prompt_id == "6"
    assert detected.negative_prompt_id == "7"
    assert detected.sampler_id == "3"
    assert detected.latent_id == "5"
    assert detected.checkpoint_id == "4"
    assert detected.output_id == "9"

def test_inject_parameters():
    sample_workflow = {
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 0,
                "steps": 20,
                "cfg": 7.0,
                "positive": ["6", 0],
                "negative": ["7", 0],
            },
        },
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "old.safetensors"},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 512, "height": 512},
        },
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": "old"}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": "old neg"}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0]}},
    }
    mapper = SmartNodeMapper()
    updated = mapper.inject_parameters(
        sample_workflow,
        prompt="A cinematic cyberpunk street",
        seed=12345,
        width=1024,
        height=576,
        negative_prompt="blurry",
        checkpoint="flux-schnell.safetensors",
        steps=25,
        cfg=6.5,
    )
    assert updated["6"]["inputs"]["text"] == "A cinematic cyberpunk street"
    assert updated["7"]["inputs"]["text"] == "blurry"
    assert updated["3"]["inputs"]["seed"] == 12345
    assert updated["3"]["inputs"]["steps"] == 25
    assert updated["3"]["inputs"]["cfg"] == 6.5
    assert updated["5"]["inputs"]["width"] == 1024
    assert updated["5"]["inputs"]["height"] == 576
    assert updated["4"]["inputs"]["ckpt_name"] == "flux-schnell.safetensors"

def test_detect_image_input_and_video_output():
    video_workflow = {
        "10": {
            "class_type": "LoadImage",
            "inputs": {"image": "old_input.png"},
        },
        "20": {
            "class_type": "VHS_VideoCombine",
            "inputs": {"frame_rate": 16, "images": ["15", 0]},
        },
    }
    mapper = SmartNodeMapper()
    detected = mapper.detect_nodes(video_workflow)
    assert detected.load_image_id == "10"
    assert detected.video_output_id == "20"
    assert detected.output_id == "20"

    updated = mapper.inject_parameters(
        video_workflow,
        prompt="ignorable",
        seed=100,
        width=1280,
        height=720,
        image_path="/path/to/shot_001.png",
    )
    assert updated["10"]["inputs"]["image"] == "/path/to/shot_001.png"

def test_validate_workflow_missing_nodes():
    sample_workflow = {
        "1": {"class_type": "KSampler"},
        "2": {"class_type": "VHS_VideoCombine"},
        "3": {"class_type": "CustomUnknownNodeXYZ"},
    }
    mapper = SmartNodeMapper()
    available = ["KSampler", "VHS_VideoCombine", "SaveImage"]
    missing = mapper.validate_workflow(sample_workflow, available)
    assert missing == ["CustomUnknownNodeXYZ"]
