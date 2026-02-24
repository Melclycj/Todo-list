"""
Reminder router — /api/v1/reminder/*

Endpoints:
- GET /reminder       — single fetch of current message (initial load)
- GET /reminder/stream — SSE stream for push updates
"""
import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_id
from app.database import get_db
from app.repositories.task_repository import TaskRepository
from app.schemas.common import ApiResponse
from app.services.reminder_service import ReminderService
from app.sse.connection_manager import sse_manager

router = APIRouter(prefix="/reminder", tags=["reminder"])


def _get_reminder_service(session: AsyncSession = Depends(get_db)) -> ReminderService:
    return ReminderService(task_repo=TaskRepository(session))


@router.get("", response_model=ApiResponse[str])
async def get_reminder(
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: ReminderService = Depends(_get_reminder_service),
):
    """Single fetch of the current reminder message."""
    message = await service.get_reminder_message(
        user_id=user_id,
        now=datetime.now(tz=timezone.utc),
    )
    return ApiResponse.ok(message)


@router.get("/stream")
async def reminder_stream(
    request: Request,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: ReminderService = Depends(_get_reminder_service),
):
    """
    SSE stream for real-time reminder updates.

    The client opens a persistent connection here.
    The server pushes a new message whenever:
    - A task status changes (triggered via SSEConnectionManager.notify_user)
    - A time boundary is crossed (6pm, 1am — triggered by APScheduler jobs)
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=10)
    sse_manager.add_connection(user_id, queue)

    async def event_generator():
        try:
            # Send initial message immediately
            initial_message = await service.get_reminder_message(
                user_id=user_id,
                now=datetime.now(tz=timezone.utc),
            )
            yield f"data: {initial_message}\n\n"

            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait for a notification or timeout (keep-alive)
                    await asyncio.wait_for(queue.get(), timeout=30.0)
                    # Recompute the current message
                    message = await service.get_reminder_message(
                        user_id=user_id,
                        now=datetime.now(tz=timezone.utc),
                    )
                    yield f"data: {message}\n\n"
                except asyncio.TimeoutError:
                    # Send a keep-alive comment every 30s
                    yield ": keep-alive\n\n"
        finally:
            sse_manager.remove_connection(user_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
