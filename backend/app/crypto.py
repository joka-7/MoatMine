import hashlib
import secrets

from cryptography.fernet import Fernet, MultiFernet

from app.config import get_settings


def new_key() -> str:
    return Fernet.generate_key().decode()


def _fernet() -> MultiFernet:
    keys = get_settings().fernet_keys
    if not keys:
        raise RuntimeError("FERNET_KEY is not set; required to store user AI keys")
    return MultiFernet([Fernet(k.encode()) for k in keys])


def encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()


def reencrypt(token: str) -> str:
    """The same secret encrypted with the newest key (for FERNET_KEY rotation).

    Raises:
        cryptography.fernet.InvalidToken: no configured key can decrypt it.
    """
    return _fernet().rotate(token.encode()).decode()


def mask(secret: str) -> str:
    return f"{secret[:4]}…{secret[-4:]}" if len(secret) > 10 else "••••"


def new_mcp_token() -> tuple[str, str]:
    """Return (plain_token, sha256_hex). Only the hash is stored."""
    token = "moatmine_" + secrets.token_urlsafe(32)
    return token, hash_token(token)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
