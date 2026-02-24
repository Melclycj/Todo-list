import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class TopicCreateRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Topic name must not be empty")
        if len(v) > 100:
            raise ValueError("Topic name must not exceed 100 characters")
        return v


class TopicRenameRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Topic name must not be empty")
        if len(v) > 100:
            raise ValueError("Topic name must not exceed 100 characters")
        return v


class TopicResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}
