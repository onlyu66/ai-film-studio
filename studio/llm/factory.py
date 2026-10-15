from studio.llm.base import LLMProvider
from studio.llm.gemini import GeminiProvider
from studio.llm.groq_provider import GroqProvider
from studio.llm.openai_compat import OpenAICompatProvider
from studio.llm.ollama import OllamaProvider

def create_llm(provider_name: str = "gemini") -> LLMProvider:
    """Instantiate the requested LLM provider."""
    name = (provider_name or "gemini").lower().strip()
    if name == "gemini":
        return GeminiProvider()
    elif name == "groq":
        return GroqProvider()
    elif name in ("openai", "deepseek", "together"):
        return OpenAICompatProvider()
    elif name == "ollama":
        return OllamaProvider()
    else:
        raise ValueError(f"Unknown LLM provider: '{provider_name}'. Supported: gemini, groq, openai, ollama")
