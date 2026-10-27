from studio.llm.base import LLMProvider
from studio.llm.gemini import GeminiProvider
from studio.llm.groq_provider import GroqProvider
from studio.llm.openai_compat import OpenAICompatProvider
from studio.llm.ollama import OllamaProvider

def create_llm(provider_name: str = "gemini", api_key: str = None, model: str = None) -> LLMProvider:
    """Instantiate the requested LLM provider with optional custom API key and model."""
    name = (provider_name or "gemini").lower().strip()
    kwargs = {}
    if api_key:
        kwargs["api_key"] = api_key
    if model:
        kwargs["model"] = model

    if name == "gemini":
        return GeminiProvider(**kwargs)
    elif name == "groq":
        return GroqProvider(**kwargs)
    elif name in ("openai", "deepseek", "together"):
        return OpenAICompatProvider(**kwargs)
    elif name == "ollama":
        ollama_kwargs = {}
        if model:
            ollama_kwargs["model"] = model
        return OllamaProvider(**ollama_kwargs)
    else:
        raise ValueError(f"Unknown LLM provider: '{provider_name}'. Supported: gemini, groq, openai, ollama")
