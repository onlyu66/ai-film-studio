import os
import requests
from studio.llm.base import LLMProvider

class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str = None, model: str = None):
        self.base_url = (base_url or os.environ.get("OLLAMA_HOST") or "http://ollama:11434").rstrip("/")
        self.model = model or os.environ.get("OLLAMA_MODEL") or "llama3.2"

    def _ensure_model_exists(self) -> None:
        """Check if model exists; auto-pull if missing."""
        try:
            resp = requests.get(f"{self.base_url}/api/tags", timeout=10)
            if resp.status_code == 200:
                models = [m.get("name", "").split(":")[0] for m in resp.json().get("models", [])]
                target_base = self.model.split(":")[0]
                if target_base not in models:
                    print(f"[Ollama] Model '{self.model}' not found in Docker. Auto-downloading (this happens once)...")
                    pull_resp = requests.post(
                        f"{self.base_url}/api/pull",
                        json={"name": self.model, "stream": False},
                        timeout=900
                    )
                    pull_resp.raise_for_status()
                    print(f"[Ollama] Model '{self.model}' downloaded successfully.")
        except Exception:
            pass

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        self._ensure_model_exists()
        payload = {
            "model": self.model,
            "system": system_prompt,
            "prompt": user_prompt,
            "stream": False,
        }
        resp = requests.post(f"{self.base_url}/api/generate", json=payload, timeout=300)
        resp.raise_for_status()
        data = resp.json()
        return data.get("response", "")
