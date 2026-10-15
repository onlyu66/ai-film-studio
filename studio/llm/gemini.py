import os
from studio.llm.base import LLMProvider

class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str = None, model: str = "gemini-2.5-flash"):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required for Gemini provider.")
        self.model = model
        try:
            from google import genai
            self.client = genai.Client(api_key=self.api_key)
        except ImportError:
            raise ImportError("google-genai package is required. Install via pip install google-genai")

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        prompt = f"{system_prompt}\n\n{user_prompt}"
        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
        )
        return response.text
