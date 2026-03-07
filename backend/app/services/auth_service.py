"""
Authentication service — registration, login, token refresh, logout.
"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from app.auth.jwt import create_access_token
from app.config import settings
from app.exceptions import AppError
from app.models.user import User


class AuthService:
    """Handles user registration, login, and token lifecycle."""

    def __init__(self, uow, password_hasher) -> None:
        self._uow = uow
        self._hasher = password_hasher

    async def register(self, email: str, password: str) -> User:
        """
        Create a new user account.

        Raises:
            AppError: If the email is already in use.
        """
        existing = await self._uow.users.get_by_email(email)
        if existing is not None:
            raise AppError("Email already in use")

        hashed = self._hasher.hash(password)
        user = await self._uow.users.create(email=email, hashed_password=hashed)
        await self._uow.commit()
        return user

    async def login(
        self, email: str, password: str
    ) -> tuple[str, str]:
        """
        Authenticate a user and return (access_token, refresh_token).

        Raises:
            AppError: On invalid credentials (generic message for security).
        """
        user = await self._uow.users.get_by_email(email)
        if user is None or not self._hasher.verify(password, user.hashed_password):
            raise AppError("Invalid credentials")

        access_token = create_access_token(user_id=user.id)
        raw_refresh, token_hash = _generate_refresh_token()

        expires_at = datetime.now(tz=timezone.utc) + timedelta(
            days=settings.refresh_token_expire_days
        )
        await self._uow.tokens.create(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        await self._uow.commit()
        return access_token, raw_refresh

    async def refresh(self, raw_refresh_token: str) -> str:
        """
        Exchange a valid refresh token for a new access token.

        Raises:
            AppError: If the refresh token is invalid, expired, or revoked.
        """
        token_hash = _hash_token(raw_refresh_token)
        record = await self._uow.tokens.get_by_hash(token_hash)
        if record is None or record.revoked:
            raise AppError("Invalid refresh token")
        if record.expires_at < datetime.now(tz=timezone.utc):
            raise AppError("Refresh token expired")

        return create_access_token(user_id=record.user_id)

    async def logout(self, raw_refresh_token: str) -> None:
        """
        Revoke the given refresh token.
        """
        token_hash = _hash_token(raw_refresh_token)
        record = await self._uow.tokens.get_by_hash(token_hash)
        if record is not None:
            await self._uow.tokens.revoke(record.id)
            await self._uow.commit()


def _hash_token(raw: str) -> str:
    """Return the SHA-256 hex digest of a raw token string."""
    return hashlib.sha256(raw.encode()).hexdigest()


def _generate_refresh_token() -> tuple[str, str]:
    """Return (raw_token, token_hash) for a newly generated refresh token."""
    import secrets
    raw = secrets.token_hex(32)
    return raw, _hash_token(raw)
