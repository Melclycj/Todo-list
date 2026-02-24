from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: T | None
    error: str | None = None
    meta: PaginationMeta | None = None

    @classmethod
    def ok(cls, data: T, meta: PaginationMeta | None = None) -> "ApiResponse[T]":
        return cls(success=True, data=data, error=None, meta=meta)

    @classmethod
    def fail(cls, error: str) -> "ApiResponse[None]":
        return cls(success=False, data=None, error=error)
