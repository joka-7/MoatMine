from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

_bearer = HTTPBearer(auto_error=False)


@lru_cache
def _jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url)


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> str:
    """Return the user id.

    dev mode: the bearer token *is* the user id (default "dev" when absent).
    clerk mode: verify the Clerk session JWT and return its `sub`.
    """
    s = get_settings()
    if s.auth_mode == "dev":
        return creds.credentials if creds else "dev"

    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing token")
    try:
        key = _jwks_client(s.clerk_jwks_url).get_signing_key_from_jwt(creds.credentials).key
        claims = jwt.decode(
            creds.credentials,
            key,
            algorithms=["RS256"],
            issuer=s.clerk_issuer or None,
            options={"verify_aud": False},
        )
    except jwt.PyJWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid token: {e}") from e
    return claims["sub"]
