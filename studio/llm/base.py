from abc import ABC, abstractmethod

class LLMProvider(ABC):
    """Abstract base class for LLM text generation providers."""

    @abstractmethod
    def generate(self, system_prompt: str, user_prompt: str) -> str:
        """Generate response given a system prompt and user prompt."""
        pass
