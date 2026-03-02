from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

limiter = Limiter(key_func=get_remote_address, enabled=settings.rate_limit_enabled)


def make_limit(setting_name: str):
    """Return a zero-argument callable that reads the limit string from settings."""
    def _limit() -> str:
        return getattr(settings, setting_name)
    return _limit
