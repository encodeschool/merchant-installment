from pathlib import Path
from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    FRONTEND_ORIGINS: str = "http://localhost:3000,http://localhost:5173,https://merchant-cbu.netlify.app"
    SECRET_KEY: str = "dev-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.FRONTEND_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = str(_ENV_FILE)


settings = Settings()
