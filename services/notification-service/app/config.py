from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://vrdcapital:vrdcapital123@postgres:5432/vrdcapital"
    SECRET_KEY: str = "supersecretkey-change-in-production"
    AUTH_SERVICE_URL: str = "http://auth-service:8000"
    BROKER_SERVICE_URL: str = "http://broker-service:8000"
    REDIS_URL: str = "redis://:redis123@redis:6379/3"
    RABBITMQ_URL: str = "amqp://vrdcapital:rabbitmq123@rabbitmq:5672/"
    RABBITMQ_EXCHANGE: str = "vrdcapital.events"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
