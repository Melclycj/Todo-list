"""
Shared fixtures for unit and integration tests.

Unit tests (tests/unit/):
    Use mocks — no DB fixtures are requested, so none are created.

Integration tests (tests/integration/):
    Use the fixtures below. Schema is created once per session;
    all rows are deleted after each test to guarantee isolation.
"""
import asyncio
import os
import uuid

# Must be set before any app import — app.config.Settings has no default for
# secret_key so that production deployments fail loudly when the env var is
# missing. Tests supply a throwaway value here.
os.environ.setdefault("SECRET_KEY", "test-only-secret-not-for-production")

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

# Register all models before metadata.create_all is called
import app.models  # noqa: F401
from app.config import settings
from app.database import Base, get_db
from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


# ---------------------------------------------------------------------------
# Database — session-scoped so schema creation runs once per pytest session
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def test_engine():
    """
    Create an async engine pointed at the test database.

    - Creates all tables before the first test runs.
    - Drops all tables after the last test finishes.

    Uses NullPool so connections are never shared across event loops.
    Uses a sync fixture + asyncio.run() to avoid pytest-asyncio event-loop
    scope issues at session level.
    """
    engine = create_async_engine(
        settings.test_database_url,
        poolclass=NullPool,
        echo=False,
    )

    async def _create_schema() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def _drop_schema() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()

    asyncio.run(_create_schema())
    yield engine
    asyncio.run(_drop_schema())


@pytest.fixture
async def db_session(test_engine):
    """
    Provide a fresh AsyncSession per test.

    Teardown deletes all rows in reverse FK order so each test starts clean
    without recreating the schema.
    """
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        yield session

    async with test_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------

@pytest.fixture
async def client(db_session):
    """
    httpx.AsyncClient wrapping the FastAPI app.

    Overrides the get_db dependency to use the test session so all requests
    hit the same in-memory transaction as the test.
    """
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

@pytest.fixture
async def auth_headers(client):
    """
    Register a throw-away test user and return ready-to-use auth headers.

    Usage:
        async def test_something(client, auth_headers):
            resp = await client.get("/api/v1/tasks", headers=auth_headers)
    """
    email = f"test-{uuid.uuid4()}@example.com"

    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "TestPass123!"},
    )
    assert reg.status_code == 201, f"Test user registration failed: {reg.text}"

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "TestPass123!"},
    )
    assert login.status_code == 200, f"Test user login failed: {login.text}"

    token = login.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
