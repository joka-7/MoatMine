"""Tools the in-app agent can call. Shared with the MCP server so external agents get the same surface.

Read-heavy by design; the only writes are adding to the watchlist and saving a stock note.
No tool places trades.
"""

import json
import time
from collections.abc import Awaitable, Callable
from dataclasses import replace

from model_dispatcher import Tool, ToolRegistry, ToolSpec
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics import price_stats
from app.crises import bad_times
from app.jsontypes import JSONDict
from app.market import get_provider
from app.models import StockNote, Target, WatchItem
from app.portfolio import BookMode, portfolio_snapshot, quotes_for
from app.research import news_feed, valuation
from app.safety.service import check_for, get_profile, portfolio_risk_report, profile_dict, stock_safety, stress_report
from app.targets import evaluate, risk_by_symbol
from app.valuation import Assumptions


def _sym_param(desc: str = "Ticker symbol, e.g. AAPL") -> JSONDict:
    return {"type": "object", "properties": {"symbol": {"type": "string", "description": desc}}, "required": ["symbol"]}


_MODE_PROP = {
    "mode": {
        "type": "string",
        "enum": ["real", "paper"],
        "description": "Which book: 'real' money (default) or 'paper' practice accounts. They are never mixed.",
    }
}


def _mode_param() -> JSONDict:
    return {"type": "object", "properties": dict(_MODE_PROP)}


class _ValuationArgs(BaseModel):
    """The model's assumption overrides, held to the same bounds as GET /stocks/{symbol}/valuation."""

    discount_rate: float | None = Field(None, gt=0, le=40)
    growth_rate: float | None = Field(None, ge=-20, le=60)
    terminal_growth: float | None = Field(None, ge=-2, le=6)
    margin_of_safety: float | None = Field(None, ge=0, le=90)

    def assumptions(self) -> Assumptions:
        given = {k: v for k, v in self.model_dump().items() if v is not None}
        d = Assumptions()
        return replace(
            d,
            discount_rate=given.get("discount_rate", d.discount_rate),
            growth_rate=given.get("growth_rate", d.growth_rate),
            terminal_growth=given.get("terminal_growth", d.terminal_growth),
            margin_of_safety=given.get("margin_of_safety", d.margin_of_safety),
        )


class _CheckArgs(BaseModel):
    """Same bound as POST /safety/check: a negative amount would make any buy look smaller."""

    amount: float = Field(gt=0)


def _mode(args: JSONDict) -> BookMode:
    return "paper" if args.get("mode") == "paper" else "real"


