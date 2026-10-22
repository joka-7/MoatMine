from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(UTC)


class Account(Base):
    """A brokerage account. `broker="manual"` until a SnapTrade/Plaid link is added."""

    __tablename__ = "accounts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(120))
    broker: Mapped[str] = mapped_column(String(60), default="manual")
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    cash: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    holdings: Mapped[list["Holding"]] = relationship(back_populates="account", cascade="all, delete-orphan")


class Holding(Base):
    __tablename__ = "holdings"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    symbol: Mapped[str] = mapped_column(String(16), index=True)
    quantity: Mapped[float] = mapped_column(Float)
    avg_cost: Mapped[float] = mapped_column(Float)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    account: Mapped[Account] = relationship(back_populates="holdings")


class WatchItem(Base):
    __tablename__ = "watchlist"
    __table_args__ = (UniqueConstraint("user_id", "symbol"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    symbol: Mapped[str] = mapped_column(String(16))
    note: Mapped[str] = mapped_column(String(500), default="")
    alert_above: Mapped[float | None] = mapped_column(Float, nullable=True)
    alert_below: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class StockNote(Base):
    """User's own info/news/thesis entries about a stock."""

    __tablename__ = "stock_notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    symbol: Mapped[str] = mapped_column(String(16), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="note")  # note | news | thesis | link
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(String(1000), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Target(Base):
    """PAPI target with MAMI bounds.

    PAPI = Profit, Amount, Period, Intent. Each has a target plus MAMI (min/max).
      profit  -> % return on cost
      amount  -> position (or portfolio) market value
      period  -> days held
      intent  -> category + risk bounds (annualised volatility %)
    symbol=None scopes the target to the whole portfolio.
    """

    __tablename__ = "targets"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(120))
    symbol: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)

    profit_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    profit_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    profit_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    amount_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    amount_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    amount_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    period_target_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    period_min_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    period_max_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    intent: Mapped[str] = mapped_column(String(30), default="growth")  # growth|income|speculation|hedge|retirement|custom
    intent_note: Mapped[str] = mapped_column(String(500), default="")
    risk_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_max: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Alert(Base):
    __tablename__ = "alerts"
    # one unread alert per condition, enforced by the database so two overlapping worker passes
    # can't both write it
    __table_args__ = (
        Index("uq_alerts_unread_dedupe", "user_id", "dedupe_key", unique=True,
              sqlite_where=text("NOT read"), postgresql_where=text("NOT read")),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    source: Mapped[str] = mapped_column(String(20))  # target | watch
    ref_id: Mapped[int] = mapped_column(Integer)
    symbol: Mapped[str | None] = mapped_column(String(16), nullable=True)
    message: Mapped[str] = mapped_column(String(500))
    dedupe_key: Mapped[str] = mapped_column(String(200), index=True)
    read: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


ALERT_WORKER = "alerts"  # WorkerHeartbeat.name of app.worker


class WorkerHeartbeat(Base):
    """The worker's last completed pass, so a stalled or crash-looping worker is visible."""

    __tablename__ = "worker_heartbeats"
    name: Mapped[str] = mapped_column(String(40), primary_key=True)
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[float] = mapped_column(Float)
    alerts_created: Mapped[int] = mapped_column(Integer)
    users_failed: Mapped[int] = mapped_column(Integer)


class AISettings(Base):
    """The user's AI settings (ModelDispatcher AgentConfig shape + external agent), encrypted at rest."""

    __tablename__ = "ai_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    encrypted_config: Mapped[str] = mapped_column(Text)
    favorite: Mapped[str | None] = mapped_column(String(30), nullable=True)  # external chat app id
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class MCPToken(Base):
    """Bearer token an external agent uses to reach this user's data over MCP. Stored hashed."""

    __tablename__ = "mcp_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    label: Mapped[str] = mapped_column(String(120), default="")
    # the owner's verified email when the token was made, so the allow-list can be checked on every
    # /mcp call (the token itself carries no email); None for tokens made before the allow-list
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RiskProfile(Base):
    """The user's own risk rules. Every safety check, plan and alert is measured against these."""

    __tablename__ = "risk_profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    level: Mapped[str] = mapped_column(String(20), default="moderate")  # conservative|moderate|balanced|growth
    answers: Mapped[str] = mapped_column(Text, default="{}")  # questionnaire answers, JSON
    max_position_pct: Mapped[float] = mapped_column(Float, default=8.0)
    max_sector_pct: Mapped[float] = mapped_column(Float, default=25.0)
    min_safety_score: Mapped[float] = mapped_column(Float, default=60.0)
    max_volatility_pct: Mapped[float] = mapped_column(Float, default=35.0)
    max_drawdown_pct: Mapped[float] = mapped_column(Float, default=-20.0)  # portfolio loss limit, negative
    min_market_cap_m: Mapped[float] = mapped_column(Float, default=2000.0)
    allow_penny_stocks: Mapped[bool] = mapped_column(default=False)
    cooling_off_hours: Mapped[int] = mapped_column(Integer, default=24)
    paper_mode: Mapped[bool] = mapped_column(default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class BuyPlan(Base):
    """A proposed buy that must pass the safety check (and, if risky, a note + cooling-off) before it runs."""

    __tablename__ = "buy_plans"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    symbol: Mapped[str] = mapped_column(String(16))
    quantity: Mapped[float] = mapped_column(Float)
    price: Mapped[float] = mapped_column(Float)
    note: Mapped[str] = mapped_column(Text, default="")
    verdict: Mapped[str] = mapped_column(String(10))  # pass | warn | block
    check_json: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(15))  # blocked | cooling_off | ready | executed | cancelled
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    executed_holding_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
