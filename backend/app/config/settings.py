from functools import lru_cache
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic import Field
from pydantic.dataclasses import dataclass


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    app_name: str = "SQL AI Assistant API"
    api_prefix: str = "/api"
    environment: str = Field(default="development")
    cors_origins: str = Field(default="http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176")

    groq_api_key: Optional[str] = Field(default=None)
    groq_model: str = Field(default="llama-3.3-70b-versatile")
    mongo_uri: Optional[str] = Field(default=None)
    secret_key: Optional[str] = Field(default=None)
    app_database_url: Optional[str] = Field(default=None)
    redis_url: Optional[str] = Field(default=None)
    clerk_jwks_url: Optional[str] = Field(default=None)
    clerk_issuer: Optional[str] = Field(default=None)

    max_result_rows: int = 500
    statement_timeout_ms: int = 3000
    schema_cache_seconds: int = 300

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    import os

    return Settings(
        environment=os.getenv("ENVIRONMENT", "development"),
        cors_origins=os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176",
        ),
        groq_api_key=os.getenv("GROQ_API_KEY") or None,
        groq_model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        mongo_uri=os.getenv("MONGO_URI") or None,
        secret_key=os.getenv("SECRET_KEY") or None,
        app_database_url=os.getenv("APP_DATABASE_URL") or None,
        redis_url=os.getenv("REDIS_URL") or None,
        clerk_jwks_url=os.getenv("CLERK_JWKS_URL") or None,
        clerk_issuer=os.getenv("CLERK_ISSUER") or None,
    )
