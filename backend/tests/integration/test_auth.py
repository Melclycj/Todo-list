"""
Integration tests for /api/v1/auth/* endpoints.

Tests exercise the full stack: HTTP → router → service → real DB.
"""
import pytest


class TestRegister:
    @pytest.mark.asyncio
    async def test_register_returns_201_with_user(self, client):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "alice@example.com", "password": "StrongPass1!"},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["success"] is True
        assert body["data"]["email"] == "alice@example.com"
        assert "id" in body["data"]
        assert "hashed_password" not in body["data"]

    @pytest.mark.asyncio
    async def test_register_duplicate_email_returns_400(self, client):
        payload = {"email": "bob@example.com", "password": "StrongPass1!"}
        await client.post("/api/v1/auth/register", json=payload)

        resp = await client.post("/api/v1/auth/register", json=payload)

        assert resp.status_code == 400
        assert resp.json()["success"] is False

    @pytest.mark.asyncio
    async def test_register_short_password_returns_422(self, client):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "carol@example.com", "password": "short"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_register_invalid_email_returns_422(self, client):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"email": "not-an-email", "password": "StrongPass1!"},
        )
        assert resp.status_code == 422


class TestLogin:
    @pytest.mark.asyncio
    async def test_login_returns_access_token(self, client):
        await client.post(
            "/api/v1/auth/register",
            json={"email": "dave@example.com", "password": "StrongPass1!"},
        )
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "dave@example.com", "password": "StrongPass1!"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "access_token" in body["data"]
        assert body["data"]["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_sets_refresh_token_cookie(self, client):
        await client.post(
            "/api/v1/auth/register",
            json={"email": "eve@example.com", "password": "StrongPass1!"},
        )
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "eve@example.com", "password": "StrongPass1!"},
        )
        assert "refresh_token" in resp.cookies

    @pytest.mark.asyncio
    async def test_login_wrong_password_returns_400(self, client):
        await client.post(
            "/api/v1/auth/register",
            json={"email": "frank@example.com", "password": "StrongPass1!"},
        )
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "frank@example.com", "password": "WrongPassword!"},
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_login_unknown_email_returns_400(self, client):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "StrongPass1!"},
        )
        assert resp.status_code == 400
