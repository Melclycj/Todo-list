"""
Unit tests for topic_service.

Business rules:
- Topic names must be unique per user
- Empty or whitespace names are rejected
- Names longer than 100 chars are rejected
- Deleting a topic unlinks it from tasks (no tasks deleted)
- Renaming rejects if name already taken by a different topic
"""
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

import app.models  # noqa: F401
from app.services.topic_service import TopicService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_topic(name: str = "Work", user_id: uuid.UUID | None = None) -> MagicMock:
    topic = MagicMock()
    topic.id = uuid.uuid4()
    topic.user_id = user_id or uuid.uuid4()
    topic.name = name
    return topic


def _make_service(existing_topic: MagicMock | None = None) -> tuple[TopicService, AsyncMock]:
    mock_repo = AsyncMock()
    mock_repo.get_by_name.return_value = existing_topic
    mock_repo.get_by_id.return_value = existing_topic
    mock_repo.create.return_value = existing_topic or _make_topic()
    mock_repo.update.return_value = existing_topic or _make_topic()
    service = TopicService(topic_repo=mock_repo)
    return service, mock_repo


# ---------------------------------------------------------------------------
# create_topic
# ---------------------------------------------------------------------------

class TestTopicServiceCreate:

    @pytest.mark.asyncio
    async def test_create_topic_success(self):
        """Creating a topic with a unique name succeeds."""
        service, mock_repo = _make_service(existing_topic=None)
        user_id = uuid.uuid4()
        new_topic = _make_topic("Work", user_id)
        mock_repo.create.return_value = new_topic

        result = await service.create_topic(user_id=user_id, name="Work")
        mock_repo.create.assert_called_once_with(user_id=user_id, name="Work")
        assert result.name == "Work"

    @pytest.mark.asyncio
    async def test_create_topic_duplicate_name_raises(self):
        """Duplicate topic name for the same user raises ValueError."""
        existing = _make_topic("Work")
        service, _ = _make_service(existing_topic=existing)

        with pytest.raises(ValueError, match="already exists"):
            await service.create_topic(user_id=uuid.uuid4(), name="Work")

    @pytest.mark.asyncio
    async def test_create_topic_empty_name_raises(self):
        service, _ = _make_service()
        with pytest.raises(ValueError, match="must not be empty"):
            await service.create_topic(user_id=uuid.uuid4(), name="")

    @pytest.mark.asyncio
    async def test_create_topic_whitespace_name_raises(self):
        service, _ = _make_service()
        with pytest.raises(ValueError, match="must not be empty"):
            await service.create_topic(user_id=uuid.uuid4(), name="   ")

    @pytest.mark.asyncio
    async def test_create_topic_name_too_long_raises(self):
        service, _ = _make_service(existing_topic=None)
        with pytest.raises(ValueError, match="must not exceed 100"):
            await service.create_topic(user_id=uuid.uuid4(), name="x" * 101)

    @pytest.mark.asyncio
    async def test_create_topic_strips_whitespace(self):
        """Leading/trailing whitespace is stripped from the name."""
        service, mock_repo = _make_service(existing_topic=None)
        new_topic = _make_topic("Work")
        mock_repo.create.return_value = new_topic

        await service.create_topic(user_id=uuid.uuid4(), name="  Work  ")
        mock_repo.create.assert_called_once()
        call_kwargs = mock_repo.create.call_args[1]
        assert call_kwargs["name"] == "Work"


# ---------------------------------------------------------------------------
# list_topics
# ---------------------------------------------------------------------------

class TestTopicServiceList:

    @pytest.mark.asyncio
    async def test_list_topics_returns_all(self):
        topics = [_make_topic("A"), _make_topic("B")]
        service, mock_repo = _make_service()
        mock_repo.list_for_user.return_value = topics

        result = await service.list_topics(user_id=uuid.uuid4())
        assert result == topics


# ---------------------------------------------------------------------------
# rename_topic
# ---------------------------------------------------------------------------

