from functools import lru_cache
from typing import Literal, Self

from cryptography.fernet import Fernet
from pydantic import ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.errors import ConfigError


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./moatmine.db"
    # Postgres connection pool per process (API and worker each have one)
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_pool_timeout_seconds: float = 10.0  # wait for a free connection, then fail the request

    # auth: "dev" trusts the bearer token as the user id (local SQLite only); "clerk" verifies a Clerk JWT
    auth_mode: Literal["dev", "clerk"] = "dev"
    clerk_jwks_url: str = ""
    clerk_issuer: str = ""
    # comma-separated frontend origins allowed to have issued the session (the JWT's azp); empty = not checked
    clerk_authorized_parties: str = ""

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
    # tokens per UTC day all users together may spend on the server's own keys (0 = no cap)
    ai_server_tokens_per_day: int = 5_000_000

    worker_interval_seconds: int = 300

    # per-user requests per minute on routes that spend provider quota (app/ratelimit.py)
    rate_limit_market_per_min: int = 240
    rate_limit_ai_per_min: int = 30

    log_level: str = "INFO"
    log_format: Literal["json", "text"] = "text"  # json in production (render.yaml)

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

    @model_validator(mode="after")
    def _fernet_key_is_usable(self) -> Self:
        """Production must be able to store user AI keys; a bad key should stop startup, not a save."""
        if self.auth_mode == "clerk" and not self.fernet_key:
            raise ValueError("AUTH_MODE=clerk needs FERNET_KEY (encrypts user AI keys); generate one with app.crypto.new_key()")
        if self.fernet_key:
            try:
                Fernet(self.fernet_key.encode())
            except ValueError as e:
                raise ValueError("FERNET_KEY is not a valid Fernet key (32 url-safe base64 bytes)") from e
        return self

    @property
    def clerk_parties(self) -> set[str]:
        return {o.strip().rstrip("/") for o in self.clerk_authorized_parties.split(",") if o.strip()}

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
