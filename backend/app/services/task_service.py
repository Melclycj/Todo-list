"""
Task service — business logic for task CRUD, status transitions, and archiving.
"""
import uuid
from datetime import datetime, timezone

from app.exceptions import AppError
from app.models.task import Task, TaskStatus


# ---------------------------------------------------------------------------
# Pure helpers (no I/O — fully unit-testable)
# ---------------------------------------------------------------------------

# Valid transitions: {from_status: set_of_allowed_to_statuses}
_VALID_TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
    TaskStatus.TODO: {TaskStatus.IN_PROGRESS, TaskStatus.DONE},
    TaskStatus.IN_PROGRESS: {TaskStatus.DONE},
    TaskStatus.DONE: {TaskStatus.TODO},  # Reopen
}


def validate_status_transition(
    current: TaskStatus, new: TaskStatus
) -> None:
    """
    Raise ValueError if the transition from current → new is not allowed.

    Valid transitions:
    - To Do       → In Progress, Done
    - In Progress → Done
    - Done        → To Do  (Reopen)
    """
    if new == current:
        raise AppError(
            f"Invalid status transition: {current.value} → {new.value} "
            "(same status)"
        )
    allowed = _VALID_TRANSITIONS.get(current, set())
    if new not in allowed:
        raise AppError(
            f"Invalid status transition: {current.value} → {new.value}"
        )


def is_task_archivable(task: Task, today_4am: datetime) -> bool:
    """
    Return True if the task should be archived at the 4am boundary.

    A task is archivable when:
    - status is Done
    - not already archived
    - done_at is strictly before today's 4am boundary
    """
    if task.status != TaskStatus.DONE:
        return False
    if task.archived:
        return False
    if task.done_at is None:
        return False
    return task.done_at < today_4am


def build_instance_title(base_title: str, instance_date: datetime) -> str:
    """
    Build the title for a recurring task instance.

    Format: "<base_title> – YYYY-MM-DD"

    Uses em dash (–) with surrounding spaces as the separator, per FR-06.
    """
    if not base_title or not base_title.strip():
        raise AppError("Title must not be empty")
    date_str = instance_date.strftime("%Y-%m-%d")
    return f"{base_title} \u2013 {date_str}"


# ---------------------------------------------------------------------------
# TaskService
# ---------------------------------------------------------------------------

