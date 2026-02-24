"""
Unit tests for task_service.

Business rules tested:
- Status transitions: To Do → In Progress → Done → (Reopen) → To Do
- Invalid status transitions are rejected
- done_at is set when transitioning to Done
- Archiving logic: tasks with status=done and done_at before today's 4am boundary
- Title postfix for recurring instances
- Task ownership enforcement (user cannot access another user's task)
- Filter window logic (today / 3days / week / all)
"""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

# Import all models first to ensure SQLAlchemy mapper is fully configured
import app.models  # noqa: F401
from app.models.task import Task, TaskStatus
from app.services.task_service import (
    TaskService,
    build_instance_title,
    is_task_archivable,
    validate_status_transition,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_task(
    status: TaskStatus = TaskStatus.TODO,
    done_at: datetime | None = None,
    archived: bool = False,
    user_id: uuid.UUID | None = None,
    title: str = "Test Task",
) -> Task:
    task = Task()
    task.id = uuid.uuid4()
    task.user_id = user_id or uuid.uuid4()
    task.title = title
    task.description = None
    task.due_date = None
    task.status = status
    task.result_note = None
    task.archived = archived
    task.done_at = done_at
    task.archived_at = None
    task.manual_order = None
    task.topics = []
    return task


# ---------------------------------------------------------------------------
# validate_status_transition
# ---------------------------------------------------------------------------

class TestValidateStatusTransition:
    """Pure function — no DB needed."""

    def test_todo_to_in_progress_is_valid(self):
        validate_status_transition(TaskStatus.TODO, TaskStatus.IN_PROGRESS)

    def test_in_progress_to_done_is_valid(self):
        validate_status_transition(TaskStatus.IN_PROGRESS, TaskStatus.DONE)

    def test_todo_to_done_is_valid(self):
        """Allow skipping In Progress."""
        validate_status_transition(TaskStatus.TODO, TaskStatus.DONE)

    def test_done_to_todo_is_valid_reopen(self):
        """Reopening: Done → To Do is allowed."""
        validate_status_transition(TaskStatus.DONE, TaskStatus.TODO)

    def test_done_to_in_progress_is_invalid(self):
        """Done → In Progress is not a valid direct transition."""
        with pytest.raises(ValueError, match="Invalid status transition"):
            validate_status_transition(TaskStatus.DONE, TaskStatus.IN_PROGRESS)

    def test_same_status_is_invalid(self):
        """Transitioning to the same status should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid status transition"):
            validate_status_transition(TaskStatus.TODO, TaskStatus.TODO)

    def test_in_progress_to_todo_is_invalid(self):
        """In Progress → To Do is not allowed (only Reopen from Done)."""
        with pytest.raises(ValueError, match="Invalid status transition"):
            validate_status_transition(TaskStatus.IN_PROGRESS, TaskStatus.TODO)


# ---------------------------------------------------------------------------
# is_task_archivable
# ---------------------------------------------------------------------------

class TestIsTaskArchivable:
    """Tests for the archiving eligibility check."""

    def _today_4am(self) -> datetime:
        """Return today's 4am UTC boundary."""
        now = datetime(2026, 2, 24, 10, 0, 0, tzinfo=timezone.utc)
        today_4am = now.replace(hour=4, minute=0, second=0, microsecond=0)
        return today_4am

    def test_done_task_with_done_at_before_4am_is_archivable(self):
        """A Done task completed before today's 4am should be archived."""
        # done_at = yesterday at 10pm
        done_at = datetime(2026, 2, 23, 22, 0, 0, tzinfo=timezone.utc)
        today_4am = self._today_4am()
        task = _make_task(status=TaskStatus.DONE, done_at=done_at)
        assert is_task_archivable(task, today_4am) is True

    def test_done_task_with_done_at_after_4am_is_not_archivable(self):
        """A Done task completed after today's 4am should NOT be archived yet."""
        # done_at = today at 9am
        done_at = datetime(2026, 2, 24, 9, 0, 0, tzinfo=timezone.utc)
        today_4am = self._today_4am()
        task = _make_task(status=TaskStatus.DONE, done_at=done_at)
        assert is_task_archivable(task, today_4am) is False

    def test_non_done_task_is_not_archivable(self):
        """Tasks with status other than Done should never be archived."""
        today_4am = self._today_4am()
        for status in [TaskStatus.TODO, TaskStatus.IN_PROGRESS]:
            task = _make_task(status=status)
            assert is_task_archivable(task, today_4am) is False

    def test_already_archived_task_is_not_archivable(self):
        """An already-archived task should not be flagged again."""
        done_at = datetime(2026, 2, 23, 22, 0, 0, tzinfo=timezone.utc)
        today_4am = self._today_4am()
        task = _make_task(status=TaskStatus.DONE, done_at=done_at, archived=True)
        assert is_task_archivable(task, today_4am) is False

    def test_done_task_exactly_at_4am_is_not_archivable(self):
        """A task completed exactly at 4am is in the new window — not archivable."""
        today_4am = self._today_4am()
        task = _make_task(status=TaskStatus.DONE, done_at=today_4am)
        assert is_task_archivable(task, today_4am) is False

    def test_done_task_one_second_before_4am_is_archivable(self):
        """A task completed 1 second before 4am belongs to the previous window."""
        today_4am = self._today_4am()
        done_at = today_4am - timedelta(seconds=1)
        task = _make_task(status=TaskStatus.DONE, done_at=done_at)
        assert is_task_archivable(task, today_4am) is True


# ---------------------------------------------------------------------------
# build_instance_title
# ---------------------------------------------------------------------------

class TestBuildInstanceTitle:
    """Tests for the recurring instance title formatter."""

    def test_weekly_title_has_date_postfix(self):
        title = build_instance_title("Weekly Review", datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc))
        assert title == "Weekly Review – 2026-02-24"

    def test_monthly_title_correct_format(self):
        title = build_instance_title("Monthly Report", datetime(2026, 3, 1, 4, 0, 0, tzinfo=timezone.utc))
        assert title == "Monthly Report – 2026-03-01"

    def test_title_uses_dash_separator(self):
        """Title must use ' – ' (em dash with spaces) as separator."""
        title = build_instance_title("Stand-up", datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc))
        assert " – " in title

    def test_title_preserves_original_title(self):
        """Original title is not modified."""
        original = "My Task With Special Chars: !"
        title = build_instance_title(original, datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc))
        assert title.startswith(original)

    def test_title_with_empty_string_raises(self):
        with pytest.raises(ValueError, match="Title must not be empty"):
            build_instance_title("", datetime(2026, 2, 24, tzinfo=timezone.utc))

    def test_date_format_is_iso_date_only(self):
        """Date postfix must be YYYY-MM-DD only (no time component)."""
        title = build_instance_title("Task", datetime(2026, 12, 31, 23, 59, tzinfo=timezone.utc))
        assert title.endswith("2026-12-31")


