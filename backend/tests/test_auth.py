"""Firebase ID token verification, with a locally generated key standing in for Google's JWKS."""

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app import auth
from app.config import Settings

PROJECT = "moatmine-test"
ISSUER = f"https://securetoken.google.com/{PROJECT}"
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


class _FakeJwks:
    def get_signing_key_from_jwt(self, _token: str):
        return type("SigningKey", (), {"key": KEY.public_key()})()


@pytest.fixture
def firebase_mode(monkeypatch):
    s = Settings(auth_mode="firebase", database_url="sqlite:///./x.db", firebase_project_id=PROJECT, allowed_emails="Alice@Example.com, bob@example.com")
    monkeypatch.setattr(auth, "get_settings", lambda: s)
    monkeypatch.setattr(auth, "_jwks_client", lambda _url: _FakeJwks())


def _token(key=KEY, alg="RS256", **overrides) -> str:
    now = int(time.time())
    claims = {"sub": "user_123", "iss": ISSUER, "aud": PROJECT, "iat": now, "exp": now + 60,
              "email": "alice@example.com", "email_verified": True, **overrides}
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm=alg)


def _bearer(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_current_user_accepts_a_valid_firebase_token(firebase_mode):
    assert auth.current_user(_bearer(_token())) == "user_123"


@pytest.mark.parametrize(
    "creds",
    [
        pytest.param(None, id="missing header"),
        pytest.param(lambda: _bearer(_token(exp=int(time.time()) - 10)), id="expired"),
        pytest.param(lambda: _bearer(_token(iss="https://evil.example")), id="wrong issuer"),
        # a real token from another Firebase project: right signature, wrong project
        pytest.param(lambda: _bearer(_token(aud="other-project", iss="https://securetoken.google.com/other-project")), id="other project"),
        pytest.param(lambda: _bearer(_token(aud=None)), id="no audience"),
        pytest.param(lambda: _bearer(_token(sub="")), id="empty subject"),
        pytest.param(lambda: _bearer(_token(key=OTHER_KEY)), id="signed by another key"),
        pytest.param(lambda: _bearer(_token(sub=None)), id="no subject"),
        pytest.param(lambda: _bearer(_token(exp=None)), id="no expiry"),
        pytest.param(lambda: _bearer(_token(key="shared-secret-shared-secret-32by", alg="HS256")), id="HS256 not allowed"),
        pytest.param(lambda: _bearer("not-a-jwt"), id="garbage"),
    ],
)
def test_current_user_rejects_bad_firebase_tokens(firebase_mode, creds):
    with pytest.raises(HTTPException) as e:
        auth.current_user(creds() if callable(creds) else creds)
    assert e.value.status_code == 401 and e.value.detail in ("missing token", "invalid token")


def test_current_identity_carries_the_verified_email(firebase_mode):
    assert auth.current_identity(_bearer(_token())) == auth.Identity("user_123", "alice@example.com")


@pytest.mark.parametrize("email", ["alice@example.com", "ALICE@example.COM", "bob@example.com"])
def test_allowed_emails_get_in_whatever_their_case(firebase_mode, email):
    assert auth.current_user(_bearer(_token(email=email))) == "user_123"


@pytest.mark.parametrize(
    "overrides",
    [
        pytest.param({"email": "mallory@example.com"}, id="not on the list"),
        pytest.param({"email": "alice@example.com", "email_verified": False}, id="address not verified"),
        pytest.param({"email": "alice@example.com", "email_verified": None}, id="verification missing"),
        pytest.param({"email": "alice@example.com", "email_verified": "true"}, id="verified is not a real boolean"),
        pytest.param({"email": None, "email_verified": None}, id="no email at all (a phone or anonymous account)"),
        pytest.param({"email": 123}, id="email is not a string"),
        pytest.param({"email": "alice@example.com.evil.test"}, id="look-alike domain"),
        pytest.param({"email": "x@example.com,alice@example.com"}, id="list syntax in the claim"),
    ],
)
def test_valid_tokens_of_people_not_on_the_list_are_refused_without_saying_why(firebase_mode, overrides):
    with pytest.raises(HTTPException) as e:
        auth.current_user(_bearer(_token(**overrides)))
    assert e.value.status_code == 403 and e.value.detail == "not allowed"


def test_allow_any_user_lets_every_verified_firebase_account_in(monkeypatch):
    s = Settings(auth_mode="firebase", database_url="sqlite:///./x.db", firebase_project_id=PROJECT, allow_any_user=True)
    monkeypatch.setattr(auth, "get_settings", lambda: s)
    monkeypatch.setattr(auth, "_jwks_client", lambda _url: _FakeJwks())
    assert auth.current_user(_bearer(_token(email="anyone@example.com", email_verified=False))) == "user_123"


@pytest.mark.parametrize(("creds", "user"), [(None, "dev"), (_bearer("alice"), "alice")])
def test_current_user_dev_mode_trusts_the_token(creds, user):
    assert auth.current_user(creds) == user
