"""Per-user AI settings in ModelDispatcher's AgentConfig shape, Fernet-encrypted at rest.

Keys never leave the server in full: reads return masked keys, and a write that sends a masked
key back (the user didn't change it) keeps the stored original.
"""

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crypto import decrypt, encrypt, mask
from app.jsontypes import JSONDict
from app.models import AISettings

SUPPORTED = ("anthropic", "openai", "gemini", "groq")  # ModelPicker also offers ollama: browser-only
FAVORITES = ("chatgpt", "claude", "gemini", "geminiApp", "groq")
EMPTY = {"config": {"providers": [], "ollamaUrl": ""}, "external": None, "favorite": None}


def _row(db: Session, user: str) -> AISettings | None:
    return db.scalar(select(AISettings).where(AISettings.user_id == user))


def load_ai_settings(db: Session, user: str) -> JSONDict:
    """Full settings with real keys. Server-side use only."""
    row = _row(db, user)
    if not row:
        empty: JSONDict = json.loads(json.dumps(EMPTY))
        return empty
    data: JSONDict = json.loads(decrypt(row.encrypted_config))
    data["favorite"] = row.favorite
    return data


def masked(data: JSONDict) -> JSONDict:
    """Safe-to-send copy: every key replaced by its mask."""
    out: JSONDict = json.loads(json.dumps(data))
    for p in out["config"]["providers"]:
        p["apiKeys"] = [mask(k) for k in p.get("apiKeys", [])]
    if out.get("external"):
        out["external"]["api_key"] = mask(out["external"]["api_key"])
    return out


def save_ai_settings(db: Session, user: str, config: JSONDict, external: JSONDict | None, favorite: str | None) -> JSONDict:
    current = load_ai_settings(db, user)
    old_keys = {p["provider"]: p.get("apiKeys", []) for p in current["config"]["providers"]}

    providers = []
    seen = set()
    for p in config.get("providers", []):
        vendor = p.get("provider")
        if vendor in seen or vendor not in (*SUPPORTED, "ollama"):
            continue
        seen.add(vendor)
        by_mask = {mask(k): k for k in old_keys.get(vendor, [])}
        keys = [by_mask.get(k, k) for k in (k.strip() for k in p.get("apiKeys", [])) if k]
        providers.append({"provider": vendor, "model": str(p.get("model", ""))[:120], "apiKeys": keys})

    ext = None
    if external and external.get("base_url"):
        if not str(external["base_url"]).startswith("https://"):
            raise ValueError("external agent needs an https:// base URL")
        key = external.get("api_key", "")
        if current.get("external") and key == mask(current["external"]["api_key"]):
            key = current["external"]["api_key"]
        if not key:
            raise ValueError("external agent needs an API key")
        ext = {"base_url": external["base_url"].rstrip("/"), "model": str(external.get("model", ""))[:120], "api_key": key}

    if favorite is not None and favorite not in FAVORITES:
        raise ValueError(f"favorite must be one of {FAVORITES}")

    data = {"config": {"providers": providers, "ollamaUrl": str(config.get("ollamaUrl", ""))[:300]}, "external": ext}
    row = _row(db, user) or AISettings(user_id=user)
    row.encrypted_config = encrypt(json.dumps(data))
    row.favorite = favorite
    db.add(row)
    db.commit()
    return masked({**data, "favorite": favorite})
