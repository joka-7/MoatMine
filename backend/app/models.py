from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


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
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    source: Mapped[str] = mapped_column(String(20))  # target | watch
    ref_id: Mapped[int] = mapped_column(Integer)
    symbol: Mapped[str | None] = mapped_column(String(16), nullable=True)
    message: Mapped[str] = mapped_column(String(500))
    dedupe_key: Mapped[str] = mapped_column(String(200), index=True)
    read: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AIKey(Base):
    """User-supplied (BYO) provider key, Fernet-encrypted."""

    __tablename__ = "ai_keys"
    __table_args__ = (UniqueConstraint("user_id", "provider"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    provider: Mapped[str] = mapped_column(String(30))  # anthropic | openai | gemini | external
    encrypted_key: Mapped[str] = mapped_column(Text)
    base_url: Mapped[str] = mapped_column(String(500), default="")  # for external agents
    model: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class MCPToken(Base):
    """Bearer token an external agent uses to reach this user's data over MCP. Stored hashed."""

    __tablename__ = "mcp_tokens"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    label: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
