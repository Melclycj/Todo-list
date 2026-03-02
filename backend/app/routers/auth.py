"""
Auth router — /api/v1/auth/*
HTTP layer only: parse request, call service, return response.
"""
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response

from app.database import get_db
from app.repositories.user_repository import RefreshTokenRepository, UserRepository
from app.schemas.common import ApiResponse
from app.schemas.user import (
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)
from app.services.auth_service import AuthService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_auth_service(session: AsyncSession = Depends(get_db)) -> AuthService:
    from passlib.context import CryptContext

    class PasswordHasher:
        _ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

        def hash(self, plain: str) -> str:
            return self._ctx.hash(plain)

        def verify(self, plain: str, hashed: str) -> bool:
            return self._ctx.verify(plain, hashed)

    return AuthService(
        user_repo=UserRepository(session),
        token_repo=RefreshTokenRepository(session),
        password_hasher=PasswordHasher(),
    )


@router.post("/register", response_model=ApiResponse[UserResponse], status_code=201)
async def register(
    body: UserRegisterRequest,
    service: AuthService = Depends(_get_auth_service),
):
    user = await service.register(email=body.email, password=body.password)
    return ApiResponse.ok(UserResponse.model_validate(user))


@router.post("/login", response_model=ApiResponse[TokenResponse])
async def login(
    body: UserLoginRequest,
    response: Response,
    service: AuthService = Depends(_get_auth_service),
):
    access_token, refresh_token = await service.login(
        email=body.email, password=body.password
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=7 * 24 * 3600,
    )
    return ApiResponse.ok(TokenResponse(access_token=access_token))


@router.post("/refresh", response_model=ApiResponse[TokenResponse])
async def refresh_token(
    refresh_token: str | None = Cookie(default=None),
    service: AuthService = Depends(_get_auth_service),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token cookie")
    access_token = await service.refresh(raw_refresh_token=refresh_token)
    return ApiResponse.ok(TokenResponse(access_token=access_token))


@router.post("/logout", response_model=ApiResponse[None])
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    service: AuthService = Depends(_get_auth_service),
):
    if refresh_token:
        try:
            await service.logout(raw_refresh_token=refresh_token)
        except Exception:
            pass  # still clear the cookie even if token was already invalid
    response.delete_cookie("refresh_token")
    return ApiResponse.ok(None)