# ---------------------------------------------------------------------------
# TaskService (using mocked repository)
# ---------------------------------------------------------------------------

class TestTaskServiceUpdateStatus:
    """Tests for TaskService.update_task_status with mocked repository."""

    def _make_service(self, task: Task) -> tuple[TaskService, AsyncMock]:
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = task
        mock_repo.update.return_value = task
        service = TaskService(task_repo=mock_repo, sse_manager=None)
        return service, mock_repo

    @pytest.mark.asyncio
    async def test_update_status_todo_to_in_progress(self):
        """Valid transition: sets new status."""
        task = _make_task(status=TaskStatus.TODO)
        user_id = task.user_id
        service, mock_repo = self._make_service(task)

        result = await service.update_task_status(
            task_id=task.id,
            user_id=user_id,
            new_status=TaskStatus.IN_PROGRESS,
            result_note=None,
        )
        mock_repo.update.assert_called_once()
        call_kwargs = mock_repo.update.call_args[1]
        assert call_kwargs["status"] == TaskStatus.IN_PROGRESS

    @pytest.mark.asyncio
    async def test_update_status_sets_done_at_when_transitioning_to_done(self):
        """Transitioning to Done sets done_at timestamp."""
        task = _make_task(status=TaskStatus.IN_PROGRESS)
        user_id = task.user_id
        service, mock_repo = self._make_service(task)

        await service.update_task_status(
            task_id=task.id,
            user_id=user_id,
            new_status=TaskStatus.DONE,
            result_note=None,
        )
        call_kwargs = mock_repo.update.call_args[1]
        assert call_kwargs["done_at"] is not None
        assert isinstance(call_kwargs["done_at"], datetime)

    @pytest.mark.asyncio
    async def test_update_status_clears_done_at_when_reopening(self):
        """Reopening (Done → To Do) clears done_at."""
        task = _make_task(
            status=TaskStatus.DONE,
            done_at=datetime(2026, 2, 24, 9, 0, tzinfo=timezone.utc),
        )
        user_id = task.user_id
        service, mock_repo = self._make_service(task)

        await service.update_task_status(
            task_id=task.id,
            user_id=user_id,
            new_status=TaskStatus.TODO,
            result_note=None,
        )
        call_kwargs = mock_repo.update.call_args[1]
        assert call_kwargs["done_at"] is None

    @pytest.mark.asyncio
    async def test_update_status_invalid_transition_raises(self):
        """Invalid transition raises ValueError, no DB write."""
        task = _make_task(status=TaskStatus.DONE)
        user_id = task.user_id
        service, mock_repo = self._make_service(task)

        with pytest.raises(ValueError, match="Invalid status transition"):
            await service.update_task_status(
                task_id=task.id,
                user_id=user_id,
                new_status=TaskStatus.IN_PROGRESS,
                result_note=None,
            )
        mock_repo.update.assert_not_called()

    @pytest.mark.asyncio
    async def test_update_status_wrong_user_raises(self):
        """A user cannot update another user's task."""
        task = _make_task(status=TaskStatus.TODO)
        wrong_user_id = uuid.uuid4()  # different user
        service, mock_repo = self._make_service(task)

        with pytest.raises(PermissionError, match="Not authorized"):
            await service.update_task_status(
                task_id=task.id,
                user_id=wrong_user_id,
                new_status=TaskStatus.IN_PROGRESS,
                result_note=None,
            )

    @pytest.mark.asyncio
    async def test_update_status_task_not_found_raises(self):
        """Raises LookupError when task doesn't exist."""
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = None
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        with pytest.raises(LookupError, match="Task not found"):
            await service.update_task_status(
                task_id=uuid.uuid4(),
                user_id=uuid.uuid4(),
                new_status=TaskStatus.IN_PROGRESS,
                result_note=None,
            )

    @pytest.mark.asyncio
    async def test_update_status_stores_result_note_with_done(self):
        """result_note is persisted when transitioning to Done."""
        task = _make_task(status=TaskStatus.IN_PROGRESS)
        user_id = task.user_id
        service, mock_repo = self._make_service(task)

        await service.update_task_status(
            task_id=task.id,
            user_id=user_id,
            new_status=TaskStatus.DONE,
            result_note="Finished the report",
        )
        call_kwargs = mock_repo.update.call_args[1]
        assert call_kwargs["result_note"] == "Finished the report"

    @pytest.mark.asyncio
    async def test_update_status_does_not_archive_immediately(self):
        """Setting a task to Done does NOT immediately set archived=True."""
        task = _make_task(status=TaskStatus.IN_PROGRESS)
        user_id = task.user_id
        service, mock_repo = self._make_service(task)

        await service.update_task_status(
            task_id=task.id,
            user_id=user_id,
            new_status=TaskStatus.DONE,
            result_note=None,
        )
        call_kwargs = mock_repo.update.call_args[1]
        # archived should NOT be set to True here; archiving happens via scheduler
        assert call_kwargs.get("archived", False) is False