class TestTopicServiceRename:

    @pytest.mark.asyncio
    async def test_rename_topic_success(self):
        user_id = uuid.uuid4()
        topic = _make_topic("Old", user_id=user_id)
        service, mock_repo = _make_service()
        mock_repo.get_by_id.return_value = topic
        mock_repo.get_by_name.return_value = None  # name not taken
        renamed = _make_topic("New", user_id=user_id)
        mock_repo.update.return_value = renamed

        result = await service.rename_topic(
            topic_id=topic.id, user_id=user_id, new_name="New"
        )
        mock_repo.update.assert_called_once_with(topic.id, name="New")

    @pytest.mark.asyncio
    async def test_rename_topic_not_found_raises(self):
        service, mock_repo = _make_service()
        mock_repo.get_by_id.return_value = None

        with pytest.raises(LookupError, match="Topic not found"):
            await service.rename_topic(
                topic_id=uuid.uuid4(), user_id=uuid.uuid4(), new_name="New"
            )

    @pytest.mark.asyncio
    async def test_rename_topic_wrong_user_raises(self):
        topic = _make_topic("Old")  # different user_id
        service, mock_repo = _make_service()
        mock_repo.get_by_id.return_value = topic

        with pytest.raises(PermissionError, match="Not authorized"):
            await service.rename_topic(
                topic_id=topic.id,
                user_id=uuid.uuid4(),  # different user
                new_name="New",
            )

    @pytest.mark.asyncio
    async def test_rename_topic_duplicate_name_raises(self):
        """Cannot rename to a name already used by a different topic."""
        user_id = uuid.uuid4()
        topic = _make_topic("Old", user_id=user_id)
        other_topic = _make_topic("New", user_id=user_id)

        service, mock_repo = _make_service()
        mock_repo.get_by_id.return_value = topic
        mock_repo.get_by_name.return_value = other_topic  # "New" is taken

        with pytest.raises(ValueError, match="already exists"):
            await service.rename_topic(
                topic_id=topic.id, user_id=user_id, new_name="New"
            )

    @pytest.mark.asyncio
    async def test_rename_topic_same_name_is_allowed(self):
        """Renaming to the same name (same topic) is a no-op, not an error."""
        user_id = uuid.uuid4()
        topic = _make_topic("Work", user_id=user_id)

        service, mock_repo = _make_service()
        mock_repo.get_by_id.return_value = topic
        # get_by_name returns the SAME topic (same id)
        mock_repo.get_by_name.return_value = topic
        mock_repo.update.return_value = topic

        # Should not raise
        await service.rename_topic(
            topic_id=topic.id, user_id=user_id, new_name="Work"
        )
        mock_repo.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_rename_topic_empty_name_raises(self):
        user_id = uuid.uuid4()
        topic = _make_topic("Old", user_id=user_id)
        service, mock_repo = _make_service()
        mock_repo.get_by_id.return_value = topic

        with pytest.raises(ValueError, match="must not be empty"):
            await service.rename_topic(
                topic_id=topic.id, user_id=user_id, new_name=""
            )


# ---------------------------------------------------------------------------
# delete_topic
# ---------------------------------------------------------------------------

class TestTopicServiceDelete:

    @pytest.mark.asyncio
    async def test_delete_topic_success(self):
        """Owner can delete their topic."""
        user_id = uuid.uuid4()
        topic = _make_topic("Work", user_id=user_id)
        service, mock_repo = _make_service()
        mock_repo.get_by_id.return_value = topic

        await service.delete_topic(topic_id=topic.id, user_id=user_id)
        mock_repo.delete.assert_called_once_with(topic.id)

    @pytest.mark.asyncio
    async def test_delete_topic_not_found_raises(self):
        service, mock_repo = _make_service()
        mock_repo.get_by_id.return_value = None

        with pytest.raises(LookupError, match="Topic not found"):
            await service.delete_topic(topic_id=uuid.uuid4(), user_id=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_delete_topic_wrong_user_raises(self):
        topic = _make_topic("Work")  # different user
        service, mock_repo = _make_service()
        mock_repo.get_by_id.return_value = topic

        with pytest.raises(PermissionError, match="Not authorized"):
            await service.delete_topic(topic_id=topic.id, user_id=uuid.uuid4())
        mock_repo.delete.assert_not_called()
