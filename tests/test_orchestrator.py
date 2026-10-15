import inspect
from studio.orchestrator import run_pipeline
from studio.config import StudioConfig

def test_run_pipeline_creates_orchestrator():
    sig = inspect.signature(run_pipeline)
    params = list(sig.parameters.keys())
    assert "config" in params
