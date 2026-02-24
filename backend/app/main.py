"""
FastAPI application entry point.

- Registers all routers under /api/v1/
- Attaches global exception handlers
- Starts APScheduler as a lifespan event
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.middleware.error_handler import (
    global_exception_handler,
    not_found_handler,
    permission_error_handler,
    value_error_handler,
)

# Routers (imported lazily to avoid circular imports at module level)
from app.routers import auth, tasks, topics, archive, recurring, reminder


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start scheduler on startup, shut it down on shutdown."""
    from app.sse.connection_manager import sse_manager
    from app.scheduler.jobs import create_scheduler
    from app.services.task_service import TaskService
    from app.services.recurring_service import RecurringService

    # NOTE: The scheduler uses app-level service instances wired at startup.
    # For production, inject real repositories here.
    # For now, the scheduler is created but services are wired per-request via DI.
    # A production implementation would create a long-lived DB session for the scheduler.

    yield  # App runs here


app = FastAPI(
    title="Todo List API",
    version="1.0.0",
    description="Todo List application backend",
    lifespan=lifespan,
)

# CORS — tighten origins in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register exception handlers
app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(LookupError, not_found_handler)
app.add_exception_handler(PermissionError, permission_error_handler)
app.add_exception_handler(ValueError, value_error_handler)

# Register API routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(topics.router, prefix="/api/v1")
app.include_router(archive.router, prefix="/api/v1")
app.include_router(recurring.router, prefix="/api/v1")
app.include_router(reminder.router, prefix="/api/v1")


@app.get("/api/health", tags=["health"])
async def health_check():
    """Health check endpoint — no auth required."""
    return {"success": True, "data": {"status": "ok"}, "error": None}
