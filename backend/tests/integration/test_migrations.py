"""
Migration consistency tests.

Verifies:
1. All migration scripts apply cleanly against a fresh database.
2. No SQLAlchemy model changes are missing a corresponding migration.

These tests manage their own DB schema state independently of the conftest
test_engine fixture (which uses create_all). The sequence is:
  drop all tables → alembic upgrade head → alembic check

Other integration tests are unaffected: the app tables are recreated by
the migrations and db_session teardown (row deletion) continues to work.
"""
import asyncio
import os
import subprocess
import sys

import sqlalchemy as sa
import app.models  # noqa: F401 — register all models so drop_all is complete
from app.config import settings
from app.database import Base
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool


def test_migrations_run_and_are_current() -> None:
    """
    1. Drop all app tables — clean slate, no leftover state from create_all.
    2. ``alembic upgrade head`` — every migration script applies without error.
    3. ``alembic check`` — no model change is missing a migration script.

    If step 3 fails, generate the missing migration:
        alembic revision --autogenerate -m "describe your change"
    """
    # --- 1. Clean slate -------------------------------------------------------
    async def _drop_all() -> None:
        engine = create_async_engine(settings.test_database_url, poolclass=NullPool)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            # Also reset Alembic's version tracking so all migrations run from
            # scratch on the next upgrade. Without this, a stale alembic_version
            # row (e.g. "002") would cause Alembic to skip earlier migrations that
            # create enum types, then fail when a later migration tries to ALTER them.
            await conn.execute(sa.text("DROP TABLE IF EXISTS alembic_version"))
        await engine.dispose()

    asyncio.run(_drop_all())

    # Point alembic at the test DB by overriding DATABASE_URL.
    # env.py reads settings.database_url, which pydantic-settings resolves from
    # this env var, so the subprocess connects to the test database, not prod.
    env = {**os.environ, "DATABASE_URL": settings.test_database_url}

    # --- 2. Upgrade head ------------------------------------------------------
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "alembic upgrade head failed — a migration script may have a syntax error "
        "or reference a column/table that does not exist at that point in history.\n\n"
        f"{result.stderr}"
    )

    # --- 3. Drift check -------------------------------------------------------
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "check"],
        env=env,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        "Model/migration drift detected — a SQLAlchemy model was changed without a "
        "corresponding migration script.\n"
        "Fix: alembic revision --autogenerate -m 'describe your change'\n\n"
        f"{result.stderr}"
    )
