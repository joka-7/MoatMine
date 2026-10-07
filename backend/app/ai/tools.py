"""Tools the in-app agent can call. Shared with the MCP server so external agents get the same surface.

Read-heavy by design; the only writes are adding to the watchlist and saving a stock note.
No tool places trades.
"""

import json
import time

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics import price_stats
from app.market import get_provider
from app.models import StockNote, Target, WatchItem
from app.portfolio import portfolio_snapshot, quotes_for
from app.research import news_feed, valuation
from app.valuation import Assumptions
from app.targets import evaluate, risk_by_symbol


def _sym_param(desc: str = "Ticker symbol, e.g. AAPL") -> dict:
    return {"type": "object", "properties": {"symbol": {"type": "string", "description": desc}}, "required": ["symbol"]}


TOOL_SPECS = [
    {"name": "get_portfolio", "description": "User's accounts, holdings with P/L and weights, and totals.", "parameters": {"type": "object", "properties": {}}},
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


def openai_tools() -> list[dict]:
    return [{"type": "function", "function": spec} for spec in TOOL_SPECS]


async def run_tool(name: str, args: dict, db: Session, user: str) -> str:
    p = get_provider()
    sym = (args.get("symbol") or "").strip().upper()
    match name:
        case "get_portfolio":
            out = await portfolio_snapshot(db, user, p)
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
            overrides = {k: float(args[k]) for k in ("discount_rate", "growth_rate", "terminal_growth", "margin_of_safety") if args.get(k) is not None}
            v = await valuation(p, sym, Assumptions(**overrides))
            out = {k: v[k] for k in ("price", "assumptions", "models", "summary", "indicators", "quality", "disclaimer")}
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
    return json.dumps(out, default=str)
