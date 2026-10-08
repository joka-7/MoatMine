"""Worker heartbeat table, and one unread alert per condition enforced by a unique index.

Existing duplicate unread alerts (possible when two worker passes overlapped) are marked read,
keeping the newest, so the index can be created.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-08 13:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0003'
down_revision: str | Sequence[str] | None = '0002'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('worker_heartbeats',
    sa.Column('name', sa.String(length=40), nullable=False),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('duration_seconds', sa.Float(), nullable=False),
    sa.Column('alerts_created', sa.Integer(), nullable=False),
    sa.Column('users_failed', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('name')
    )
    op.execute(
        "UPDATE alerts SET read = TRUE WHERE NOT read AND id NOT IN ("
        " SELECT MAX(id) FROM alerts WHERE NOT read GROUP BY user_id, dedupe_key)"
    )
    op.create_index('uq_alerts_unread_dedupe', 'alerts', ['user_id', 'dedupe_key'], unique=True,
                    sqlite_where=sa.text('NOT read'), postgresql_where=sa.text('NOT read'))


def downgrade() -> None:
    op.drop_index('uq_alerts_unread_dedupe', table_name='alerts',
                  sqlite_where=sa.text('NOT read'), postgresql_where=sa.text('NOT read'))
    op.drop_table('worker_heartbeats')
