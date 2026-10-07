from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

from app.db import Base, engine


def test_migrate_to_head_matches_models(client):
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata)
    assert diff == []
