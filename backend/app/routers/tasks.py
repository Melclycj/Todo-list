"""
Tasks router — /api/v1/tasks/*
"""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_id
from app.database import get_db
from app.repositories.task_repository import TaskRepository
from app.schemas.common import ApiResponse, PaginationMeta
from app.schemas.task import (
    TaskCreateRequest,
    TaskFilterParams,
    TaskOrderUpdateRequest,
    TaskResponse,
    TaskStatusUpdateRequest,
    TaskUpdateRequest,
)
from app.services.task_service import TaskService
from app.sse.connection_manager import sse_manager

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _get_task_service(session: AsyncSession = Depends(get_db)) -> TaskService:
    return TaskService(
        task_repo=TaskRepository(session),
        sse_manager=sse_manager,
    )


@router.get("", response_model=ApiResponse[list[TaskResponse]])
async def list_tasks(
    window: str | None = Query(None),
    topic_id: uuid.UUID | None = Query(None),
    q: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=30),
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: TaskService = Depends(_get_task_service),
):
    tasks, total = await service.list_tasks(
        user_id=user_id,
        window=window,
        topic_id=topic_id,
        q=q,
        page=page,
        limit=limit,
    )
    return ApiResponse.ok(
        [TaskResponse.model_validate(t) for t in tasks],
        meta=PaginationMeta(total=total, page=page, limit=limit),
    )


@router.post("", response_model=ApiResponse[TaskResponse], status_code=201)
async def create_task(
    body: TaskCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: TaskService = Depends(_get_task_service),
):
    task = await service.create_task(
        user_id=user_id,
        title=body.title,
        description=body.description,
        due_date=body.due_date,
        topic_ids=body.topic_ids,
    )
    return ApiResponse.ok(TaskResponse.model_validate(task))


@router.get("/{task_id}", response_model=ApiResponse[TaskResponse])
async def get_task(
    task_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: TaskService = Depends(_get_task_service),
):
    task = await service.get_task(task_id=task_id, user_id=user_id)
    return ApiResponse.ok(TaskResponse.model_validate(task))


@router.patch("/{task_id}", response_model=ApiResponse[TaskResponse])
async def update_task(
    task_id: uuid.UUID,
    body: TaskUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: TaskService = Depends(_get_task_service),
):
    fields = body.model_dump(exclude_unset=True)
    task = await service.update_task(task_id=task_id, user_id=user_id, **fields)
    return ApiResponse.ok(TaskResponse.model_validate(task))


@router.delete("/{task_id}", response_model=ApiResponse[None])
async def delete_task(
    task_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: TaskService = Depends(_get_task_service),
):
    await service.delete_task(task_id=task_id, user_id=user_id)
    return ApiResponse.ok(None)


@router.patch("/{task_id}/status", response_model=ApiResponse[TaskResponse])
async def update_task_status(
    task_id: uuid.UUID,
    body: TaskStatusUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: TaskService = Depends(_get_task_service),
):
    task = await service.update_task_status(
        task_id=task_id,
        user_id=user_id,
        new_status=body.status,
        result_note=body.result_note,
    )
    return ApiResponse.ok(TaskResponse.model_validate(task))


@router.patch("/{task_id}/order", response_model=ApiResponse[TaskResponse])
async def update_task_order(
    task_id: uuid.UUID,
    body: TaskOrderUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: TaskService = Depends(_get_task_service),
):
    task = await service.update_task_order(
        task_id=task_id,
        user_id=user_id,
        manual_order=body.manual_order,
    )
    return ApiResponse.ok(TaskResponse.model_validate(task))
