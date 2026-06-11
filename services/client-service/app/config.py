from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    APP_NAME: str = "VrdCapital Client Service"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    SERVICE_NAME: str = "client-service"

    DATABASE_URL: str = "postgresql+asyncpg://vrdcapital:vrdcapital123@localhost:5432/vrdcapital"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    REDIS_URL: str = "redis://:redis123@localhost:6379/1"

    SECRET_KEY: str = "supersecretkey-change-in-production-minimum-32-chars"
    ALGORITHM: str = "HS256"

    AUTH_SERVICE_URL: str = "http://localhost:8001"

    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
