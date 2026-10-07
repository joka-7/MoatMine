from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

from app.db import Base, engine


def test_migrate_to_head_matches_models(client):
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata)
    assert diff == []


def test_ready_checks_database_and_schema(client, monkeypatch):
    assert client.get("/health/ready").json() == {"ok": True, "database": "ok"}

    from alembic.script import ScriptDirectory

    monkeypatch.setattr(ScriptDirectory, "get_heads", lambda self: ["9999_not_applied"])
    r = client.get("/health/ready")
    assert r.status_code == 503 and "alembic upgrade head" in r.json()["database"]


def test_ready_reports_unreachable_database(client, monkeypatch):
    from sqlalchemy.exc import OperationalError

    import app.main

    def down():
        raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    monkeypatch.setattr(app.main, "schema_is_current", down)
    r = client.get("/health/ready")
    assert r.status_code == 503 and r.json() == {"ok": False, "database": "unreachable"}
