"""Per-user AI settings in ModelDispatcher's AgentConfig shape, Fernet-encrypted at rest.

Keys never leave the server in full: reads return masked keys, and a write that sends a masked
key back (the user didn't change it) keeps the stored original.
"""

import ipaddress
import json
import socket
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crypto import decrypt, encrypt, mask
from app.jsontypes import JSONDict
from app.models import AISettings

SUPPORTED = ("anthropic", "openai", "gemini", "groq")  # ModelPicker also offers ollama: browser-only
FAVORITES = ("chatgpt", "claude", "gemini", "geminiApp", "groq")
EMPTY = {"config": {"providers": [], "ollamaUrl": ""}, "external": None, "favorite": None}


def check_public_https_url(url: str) -> None:
    """The external agent is called from our server, so it must be a public HTTPS host.

    Otherwise a user could point it at Render's internal network or the cloud metadata service.
    Checked when saved; a host that later re-resolves to a private address isn't caught here.

    Raises:
        ValueError: not https, no host, or the host is/resolves to a private, loopback,
            link-local, reserved or multicast address.
    """
    parts = urlsplit(url)
    if parts.scheme != "https" or not parts.hostname:
        raise ValueError("external agent needs an https:// base URL")
    try:
        infos = socket.getaddrinfo(parts.hostname, parts.port or 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise ValueError(f"external agent host {parts.hostname} doesn't resolve") from e
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global or ip.is_multicast:
            raise ValueError("external agent must be on the public internet, not a private or local address")


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
        check_public_https_url(str(external["base_url"]))
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
