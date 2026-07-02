import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator

from app.models.task import TaskStatus


class SubtaskCreateRequest(BaseModel):
    title: str

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title must not be empty")
        if len(v) > 255:
            raise ValueError("Title must not exceed 255 characters")
        return v


class SubtaskUpdateRequest(BaseModel):
    title: str | None = None
    status: TaskStatus | None = None
    sort_order: int | None = None

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


class SubtaskResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    title: str
    status: TaskStatus
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
