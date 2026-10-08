"""Re-encrypt every stored AI setting with the newest FERNET_KEY (step 2 of a key rotation).

    FERNET_KEY="<new>,<old>" python -m app.rotate_keys

Safe to re-run: rows already on the new key are re-encrypted to the same key. See docs/RUNBOOK.md.
"""

import logging

from sqlalchemy import select

from app.config import get_settings
from app.crypto import reencrypt
from app.db import SessionLocal
from app.log_config import configure_logging
from app.models import AISettings

logger = logging.getLogger(__name__)


def rotate_all() -> int:
    """Re-encrypt every AISettings row in one transaction; returns how many rows were rewritten.

    Raises:
        cryptography.fernet.InvalidToken: a row can't be decrypted with any configured key
            (nothing is committed).
    """
    with SessionLocal() as db:
        rows = db.scalars(select(AISettings)).all()
        for row in rows:
            row.encrypted_config = reencrypt(row.encrypted_config)
        db.commit()
        return len(rows)


if __name__ == "__main__":
    configure_logging(get_settings().log_level, get_settings().log_format)
    logger.info(f"re-encrypted {rotate_all()} AI settings rows with the newest FERNET_KEY")
