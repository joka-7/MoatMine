"""Baseline schema: every table as it stood when Alembic replaced create_all.

Revision ID: 0001
Revises:
Create Date: 2026-10-07 20:45:10.290439
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0001'
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Databases deployed before migrations already have these tables (made by create_all).
    # Adopt them as-is so their first `alembic upgrade head` records this revision instead of failing.
    if sa.inspect(op.get_bind()).has_table("accounts"):
        return
    op.create_table('accounts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.String(length=128), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('broker', sa.String(length=60), nullable=False),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.Column('cash', sa.Float(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('accounts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_accounts_user_id'), ['user_id'], unique=False)

    op.create_table('ai_settings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.String(length=128), nullable=False),
    sa.Column('encrypted_config', sa.Text(), nullable=False),
    sa.Column('favorite', sa.String(length=30), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('ai_settings', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ai_settings_user_id'), ['user_id'], unique=True)

    op.create_table('alerts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.String(length=128), nullable=False),
    sa.Column('source', sa.String(length=20), nullable=False),
    sa.Column('ref_id', sa.Integer(), nullable=False),
    sa.Column('symbol', sa.String(length=16), nullable=True),
    sa.Column('message', sa.String(length=500), nullable=False),
    sa.Column('dedupe_key', sa.String(length=200), nullable=False),
    sa.Column('read', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('alerts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_alerts_dedupe_key'), ['dedupe_key'], unique=False)
        batch_op.create_index(batch_op.f('ix_alerts_user_id'), ['user_id'], unique=False)

    op.create_table('mcp_tokens',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.String(length=128), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('label', sa.String(length=120), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    with op.batch_alter_table('mcp_tokens', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_mcp_tokens_user_id'), ['user_id'], unique=False)

    op.create_table('risk_profiles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.String(length=128), nullable=False),
    sa.Column('level', sa.String(length=20), nullable=False),
    sa.Column('answers', sa.Text(), nullable=False),
    sa.Column('max_position_pct', sa.Float(), nullable=False),
    sa.Column('max_sector_pct', sa.Float(), nullable=False),
    sa.Column('min_safety_score', sa.Float(), nullable=False),
    sa.Column('max_volatility_pct', sa.Float(), nullable=False),
    sa.Column('max_drawdown_pct', sa.Float(), nullable=False),
    sa.Column('min_market_cap_m', sa.Float(), nullable=False),
    sa.Column('allow_penny_stocks', sa.Boolean(), nullable=False),
    sa.Column('cooling_off_hours', sa.Integer(), nullable=False),
    sa.Column('paper_mode', sa.Boolean(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('risk_profiles', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_risk_profiles_user_id'), ['user_id'], unique=True)

    op.create_table('stock_notes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.String(length=128), nullable=False),
    sa.Column('symbol', sa.String(length=16), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=False),
    sa.Column('body', sa.Text(), nullable=False),
    sa.Column('url', sa.String(length=1000), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('stock_notes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_stock_notes_symbol'), ['symbol'], unique=False)
        batch_op.create_index(batch_op.f('ix_stock_notes_user_id'), ['user_id'], unique=False)

    op.create_table('targets',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.String(length=128), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('symbol', sa.String(length=16), nullable=True),
    sa.Column('profit_target', sa.Float(), nullable=True),
    sa.Column('profit_min', sa.Float(), nullable=True),
    sa.Column('profit_max', sa.Float(), nullable=True),
    sa.Column('amount_target', sa.Float(), nullable=True),
    sa.Column('amount_min', sa.Float(), nullable=True),
    sa.Column('amount_max', sa.Float(), nullable=True),
    sa.Column('period_target_days', sa.Integer(), nullable=True),
    sa.Column('period_min_days', sa.Integer(), nullable=True),
    sa.Column('period_max_days', sa.Integer(), nullable=True),
    sa.Column('intent', sa.String(length=30), nullable=False),
    sa.Column('intent_note', sa.String(length=500), nullable=False),
    sa.Column('risk_target', sa.Float(), nullable=True),
    sa.Column('risk_min', sa.Float(), nullable=True),
    sa.Column('risk_max', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('targets', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_targets_symbol'), ['symbol'], unique=False)
        batch_op.create_index(batch_op.f('ix_targets_user_id'), ['user_id'], unique=False)

    op.create_table('watchlist',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.String(length=128), nullable=False),
    sa.Column('symbol', sa.String(length=16), nullable=False),
    sa.Column('note', sa.String(length=500), nullable=False),
    sa.Column('alert_above', sa.Float(), nullable=True),
    sa.Column('alert_below', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'symbol')
    )
    with op.batch_alter_table('watchlist', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_watchlist_user_id'), ['user_id'], unique=False)

    op.create_table('buy_plans',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.String(length=128), nullable=False),
    sa.Column('account_id', sa.Integer(), nullable=False),
    sa.Column('symbol', sa.String(length=16), nullable=False),
    sa.Column('quantity', sa.Float(), nullable=False),
    sa.Column('price', sa.Float(), nullable=False),
    sa.Column('note', sa.Text(), nullable=False),
    sa.Column('verdict', sa.String(length=10), nullable=False),
    sa.Column('check_json', sa.Text(), nullable=False),
    sa.Column('status', sa.String(length=15), nullable=False),
    sa.Column('available_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('executed_holding_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('buy_plans', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_buy_plans_user_id'), ['user_id'], unique=False)

    op.create_table('holdings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.String(length=128), nullable=False),
    sa.Column('account_id', sa.Integer(), nullable=False),
    sa.Column('symbol', sa.String(length=16), nullable=False),
    sa.Column('quantity', sa.Float(), nullable=False),
    sa.Column('avg_cost', sa.Float(), nullable=False),
    sa.Column('opened_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('holdings', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_holdings_symbol'), ['symbol'], unique=False)
        batch_op.create_index(batch_op.f('ix_holdings_user_id'), ['user_id'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('holdings', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_holdings_user_id'))
        batch_op.drop_index(batch_op.f('ix_holdings_symbol'))

    op.drop_table('holdings')
    with op.batch_alter_table('buy_plans', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_buy_plans_user_id'))

    op.drop_table('buy_plans')
    with op.batch_alter_table('watchlist', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_watchlist_user_id'))

    op.drop_table('watchlist')
    with op.batch_alter_table('targets', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_targets_user_id'))
        batch_op.drop_index(batch_op.f('ix_targets_symbol'))

    op.drop_table('targets')
    with op.batch_alter_table('stock_notes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_stock_notes_user_id'))
        batch_op.drop_index(batch_op.f('ix_stock_notes_symbol'))

    op.drop_table('stock_notes')
    with op.batch_alter_table('risk_profiles', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_risk_profiles_user_id'))

    op.drop_table('risk_profiles')
    with op.batch_alter_table('mcp_tokens', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_mcp_tokens_user_id'))

    op.drop_table('mcp_tokens')
    with op.batch_alter_table('alerts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_alerts_user_id'))
        batch_op.drop_index(batch_op.f('ix_alerts_dedupe_key'))

    op.drop_table('alerts')
    with op.batch_alter_table('ai_settings', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ai_settings_user_id'))

    op.drop_table('ai_settings')
    with op.batch_alter_table('accounts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_accounts_user_id'))

    op.drop_table('accounts')
