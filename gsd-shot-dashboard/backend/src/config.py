from __future__ import annotations
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str              # postgresql+asyncpg://...
    database_url_sync: str         # postgresql://... for Alembic
    redis_url: str                 # redis://redis:6379/0
    session_secret: str            # >= 32 bytes in real deploy
    cookie_name: str = "osint_session"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    session_max_age_s: int = 60 * 60 * 24 * 7   # 7 days


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
