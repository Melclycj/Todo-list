"""
Access log middleware.

Emits one structured JSON log line per request after the response is sent:

  {
    "message":    "http.request",
    "method":     "POST",
    "path":       "/api/v1/tasks",
    "status":     201,
    "duration_ms": 14,
    "request_id": "uuid-...",
    "user_id":    "uuid-..."   // present only on authenticated routes
  }

Skipped for the /api/health endpoint to avoid log spam from uptime monitors.
"""
import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

_SKIP_PATHS = {"/api/health"}


class AccessLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in _SKIP_PATHS:
            return await call_next(request)

        start = time.monotonic()
        response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000)

        extra: dict = {
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
            "request_id": getattr(request.state, "request_id", None),
        }

        user_id = getattr(request.state, "user_id", None)
        if user_id is not None:
            extra["user_id"] = str(user_id)

        logger.info("http.request", extra=extra)
        return response
