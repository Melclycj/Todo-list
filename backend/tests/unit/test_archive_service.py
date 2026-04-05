"""
Unit tests for archive_service.
"""
import uuid
from unittest.mock import AsyncMock

import pytest

import app.models  # noqa: F401
from app.services.archive_service import ArchiveService


def _make_service(task_repo: AsyncMock) -> tuple[ArchiveService, AsyncMock]:
    mock_uow = AsyncMock()
    mock_uow.tasks = task_repo
    mock_uow.commit = AsyncMock()
    return ArchiveService(uow=mock_uow), task_repo


class TestArchiveServiceListArchived:

    @pytest.mark.asyncio
    async def test_list_archived_delegates_to_repo(self):
        """list_archived passes user_id, page, and limit to the repository."""
        mock_repo = AsyncMock()
        mock_repo.list_archived.return_value = ([], 0)
        service, mock_repo = _make_service(mock_repo)

        user_id = uuid.uuid4()
        tasks, total = await service.list_archived(user_id=user_id, page=2, limit=10)

        assert tasks == []
        assert total == 0
        mock_repo.list_archived.assert_called_once_with(
            user_id=user_id, page=2, limit=10
        )

    @pytest.mark.asyncio
    async def test_list_archived_default_pagination(self):
        """Default page=1, limit=20."""
        mock_repo = AsyncMock()
        mock_repo.list_archived.return_value = ([], 0)
        service, mock_repo = _make_service(mock_repo)

        await service.list_archived(user_id=uuid.uuid4())
        call_kwargs = mock_repo.list_archived.call_args[1]
        assert call_kwargs["page"] == 1
        assert call_kwargs["limit"] == 20
