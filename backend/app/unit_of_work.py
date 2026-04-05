"""
Unit of Work — owns the transaction boundary.

Services use UnitOfWork to access repositories and call commit() once
all writes for a logical operation are complete.
"""
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.recurring_repository import RecurringRepository
from app.repositories.task_repository import TaskRepository
from app.repositories.topic_repository import TopicRepository
from app.repositories.user_repository import RefreshTokenRepository, UserRepository


class UnitOfWork:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self.tasks = TaskRepository(session)
        self.topics = TopicRepository(session)
        self.users = UserRepository(session)
        self.tokens = RefreshTokenRepository(session)
        self.templates = RecurringRepository(session)

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()
