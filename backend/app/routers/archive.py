"""
Archive router — /api/v1/archive/*
"""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_id
from app.database import get_db
from app.repositories.task_repository import TaskRepository
from app.schemas.common import ApiResponse, PaginationMeta
from app.schemas.task import TaskResponse
from app.services.archive_service import ArchiveService
from app.services.task_service import TaskService
from app.sse.connection_manager import sse_manager

router = APIRouter(prefix="/archive", tags=["archive"])


def _get_archive_service(session: AsyncSession = Depends(get_db)) -> ArchiveService:
    return ArchiveService(task_repo=TaskRepository(session))


def _get_task_service(session: AsyncSession = Depends(get_db)) -> TaskService:
    return TaskService(task_repo=TaskRepository(session), sse_manager=sse_manager)


@router.get("", response_model=ApiResponse[list[TaskResponse]])
async def list_archived(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=30),
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: ArchiveService = Depends(_get_archive_service),
):
    tasks, total = await service.list_archived(
        user_id=user_id, page=page, limit=limit
    )
    return ApiResponse.ok(
        [TaskResponse.model_validate(t) for t in tasks],
        meta=PaginationMeta(total=total, page=page, limit=limit),
    )


@router.post("/{task_id}/restore", response_model=ApiResponse[TaskResponse])
async def restore_task(
    task_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: TaskService = Depends(_get_task_service),
):
    task = await service.restore_task(task_id=task_id, user_id=user_id)
    return ApiResponse.ok(TaskResponse.model_validate(task))
