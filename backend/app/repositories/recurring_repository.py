"""
Recurring template repository — queries for recurring task templates and instances.
"""
import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.recurring import RecurringInstance, RecurringTemplate
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
        topic_ids: list[uuid.UUID] | None = None,
    ) -> RecurringTemplate:
        template = RecurringTemplate(
            user_id=user_id,
            title=title,
            description=description,
            frequency=frequency,
            is_active=is_active,
            next_run_at=next_run_at,
        )
        self._session.add(template)
        await self._session.flush()

        if topic_ids:
            topics_result = await self._session.execute(
                select(Topic).where(Topic.id.in_(topic_ids))
            )
            template.topics = list(topics_result.scalars().all())

        await self._session.commit()
        await self._session.refresh(template)
        return template

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

        await self._session.commit()
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
        """Return active templates whose next_run_at <= now."""
        result = await self._session.execute(
            select(RecurringTemplate)
            .where(RecurringTemplate.is_active.is_(True))
            .where(RecurringTemplate.next_run_at <= now)
            .options(selectinload(RecurringTemplate.topics))
        )
        return list(result.scalars().all())

    async def link_instance(
        self, template_id: uuid.UUID, task_id: uuid.UUID
    ) -> RecurringInstance:
        instance = RecurringInstance(template_id=template_id, task_id=task_id)
        self._session.add(instance)
        await self._session.commit()
        return instance
