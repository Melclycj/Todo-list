from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/todoapp"
    test_database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/todoapp_test"
    # No default — app refuses to start if SECRET_KEY is not set in the environment.
    secret_key: str
    allowed_origins: str = "http://localhost"
    rate_limit_enabled: bool = True
    # Override these in production with stricter values via env vars
    register_rate_limit: str = "20/minute"
    login_rate_limit: str = "30/minute"
    refresh_rate_limit: str = "60/minute"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    db_pool_recycle: int = 1800
    scheduler_timezone: str = "UTC"


settings = Settings()
