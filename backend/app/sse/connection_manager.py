"""
SSE connection manager.
Maintains a per-user registry of active SSE connections.
Used to push updated reminder messages immediately after task status changes.
"""
import asyncio
import uuid
from collections import defaultdict


class SSEConnectionManager:
    """
    Thread-safe registry of active SSE queues, keyed by user_id.

    Each connection is represented by an asyncio.Queue.
    When the service calls notify_user(), a message is put on all queues
    for that user, and each active SSE endpoint consumes from its queue.
    """

    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, list[asyncio.Queue]] = defaultdict(list)

    def add_connection(self, user_id: uuid.UUID, queue: asyncio.Queue) -> None:
        """Register a new SSE connection queue for the user."""
        self._connections[user_id].append(queue)

    def remove_connection(self, user_id: uuid.UUID, queue: asyncio.Queue) -> None:
        """Unregister an SSE connection queue (on disconnect)."""
        try:
            self._connections[user_id].remove(queue)
        except ValueError:
            pass

    async def notify_user(self, user_id: uuid.UUID, message: str = "update") -> None:
        """
        Push a message to all active SSE connections for the given user.
        Non-blocking: dead queues are silently skipped.
        """
        for queue in list(self._connections.get(user_id, [])):
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                pass  # Slow consumer — skip silently

    async def broadcast(self, message: str = "update") -> None:
        """Push a message to ALL connected users (used by scheduler jobs)."""
        for user_id in list(self._connections.keys()):
            await self.notify_user(user_id, message)


# Module-level singleton — shared across the application
sse_manager = SSEConnectionManager()
