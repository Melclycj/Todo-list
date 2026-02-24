"""
Authentication service — registration, login, token refresh, logout.
"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from app.auth.jwt import create_access_token, create_refresh_token, verify_refresh_token
from app.config import settings
from app.models.user import User


class AuthService:
    """Handles user registration, login, and token lifecycle."""

    def __init__(self, user_repo, token_repo, password_hasher) -> None:
        self._user_repo = user_repo
        self._token_repo = token_repo
        self._hasher = password_hasher

    async def register(self, email: str, password: str) -> User:
        """
        Create a new user account.

        Raises:
            ValueError: If the email is already in use.
        """
        existing = await self._user_repo.get_by_email(email)
        if existing is not None:
            raise ValueError("Email already in use")

        hashed = self._hasher.hash(password)
        return await self._user_repo.create(email=email, hashed_password=hashed)

    async def login(
        self, email: str, password: str
    ) -> tuple[str, str]:
        """
        Authenticate a user and return (access_token, refresh_token).

        Raises:
            ValueError: On invalid credentials (generic message for security).
        """
        user = await self._user_repo.get_by_email(email)
        if user is None or not self._hasher.verify(password, user.hashed_password):
            raise ValueError("Invalid credentials")

        access_token = create_access_token(user_id=user.id)
        raw_refresh, token_hash = _generate_refresh_token()

        expires_at = datetime.now(tz=timezone.utc) + timedelta(
            days=settings.refresh_token_expire_days
        )
        await self._token_repo.create(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        return access_token, raw_refresh

    async def refresh(self, raw_refresh_token: str) -> str:
        """
        Exchange a valid refresh token for a new access token.

        Raises:
            ValueError: If the refresh token is invalid, expired, or revoked.
        """
        token_hash = _hash_token(raw_refresh_token)
        record = await self._token_repo.get_by_hash(token_hash)
        if record is None or record.revoked:
            raise ValueError("Invalid refresh token")
        if record.expires_at < datetime.now(tz=timezone.utc):
            raise ValueError("Refresh token expired")

        return create_access_token(user_id=record.user_id)

    async def logout(self, raw_refresh_token: str) -> None:
        """
        Revoke the given refresh token.
        """
        token_hash = _hash_token(raw_refresh_token)
        record = await self._token_repo.get_by_hash(token_hash)
        if record is not None:
            await self._token_repo.revoke(record.id)


def _hash_token(raw: str) -> str:
    """Return the SHA-256 hex digest of a raw token string."""
    return hashlib.sha256(raw.encode()).hexdigest()


def _generate_refresh_token() -> tuple[str, str]:
    """Return (raw_token, token_hash) for a newly generated refresh token."""
    import secrets
    raw = secrets.token_hex(32)
    return raw, _hash_token(raw)
