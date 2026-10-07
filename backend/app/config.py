from functools import lru_cache
from typing import Literal, Self

from pydantic import ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.errors import ConfigError


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./moatmine.db"

    # auth: "dev" trusts the bearer token as the user id (local SQLite only); "clerk" verifies a Clerk JWT
    auth_mode: Literal["dev", "clerk"] = "dev"
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""

    # CORS: Vercel URL(s) plus the Tauri origins
    cors_origins: str = "http://localhost:3000,tauri://localhost,http://tauri.localhost"
    cors_origin_regex: str = ""

    # market data: "mock" (no key needed) or "finnhub"
    market_provider: str = "mock"
    finnhub_api_key: str = ""
    # optional: company descriptions, financial statements, price targets, dividends
    fmp_api_key: str = ""

    # encrypts user-supplied AI keys at rest (Fernet key; generate with app.crypto.new_key())
    fernet_key: str = ""

    # AI via ModelDispatcher: optional server keys (users can bring their own instead)
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""
    groq_api_key: str = ""
    # per-user limits, enforced by ModelDispatcher's quota manager
    ai_requests_per_min: int = 20
    ai_tokens_per_min: int = 60_000
    ai_tokens_per_day: int = 1_000_000
    ai_timeout_seconds: float = 90.0

    worker_interval_seconds: int = 300

    @model_validator(mode="after")
    def _auth_is_safe(self) -> Self:
        """Refuse to start with an auth setup that would let anyone act as any user."""
        if self.auth_mode == "dev" and self.database_url.startswith("postgres"):
            raise ValueError(
                "AUTH_MODE=dev trusts any bearer token as the user id and is for a local SQLite database only. "
                "Set AUTH_MODE=clerk with CLERK_JWKS_URL and CLERK_ISSUER."
            )
        if self.auth_mode == "clerk" and not (self.clerk_jwks_url and self.clerk_issuer):
            raise ValueError("AUTH_MODE=clerk needs CLERK_JWKS_URL and CLERK_ISSUER")
        return self

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Load settings from the environment (and .env), once per process.

    Raises:
        ConfigError: a value is invalid or unsafe. Only the reasons are kept, never the values,
            which include secrets such as DATABASE_URL and API keys.
    """
    try:
        return Settings()
    except ValidationError as e:
        reasons = "; ".join(str(err["msg"]) for err in e.errors(include_input=False, include_url=False))
        raise ConfigError(f"invalid settings: {reasons}") from None
