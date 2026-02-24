"""
Topic service — CRUD for user-defined task categories.
"""
import uuid

from app.models.topic import Topic


class TopicService:
    """Handles topic creation, renaming, deletion, and listing."""

    def __init__(self, topic_repo) -> None:
        self._topic_repo = topic_repo

    async def create_topic(self, user_id: uuid.UUID, name: str) -> Topic:
        name = name.strip()
        if not name:
            raise ValueError("Topic name must not be empty")
        if len(name) > 100:
            raise ValueError("Topic name must not exceed 100 characters")

        existing = await self._topic_repo.get_by_name(user_id=user_id, name=name)
        if existing is not None:
            raise ValueError(f"Topic '{name}' already exists")

        return await self._topic_repo.create(user_id=user_id, name=name)

    async def list_topics(self, user_id: uuid.UUID) -> list[Topic]:
        return await self._topic_repo.list_for_user(user_id=user_id)

    async def rename_topic(
        self, topic_id: uuid.UUID, user_id: uuid.UUID, new_name: str
    ) -> Topic:
        new_name = new_name.strip()
        if not new_name:
            raise ValueError("Topic name must not be empty")
        if len(new_name) > 100:
            raise ValueError("Topic name must not exceed 100 characters")

        topic = await self._topic_repo.get_by_id(topic_id)
        if topic is None:
            raise LookupError("Topic not found")
        if topic.user_id != user_id:
            raise PermissionError("Not authorized")

        existing = await self._topic_repo.get_by_name(user_id=user_id, name=new_name)
        if existing is not None and existing.id != topic_id:
            raise ValueError(f"Topic '{new_name}' already exists")

        return await self._topic_repo.update(topic_id, name=new_name)

    async def delete_topic(self, topic_id: uuid.UUID, user_id: uuid.UUID) -> None:
        topic = await self._topic_repo.get_by_id(topic_id)
        if topic is None:
            raise LookupError("Topic not found")
        if topic.user_id != user_id:
            raise PermissionError("Not authorized")
        # Deletion removes the tag from all associated tasks (FK cascade via join table)
        await self._topic_repo.delete(topic_id)
