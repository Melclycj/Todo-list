"""
Request ID middleware.

Attaches a UUID to every request as request.state.request_id and echoes
it back in the X-Request-ID response header.  All other middleware and
log calls read from request.state.request_id so every log line for a
single request can be correlated.

If the caller already sends an X-Request-ID header (e.g. from a load
balancer or API gateway), that value is reused instead of generating a
new one.
"""
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