class TestTaskServiceCreateTask:
    """Tests for TaskService.create_task."""

    def _make_service(self) -> tuple[TaskService, AsyncMock]:
        mock_repo = AsyncMock()
        mock_topic_repo = AsyncMock()
        mock_topic_repo.get_by_ids_for_user.return_value = []
        service = TaskService(
            task_repo=mock_repo,
            sse_manager=None,
            topic_repo=mock_topic_repo,
        )
        return service, mock_repo

    @pytest.mark.asyncio
    async def test_create_task_minimal(self):
        """Creating a task with just a title succeeds."""
        service, mock_repo = self._make_service()
        user_id = uuid.uuid4()
        created_task = _make_task(title="New Task", user_id=user_id)
        mock_repo.create.return_value = created_task

        result = await service.create_task(
            user_id=user_id,
            title="New Task",
        )
        mock_repo.create.assert_called_once()
        assert result.title == "New Task"

    @pytest.mark.asyncio
    async def test_create_task_empty_title_raises(self):
        """Empty title raises ValueError."""
        service, _ = self._make_service()

        with pytest.raises(ValueError, match="Title must not be empty"):
            await service.create_task(user_id=uuid.uuid4(), title="")

    @pytest.mark.asyncio
    async def test_create_task_whitespace_title_raises(self):
        """Whitespace-only title raises ValueError."""
        service, _ = self._make_service()

        with pytest.raises(ValueError, match="Title must not be empty"):
            await service.create_task(user_id=uuid.uuid4(), title="   ")

    @pytest.mark.asyncio
    async def test_create_task_default_status_is_todo(self):
        """New tasks start with status TODO."""
        service, mock_repo = self._make_service()
        user_id = uuid.uuid4()
        created_task = _make_task(user_id=user_id, status=TaskStatus.TODO)
        mock_repo.create.return_value = created_task

        await service.create_task(user_id=user_id, title="Task")

        call_kwargs = mock_repo.create.call_args[1]
        assert call_kwargs["status"] == TaskStatus.TODO

    @pytest.mark.asyncio
    async def test_create_task_not_archived_by_default(self):
        """New tasks are not archived."""
        service, mock_repo = self._make_service()
        user_id = uuid.uuid4()
        created_task = _make_task(user_id=user_id)
        mock_repo.create.return_value = created_task

        await service.create_task(user_id=user_id, title="Task")

        call_kwargs = mock_repo.create.call_args[1]
        assert call_kwargs["archived"] is False


