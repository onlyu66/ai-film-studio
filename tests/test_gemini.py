import os
from unittest.mock import MagicMock, patch
import pytest
from studio.llm.gemini import GeminiProvider

def test_gemini_provider_defaults():
    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake-key"}):
        with patch("google.genai.Client") as mock_client:
            provider = GeminiProvider()
            assert provider.model == "gemini-3.5-flash"
            assert provider.api_key == "fake-key"

def test_gemini_provider_env_override():
    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake-key", "GEMINI_MODEL": "gemini-3.5-flash"}):
        with patch("google.genai.Client") as mock_client:
            provider = GeminiProvider()
            assert provider.model == "gemini-3.5-flash"

def test_gemini_provider_missing_key():
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(ValueError, match="GEMINI_API_KEY environment variable is required"):
            GeminiProvider()

def test_gemini_provider_fallback_on_404():
    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake-key"}):
        with patch("google.genai.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            
            # First call with gemini-3.8-flash raises 404 (deprecated)
            # Second call with gemini-3.5-flash succeeds
            response_ok = MagicMock()
            response_ok.text = "Script content generated successfully"
            
            mock_client.models.generate_content.side_effect = [
                Exception("404 NOT_FOUND. Model is no longer available"),
                response_ok
            ]
            
            provider = GeminiProvider()
            result = provider.generate("system prompt", "user prompt")
            assert result == "Script content generated successfully"
            assert mock_client.models.generate_content.call_count == 2
