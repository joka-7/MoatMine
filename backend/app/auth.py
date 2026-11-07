from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)

# Google's public keys for Firebase Authentication ID tokens (rotated by Google; PyJWKClient caches them)
FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url)


@dataclass(frozen=True)
class Identity:
    """Who is calling: the user id, and the Firebase-verified email when there is one."""

    user_id: str
    email: str | None = None


def email_allowed(email: str | None, settings: Settings) -> bool:
    """Whether `email` may use the app. Dev mode has no emails and lets everyone in; so does ALLOW_ANY_USER."""
    if settings.auth_mode == "dev" or settings.allow_any_user:
        return True
    return email is not None and email.lower() in settings.allowed_email_set


def current_identity(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> Identity:
    """Return who is calling.

    dev mode (local SQLite only, enforced by Settings): the bearer token *is* the user id
    (default "dev" when absent), with no email.
    firebase mode: verify the Firebase ID token's signature, expiry, issuer and audience (both
    name this project, so a token minted for another Firebase project is refused), then require its
    email to be verified and on the allow-list.

    Raises:
        HTTPException: 401 in firebase mode when the token is missing or fails verification; 403 when
            it is valid but its email is not verified or not allowed.
    """
    s = get_settings()
    if s.auth_mode == "dev":
        return Identity(creds.credentials if creds else "dev")

    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing token")
    try:
        key = _jwks_client(FIREBASE_JWKS_URL).get_signing_key_from_jwt(creds.credentials).key
        claims = jwt.decode(
            creds.credentials,
            key,
            algorithms=["RS256"],
            audience=s.firebase_project_id,
            issuer=f"https://securetoken.google.com/{s.firebase_project_id}",
            options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        )
    except jwt.PyJWTError as e:
        # the reason stays server-side; callers only learn that the token was rejected
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token") from e
    if not claims["sub"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token")
    email = claims.get("email")
    verified_email = email if isinstance(email, str) and claims.get("email_verified") is True else None
    if not email_allowed(verified_email, s):
        # no detail: a refused caller learns nothing about the list or about which check failed
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not allowed")
    return Identity(str(claims["sub"]), verified_email)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    """The calling user's id, after every check in `current_identity`."""
    return current_identity(creds).user_id
