"""
Recurring templates router — /api/v1/recurring/*
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user_id
from app.database import get_db
from app.repositories.recurring_repository import RecurringRepository
from app.repositories.task_repository import TaskRepository
from app.schemas.common import ApiResponse
from app.schemas.recurring import (
    RecurringTemplateCreateRequest,
    RecurringTemplateResponse,
    RecurringTemplateUpdateRequest,
)
from app.services.recurring_service import RecurringService

router = APIRouter(prefix="/recurring", tags=["recurring"])


def _get_recurring_service(session: AsyncSession = Depends(get_db)) -> RecurringService:
    return RecurringService(
        template_repo=RecurringRepository(session),
        task_repo=TaskRepository(session),
    )


@router.get("", response_model=ApiResponse[list[RecurringTemplateResponse]])
async def list_recurring(
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: RecurringService = Depends(_get_recurring_service),
):
    templates = await service._template_repo.list_for_user(user_id=user_id)
    return ApiResponse.ok(
        [RecurringTemplateResponse.model_validate(t) for t in templates]
    )


@router.post("", response_model=ApiResponse[RecurringTemplateResponse], status_code=201)
async def create_recurring(
    body: RecurringTemplateCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: RecurringService = Depends(_get_recurring_service),
):
    template, _ = await service.create_template_with_first_instance(
        user_id=user_id,
        title=body.title,
        frequency=body.frequency,
        description=body.description,
        topic_ids=body.topic_ids,
        now=datetime.now(tz=timezone.utc),
    )
    return ApiResponse.ok(RecurringTemplateResponse.model_validate(template))


@router.patch("/{template_id}", response_model=ApiResponse[RecurringTemplateResponse])
async def update_recurring(
    template_id: uuid.UUID,
    body: RecurringTemplateUpdateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: RecurringService = Depends(_get_recurring_service),
):
    template = await service.update_template(
        template_id=template_id,
        user_id=user_id,
        **body.model_dump(exclude_unset=True),
    )
    return ApiResponse.ok(RecurringTemplateResponse.model_validate(template))


@router.delete("/{template_id}", response_model=ApiResponse[None])
async def stop_recurring(
    template_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: RecurringService = Depends(_get_recurring_service),
):
    await service.stop_template(template_id=template_id, user_id=user_id)
    return ApiResponse.ok(None)
