"""
Archive service — listing and restoring archived tasks.

Note: The actual archiving logic (setting archived=True at 4am) lives in task_service.py.
This service handles the archive *view* and the restore operation.
"""
import uuid

from app.models.task import Task


class ArchiveService:
    """Handles archive view and restore operations."""

    def __init__(self, uow) -> None:
        self._uow = uow

    async def list_archived(
        self,
        user_id: uuid.UUID,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[Task], int]:
        """Return a paginated list of archived tasks for the given user."""
        return await self._uow.tasks.list_archived(
            user_id=user_id, page=page, limit=limit
        )
