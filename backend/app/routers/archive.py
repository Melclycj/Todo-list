"""
Archive router — /api/v1/archive/*
"""
import uuid

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_user_id
from app.database import get_uow
from app.schemas.common import ApiResponse, PaginationMeta
from app.schemas.task import TaskResponse
from app.services.archive_service import ArchiveService
from app.services.task_service import TaskService
from app.sse.connection_manager import sse_manager
from app.unit_of_work import UnitOfWork

router = APIRouter(prefix="/archive", tags=["archive"])


def _get_archive_service(uow: UnitOfWork = Depends(get_uow)) -> ArchiveService:
    return ArchiveService(uow=uow)


def _get_task_service(uow: UnitOfWork = Depends(get_uow)) -> TaskService:
    return TaskService(uow=uow, sse_manager=sse_manager)


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
