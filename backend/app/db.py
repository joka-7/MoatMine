from collections.abc import Iterator
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def _make_engine(url: str):
    # Render gives postgres:// URLs; SQLAlchemy + psycopg3 wants postgresql+psycopg://
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {"pool_pre_ping": True}
    return create_engine(url, **kwargs)


engine = _make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def _alembic_config():  # -> alembic.config.Config (alembic is imported lazily, off the request path)
    from alembic.config import Config

    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    cfg.attributes["configure_logger"] = False
    return cfg


def schema_is_current() -> bool:
    """Whether the database answers and is at the newest migration. Raises if it can't be reached."""
    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory

    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
        current = set(MigrationContext.configure(conn).get_current_heads())
    return current == set(ScriptDirectory.from_config(_alembic_config()).get_heads())


def migrate_to_head() -> None:
    """Apply every pending Alembic migration, as `alembic upgrade head` does.

    Deploys run the CLI before the services start; this is for the seed script and tests.
    """
    from alembic import command

    command.upgrade(_alembic_config(), "head")


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
