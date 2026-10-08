"""Gathers market data for the pure safety maths, and applies the user's risk profile."""

import asyncio
import json
import logging
import time
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.dispatcher import complete
from app.ai.llm_json import json_object_in
from app.analytics import annual_volatility_pct, max_drawdown_pct, returns
from app.cache import ttl_cache
from app.crises import CRISES, HISTORY_START, _ts, bad_times, crisis_stats
from app.jsontypes import JSONDict
from app.market.base import MarketProvider
from app.market.sources import source_label, track_sources
from app.models import RiskProfile, Target
from app.portfolio import BookMode, portfolio_snapshot
from app.safety.check import Book, Candidate, Rules, check_buy, portfolio_breaches
from app.safety.moat import moat_metrics
from app.safety.profile import DEFAULT_RULES, RULE_KEYS
from app.safety.risk import align, beta, portfolio_risk, stress_scenarios
from app.safety.score import StockFacts, safety_score
from app.valuation import Assumptions, estimate

logger = logging.getLogger(__name__)

BENCHMARK = "SPY"
AUTO_TARGET = "Risk profile (auto)"


# ---------------- per-stock ----------------


@ttl_cache(600)
async def stock_safety(provider: MarketProvider, symbol: str) -> JSONDict:
    now = int(time.time())
    with track_sources() as used:
        # two typed groups (gather's overloads stop at six), still all in flight at once
        prices = asyncio.gather(
            provider.quote(symbol),
            provider.candles(symbol, "D", now - 365 * 86400, now),
            provider.candles(symbol, "W", now - 5 * 365 * 86400, now),
            bad_times(provider, symbol, BENCHMARK),
        )
        company_data = asyncio.gather(
            provider.fundamentals(symbol),
            provider.company(symbol),
            provider.profile(symbol),
            provider.earnings(symbol),
            provider.history(symbol),
        )
        (quote, daily, weekly5y, hist), (fund, company, profile, earnings, annual) = await asyncio.gather(prices, company_data)
    moat = moat_metrics(annual)
    price = quote["price"]
    val = estimate(price, fund, Assumptions())
    weekly = [b["c"] for b in weekly5y]
    max_dd = max_drawdown_pct(weekly)

    facts = StockFacts(
        price=price,
        altman_zone=val["quality"]["altman_z"]["zone"],
        piotroski=val["quality"]["piotroski"]["score"],
        net_debt_to_ebitda=val["indicators"]["net_debt_to_ebitda"],
        volatility_pct=annual_volatility_pct([b["c"] for b in daily]),
        max_drawdown_pct=max_dd,
        downside_capture_pct=hist["resilience"]["downside_capture_pct"],
        market_cap_m=profile.get("market_cap"),
        eps_quarters=tuple(e["actual"] for e in earnings[:8] if e.get("actual") is not None),
        eps_ttm=fund.get("eps"),
        fair_value=val["summary"]["fair_value"],
        roic_avg_pct=moat["roic_avg_pct"] if moat else fund.get("roic_5y"),
        roic_consistency=moat["roic_consistency"] if moat else None,
        gross_margin_std_pp=moat["gross_margin_std_pp"] if moat else None,
        revenue_cagr_pct=moat["revenue_cagr_pct"] if moat else None,
        growth_consistency=moat["growth_consistency"] if moat else None,
    )
    report = safety_score(facts)
    return {
        "symbol": symbol,
        **report,
        "facts": {k: getattr(facts, k) for k in facts.__dataclass_fields__ if k != "eps_quarters"},
        "sector": company.get("sector") or profile.get("industry") or None,
        "moat": moat,
        "data_source": source_label(provider.name, used),
    }


# ---------------- risk profile ----------------


def get_profile(db: Session, user: str) -> RiskProfile | None:
    return db.scalar(select(RiskProfile).where(RiskProfile.user_id == user))


def profile_dict(p: RiskProfile | None) -> JSONDict:
    if p is None:
        return {"saved": False, "level": "moderate", "answers": {}, "paper_mode": True, **DEFAULT_RULES["moderate"]}
    return {
        "saved": True, "level": p.level, "answers": json.loads(p.answers or "{}"), "paper_mode": p.paper_mode,
        **{k: getattr(p, k) for k in RULE_KEYS},
    }


def rules_for(db: Session, user: str) -> Rules:
    d = profile_dict(get_profile(db, user))
    return Rules(**{k: d[k] for k in RULE_KEYS})


