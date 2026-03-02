"""
JWT token creation and verification.
Uses python-jose with HS256 algorithm.
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.config import settings

ALGORITHM = "HS256"
TOKEN_TYPE = "bearer"


def create_access_token(user_id: uuid.UUID) -> str:
    """
    Create a short-lived JWT access token for the given user.
    Expiry is controlled by settings.access_token_expire_minutes.
    """
    expire = datetime.now(tz=timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)



def decode_access_token(token: str) -> uuid.UUID:
    """
    Decode an access token and return the user_id.

    Raises:
        ValueError: If the token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            raise ValueError("Not an access token")
        return uuid.UUID(payload["sub"])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
