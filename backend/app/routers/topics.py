"""
Topics router — /api/v1/topics/*
"""
import uuid

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user_id
from app.database import get_uow
from app.schemas.common import ApiResponse
from app.schemas.topic import TopicCreateRequest, TopicRenameRequest, TopicResponse
from app.services.topic_service import TopicService
from app.unit_of_work import UnitOfWork

router = APIRouter(prefix="/topics", tags=["topics"])


def _get_topic_service(uow: UnitOfWork = Depends(get_uow)) -> TopicService:
    return TopicService(uow=uow)


@router.get("", response_model=ApiResponse[list[TopicResponse]])
async def list_topics(
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: TopicService = Depends(_get_topic_service),
):
    topics = await service.list_topics(user_id=user_id)
    return ApiResponse.ok([TopicResponse.model_validate(t) for t in topics])


@router.post("", response_model=ApiResponse[TopicResponse], status_code=201)
async def create_topic(
    body: TopicCreateRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: TopicService = Depends(_get_topic_service),
):
    topic = await service.create_topic(user_id=user_id, name=body.name)
    return ApiResponse.ok(TopicResponse.model_validate(topic))


@router.patch("/{topic_id}", response_model=ApiResponse[TopicResponse])
async def rename_topic(
    topic_id: uuid.UUID,
    body: TopicRenameRequest,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: TopicService = Depends(_get_topic_service),
):
    topic = await service.rename_topic(
        topic_id=topic_id, user_id=user_id, new_name=body.name
    )
    return ApiResponse.ok(TopicResponse.model_validate(topic))


@router.delete("/{topic_id}", response_model=ApiResponse[None])
async def delete_topic(
    topic_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    service: TopicService = Depends(_get_topic_service),
):
    await service.delete_topic(topic_id=topic_id, user_id=user_id)
    return ApiResponse.ok(None)
