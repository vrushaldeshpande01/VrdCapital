from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://vrdcapital:vrdcapital123@postgres:5432/vrdcapital"
    SECRET_KEY: str = "your-super-secret-key-change-in-production"
    AUTH_SERVICE_URL: str = "http://auth-service:8000"
    BROKER_SERVICE_URL: str = "http://broker-service:8000"
    CLIENT_SERVICE_URL: str = "http://client-service:8000"
    PORTFOLIO_SERVICE_URL: str = "http://portfolio-service:8000"
    RABBITMQ_URL: str = "amqp://vrdcapital:rabbitmq123@rabbitmq:5672/"

    class Config:
        env_file = ".env"

settings = Settings()
