from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

_bearer = HTTPBearer(auto_error=False)

# Google's public keys for Firebase Authentication ID tokens (rotated by Google; PyJWKClient caches them)
FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    """Return the user id.

    dev mode (local SQLite only, enforced by Settings): the bearer token *is* the user id
    (default "dev" when absent).
    firebase mode: verify the Firebase ID token's signature, expiry, issuer and audience (both
    name this project, so a token minted for another Firebase project is refused) and return
    its `sub`, the Firebase user id.

    Raises:
        HTTPException: 401 in firebase mode when the token is missing or fails verification.
    """
    s = get_settings()
    if s.auth_mode == "dev":
        return creds.credentials if creds else "dev"

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
    return str(claims["sub"])
