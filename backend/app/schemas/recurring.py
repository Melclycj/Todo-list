import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from app.models.recurring import RecurringFrequency
from app.schemas.topic import TopicResponse


class RecurringTemplateCreateRequest(BaseModel):
    title: str
    description: str | None = None
    frequency: RecurringFrequency
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


class RecurringTemplateUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    frequency: RecurringFrequency | None = None
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


class RecurringTemplateResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str | None
    frequency: RecurringFrequency
    is_active: bool
    next_run_at: datetime
    topics: list[TopicResponse]
    created_at: datetime

    model_config = {"from_attributes": True}
