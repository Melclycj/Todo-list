"""
Recurring templates router — /api/v1/recurring/*
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user_id
from app.database import get_uow
from app.schemas.common import ApiResponse
from app.schemas.recurring import (
    RecurringTemplateCreateRequest,
    RecurringTemplateResponse,
    RecurringTemplateUpdateRequest,
)
from app.services.recurring_service import RecurringService
from app.unit_of_work import UnitOfWork

router = APIRouter(prefix="/recurring", tags=["recurring"])


def _get_recurring_service(uow: UnitOfWork = Depends(get_uow)) -> RecurringService:
    return RecurringService(uow=uow)


@router.get("", response_model=ApiResponse[list[RecurringTemplateResponse]])
async def list_recurring(
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: RecurringService = Depends(_get_recurring_service),
):
    templates = await service.list_templates(user_id=user_id)
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
        due_date=body.due_date,
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
