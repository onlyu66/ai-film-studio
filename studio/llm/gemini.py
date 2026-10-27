import os
import logging
from studio.llm.base import LLMProvider

logger = logging.getLogger(__name__)

class GeminiProvider(LLMProvider):
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required for Gemini provider.")
        # Default to gemini-3.5-flash for maximum stability & speed, or allow GEMINI_MODEL override
        self.model = model or os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")
        try:
            from google import genai
            self.client = genai.Client(api_key=self.api_key)
        except ImportError:
            raise ImportError("google-genai package is required. Install via pip install google-genai")

    def generate(self, system_prompt: str, user_prompt: str) -> str:
        prompt = f"{system_prompt}\n\n{user_prompt}"
        # Candidate models with auto-fallback for 404 (deprecated) and 503 (high demand)
        models_to_try = [self.model]
        for fallback in ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"]:
            if fallback not in models_to_try:
                models_to_try.append(fallback)

        last_error = None
        for m in models_to_try:
            try:
                response = self.client.models.generate_content(
                    model=m,
                    contents=prompt,
                )
                if response and response.text:
                    return response.text
            except Exception as e:
                last_error = e
                err_str = str(e)
                # If model is deprecated (404) or overloaded (503), try next fallback
                if any(code in err_str for code in ["404", "503", "NOT_FOUND", "UNAVAILABLE"]):
                    logger.warning(f"Gemini model '{m}' unavailable ({e}), trying fallback...")
                    continue
                raise e

        if last_error:
            raise last_error
        raise RuntimeError("Failed to generate content with Gemini provider.")
