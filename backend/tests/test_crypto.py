import hashlib
from types import SimpleNamespace

import pytest
from cryptography.fernet import Fernet, InvalidToken

from app import crypto

KEY = Fernet.generate_key().decode()


@pytest.fixture
def fernet_key(monkeypatch):
    def use(key: str) -> None:
        keys = [k for k in key.split(",") if k]
        monkeypatch.setattr(crypto, "get_settings", lambda: SimpleNamespace(fernet_keys=keys))

    use(KEY)
    return use


@pytest.mark.parametrize("plain", ["sk-live-abc123", "", "ünïcødé ✓"])
def test_encrypt_round_trips(fernet_key, plain):
    token = crypto.encrypt(plain)
    assert token != plain and crypto.decrypt(token) == plain


def _tamper(token: str) -> str:
    return token[:-4] + ("BBBB" if token.endswith("AAAA") else "AAAA")


@pytest.mark.parametrize(("rotate_key", "edit"), [(True, str), (False, _tamper)], ids=["wrong key", "tampered"])
def test_decrypt_rejects_wrong_key_or_tampering(fernet_key, rotate_key, edit):
    token = crypto.encrypt("secret")
    if rotate_key:
        fernet_key(Fernet.generate_key().decode())
    with pytest.raises(InvalidToken):
        crypto.decrypt(edit(token))


def test_encrypt_without_key_refuses(fernet_key):
    fernet_key("")
    with pytest.raises(RuntimeError, match="FERNET_KEY"):
        crypto.encrypt("x")


@pytest.mark.parametrize(
    ("secret", "masked"), [("sk-test-1234567890abcd", "sk-t…abcd"), ("short", "••••"), ("", "••••"), ("12345678901", "1234…8901")]
)
def test_mask_shows_only_the_ends(secret, masked):
    assert crypto.mask(secret) == masked


def test_new_mcp_token_stores_only_a_hash():
    token, digest = crypto.new_mcp_token()
    assert token.startswith("moatmine_") and len(token) > 40
    assert digest == crypto.hash_token(token) == hashlib.sha256(token.encode()).hexdigest()
    assert crypto.new_mcp_token()[0] != token


def test_reencrypt_moves_a_secret_to_the_newest_key(fernet_key):
    old, new = KEY, Fernet.generate_key().decode()
    token = crypto.encrypt("sk-live-abc123")  # under the old key

    fernet_key(f"{new},{old}")  # rotating: both decrypt, the new one encrypts
    assert crypto.decrypt(token) == "sk-live-abc123"
    moved = crypto.reencrypt(token)

    fernet_key(new)  # old key retired
    assert crypto.decrypt(moved) == "sk-live-abc123"
    with pytest.raises(InvalidToken):
        crypto.decrypt(token)
