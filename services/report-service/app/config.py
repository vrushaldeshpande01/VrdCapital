from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://vrdcapital:vrdcapital123@postgres:5432/vrdcapital"
    SECRET_KEY: str = "supersecretkey-change-in-production"
    AUTH_SERVICE_URL: str = "http://auth-service:8000"
    PORTFOLIO_SERVICE_URL: str = "http://portfolio-service:8000"
    CLIENT_SERVICE_URL: str = "http://client-service:8000"
    ORDER_SERVICE_URL: str = "http://order-service:8000"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
