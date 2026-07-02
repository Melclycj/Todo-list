"""
Subtask service — business logic for subtask CRUD and parent status derivation.
"""
import logging
import uuid
from datetime import datetime, timezone

from app.exceptions import AppError
from app.models.subtask import Subtask
from app.models.task import TaskStatus

logger = logging.getLogger(__name__)


class SubtaskService:
    def __init__(self, uow) -> None:
        self._uow = uow

    async def _get_parent_task_for_user(self, task_id: uuid.UUID, user_id: uuid.UUID):
        """Load the parent task and verify ownership."""
        task = await self._uow.tasks.get_by_id(task_id)
        if task is None:
            raise LookupError("Task not found")
        if task.user_id != user_id:
            raise PermissionError("Not authorized")
        return task

    async def _sync_parent_status(self, task_id: uuid.UUID) -> None:
        """Auto-update parent task status based on subtask completion."""
        total = await self._uow.subtasks.count_by_task_id(task_id)
        if total == 0:
            return
        done = await self._uow.subtasks.count_done_by_task_id(task_id)
        task = await self._uow.tasks.get_by_id(task_id)

        if done == total and task.status != TaskStatus.DONE:
            await self._uow.tasks.update(
                task_id,
                status=TaskStatus.DONE,
                done_at=datetime.now(tz=timezone.utc),
            )
        elif done < total and task.status == TaskStatus.DONE:
            await self._uow.tasks.update(
                task_id,
                status=TaskStatus.IN_PROGRESS,
                done_at=None,
                result_note=None,
            )
        elif done > 0 and task.status == TaskStatus.TODO:
            await self._uow.tasks.update(task_id, status=TaskStatus.IN_PROGRESS)

    async def create_subtask(
        self,
        task_id: uuid.UUID,
        user_id: uuid.UUID,
        title: str,
    ) -> Subtask:
        title = title.strip() if title else ""
        if not title:
            raise AppError("Title must not be empty")
        if len(title) > 255:
            raise AppError("Title must not exceed 255 characters")

        await self._get_parent_task_for_user(task_id, user_id)

        max_order = await self._uow.subtasks.get_max_sort_order(task_id)
        subtask = await self._uow.subtasks.create(
            task_id=task_id,
            title=title,
            sort_order=max_order + 1,
        )
        await self._uow.commit()
        logger.info(
            "subtask.created",
            extra={"task_id": str(task_id), "subtask_id": str(subtask.id)},
        )
        return subtask

    async def list_subtasks(
        self, task_id: uuid.UUID, user_id: uuid.UUID
    ) -> list[Subtask]:
        await self._get_parent_task_for_user(task_id, user_id)
        return await self._uow.subtasks.list_by_task_id(task_id)

    async def update_subtask(
        self,
        task_id: uuid.UUID,
        subtask_id: uuid.UUID,
        user_id: uuid.UUID,
        **fields,
    ) -> Subtask:
        await self._get_parent_task_for_user(task_id, user_id)

        subtask = await self._uow.subtasks.get_by_id(subtask_id)
        if subtask is None or subtask.task_id != task_id:
            raise LookupError("Subtask not found")

        update_fields = {k: v for k, v in fields.items() if v is not None}
        if not update_fields:
            return subtask

        result = await self._uow.subtasks.update(subtask_id, **update_fields)
        await self._sync_parent_status(task_id)
        await self._uow.commit()
        return result

    async def delete_subtask(
        self,
        task_id: uuid.UUID,
        subtask_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        await self._get_parent_task_for_user(task_id, user_id)

        subtask = await self._uow.subtasks.get_by_id(subtask_id)
        if subtask is None or subtask.task_id != task_id:
            raise LookupError("Subtask not found")

        await self._uow.subtasks.delete(subtask_id)
        await self._sync_parent_status(task_id)
        await self._uow.commit()
        logger.info(
            "subtask.deleted",
            extra={"task_id": str(task_id), "subtask_id": str(subtask_id)},
        )
