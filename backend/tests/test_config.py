import pytest
from cryptography.fernet import Fernet

from app import config
from app.config import Settings, get_settings
from app.errors import ConfigError

SQLITE = "sqlite:///./x.db"
PG = "postgresql://u:secret-password@db/moatmine"
KEY = Fernet.generate_key().decode()
CLERK = {"clerk_jwks_url": "https://clerk.example/.well-known/jwks.json", "clerk_issuer": "https://clerk.example", "fernet_key": KEY}


@pytest.mark.parametrize(
    ("kwargs", "ok"),
    [
        ({"auth_mode": "dev", "database_url": SQLITE}, True),
        ({"auth_mode": "dev", "database_url": PG}, False),
        ({"auth_mode": "dev", "database_url": "postgres://u@db/x"}, False),
        ({"auth_mode": "clerk", "database_url": PG, **CLERK}, True),
        ({"auth_mode": "clerk", "database_url": PG, "clerk_jwks_url": CLERK["clerk_jwks_url"]}, False),
        ({"auth_mode": "clerk", "database_url": SQLITE}, False),
        ({"auth_mode": "clerk", "database_url": PG, **{**CLERK, "fernet_key": ""}}, False),  # can't store AI keys
        ({"auth_mode": "dev", "database_url": SQLITE, "fernet_key": "not-a-key"}, False),
        ({"auth_mode": "dev", "database_url": SQLITE, "fernet_key": ""}, True),  # local: only AI-key saving needs it
    ],
)
def test_settings_refuses_unsafe_auth(kwargs, ok):
    if ok:
        assert Settings(**kwargs).auth_mode == kwargs["auth_mode"]
    else:
        with pytest.raises(ValueError):
            Settings(**kwargs)


def test_get_settings_raises_config_error_without_values(monkeypatch):
    monkeypatch.setenv("AUTH_MODE", "dev")
    monkeypatch.setenv("DATABASE_URL", PG)
    get_settings.cache_clear()
    try:
        with pytest.raises(ConfigError) as e:
            config.get_settings()
        assert "AUTH_MODE=dev" in str(e.value) and "secret-password" not in str(e.value)
        assert e.value.__cause__ is None and e.value.__suppress_context__
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()