class TestTaskServiceDeleteTask:
    """Tests for TaskService.delete_task."""

    @pytest.mark.asyncio
    async def test_delete_task_success(self):
        """Task owner can delete their task."""
        task = _make_task()
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = task
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        await service.delete_task(task_id=task.id, user_id=task.user_id)
        mock_repo.delete.assert_called_once_with(task.id)

    @pytest.mark.asyncio
    async def test_delete_task_wrong_user_raises(self):
        """Non-owner cannot delete a task."""
        task = _make_task()
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = task
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        with pytest.raises(PermissionError, match="Not authorized"):
            await service.delete_task(task_id=task.id, user_id=uuid.uuid4())
        mock_repo.delete.assert_not_called()

    @pytest.mark.asyncio
    async def test_delete_task_not_found_raises(self):
        """LookupError when task doesn't exist."""
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = None
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        with pytest.raises(LookupError, match="Task not found"):
            await service.delete_task(task_id=uuid.uuid4(), user_id=uuid.uuid4())


class TestTaskServiceArchiving:
    """Tests for TaskService.archive_done_tasks (scheduler job logic)."""

    @pytest.mark.asyncio
    async def test_archive_done_tasks_archives_eligible_tasks(self):
        """The service archives all done tasks whose done_at < today's 4am."""
        today_4am = datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)

        # 2 archivable tasks (done before 4am)
        task1 = _make_task(
            status=TaskStatus.DONE,
            done_at=datetime(2026, 2, 23, 22, 0, tzinfo=timezone.utc),
        )
        task2 = _make_task(
            status=TaskStatus.DONE,
            done_at=datetime(2026, 2, 24, 1, 0, tzinfo=timezone.utc),
        )
        # 1 NOT archivable (done after 4am today)
        task3 = _make_task(
            status=TaskStatus.DONE,
            done_at=datetime(2026, 2, 24, 9, 0, tzinfo=timezone.utc),
        )

        mock_repo = AsyncMock()
        mock_repo.get_unarchived_done_tasks.return_value = [task1, task2, task3]
        mock_repo.bulk_archive.return_value = None

        service = TaskService(task_repo=mock_repo, sse_manager=None)
        archived_count = await service.archive_done_tasks(today_4am=today_4am)

        assert archived_count == 2
        archived_ids = set(mock_repo.bulk_archive.call_args[0][0])
        assert task1.id in archived_ids
        assert task2.id in archived_ids
        assert task3.id not in archived_ids

    @pytest.mark.asyncio
    async def test_archive_done_tasks_no_tasks(self):
        """When there are no done tasks, nothing is archived."""
        mock_repo = AsyncMock()
        mock_repo.get_unarchived_done_tasks.return_value = []
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        count = await service.archive_done_tasks(
            today_4am=datetime(2026, 2, 24, 4, 0, 0, tzinfo=timezone.utc)
        )
        assert count == 0
        mock_repo.bulk_archive.assert_not_called()


