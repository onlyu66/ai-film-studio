import pytest
import asyncio
import json
from studio.events import ProgressBroadcaster

@pytest.mark.anyio
async def test_progress_broadcaster_subscribe_and_publish():
    broadcaster = ProgressBroadcaster()
    queue = broadcaster.subscribe()
    
    event_payload = {
        "task_id": "test_task_123",
        "stage": "upscale_4k",
        "percent": 45.5,
        "detail": "Processing frame 135/300"
    }
    broadcaster.publish(event_payload)
    
    # Receive from subscriber queue
    received = await asyncio.wait_for(queue.get(), timeout=2.0)
    assert received == event_payload
    
    broadcaster.unsubscribe(queue)
    assert queue not in broadcaster.subscribers

def test_sse_endpoint_registered():
    from fastapi.testclient import TestClient
    from studio.server import app
    client = TestClient(app)
    
    with client.stream("GET", "/api/events/progress") as response:
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]
