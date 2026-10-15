import os
import requests
from studio.llm.base import LLMProvider

class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str = None, model: str = "llama3.1"):
        # Inside docker, host is usually host.docker.internal or localhost
        self.base_url = (base_url or os.environ.get("OLLAMA_HOST") or "http://host.docker.internal:11434").rstrip("/")
        self.model = model

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        payload = {
            "model": self.model,
            "system": system_prompt,
            "prompt": user_prompt,
            "stream": False,
        }
        try:
            resp = requests.post(f"{self.base_url}/api/generate", json=payload, timeout=120)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")
        except requests.ConnectionError:
            # Fallback to localhost if host.docker.internal fails
            if "host.docker.internal" in self.base_url:
                fallback_url = "http://localhost:11434"
                resp = requests.post(f"{fallback_url}/api/generate", json=payload, timeout=120)
                resp.raise_for_status()
                return resp.json().get("response", "")
            raise
