from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./folio.db"

    # auth: "dev" trusts the bearer token as the user id; "clerk" verifies a Clerk JWT
    auth_mode: str = "dev"
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

    # model dispatcher
    default_model: str = "anthropic/claude-sonnet-5-5"
    fast_model: str = "anthropic/claude-haiku-4-5-20251001"
    fallback_models: str = "openai/gpt-4o-mini"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""

    worker_interval_seconds: int = 300

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def fallback_list(self) -> list[str]:
        return [m.strip() for m in self.fallback_models.split(",") if m.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
