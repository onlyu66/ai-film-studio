from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
import asyncio
import json

from studio.events import progress_broadcaster

router = APIRouter(tags=["events"])

@router.get("/api/events/progress")
async def events_progress(request: Request):
    """
    Stream real-time progress events for long-running tasks (4K enhancer, master assembly, etc.)
    via Server-Sent Events (SSE).
    """
    async def event_generator():
        queue = progress_broadcaster.subscribe()
        try:
            # Send initial connection handshake
            yield "event: connected\ndata: {}\n\n"

            while True:
                # Check for client disconnect
                if await request.is_disconnected():
                    break

                try:
                    # Wait for next progress payload with 15-second heartbeat
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            progress_broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.get("/api/system/lipsync-status")
def api_get_lipsync_status():
    """Return health status and availability of local GPU and cloud lip-sync models."""
    from studio.lipsync import check_lipsync_service_status
    return check_lipsync_service_status()
