from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://basera:basera_dev_123@db:5432/basera"
    PORT: int = 8000

    class Config:
        env_file = ".env"


settings = Settings()
