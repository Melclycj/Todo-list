import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator

from app.models.task import TaskStatus
from app.schemas.topic import TopicResponse


class TaskCreateRequest(BaseModel):
    title: str
    description: str | None = None
    due_date: datetime | None = None
    topic_ids: list[uuid.UUID] = []

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title must not be empty")
        if len(v) > 255:
            raise ValueError("Title must not exceed 255 characters")
        return v


class TaskUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    due_date: datetime | None = None
    topic_ids: list[uuid.UUID] | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Title must not be empty")
            if len(v) > 255:
                raise ValueError("Title must not exceed 255 characters")
        return v


class TaskStatusUpdateRequest(BaseModel):
    status: TaskStatus
    result_note: str | None = None


class TaskOrderUpdateRequest(BaseModel):
    manual_order: int


class TaskResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str | None
    due_date: datetime | None
    status: TaskStatus
    result_note: str | None
    archived: bool
    done_at: datetime | None
    archived_at: datetime | None
    manual_order: int | None
    topics: list[TopicResponse]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskFilterParams(BaseModel):
    window: Literal["today", "3days", "week", "all"] | None = None
    topic_id: uuid.UUID | None = None
    q: str | None = None
    page: int = 1
    limit: int = 20

    @field_validator("limit")
    @classmethod
    def limit_max(cls, v: int) -> int:
        if v > 30:
            return 30
        if v < 1:
            return 1
        return v

    @field_validator("page")
    @classmethod
    def page_min(cls, v: int) -> int:
        if v < 1:
            return 1
        return v
