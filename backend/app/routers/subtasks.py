"""
Subtasks router — /api/v1/tasks/{task_id}/subtasks/*
"""
import uuid

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user_id
from app.database import get_uow
from app.schemas.common import ApiResponse
from app.schemas.subtask import (
    SubtaskCreateRequest,
    SubtaskResponse,
    SubtaskUpdateRequest,
)
from app.services.subtask_service import SubtaskService
from app.unit_of_work import UnitOfWork

router = APIRouter(prefix="/tasks/{task_id}/subtasks", tags=["subtasks"])


def _get_subtask_service(uow: UnitOfWork = Depends(get_uow)) -> SubtaskService:
    return SubtaskService(uow=uow)


@router.get("", response_model=ApiResponse[list[SubtaskResponse]])
async def list_subtasks(
    task_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: SubtaskService = Depends(_get_subtask_service),
):
    subtasks = await service.list_subtasks(task_id=task_id, user_id=user_id)
    return ApiResponse.ok([SubtaskResponse.model_validate(s) for s in subtasks])


@router.post("", response_model=ApiResponse[SubtaskResponse], status_code=201)
async def create_subtask(
    task_id: uuid.UUID,
    body: SubtaskCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: SubtaskService = Depends(_get_subtask_service),
):
    subtask = await service.create_subtask(
        task_id=task_id, user_id=user_id, title=body.title
    )
    return ApiResponse.ok(SubtaskResponse.model_validate(subtask))


@router.patch("/{subtask_id}", response_model=ApiResponse[SubtaskResponse])
async def update_subtask(
    task_id: uuid.UUID,
    subtask_id: uuid.UUID,
    body: SubtaskUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: SubtaskService = Depends(_get_subtask_service),
):
    fields = body.model_dump(exclude_unset=True)
    subtask = await service.update_subtask(
        task_id=task_id, subtask_id=subtask_id, user_id=user_id, **fields
    )
    return ApiResponse.ok(SubtaskResponse.model_validate(subtask))


@router.delete("/{subtask_id}", response_model=ApiResponse[None])
async def delete_subtask(
    task_id: uuid.UUID,
    subtask_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: SubtaskService = Depends(_get_subtask_service),
):
    await service.delete_subtask(
        task_id=task_id, subtask_id=subtask_id, user_id=user_id
    )
    return ApiResponse.ok(None)
