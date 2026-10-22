"""MCP tokens remember their owner's verified email, so the allow-list can be checked on every /mcp call.

Tokens that already exist keep a NULL email. When ALLOWED_EMAILS is in force they are refused
until their owner creates a new one.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-22 14:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0004'
down_revision: str | Sequence[str] | None = '0003'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('mcp_tokens', sa.Column('email', sa.String(length=320), nullable=True))


def downgrade() -> None:
    op.drop_column('mcp_tokens', 'email')
