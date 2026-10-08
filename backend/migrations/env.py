"""Alembic environment: runs migrations against the app's own DATABASE_URL."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import text

from app import models  # noqa: F401  (register tables on Base.metadata)
from app.db import Base, engine

# Both the API and the worker run `alembic upgrade head` before they start; on Postgres an
# advisory lock makes the second one wait, then find nothing left to do.
_MIGRATION_LOCK_ID = 7_406_311


def run_migrations_online() -> None:
    with engine.connect() as connection:
        is_postgres = connection.dialect.name == "postgresql"
        if is_postgres:
            connection.execute(text("SELECT pg_advisory_lock(:id)"), {"id": _MIGRATION_LOCK_ID})
            connection.commit()
        try:
            context.configure(
                connection=connection,
                target_metadata=Base.metadata,
                render_as_batch=connection.dialect.name == "sqlite",  # SQLite can't ALTER most things
                compare_type=True,
            )
            with context.begin_transaction():
                context.run_migrations()
        finally:
            if is_postgres:
                connection.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": _MIGRATION_LOCK_ID})
                connection.commit()


# The CLI gets alembic.ini's log setup; in-process callers (app.db.migrate_to_head) keep their own.
if context.config.config_file_name and context.config.attributes.get("configure_logger", True):
    fileConfig(context.config.config_file_name, disable_existing_loggers=False)

if context.is_offline_mode():
    raise SystemExit("offline (--sql) migrations are not supported; run against a database")
run_migrations_online()
