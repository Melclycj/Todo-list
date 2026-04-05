"""
FastAPI application entry point.

- Registers all routers under /api/v1/
- Attaches global exception handlers
- Starts APScheduler as a lifespan event
"""
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import Depends, FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.exceptions import AppError
from app.limiter import limiter
from app.logging_config import configure_logging
from app.middleware.access_log import AccessLogMiddleware
from app.middleware.error_handler import (
    app_error_handler,
    global_exception_handler,
    not_found_handler,
    permission_error_handler,
)
from app.middleware.request_id import RequestIDMiddleware
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

configure_logging(log_level=settings.log_level, log_file=settings.log_file)

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        environment=settings.environment,
    )

# Routers (imported lazily to avoid circular imports at module level)
from app.routers import auth, tasks, topics, archive, recurring, reminder


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start scheduler on startup, shut it down on shutdown."""
    from app.database import async_session_factory
    from app.scheduler.jobs import create_scheduler
    from app.sse.connection_manager import sse_manager

    scheduler = create_scheduler(
        session_factory=async_session_factory,
        sse_manager=sse_manager,
        timezone_str=settings.scheduler_timezone,
    )
    scheduler.start()

    yield  # App runs here

    scheduler.shutdown()


app = FastAPI(
    title="Todo List API",
    version="1.0.0",
    description="Todo List application backend",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(AccessLogMiddleware)
app.add_middleware(RequestIDMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Register exception handlers
app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(LookupError, not_found_handler)
app.add_exception_handler(PermissionError, permission_error_handler)
# AppError (subclass of ValueError) — intentional business-rule violations only.
# Plain ValueError from third-party code falls through to global_exception_handler (500).
app.add_exception_handler(AppError, app_error_handler)

# Register API routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(topics.router, prefix="/api/v1")
app.include_router(archive.router, prefix="/api/v1")
app.include_router(recurring.router, prefix="/api/v1")
app.include_router(reminder.router, prefix="/api/v1")


@app.get("/api/health", tags=["health"])
async def health_check(session: AsyncSession = Depends(get_db)):
    """Health check endpoint — no auth required. Returns 503 if DB is unreachable."""
    try:
        await session.execute(text("SELECT 1"))
        db_status = "ok"
        http_status = status.HTTP_200_OK
    except Exception:
        db_status = "unreachable"
        http_status = status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=http_status,
        content={"status": "ok" if db_status == "ok" else "degraded", "db": db_status},
    )