TOOL_SPECS: list[JSONDict] = [
    {"name": "get_portfolio", "description": "User's accounts, holdings with P/L and weights, and totals for the real-money or the paper book.", "parameters": _mode_param()},
    {"name": "get_quote", "description": "Latest quote for a symbol.", "parameters": _sym_param()},
    {"name": "get_ratios", "description": "Fundamental ratios (P/E, ROE, margins…) and 1-year price/risk stats (volatility, drawdown, Sharpe, RSI).", "parameters": _sym_param()},
    {"name": "get_news", "description": "Recent company news headlines for a symbol.", "parameters": _sym_param()},
    {"name": "get_company", "description": "Company profile: description, sector, industry, employees, website, IPO date, market cap.", "parameters": _sym_param()},
    {"name": "get_earnings", "description": "Recent quarterly EPS: actual vs estimate and surprise %.", "parameters": _sym_param()},
    {"name": "get_analysts", "description": "Analyst recommendation trend (strong buy … strong sell) and consensus price target.", "parameters": _sym_param()},
    {"name": "get_dividends", "description": "Dividend history and stock splits.", "parameters": _sym_param()},
    {
        "name": "get_valuation",
        "description": "Fair-value estimate from several models (DCF, Graham, Lynch, DDM, EPV, P/E and EV/EBITDA multiples), "
        "valuation indicators (PEG, FCF yield, payout…) and quality scores (Piotroski F, Altman Z). "
        "Optional assumption overrides in percent.",
        "parameters": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string"},
                "discount_rate": {"type": "number"}, "growth_rate": {"type": "number"},
                "terminal_growth": {"type": "number"}, "margin_of_safety": {"type": "number"},
            },
            "required": ["symbol"],
        },
    },
    {
        "name": "get_bad_times",
        "description": "How the stock behaved in past market crises (dot-com, 2008, 2011, Q4 2018, COVID, 2022) vs SPY: "
        "drawdown, recovery time, downside capture, plus its own worst drawdowns. Use for any safety/risk question.",
        "parameters": _sym_param(),
    },
    {"name": "get_risk_profile", "description": "The user's own risk rules: level, max position/sector %, minimum safety score, volatility and loss limits, cooling-off. Every recommendation must respect these.", "parameters": {"type": "object", "properties": {}}},
    {"name": "get_safety_score", "description": "0–100 safety score for a stock with its components (Altman Z, Piotroski, debt, volatility, worst fall, crisis resilience, size, earnings, valuation, moat: return on capital, margin stability, steady growth) with A–F grades by area and red flags.", "parameters": _sym_param()},
    {
        "name": "safety_check",
        "description": "Check a proposed buy against the user's risk rules: pass / warn / block with each rule's result. Run this before discussing any buy.",
        "parameters": {
            "type": "object",
            "properties": {"symbol": {"type": "string"}, "amount": {"type": "number", "description": "money to invest"}, **_MODE_PROP},
            "required": ["symbol", "amount"],
        },
    },
    {"name": "get_portfolio_risk", "description": "Portfolio volatility, beta, value-at-risk, max drawdown, concentration, sectors, correlation and rule breaches, for the real-money or the paper book.", "parameters": _mode_param()},
    {"name": "get_stress_test", "description": "Today's portfolio (real-money or paper book) replayed through past crises and market falls of 10/20/35%, vs the user's loss limit.", "parameters": _mode_param()},
    {"name": "get_news_feed", "description": "Recent news across all holdings and watchlist symbols.", "parameters": {"type": "object", "properties": {}}},
    {"name": "get_targets_status", "description": "User's PAPI targets (profit, amount, period, intent) evaluated against their min/max bounds.", "parameters": {"type": "object", "properties": {}}},
    {"name": "get_watchlist", "description": "User's watchlist with live quotes.", "parameters": {"type": "object", "properties": {}}},
    {"name": "get_notes", "description": "User's own saved notes/thesis for a symbol.", "parameters": _sym_param()},
    {
        "name": "add_to_watchlist",
        "description": "Add a symbol to the user's watchlist. Only when the user asks.",
        "parameters": {"type": "object", "properties": {"symbol": {"type": "string"}, "note": {"type": "string"}}, "required": ["symbol"]},
    },
    {
        "name": "save_note",
        "description": "Save a note about a symbol to the user's stock page. Only when the user asks.",
        "parameters": {
            "type": "object",
            "properties": {"symbol": {"type": "string"}, "title": {"type": "string"}, "body": {"type": "string"}},
            "required": ["symbol", "title", "body"],
        },
    },
]


def registry(db: Session, user: str, used: list[str]) -> ToolRegistry:
    """Every tool as a ModelDispatcher ToolRegistry for one user's chat turn; `used` collects the names called."""
    reg = ToolRegistry()

    def handler(name: str) -> Callable[[JSONDict], Awaitable[str]]:
        async def run(args: JSONDict) -> str:
            used.append(name)
            return await run_tool(name, dict(args), db, user)

        return run

    for spec in TOOL_SPECS:
        reg.register(Tool(spec=ToolSpec(spec["name"], spec["description"], spec["parameters"]), ahandler=handler(spec["name"])))
    return reg


def openai_tools() -> list[JSONDict]:
    return [{"type": "function", "function": spec} for spec in TOOL_SPECS]


