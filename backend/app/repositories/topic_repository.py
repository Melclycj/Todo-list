"""
Topic repository — queries for user-defined topics.
"""
import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.topic import Topic


class TopicRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, topic_id: uuid.UUID) -> Topic | None:
        result = await self._session.execute(
            select(Topic).where(Topic.id == topic_id)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, user_id: uuid.UUID, name: str) -> Topic | None:
        result = await self._session.execute(
            select(Topic).where(Topic.user_id == user_id, Topic.name == name)
        )
        return result.scalar_one_or_none()

    async def get_by_ids_for_user(
        self, user_id: uuid.UUID, topic_ids: list[uuid.UUID]
    ) -> list[Topic]:
        result = await self._session.execute(
            select(Topic).where(
                Topic.user_id == user_id, Topic.id.in_(topic_ids)
            )
        )
        return list(result.scalars().all())

    async def count_for_user(self, user_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count(Topic.id)).where(Topic.user_id == user_id)
        )
        return result.scalar_one()

    async def list_for_user(self, user_id: uuid.UUID) -> list[Topic]:
        result = await self._session.execute(
            select(Topic)
            .where(Topic.user_id == user_id)
            .order_by(Topic.name.asc())
        )
        return list(result.scalars().all())

    async def create(self, user_id: uuid.UUID, name: str) -> Topic:
        topic = Topic(user_id=user_id, name=name)
        self._session.add(topic)
        await self._session.flush()
        return topic

    async def update(self, topic_id: uuid.UUID, **fields) -> Topic:
        await self._session.execute(
            update(Topic).where(Topic.id == topic_id).values(**fields)
        )
        return await self.get_by_id(topic_id)

    async def delete(self, topic_id: uuid.UUID) -> None:
        topic = await self.get_by_id(topic_id)
        if topic:
            await self._session.delete(topic)
            await self._session.flush()
