"""
Shared test fixtures for unit and integration tests.

Unit tests use mocks — no real DB required.
Integration tests (future) will use a test DB session.
"""
import pytest


@pytest.fixture
def anyio_backend():
    return "asyncio"
