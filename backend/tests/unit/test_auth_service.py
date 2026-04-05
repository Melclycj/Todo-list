"""
Unit tests for auth_service.

Business rules:
- Register: email must be unique
- Login: invalid credentials return generic error (no hint about which field)
- Login: returns (access_token, refresh_token) on success
- Refresh: validates token, returns new access token
- Logout: revokes the refresh token
"""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Ensure all models are loaded before anything
import app.models  # noqa: F401
from app.services.auth_service import AuthService, _hash_token


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(email: str = "user@example.com") -> MagicMock:
    user = MagicMock()
    user.id = uuid.uuid4()
    user.email = email
    user.hashed_password = "hashed"
    return user


def _make_token_record(
    user_id: uuid.UUID,
    revoked: bool = False,
    expires_at: datetime | None = None,
) -> MagicMock:
    record = MagicMock()
    record.id = uuid.uuid4()
    record.user_id = user_id
    record.revoked = revoked
    record.expires_at = expires_at or (
        datetime.now(tz=timezone.utc) + timedelta(days=7)
    )
    return record


def _make_service(
    user: MagicMock | None = None,
    token_record: MagicMock | None = None,
    password_valid: bool = True,
) -> AuthService:
    user_repo = AsyncMock()
    user_repo.get_by_email.return_value = user
    user_repo.create.return_value = user or _make_user()

    token_repo = AsyncMock()
    token_repo.get_by_hash.return_value = token_record
    token_repo.create.return_value = token_record or MagicMock()

    hasher = MagicMock()
    hasher.hash.return_value = "hashed"
    hasher.verify.return_value = password_valid

    mock_uow = AsyncMock()
    mock_uow.users = user_repo
    mock_uow.tokens = token_repo
    mock_uow.commit = AsyncMock()
    mock_uow.rollback = AsyncMock()

    return AuthService(uow=mock_uow, password_hasher=hasher)


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

class TestAuthServiceRegister:

    @pytest.mark.asyncio
    async def test_register_success(self):
        """Valid email + password creates a new user."""
        service = _make_service(user=None)
        result = await service.register(email="new@example.com", password="password123")
        assert result is not None

    @pytest.mark.asyncio
    async def test_register_duplicate_email_raises(self):
        """Registering with an email that already exists raises ValueError."""
        existing_user = _make_user("existing@example.com")
        service = _make_service(user=existing_user)

        with pytest.raises(ValueError, match="Email already in use"):
            await service.register(email="existing@example.com", password="password123")

    @pytest.mark.asyncio
    async def test_register_hashes_password(self):
        """Password is hashed before storing."""
        service = _make_service(user=None)
        await service.register(email="new@example.com", password="plaintext")
        service._hasher.hash.assert_called_once_with("plaintext")


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class TestAuthServiceLogin:

    @pytest.mark.asyncio
    async def test_login_success_returns_tokens(self):
        """Valid credentials return (access_token, refresh_token)."""
        user = _make_user()
        service = _make_service(user=user, password_valid=True)

        with patch("app.services.auth_service.create_access_token", return_value="access_tok"):
            access, refresh = await service.login(
                email="user@example.com", password="password"
            )
        assert access == "access_tok"
        assert isinstance(refresh, str)
        assert len(refresh) > 0

    @pytest.mark.asyncio
    async def test_login_wrong_password_raises(self):
        """Wrong password raises ValueError with generic message."""
        user = _make_user()
        service = _make_service(user=user, password_valid=False)

        with pytest.raises(ValueError, match="Invalid credentials"):
            await service.login(email="user@example.com", password="wrong")

    @pytest.mark.asyncio
    async def test_login_unknown_email_raises(self):
        """Unknown email raises ValueError with same generic message."""
        service = _make_service(user=None)

        with pytest.raises(ValueError, match="Invalid credentials"):
            await service.login(email="ghost@example.com", password="anything")

    @pytest.mark.asyncio
    async def test_login_stores_hashed_refresh_token(self):
        """The refresh token is stored as a SHA-256 hash, not plaintext."""
        user = _make_user()
        service = _make_service(user=user, password_valid=True)

        with patch("app.services.auth_service.create_access_token", return_value="tok"):
            _, raw_refresh = await service.login(
                email="user@example.com", password="password"
            )

        # The token_repo.create should have been called with a hash, not the raw token
        call_kwargs = service._uow.tokens.create.call_args[1]
        assert call_kwargs["token_hash"] == _hash_token(raw_refresh)
        assert call_kwargs["token_hash"] != raw_refresh


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------

class TestAuthServiceRefresh:

    @pytest.mark.asyncio
    async def test_refresh_valid_token_returns_access_token(self):
        """Valid non-revoked refresh token returns a new access token."""
        user_id = uuid.uuid4()
        token_record = _make_token_record(user_id=user_id, revoked=False)
        service = _make_service(token_record=token_record)

        with patch("app.services.auth_service.create_access_token", return_value="new_access"):
            new_access = await service.refresh(raw_refresh_token="sometoken")
        assert new_access == "new_access"

    @pytest.mark.asyncio
    async def test_refresh_revoked_token_raises(self):
        """Revoked refresh token raises ValueError."""
        user_id = uuid.uuid4()
        token_record = _make_token_record(user_id=user_id, revoked=True)
        service = _make_service(token_record=token_record)

        with pytest.raises(ValueError, match="Invalid refresh token"):
            await service.refresh(raw_refresh_token="revoked_token")

    @pytest.mark.asyncio
    async def test_refresh_unknown_token_raises(self):
        """Unknown refresh token (not in DB) raises ValueError."""
        service = _make_service(token_record=None)

        with pytest.raises(ValueError, match="Invalid refresh token"):
            await service.refresh(raw_refresh_token="unknown")

    @pytest.mark.asyncio
    async def test_refresh_expired_token_raises(self):
        """Expired refresh token raises ValueError."""
        user_id = uuid.uuid4()
        expired_token = _make_token_record(
            user_id=user_id,
            revoked=False,
            expires_at=datetime.now(tz=timezone.utc) - timedelta(days=1),
        )
        service = _make_service(token_record=expired_token)

        with pytest.raises(ValueError, match="Refresh token expired"):
            await service.refresh(raw_refresh_token="expired_token")


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

class TestAuthServiceLogout:

    @pytest.mark.asyncio
    async def test_logout_revokes_token(self):
        """Logout calls revoke on the matching token record."""
        user_id = uuid.uuid4()
        token_record = _make_token_record(user_id=user_id, revoked=False)
        service = _make_service(token_record=token_record)

        await service.logout(raw_refresh_token="sometoken")
        service._uow.tokens.revoke.assert_called_once_with(token_record.id)

    @pytest.mark.asyncio
    async def test_logout_unknown_token_does_not_raise(self):
        """Logging out with an unknown token is silently ignored."""
        service = _make_service(token_record=None)
        # Should NOT raise
        await service.logout(raw_refresh_token="nonexistent")
        service._uow.tokens.revoke.assert_not_called()
