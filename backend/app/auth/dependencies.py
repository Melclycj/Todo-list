"""
FastAPI dependency: get_current_user.
Extracts and validates the JWT Bearer token from the Authorization header.
"""
import uuid

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt import decode_access_token
from app.database import get_db

security = HTTPBearer()


async def get_current_user_id(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> uuid.UUID:
    """
    Extract and validate the Bearer token, returning the user_id.
    Also stores user_id on request.state so the access log middleware
    can include it without needing to re-parse the token.

    Raises:
        HTTPException 401: If the token is missing or invalid.
    """
    try:
        user_id = decode_access_token(credentials.credentials)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    request.state.user_id = user_id
    return user_id