def save_profile(db: Session, user: str, level: str, answers: JSONDict, overrides: JSONDict, paper_mode: bool) -> RiskProfile:
    p = get_profile(db, user) or RiskProfile(user_id=user)
    rules = {**DEFAULT_RULES[level], **{k: v for k, v in overrides.items() if v is not None}}
    p.level, p.answers, p.paper_mode = level, json.dumps(answers), paper_mode
    for k in RULE_KEYS:
        setattr(p, k, rules[k])
    db.add(p)
    _sync_auto_target(db, user, p)
    db.commit()
    return p


def _sync_auto_target(db: Session, user: str, p: RiskProfile) -> None:
    """Mirror the profile's loss and risk limits into a portfolio-level PAPI target (MAMI bounds)."""
    t = db.scalar(select(Target).where(Target.user_id == user, Target.name == AUTO_TARGET))
    if t is None:
        t = Target(user_id=user, name=AUTO_TARGET, symbol=None)
        db.add(t)
    t.profit_min = p.max_drawdown_pct
    t.risk_max = p.max_volatility_pct
    t.intent = "growth" if p.level == "growth" else "retirement" if p.level == "conservative" else "growth"
    t.intent_note = f"From your {p.level} risk profile. Edit the profile, not this target."


# ---------------- book & checks ----------------


async def book_for(
    db: Session, user: str, provider: MarketProvider, mode: BookMode = "real"
) -> tuple[JSONDict, Book, dict[str, str | None]]:
    snap = await portfolio_snapshot(db, user, provider, mode)
    syms = sorted({h["symbol"] for h in snap["holdings"]})
    reports = await asyncio.gather(*(sector_of(provider, s) for s in syms), return_exceptions=True)
    sectors: dict[str, str | None] = {}
    for sym, rep in zip(syms, reports, strict=True):
        if isinstance(rep, BaseException):
            # an unknown sector only skips that holding's sector rule; it must not sink the whole check
            logger.warning("sector lookup failed; counting it as Unknown", extra={"symbol": sym, "error": type(rep).__name__})
            sectors[sym] = None
        else:
            sectors[sym] = rep
    by_symbol: dict[str, float] = {}
    by_sector: dict[str, float] = {}
    for h in snap["holdings"]:
        by_symbol[h["symbol"]] = by_symbol.get(h["symbol"], 0) + h["value"]
        sec = sectors.get(h["symbol"]) or "Unknown"
        by_sector[sec] = by_sector.get(sec, 0) + h["value"]
    book = Book(total_value=snap["totals"]["net_worth"], by_symbol=by_symbol, by_sector=by_sector,
                cash=snap["totals"]["cash"], unpriced=tuple(snap["totals"]["unpriced"]))
    return snap, book, sectors


@ttl_cache(3600)
async def sector_of(provider: MarketProvider, symbol: str) -> str | None:
    c = await provider.company(symbol)
    return c.get("sector") or c.get("industry") or None


async def check_for(
    db: Session, user: str, provider: MarketProvider, symbol: str, amount: float, mode: BookMode = "real"
) -> JSONDict:
    """Safety check for buying `amount` of `symbol`, sized against the book the money would go into."""
    report, (_, book, _) = await asyncio.gather(stock_safety(provider, symbol), book_for(db, user, provider, mode))
    f = report["facts"]
    cand = Candidate(
        symbol=symbol, amount=amount, sector=report["sector"], price=f["price"], fair_value=f["fair_value"],
        market_cap_m=f["market_cap_m"], volatility_pct=f["volatility_pct"], safety=report,
    )
    out = check_buy(await asyncio.to_thread(rules_for, db, user), cand, book)
    out["mode"] = mode
    out["safety"] = {"score": report["score"], "grade": report["grade"], "flags": report["flags"]}
    return out


# ---------------- portfolio risk & stress ----------------


async def portfolio_risk_report(db: Session, user: str, provider: MarketProvider, mode: BookMode = "real") -> JSONDict:
    snap, book, sectors = await book_for(db, user, provider, mode)
    values = book.by_symbol
    rules = await asyncio.to_thread(rules_for, db, user)
    now = int(time.time())
    syms = sorted(values)
    with track_sources() as used:
        bars = await asyncio.gather(*(provider.candles(s, "D", now - 365 * 86400, now) for s in [*syms, BENCHMARK]))
    series = {s: [(b["t"], b["c"]) for b in bs] for s, bs in zip([*syms, BENCHMARK], bars, strict=True)}
    _, closes = align(series)
    bench = closes.pop(BENCHMARK, None)
    out = portfolio_risk(values, snap["totals"]["cash"], closes, bench, sectors)
    # the aligned window is the shortest history; say which holding cut it if it's much shorter than the market's
    held = {s: len(series[s]) for s in syms if series[s]}
    shortest = min(held, key=lambda s: held[s]) if held else None
    out["window_limited_by"] = shortest if shortest and held[shortest] < 0.9 * len(series[BENCHMARK]) else None

    out["breaches"] = [{"rule": b.rule, "subject": b.subject, "message": b.message} for b in portfolio_breaches(rules, book)]
    out["rules"] = {k: getattr(rules, k) for k in RULE_KEYS}
    out["data_source"] = source_label(provider.name, used)
    out["mode"] = mode
    return out


