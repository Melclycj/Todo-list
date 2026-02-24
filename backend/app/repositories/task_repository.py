"""
Task repository — all database queries for tasks.
No business logic here.
"""
import uuid
from datetime import datetime

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.task import Task, TaskStatus, task_topics
from app.models.topic import Topic
from app.services.reminder_service import get_day_window


class TaskRepository:
    """Data-access layer for Task records."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, task_id: uuid.UUID) -> Task | None:
        result = await self._session.execute(
            select(Task)
            .where(Task.id == task_id)
            .options(selectinload(Task.topics))
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        user_id: uuid.UUID,
        title: str,
        description: str | None = None,
        due_date: datetime | None = None,
        status: TaskStatus = TaskStatus.TODO,
        archived: bool = False,
        topic_ids: list[uuid.UUID] | None = None,
    ) -> Task:
        task = Task(
            user_id=user_id,
            title=title,
            description=description,
            due_date=due_date,
            status=status,
            archived=archived,
        )
        self._session.add(task)
        await self._session.flush()  # get the task.id before loading topics

        if topic_ids:
            topics_result = await self._session.execute(
                select(Topic).where(Topic.id.in_(topic_ids))
            )
            task.topics = list(topics_result.scalars().all())

        await self._session.commit()
        await self._session.refresh(task)
        return task

    async def update(self, task_id: uuid.UUID, **fields) -> Task:
        # Remove topic_ids from fields — handled separately
        topic_ids = fields.pop("topic_ids", None)

        if fields:
            fields["updated_at"] = datetime.utcnow()
            await self._session.execute(
                update(Task).where(Task.id == task_id).values(**fields)
            )

        if topic_ids is not None:
            task = await self.get_by_id(task_id)
            topics_result = await self._session.execute(
                select(Topic).where(Topic.id.in_(topic_ids))
            )
            task.topics = list(topics_result.scalars().all())

        await self._session.commit()
        return await self.get_by_id(task_id)

    async def delete(self, task_id: uuid.UUID) -> None:
        task = await self.get_by_id(task_id)
        if task:
            await self._session.delete(task)
            await self._session.commit()

    async def list_active(
        self,
        user_id: uuid.UUID,
        window: str | None = None,
        topic_id: uuid.UUID | None = None,
        q: str | None = None,
        page: int = 1,
        limit: int = 20,
        now: datetime | None = None,
    ) -> tuple[list[Task], int]:
        """
        List non-archived tasks for the user with optional filters.

        Active tasks = status in (todo, in_progress) OR (status=done AND done_at >= today_4am).
        """
        if now is None:
            now = datetime.utcnow()

        today_4am, _ = get_day_window(now)

        # Base condition: active tasks
        active_condition = or_(
            Task.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS]),
            and_(Task.status == TaskStatus.DONE, Task.done_at >= today_4am),
        )
        stmt = (
            select(Task)
            .where(Task.user_id == user_id)
            .where(Task.archived.is_(False))
            .where(active_condition)
            .options(selectinload(Task.topics))
        )

        # Time window filter
        if window == "today":
            _, today_end = get_day_window(now)
            stmt = stmt.where(
                or_(Task.due_date.is_(None) == False, Task.due_date <= today_end)
            ).where(Task.due_date >= today_4am)
        elif window == "3days":
            from datetime import timedelta
            three_days_end = now + timedelta(days=3)
            stmt = stmt.where(Task.due_date.isnot(None)).where(
                Task.due_date <= three_days_end
            )
        elif window == "week":
            from datetime import timedelta
            week_end = now + timedelta(days=7)
            stmt = stmt.where(Task.due_date.isnot(None)).where(
                Task.due_date <= week_end
            )

        # Topic filter
        if topic_id is not None:
            stmt = stmt.where(
                Task.id.in_(
                    select(task_topics.c.task_id).where(
                        task_topics.c.topic_id == topic_id
                    )
                )
            )

        # Search
        if q:
            stmt = stmt.where(Task.title.ilike(f"%{q}%"))

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self._session.execute(count_stmt)
        total = total_result.scalar_one()

        # Sort: ascending due_date (nulls last), then manual_order
        stmt = stmt.order_by(Task.due_date.asc().nulls_last(), Task.manual_order.asc().nulls_last())
        stmt = stmt.offset((page - 1) * limit).limit(limit)

        result = await self._session.execute(stmt)
        return list(result.scalars().all()), total

    async def list_archived(
        self,
        user_id: uuid.UUID,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[list[Task], int]:
        stmt = (
            select(Task)
            .where(Task.user_id == user_id)
            .where(Task.archived.is_(True))
            .options(selectinload(Task.topics))
        )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self._session.execute(count_stmt)).scalar_one()

        stmt = stmt.order_by(Task.archived_at.desc()).offset((page - 1) * limit).limit(limit)
        result = await self._session.execute(stmt)
        return list(result.scalars().all()), total

    async def get_unarchived_done_tasks(self) -> list[Task]:
        """Return all Done tasks that are not yet archived."""
        result = await self._session.execute(
            select(Task)
            .where(Task.status == TaskStatus.DONE)
            .where(Task.archived.is_(False))
        )
        return list(result.scalars().all())

    async def bulk_archive(self, task_ids: list[uuid.UUID]) -> None:
        """Mark all given task IDs as archived."""
        now = datetime.utcnow()
        await self._session.execute(
            update(Task)
            .where(Task.id.in_(task_ids))
            .values(archived=True, archived_at=now)
        )
        await self._session.commit()

    async def count_tasks_in_window(
        self,
        user_id: uuid.UUID,
        window_start: datetime,
        window_end: datetime,
    ) -> int:
        """Count tasks due within the given time window for the user."""
        result = await self._session.execute(
            select(func.count(Task.id))
            .where(Task.user_id == user_id)
            .where(Task.due_date >= window_start)
            .where(Task.due_date < window_end)
            .where(Task.archived.is_(False))
        )
        return result.scalar_one()

    async def count_done_tasks_in_window(
        self,
        user_id: uuid.UUID,
        window_start: datetime,
        window_end: datetime,
    ) -> int:
        """Count Done tasks due within the given time window."""
        result = await self._session.execute(
            select(func.count(Task.id))
            .where(Task.user_id == user_id)
            .where(Task.status == TaskStatus.DONE)
            .where(Task.due_date >= window_start)
            .where(Task.due_date < window_end)
            .where(Task.archived.is_(False))
        )
        return result.scalar_one()
