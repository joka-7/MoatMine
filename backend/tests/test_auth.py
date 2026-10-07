"""Clerk JWT verification, with a locally generated key standing in for Clerk's JWKS."""

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app import auth
from app.config import Settings

ISSUER = "https://clerk.example"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _FakeJwks:
    def get_signing_key_from_jwt(self, _token: str):
        return type("SigningKey", (), {"key": KEY.public_key()})()


@pytest.fixture
def clerk_mode(monkeypatch):
    s = Settings(auth_mode="clerk", database_url="sqlite:///./x.db", clerk_jwks_url=f"{ISSUER}/jwks", clerk_issuer=ISSUER)
    monkeypatch.setattr(auth, "get_settings", lambda: s)
    monkeypatch.setattr(auth, "_jwks_client", lambda _url: _FakeJwks())


def _token(key=KEY, alg="RS256", **overrides) -> str:
    claims = {"sub": "user_123", "iss": ISSUER, "exp": int(time.time()) + 60, **overrides}
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm=alg)


def _bearer(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_current_user_accepts_a_valid_clerk_token(clerk_mode):
    assert auth.current_user(_bearer(_token())) == "user_123"


@pytest.mark.parametrize(
    "creds",
    [
        pytest.param(None, id="missing header"),
        pytest.param(lambda: _bearer(_token(exp=int(time.time()) - 10)), id="expired"),
        pytest.param(lambda: _bearer(_token(iss="https://evil.example")), id="wrong issuer"),
        pytest.param(lambda: _bearer(_token(key=OTHER_KEY)), id="signed by another key"),
        pytest.param(lambda: _bearer(_token(sub=None)), id="no subject"),
        pytest.param(lambda: _bearer(_token(exp=None)), id="no expiry"),
        pytest.param(lambda: _bearer(_token(key="shared-secret-shared-secret-32by", alg="HS256")), id="HS256 not allowed"),
        pytest.param(lambda: _bearer("not-a-jwt"), id="garbage"),
    ],
)
def test_current_user_rejects_bad_clerk_tokens(clerk_mode, creds):
    with pytest.raises(HTTPException) as e:
        auth.current_user(creds() if callable(creds) else creds)
    assert e.value.status_code == 401 and e.value.detail in ("missing token", "invalid token")


@pytest.mark.parametrize(("creds", "user"), [(None, "dev"), (_bearer("alice"), "alice")])
def test_current_user_dev_mode_trusts_the_token(creds, user):
    assert auth.current_user(creds) == user
