from datetime import datetime
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class _Sym(BaseModel):
    @field_validator("symbol", check_fields=False)
    @classmethod
    def _upper(cls, v: str | None) -> str | None:
        return v.strip().upper() if v else v


class AccountIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    broker: str = Field("manual", max_length=60)  # "paper" makes it a practice account (a separate book)
    currency: str = "USD"
    cash: float = 0.0

    @field_validator("broker")
    @classmethod
    def _normalise_broker(cls, v: str) -> str:
        # "Paper" or " paper" must not silently become a real-money account
        return v.strip().lower() or "manual"


class AccountOut(AccountIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class HoldingIn(_Sym):
    account_id: int
    symbol: str = Field(min_length=1, max_length=16)
    quantity: float = Field(gt=0)
    avg_cost: float = Field(ge=0)
    opened_at: datetime | None = None


class HoldingUpdate(BaseModel):
    quantity: float | None = Field(default=None, gt=0)
    avg_cost: float | None = Field(default=None, ge=0)
    opened_at: datetime | None = None


class WatchIn(_Sym):
    symbol: str = Field(min_length=1, max_length=16)
    note: str = ""
    alert_above: float | None = None
    alert_below: float | None = None


class WatchOut(WatchIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class NoteIn(BaseModel):
    kind: Literal["note", "news", "thesis", "link"] = "note"
    title: str = Field(min_length=1, max_length=200)
    body: str = ""
    url: str = ""


class NoteOut(NoteIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    symbol: str
    created_at: datetime


class TargetIn(_Sym):
    name: str = Field(min_length=1, max_length=120)
    symbol: str | None = None
    profit_target: float | None = None
    profit_min: float | None = None
    profit_max: float | None = None
    amount_target: float | None = None
    amount_min: float | None = None
    amount_max: float | None = None
    period_target_days: int | None = None
    period_min_days: int | None = None
    period_max_days: int | None = None
    intent: Literal["growth", "income", "speculation", "hedge", "retirement", "custom"] = "growth"
    intent_note: str = ""
    risk_target: float | None = None
    risk_min: float | None = None
    risk_max: float | None = None

    @model_validator(mode="after")
    def _min_le_max(self) -> Self:
        for dim, lo, hi in [
            ("profit", self.profit_min, self.profit_max),
            ("amount", self.amount_min, self.amount_max),
            ("period", self.period_min_days, self.period_max_days),
            ("risk", self.risk_min, self.risk_max),
        ]:
            if lo is not None and hi is not None and lo > hi:
                raise ValueError(f"{dim}: min must be <= max")
        return self


class TargetOut(TargetIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source: str
    symbol: str | None
    message: str
    read: bool
    created_at: datetime


class ChatMessage(BaseModel):
    # no "system": the server owns the system prompt (it carries the user's risk rules)
    role: Literal["user", "assistant"]
    content: str


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    # "auto" lets ModelDispatcher route; a vendor id (anthropic|openai|gemini|groq) pins one;
    # "external" uses only the user's external agent endpoint
    model: str = "auto"
    symbol: str | None = None  # optional page context