async def run_tool(name: str, args: JSONDict, db: Session, user: str) -> str:
    """Run one tool and return its JSON result. Arguments come from a model, so bad ones become an
    error the model can read and correct, not an exception."""
    try:
        out = await _run(name, args, db, user)
    except ValidationError as e:
        out = {"error": "invalid arguments", "details": [f"{'.'.join(map(str, err['loc']))}: {err['msg']}" for err in e.errors()]}
    return json.dumps(out, default=str)


async def _run(name: str, args: JSONDict, db: Session, user: str) -> object:
    p = get_provider()
    sym = (args.get("symbol") or "").strip().upper()
    out: object  # any JSON-serialisable result
    match name:
        case "get_portfolio":
            out = await portfolio_snapshot(db, user, p, _mode(args))
        case "get_quote":
            out = await p.quote(sym)
        case "get_ratios":
            end = int(time.time())
            bars = await p.candles(sym, "D", end - 365 * 86400, end)
            out = {"fundamental": await p.metrics(sym), "price": price_stats([b["c"] for b in bars])}
        case "get_news":
            out = [{k: n[k] for k in ("headline", "source", "datetime", "url")} for n in (await p.news(sym))[:10]]
        case "get_company":
            out = {**(await p.profile(sym)), **(await p.company(sym))}
        case "get_earnings":
            out = (await p.earnings(sym))[:8]
        case "get_analysts":
            out = {"recommendations": (await p.recommendations(sym))[:3], "price_target": await p.price_target(sym)}
        case "get_dividends":
            out = {"dividends": (await p.dividends(sym))[:12], "splits": await p.splits(sym)}
        case "get_valuation":
            v = await valuation(p, sym, _ValuationArgs.model_validate(args).assumptions())
            out = {k: v[k] for k in ("price", "assumptions", "models", "summary", "indicators", "quality", "disclaimer")}
        case "get_bad_times":
            out = await bad_times(p, sym)
        case "get_risk_profile":
            out = profile_dict(get_profile(db, user))
        case "get_safety_score":
            out = await stock_safety(p, sym)
        case "safety_check":
            out = await check_for(db, user, p, sym, _CheckArgs.model_validate(args).amount, _mode(args))
        case "get_portfolio_risk":
            out = await portfolio_risk_report(db, user, p, _mode(args))
        case "get_stress_test":
            r = await stress_report(db, user, p, _mode(args))
            out = {**r, "scenarios": [{k: sc[k] for k in ("name", "change", "change_pct", "worst", "breaches_limit")} for sc in r["scenarios"]]}
        case "get_news_feed":
            out = [{k: n[k] for k in ("symbol", "headline", "source", "datetime")} for n in (await news_feed(db, user, p, 7, 25))]
        case "get_targets_status":
            snap = await portfolio_snapshot(db, user, p)
            risks = await risk_by_symbol(p, {h["symbol"] for h in snap["holdings"]})
            out = [evaluate(t, snap, risks) for t in db.scalars(select(Target).where(Target.user_id == user)).all()]
        case "get_watchlist":
            items = db.scalars(select(WatchItem).where(WatchItem.user_id == user)).all()
            q = await quotes_for(p, {i.symbol for i in items})
            out = [{"symbol": i.symbol, "note": i.note, "quote": q.get(i.symbol)} for i in items]
        case "get_notes":
            notes = db.scalars(select(StockNote).where(StockNote.user_id == user, StockNote.symbol == sym)).all()
            out = [{"kind": n.kind, "title": n.title, "body": n.body[:2000]} for n in notes]
        case "add_to_watchlist":
            db.add(WatchItem(user_id=user, symbol=sym, note=args.get("note", "")))
            try:
                db.commit()
                out = {"ok": True, "symbol": sym}
            except IntegrityError:
                db.rollback()
                out = {"ok": False, "error": f"{sym} already on watchlist"}
        case "save_note":
            db.add(StockNote(user_id=user, symbol=sym, kind="note", title=args["title"][:200], body=args["body"]))
            db.commit()
            out = {"ok": True}
        case _:
            out = {"error": f"unknown tool {name}"}
    return out
