"""
Subtask repository — all database queries for subtasks.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subtask import Subtask
from app.models.task import TaskStatus


class SubtaskRepository:
    """Data-access layer for Subtask records."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, subtask_id: uuid.UUID) -> Subtask | None:
        result = await self._session.execute(
            select(Subtask).where(Subtask.id == subtask_id)
        )
        return result.scalar_one_or_none()

    async def list_by_task_id(self, task_id: uuid.UUID) -> list[Subtask]:
        result = await self._session.execute(
            select(Subtask)
            .where(Subtask.task_id == task_id)
            .order_by(Subtask.sort_order)
        )
        return list(result.scalars().all())

    async def create(
        self,
        task_id: uuid.UUID,
        title: str,
        sort_order: int = 0,
    ) -> Subtask:
        subtask = Subtask(
            task_id=task_id,
            title=title,
            sort_order=sort_order,
        )
        self._session.add(subtask)
        await self._session.flush()
        return subtask

    async def update(self, subtask_id: uuid.UUID, **fields) -> Subtask:
        fields["updated_at"] = datetime.now(tz=timezone.utc)
        await self._session.execute(
            update(Subtask).where(Subtask.id == subtask_id).values(**fields)
        )
        await self._session.flush()
        return await self.get_by_id(subtask_id)

    async def delete(self, subtask_id: uuid.UUID) -> None:
        subtask = await self.get_by_id(subtask_id)
        if subtask:
            await self._session.delete(subtask)
            await self._session.flush()

    async def get_max_sort_order(self, task_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.coalesce(func.max(Subtask.sort_order), -1))
            .where(Subtask.task_id == task_id)
        )
        return result.scalar_one()

    async def count_by_task_id(self, task_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count(Subtask.id)).where(Subtask.task_id == task_id)
        )
        return result.scalar_one()

    async def count_done_by_task_id(self, task_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count(Subtask.id))
            .where(Subtask.task_id == task_id)
            .where(Subtask.status == TaskStatus.DONE)
        )
        return result.scalar_one()