async def stress_report(db: Session, user: str, provider: MarketProvider, mode: BookMode = "real") -> JSONDict:
    snap, book, _ = await book_for(db, user, provider, mode)
    values = book.by_symbol
    now = int(time.time())
    start = _ts(HISTORY_START)
    syms = sorted(values)
    with track_sources() as used:
        weekly = await asyncio.gather(*(provider.candles(s, "W", start, now) for s in [*syms, BENCHMARK]))
        daily = await asyncio.gather(*(provider.candles(s, "D", now - 365 * 86400, now) for s in [*syms, BENCHMARK]))
    wk = dict(zip([*syms, BENCHMARK], weekly, strict=True))
    _, aligned = align({s: [(b["t"], b["c"]) for b in bs] for s, bs in zip([*syms, BENCHMARK], daily, strict=True)})
    bench_r = returns(aligned.get(BENCHMARK, []))
    betas = {s: beta(returns(aligned[s]), bench_r) if s in aligned else None for s in syms}

    crisis_dd: dict[str, dict[str, float | None]] = {s: {} for s in syms}
    bench_dd: dict[str, float | None] = {}
    for key, _name, s0, e0, _d in CRISES:
        b = crisis_stats(wk[BENCHMARK], s0, e0) if wk[BENCHMARK] else None
        bench_dd[key] = b["drawdown_pct"] if b else None
        for s in syms:
            st = crisis_stats(wk[s], s0, e0) if wk[s] else None
            crisis_dd[s][key] = st["drawdown_pct"] if st else None

    scenarios = stress_scenarios(values, snap["totals"]["cash"], betas, crisis_dd, bench_dd,
                                 [(k, n) for k, n, *_ in CRISES])
    limit = (await asyncio.to_thread(rules_for, db, user)).max_drawdown_pct
    for sc in scenarios:
        sc["breaches_limit"] = sc["change_pct"] < limit
    return {
        "total_value": round(sum(values.values()) + snap["totals"]["cash"], 2),
        "loss_limit_pct": limit,
        "betas": {s: (round(b, 2) if b is not None else None) for s, b in betas.items()},
        "scenarios": scenarios,
        "data_source": source_label(provider.name, used),
        "mode": mode,
        "note": "Replays past crises on today's holdings. Past falls don't predict future ones.",
        "as_of": datetime.now(UTC).date().isoformat(),
    }


# ---------------- AI analyzer ----------------

_ANALYZER_SYSTEM = (
    "You are a cautious stock-safety analyst. You get a stock's safety grades by area, red flags, the facts "
    "behind them and the user's own risk rules. Reply with JSON only: "
    '{"overview": "2-3 sentences", "areas": [{"name": "area name", "comment": "one sentence on why it got that grade"}], '
    '"fit": "one or two sentences on whether it fits the user\'s rules and why", '
    '"improve": "what would have to change for the grade to improve"}. '
    "Use only the data given. Never promise returns or call any investment safe; this is risk information, not advice."
)


async def ai_analysis(db: Session, user: str, provider: MarketProvider, symbol: str) -> JSONDict:
    report = await stock_safety(provider, symbol)
    payload = {
        "symbol": symbol,
        "score": report["score"], "grade": report["grade"], "coverage_pct": report["coverage_pct"],
        "areas": report["areas"], "flags": report["flags"], "facts": report["facts"], "sector": report["sector"],
        "user_rules": profile_dict(await asyncio.to_thread(get_profile, db, user)),
    }
    r = await complete(db, user, json.dumps(payload, default=str), system=_ANALYZER_SYSTEM)
    text = r["content"]
    parsed = json_object_in(text) or {}
    return {
        "symbol": symbol,
        "overview": str(parsed.get("overview") or text.strip())[:1500],
        "areas": [{"name": str(a.get("name", ""))[:80], "comment": str(a.get("comment", ""))[:400]}
                  for a in (parsed.get("areas") or []) if isinstance(a, dict)][:8],
        "fit": str(parsed.get("fit", ""))[:600],
        "improve": str(parsed.get("improve", ""))[:600],
        "model": r["model"],
    }
