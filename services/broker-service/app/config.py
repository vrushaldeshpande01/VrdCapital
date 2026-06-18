from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "VrdCapital Broker Service"
    SERVICE_NAME: str = "broker-service"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "postgresql+asyncpg://vrdcapital:vrdcapital123@postgres:5432/vrdcapital"
    REDIS_URL: str = "redis://:redis123@redis:6379/3"
    SECRET_KEY: str = "supersecretkey-change-in-production"
    ENCRYPTION_KEY: str = ""  # Derived from SECRET_KEY if empty

    AUTH_SERVICE_URL: str = "http://auth-service:8000"
    PORTFOLIO_SERVICE_URL: str = "http://portfolio-service:8000"
    CLIENT_SERVICE_URL: str = "http://client-service:8000"

    ALLOWED_ORIGINS: list[str] = ["*"]

    # Zerodha Kite Connect app credentials (from https://kite.trade)
    ZERODHA_API_KEY: str = ""
    ZERODHA_API_SECRET: str = ""
    ALPHA_VANTAGE_API_KEY: str = ""

    # Price sync interval in seconds
    PRICE_SYNC_INTERVAL: int = 300  # 5 minutes

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
