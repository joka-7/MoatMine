"""An MCP token only works while its owner's email is on the allow-list."""

import pytest

from app import mcp_server
from app.config import Settings
from app.crypto import hash_token
from app.db import SessionLocal
from app.models import MCPToken

PROJECT = "moatmine-test"


def settings(**kwargs: object) -> Settings:
    return Settings(auth_mode="firebase", database_url="sqlite:///./x.db", firebase_project_id=PROJECT, **kwargs)  # type: ignore[arg-type]


@pytest.fixture
def token_for(client):
    """Stores an MCP token for `email` and returns its secret."""
    made: list[int] = []

    def make(user: str, email: str | None) -> str:
        secret = f"secret-{user}-{email}"
        with SessionLocal() as db:
            row = MCPToken(user_id=user, email=email, token_hash=hash_token(secret), label="t")
            db.add(row)
            db.commit()
            made.append(row.id)
        return secret

    yield make
    with SessionLocal() as db:
        for token_id in made:
            db.delete(db.get(MCPToken, token_id))
        db.commit()


@pytest.mark.parametrize(
    ("email", "config", "user"),
    [
        ("owner@example.com", {"allowed_emails": "Owner@Example.com"}, "u1"),
        ("owner@example.com", {"allowed_emails": "someone-else@example.com"}, None),  # taken off the list
        (None, {"allowed_emails": "owner@example.com"}, None),  # made before the list existed
        (None, {"allow_any_user": True}, "u1"),  # the app is open to every account
    ],
)
def test_token_works_only_for_an_owner_on_the_list(monkeypatch, token_for, email, config, user):
    monkeypatch.setattr(mcp_server, "get_settings", lambda: settings(**config))
    assert mcp_server._user_for_token(token_for("u1", email)) == user


def test_unknown_or_missing_tokens_never_work(monkeypatch, token_for):
    monkeypatch.setattr(mcp_server, "get_settings", lambda: settings(allow_any_user=True))
    token_for("u1", "owner@example.com")
    assert mcp_server._user_for_token("not-a-token") is None
    assert mcp_server._user_for_token(None) is None
    assert mcp_server._user_for_token("") is None