class TestTaskServiceGetTask:
    """Tests for TaskService.get_task."""

    @pytest.mark.asyncio
    async def test_get_task_success(self):
        """Owner can fetch their own task."""
        task = _make_task()
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = task
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        result = await service.get_task(task_id=task.id, user_id=task.user_id)
        assert result is task

    @pytest.mark.asyncio
    async def test_get_task_not_found_raises(self):
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = None
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        with pytest.raises(LookupError, match="Task not found"):
            await service.get_task(task_id=uuid.uuid4(), user_id=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_get_task_wrong_user_raises(self):
        task = _make_task()
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = task
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        with pytest.raises(PermissionError, match="Not authorized"):
            await service.get_task(task_id=task.id, user_id=uuid.uuid4())


class TestTaskServiceListTasks:
    """Tests for TaskService.list_tasks."""

    @pytest.mark.asyncio
    async def test_list_tasks_delegates_to_repo(self):
        """list_tasks passes all parameters through to the repository."""
        mock_repo = AsyncMock()
        mock_repo.list_active.return_value = ([], 0)
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        user_id = uuid.uuid4()
        now = datetime(2026, 2, 24, 10, 0, 0, tzinfo=timezone.utc)
        tasks, total = await service.list_tasks(
            user_id=user_id,
            window="today",
            page=1,
            limit=20,
            now=now,
        )
        assert tasks == []
        assert total == 0
        mock_repo.list_active.assert_called_once()
        call_kwargs = mock_repo.list_active.call_args[1]
        assert call_kwargs["user_id"] == user_id
        assert call_kwargs["window"] == "today"

    @pytest.mark.asyncio
    async def test_list_tasks_uses_utc_now_when_not_provided(self):
        """When now is not provided, the service uses the current UTC time."""
        mock_repo = AsyncMock()
        mock_repo.list_active.return_value = ([], 0)
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        await service.list_tasks(user_id=uuid.uuid4())
        call_kwargs = mock_repo.list_active.call_args[1]
        assert call_kwargs["now"] is not None
        # now should be timezone-aware
        assert call_kwargs["now"].tzinfo is not None


class TestTaskServiceUpdateTask:
    """Tests for TaskService.update_task (generic field update)."""

    @pytest.mark.asyncio
    async def test_update_task_success(self):
        task = _make_task()
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = task
        updated = _make_task(title="Updated", user_id=task.user_id)
        mock_repo.update.return_value = updated
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        result = await service.update_task(
            task_id=task.id, user_id=task.user_id, title="Updated"
        )
        assert result.title == "Updated"

    @pytest.mark.asyncio
    async def test_update_task_not_found_raises(self):
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = None
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        with pytest.raises(LookupError, match="Task not found"):
            await service.update_task(
                task_id=uuid.uuid4(), user_id=uuid.uuid4(), title="x"
            )

    @pytest.mark.asyncio
    async def test_update_task_wrong_user_raises(self):
        task = _make_task()
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = task
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        with pytest.raises(PermissionError, match="Not authorized"):
            await service.update_task(
                task_id=task.id, user_id=uuid.uuid4(), title="x"
            )


class TestTaskServiceUpdateOrder:
    """Tests for TaskService.update_task_order."""

    @pytest.mark.asyncio
    async def test_update_task_order_success(self):
        task = _make_task()
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = task
        updated = _make_task(user_id=task.user_id)
        updated.manual_order = 5
        mock_repo.update.return_value = updated
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        result = await service.update_task_order(
            task_id=task.id, user_id=task.user_id, manual_order=5
        )
        mock_repo.update.assert_called_once_with(task.id, manual_order=5)

    @pytest.mark.asyncio
    async def test_update_task_order_not_found_raises(self):
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = None
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        with pytest.raises(LookupError, match="Task not found"):
            await service.update_task_order(
                task_id=uuid.uuid4(), user_id=uuid.uuid4(), manual_order=1
            )

    @pytest.mark.asyncio
    async def test_update_task_order_wrong_user_raises(self):
        task = _make_task()
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = task
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        with pytest.raises(PermissionError, match="Not authorized"):
            await service.update_task_order(
                task_id=task.id, user_id=uuid.uuid4(), manual_order=1
            )


class TestTaskServiceRestoreTask:
    """Tests for TaskService.restore_task."""

    @pytest.mark.asyncio
    async def test_restore_task_success(self):
        """Archived task can be restored by its owner."""
        task = _make_task(
            status=TaskStatus.DONE,
            done_at=datetime(2026, 2, 23, 22, 0, tzinfo=timezone.utc),
            archived=True,
        )
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = task
        restored = _make_task(user_id=task.user_id, status=TaskStatus.TODO, archived=False)
        mock_repo.update.return_value = restored
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        result = await service.restore_task(task_id=task.id, user_id=task.user_id)
        call_kwargs = mock_repo.update.call_args[1]
        assert call_kwargs["archived"] is False
        assert call_kwargs["status"] == TaskStatus.TODO
        assert call_kwargs["done_at"] is None

    @pytest.mark.asyncio
    async def test_restore_task_not_archived_raises(self):
        """Cannot restore a task that is not archived."""
        task = _make_task(archived=False)
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = task
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        with pytest.raises(ValueError, match="Task is not archived"):
            await service.restore_task(task_id=task.id, user_id=task.user_id)

    @pytest.mark.asyncio
    async def test_restore_task_not_found_raises(self):
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = None
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        with pytest.raises(LookupError, match="Task not found"):
            await service.restore_task(task_id=uuid.uuid4(), user_id=uuid.uuid4())

    @pytest.mark.asyncio
    async def test_restore_task_wrong_user_raises(self):
        task = _make_task(archived=True, status=TaskStatus.DONE)
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = task
        service = TaskService(task_repo=mock_repo, sse_manager=None)

        with pytest.raises(PermissionError, match="Not authorized"):
            await service.restore_task(task_id=task.id, user_id=uuid.uuid4())


class TestTaskServiceSseNotification:
    """Tests for SSE notification after status change."""

    @pytest.mark.asyncio
    async def test_sse_manager_notified_after_status_change(self):
        """SSE manager is called after a successful status transition."""
        task = _make_task(status=TaskStatus.TODO)
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = task
        mock_repo.update.return_value = task

        mock_sse = AsyncMock()
        service = TaskService(task_repo=mock_repo, sse_manager=mock_sse)

        await service.update_task_status(
            task_id=task.id,
            user_id=task.user_id,
            new_status=TaskStatus.IN_PROGRESS,
            result_note=None,
        )
        mock_sse.notify_user.assert_called_once_with(task.user_id)

    @pytest.mark.asyncio
    async def test_title_too_long_raises(self):
        """Title exceeding 255 chars raises ValueError."""
        service = TaskService(task_repo=AsyncMock(), sse_manager=None)
        with pytest.raises(ValueError, match="Title must not exceed 255 characters"):
            await service.create_task(user_id=uuid.uuid4(), title="x" * 256)
