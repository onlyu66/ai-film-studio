from typing import Optional, Set, Dict, Any
import asyncio
import json

class ProgressBroadcaster:
    """Thread-safe event pub/sub broadcaster for Server-Sent Events (SSE)."""

    def __init__(self):
        self.subscribers: Set[asyncio.Queue] = set()
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self.subscribers.add(q)
        if self.loop is None:
            try:
                self.loop = asyncio.get_running_loop()
            except RuntimeError:
                pass
        return q

    def unsubscribe(self, queue: asyncio.Queue):
        self.subscribers.discard(queue)

    def publish(self, data: Dict[str, Any]):
        """Publish event dictionary to all active subscriber queues in a thread-safe manner."""
        for q in list(self.subscribers):
            try:
                # If we have an active running event loop, schedule put_nowait thread-safely
                if self.loop and self.loop.is_running():
                    self.loop.call_soon_threadsafe(self._safe_put, q, data)
                else:
                    self._safe_put(q, data)
            except Exception:
                pass

    def _safe_put(self, queue: asyncio.Queue, data: Dict[str, Any]):
        try:
            if queue.full():
                try:
                    queue.get_nowait()
                except Exception:
                    pass
            queue.put_nowait(data)
        except Exception:
            pass

    def emit_progress(self, task_id: str, stage: str, percent: float, detail: Optional[str] = None):
        self.publish({
            "task_id": task_id,
            "stage": stage,
            "percent": round(float(percent), 1),
            "detail": detail or "",
        })

# Global singleton instance
progress_broadcaster = ProgressBroadcaster()
