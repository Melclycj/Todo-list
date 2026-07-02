"""
Recurring template repository — queries for recurring task templates and instances.
"""
import uuid
from datetime import datetime

from sqlalchemy import delete as sa_delete, insert as sa_insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.recurring import RecurringInstance, RecurringTemplate, recurring_template_topics
from app.models.topic import Topic


class RecurringRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, template_id: uuid.UUID) -> RecurringTemplate | None:
        result = await self._session.execute(
            select(RecurringTemplate)
            .where(RecurringTemplate.id == template_id)
            .options(selectinload(RecurringTemplate.topics))
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        user_id: uuid.UUID,
        title: str,
        description: str | None,
        frequency,
        is_active: bool,
        next_run_at: datetime,
        due_date: datetime | None = None,
        topic_ids: list[uuid.UUID] | None = None,
    ) -> RecurringTemplate:
        template = RecurringTemplate(
            user_id=user_id,
            title=title,
            description=description,
            frequency=frequency,
            is_active=is_active,
            next_run_at=next_run_at,
            due_date=due_date,
        )
        self._session.add(template)
        await self._session.flush()

        if topic_ids:
            valid_ids_result = await self._session.execute(
                select(Topic.id).where(Topic.id.in_(topic_ids))
            )
            valid_ids = valid_ids_result.scalars().all()
            if valid_ids:
                await self._session.execute(
                    sa_insert(recurring_template_topics),
                    [{"template_id": template.id, "topic_id": tid} for tid in valid_ids],
                )

        return await self.get_by_id(template.id)

    async def update(self, template_id: uuid.UUID, **fields) -> RecurringTemplate | None:
        topic_ids = fields.pop("topic_ids", None)

        if fields:
            await self._session.execute(
                update(RecurringTemplate)
                .where(RecurringTemplate.id == template_id)
                .values(**fields)
            )

        if topic_ids is not None:
            template = await self.get_by_id(template_id)
            if template:
                topics_result = await self._session.execute(
                    select(Topic).where(Topic.id.in_(topic_ids))
                )
                template.topics = list(topics_result.scalars().all())

        return await self.get_by_id(template_id)

    async def list_for_user(self, user_id: uuid.UUID) -> list[RecurringTemplate]:
        result = await self._session.execute(
            select(RecurringTemplate)
            .where(RecurringTemplate.user_id == user_id)
            .options(selectinload(RecurringTemplate.topics))
            .order_by(RecurringTemplate.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_due_templates(self, now: datetime) -> list[RecurringTemplate]:
        """Return active templates whose next_run_at <= now, locking rows to prevent duplicate spawning."""
        result = await self._session.execute(
            select(RecurringTemplate)
            .where(RecurringTemplate.is_active.is_(True))
            .where(RecurringTemplate.next_run_at <= now)
            .options(selectinload(RecurringTemplate.topics))
            .with_for_update(skip_locked=True)
        )
        return list(result.scalars().all())

    async def delete(self, template_id: uuid.UUID) -> None:
        """Hard-delete a recurring template, its instance links, and topic associations."""
        await self._session.execute(
            sa_delete(RecurringInstance).where(RecurringInstance.template_id == template_id)
        )
        await self._session.execute(
            sa_delete(recurring_template_topics).where(
                recurring_template_topics.c.template_id == template_id
            )
        )
        await self._session.execute(
            sa_delete(RecurringTemplate).where(RecurringTemplate.id == template_id)
        )

    async def link_instance(
        self, template_id: uuid.UUID, task_id: uuid.UUID
    ) -> RecurringInstance:
        instance = RecurringInstance(template_id=template_id, task_id=task_id)
        self._session.add(instance)
        await self._session.flush()
        return instance
