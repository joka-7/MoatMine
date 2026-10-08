"""FERNET_KEY rotation re-encrypts stored AI settings so the old key can be retired."""

from types import SimpleNamespace

from cryptography.fernet import Fernet
from sqlalchemy import select

from app import crypto, rotate_keys
from app.ai.settings_store import load_ai_settings, save_ai_settings
from app.config import get_settings
from app.db import SessionLocal
from app.models import AISettings


def test_rotate_all(client, monkeypatch):
    old, new = get_settings().fernet_key, Fernet.generate_key().decode()  # old: what every stored row uses

    def use(*keys: str) -> None:
        monkeypatch.setattr(crypto, "get_settings", lambda: SimpleNamespace(fernet_keys=list(keys)))

    cfg = {"providers": [{"provider": "openai", "model": "gpt-4o-mini", "apiKeys": ["sk-rotate-1234567890"]}], "ollamaUrl": ""}
    with SessionLocal() as db:
        save_ai_settings(db, "rotator", cfg, None, None)

    use(new, old)
    assert rotate_keys.rotate_all() >= 1

    use(new)  # the old key is gone: everything must still decrypt
    with SessionLocal() as db:
        assert load_ai_settings(db, "rotator")["config"]["providers"][0]["apiKeys"] == ["sk-rotate-1234567890"]
        for row in db.scalars(select(AISettings)).all():
            crypto.decrypt(row.encrypted_config)
