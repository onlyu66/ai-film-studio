import os
from unittest.mock import MagicMock, patch
import pytest
from studio.llm.discovery import (
    list_gemini_models,
    list_groq_models,
    list_openai_models,
    list_ollama_models,
)

def test_list_gemini_models_missing_key():
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(ValueError, match="Chưa cấu hình GEMINI_API_KEY"):
            list_gemini_models(api_key=None)

def test_list_gemini_models_success():
    with patch("google.genai.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        
        m1 = MagicMock()
        m1.name = "models/gemini-3.5-flash"
        m1.display_name = "Gemini 3.5 Flash"
        m1.supported_generation_methods = ["generateContent"]
        
        m2 = MagicMock()
        m2.name = "models/gemini-embedding-001"
        m2.supported_generation_methods = ["embedContent"]

        mock_client.models.list.return_value = [m1, m2]
        
        models = list_gemini_models(api_key="fake-key")
        assert len(models) == 1
        assert models[0]["id"] == "gemini-3.5-flash"
        assert models[0]["recommended"] is True

def test_list_groq_models():
    with patch("groq.Groq") as mock_groq_cls:
        mock_client = MagicMock()
        mock_groq_cls.return_value = mock_client
        
        m1 = MagicMock()
        m1.id = "llama-3.3-70b-versatile"
        m2 = MagicMock()
        m2.id = "whisper-large-v3"
        
        mock_client.models.list.return_value.data = [m1, m2]
        
        models = list_groq_models(api_key="fake-key")
        assert len(models) == 1
        assert models[0]["id"] == "llama-3.3-70b-versatile"
        assert models[0]["recommended"] is True

def test_list_ollama_models():
    with patch("requests.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "models": [
                {
                    "name": "llama3.2:latest",
                    "details": {"parameter_size": "3.2B", "quantization_level": "Q4_K_M"}
                }
            ]
        }
        mock_get.return_value = mock_resp
        
        models = list_ollama_models()
        assert len(models) == 1
        assert models[0]["id"] == "llama3.2:latest"
