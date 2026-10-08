"""Stop mirroring the loss limit into the auto target's profit floor.

The loss limit is a fall from the portfolio's peak; the target's profit floor is a return
against cost. Auto targets written before this change carry the limit as profit_min, which
alerted on the wrong condition. The worker now checks the loss limit itself.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-08 12:00:00
"""

from collections.abc import Sequence

from alembic import op

revision: str = '0002'
down_revision: str | Sequence[str] | None = '0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

AUTO_TARGET = "Risk profile (auto)"  # app.safety.service.AUTO_TARGET at the time of writing


def upgrade() -> None:
    op.execute(f"UPDATE targets SET profit_min = NULL WHERE name = '{AUTO_TARGET}'")


def downgrade() -> None:
    op.execute(
        "UPDATE targets SET profit_min = (SELECT max_drawdown_pct FROM risk_profiles"
        f" WHERE risk_profiles.user_id = targets.user_id) WHERE name = '{AUTO_TARGET}'"
    )
