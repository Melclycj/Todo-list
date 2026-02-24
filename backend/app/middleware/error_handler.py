"""
Global exception handler middleware.
Converts all unhandled exceptions to the standard API response envelope.
"""
import logging

from fastapi import Request, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all exception handler.
    Returns a 500 response with a generic message.
    Logs the full exception for server-side debugging.
    """
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "data": None,
            "error": "An internal server error occurred",
        },
    )


async def not_found_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"success": False, "data": None, "error": "Resource not found"},
    )


async def permission_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"success": False, "data": None, "error": "Not authorized"},
    )


async def value_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"success": False, "data": None, "error": str(exc)},
    )