class TaskService:
    """
    Orchestrates task operations. All business rules live here.

    Dependencies are injected for testability.
    """

    def __init__(self, task_repo, sse_manager=None, topic_repo=None) -> None:
        self._task_repo = task_repo
        self._sse_manager = sse_manager
        self._topic_repo = topic_repo

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    async def create_task(
        self,
        user_id: uuid.UUID,
        title: str,
        description: str | None = None,
        due_date: datetime | None = None,
        topic_ids: list[uuid.UUID] | None = None,
    ) -> Task:
        """Create a new task for the given user."""
        title = title.strip() if title else ""
        if not title:
            raise AppError("Title must not be empty")
        if len(title) > 255:
            raise AppError("Title must not exceed 255 characters")

        task = await self._task_repo.create(
            user_id=user_id,
            title=title,
            description=description,
            due_date=due_date,
            status=TaskStatus.TODO,
            archived=False,
            topic_ids=topic_ids or [],
        )
        return task

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    async def get_task(self, task_id: uuid.UUID, user_id: uuid.UUID) -> Task:
        """Fetch a single task, enforcing ownership."""
        task = await self._task_repo.get_by_id(task_id)
        if task is None:
            raise LookupError("Task not found")
        if task.user_id != user_id:
            raise PermissionError("Not authorized")
        return task

    async def list_tasks(
        self,
        user_id: uuid.UUID,
        window: str | None = None,
        topic_id: uuid.UUID | None = None,
        q: str | None = None,
        page: int = 1,
        limit: int = 20,
        now: datetime | None = None,
    ) -> tuple[list[Task], int]:
        """List active (non-archived) tasks with optional filters."""
        if now is None:
            now = datetime.now(tz=timezone.utc)

        tasks, total = await self._task_repo.list_active(
            user_id=user_id,
            window=window,
            topic_id=topic_id,
            q=q,
            page=page,
            limit=limit,
            now=now,
        )
        return tasks, total

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    async def update_task(
        self,
        task_id: uuid.UUID,
        user_id: uuid.UUID,
        **fields,
    ) -> Task:
        """Update arbitrary fields on a task, enforcing ownership."""
        task = await self._task_repo.get_by_id(task_id)
        if task is None:
            raise LookupError("Task not found")
        if task.user_id != user_id:
            raise PermissionError("Not authorized")
        return await self._task_repo.update(task_id, **fields)

    async def update_task_status(
        self,
        task_id: uuid.UUID,
        user_id: uuid.UUID,
        new_status: TaskStatus,
        result_note: str | None = None,
    ) -> Task:
        """
        Transition a task's status, enforcing valid transitions and ownership.

        Side effects:
        - Sets done_at when transitioning to Done.
        - Clears done_at when reopening (Done → To Do).
        - Sets result_note if provided with a Done transition.
        - Notifies SSE manager so reminder banner updates immediately.
        """
        task = await self._task_repo.get_by_id(task_id)
        if task is None:
            raise LookupError("Task not found")
        if task.user_id != user_id:
            raise PermissionError("Not authorized")

        validate_status_transition(task.status, new_status)

        update_fields: dict = {"status": new_status, "archived": False}

        if new_status == TaskStatus.DONE:
            update_fields["done_at"] = datetime.now(tz=timezone.utc)
            if result_note is not None:
                update_fields["result_note"] = result_note
        elif new_status == TaskStatus.TODO and task.status == TaskStatus.DONE:
            # Reopen: clear done_at and result_note
            update_fields["done_at"] = None
            update_fields["result_note"] = None

        updated_task = await self._task_repo.update(task_id, **update_fields)

        # Notify SSE so reminder banner updates within 1 second (FR-07)
        if self._sse_manager is not None:
            await self._sse_manager.notify_user(user_id)

        return updated_task

    async def update_task_order(
        self,
        task_id: uuid.UUID,
        user_id: uuid.UUID,
        manual_order: int,
    ) -> Task:
        """Update the manual sort order within a same-day group."""
        task = await self._task_repo.get_by_id(task_id)
        if task is None:
            raise LookupError("Task not found")
        if task.user_id != user_id:
            raise PermissionError("Not authorized")
        return await self._task_repo.update(task_id, manual_order=manual_order)

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    async def delete_task(
        self, task_id: uuid.UUID, user_id: uuid.UUID
    ) -> None:
        """Delete a task, enforcing ownership."""
        task = await self._task_repo.get_by_id(task_id)
        if task is None:
            raise LookupError("Task not found")
        if task.user_id != user_id:
            raise PermissionError("Not authorized")
        await self._task_repo.delete(task_id)

    async def bulk_delete_tasks(
        self, user_id: uuid.UUID, task_ids: list[uuid.UUID]
    ) -> int:
        """Delete multiple tasks at once, enforcing ownership. Returns count deleted."""
        if not task_ids:
            raise AppError("No task IDs provided")
        if len(task_ids) > 50:
            raise AppError("Cannot delete more than 50 tasks at once")
        return await self._task_repo.bulk_delete_for_user(task_ids, user_id)

    # ------------------------------------------------------------------
    # Archive (scheduler job)
    # ------------------------------------------------------------------

    async def archive_done_tasks(self, today_4am: datetime) -> int:
        """
        Archive all Done tasks whose done_at is before today's 4am boundary.

        Called by the APScheduler job at 4am daily.

        Returns:
            Number of tasks archived.
        """
        unarchived_done = await self._task_repo.get_unarchived_done_tasks()
        to_archive = [
            task.id
            for task in unarchived_done
            if is_task_archivable(task, today_4am)
        ]
        if to_archive:
            await self._task_repo.bulk_archive(to_archive)
        return len(to_archive)

    # ------------------------------------------------------------------
    # Restore (from archive)
    # ------------------------------------------------------------------

    async def restore_task(
        self, task_id: uuid.UUID, user_id: uuid.UUID
    ) -> Task:
        """Restore an archived task back to active (To Do status)."""
        task = await self._task_repo.get_by_id(task_id)
        if task is None:
            raise LookupError("Task not found")
        if task.user_id != user_id:
            raise PermissionError("Not authorized")
        if not task.archived:
            raise AppError("Task is not archived")
        return await self._task_repo.update(
            task_id,
            archived=False,
            archived_at=None,
            status=TaskStatus.TODO,
            done_at=None,
            result_note=None,
        )
