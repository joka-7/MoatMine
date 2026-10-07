"""Gathers market data for the pure safety maths, and applies the user's risk profile."""

import asyncio
import json
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics import annual_volatility_pct
from app.cache import ttl_cache
from app.crises import CRISES, HISTORY_START, _ts, bad_times, crisis_stats
from app.market.base import MarketProvider
from app.models import Account, RiskProfile, Target
from app.portfolio import portfolio_snapshot
from app.safety.check import Book, Candidate, Rules, check_buy
from app.safety.profile import DEFAULT_RULES, RULE_KEYS
from app.safety.risk import align, beta, daily_returns, portfolio_risk, stress_scenarios
from app.safety.score import StockFacts, safety_score
from app.valuation import Assumptions, estimate

BENCHMARK = "SPY"
AUTO_TARGET = "Risk profile (auto)"


# ---------------- per-stock ----------------


@ttl_cache(600)
async def stock_safety(provider: MarketProvider, symbol: str) -> dict:
    now = int(time.time())
    quote, fund, daily, weekly5y, company, profile, earnings, hist = await asyncio.gather(
        provider.quote(symbol),
        provider.fundamentals(symbol),
        provider.candles(symbol, "D", now - 365 * 86400, now),
        provider.candles(symbol, "W", now - 5 * 365 * 86400, now),
        provider.company(symbol),
        provider.profile(symbol),
        provider.earnings(symbol),
        bad_times(provider, symbol, BENCHMARK),
    )
    price = quote["price"]
    val = estimate(price, fund, Assumptions())
    weekly = [b["c"] for b in weekly5y]
    max_dd = None
    if weekly:
        peak, worst = weekly[0], 0.0
        for c in weekly:
            peak = max(peak, c)
            worst = min(worst, c / peak - 1)
        max_dd = round(worst * 100, 1)

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
    )
    report = safety_score(facts)
    return {
        "symbol": symbol,
        **report,
        "facts": {k: getattr(facts, k) for k in facts.__dataclass_fields__ if k != "eps_quarters"},
        "sector": company.get("sector") or profile.get("industry") or None,
        "data_source": provider.name,
    }


# ---------------- risk profile ----------------


def get_profile(db: Session, user: str) -> RiskProfile | None:
    return db.scalar(select(RiskProfile).where(RiskProfile.user_id == user))


def profile_dict(p: RiskProfile | None) -> dict:
    if p is None:
        return {"saved": False, "level": "moderate", "answers": {}, "paper_mode": True, **DEFAULT_RULES["moderate"]}
    return {
        "saved": True, "level": p.level, "answers": json.loads(p.answers or "{}"), "paper_mode": p.paper_mode,
        **{k: getattr(p, k) for k in RULE_KEYS},
    }


def rules_for(db: Session, user: str) -> Rules:
    d = profile_dict(get_profile(db, user))
    return Rules(**{k: d[k] for k in RULE_KEYS})


def save_profile(db: Session, user: str, level: str, answers: dict, overrides: dict, paper_mode: bool) -> RiskProfile:
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


async def book_for(db: Session, user: str, provider: MarketProvider) -> tuple[dict, Book, dict[str, str | None]]:
    snap = await portfolio_snapshot(db, user, provider)
    syms = sorted({h["symbol"] for h in snap["holdings"]})
    reports = await asyncio.gather(*(sector_of(provider, s) for s in syms))
    sectors = dict(zip(syms, reports))
    by_symbol: dict[str, float] = {}
    by_sector: dict[str, float] = {}
    for h in snap["holdings"]:
        by_symbol[h["symbol"]] = by_symbol.get(h["symbol"], 0) + h["value"]
        sec = sectors.get(h["symbol"]) or "Unknown"
        by_sector[sec] = by_sector.get(sec, 0) + h["value"]
    return snap, Book(total_value=snap["totals"]["net_worth"], by_symbol=by_symbol, by_sector=by_sector), sectors


@ttl_cache(3600)
async def sector_of(provider: MarketProvider, symbol: str) -> str | None:
    c = await provider.company(symbol)
    return c.get("sector") or c.get("industry") or None


async def check_for(db: Session, user: str, provider: MarketProvider, symbol: str, amount: float) -> dict:
    report, (_, book, _) = await asyncio.gather(stock_safety(provider, symbol), book_for(db, user, provider))
    f = report["facts"]
    cand = Candidate(
        symbol=symbol, amount=amount, sector=report["sector"], price=f["price"], fair_value=f["fair_value"],
        market_cap_m=f["market_cap_m"], volatility_pct=f["volatility_pct"], safety=report,
    )
    out = check_buy(rules_for(db, user), cand, book)
    out["safety"] = {"score": report["score"], "grade": report["grade"], "flags": report["flags"]}
    return out


def account_is_paper(db: Session, account_id: int) -> bool:
    acc = db.get(Account, account_id)
    return bool(acc and acc.broker == "paper")


# ---------------- portfolio risk & stress ----------------


async def portfolio_risk_report(db: Session, user: str, provider: MarketProvider) -> dict:
    snap, book, sectors = await book_for(db, user, provider)
    values = book.by_symbol
    rules = rules_for(db, user)
    now = int(time.time())
    syms = sorted(values)
    bars = await asyncio.gather(*(provider.candles(s, "D", now - 365 * 86400, now) for s in [*syms, BENCHMARK]))
    series = {s: [(b["t"], b["c"]) for b in bs] for s, bs in zip([*syms, BENCHMARK], bars)}
    _, closes = align(series)
    bench = closes.pop(BENCHMARK, None)
    out = portfolio_risk(values, snap["totals"]["cash"], closes, bench, sectors)

    breaches = []
    total = out["total_value"]
    for s, v in values.items():
        pct = v / total * 100 if total else 0
        if pct > rules.max_position_pct:
            breaches.append({"rule": "position_size", "subject": s, "message": f"{s} is {pct:.1f}% of the portfolio (limit {rules.max_position_pct:g}%)"})
    for sec, pct in out["sectors"].items():
        if sec != "Unknown" and pct > rules.max_sector_pct:
            breaches.append({"rule": "sector", "subject": sec, "message": f"{sec} is {pct:.1f}% of the portfolio (limit {rules.max_sector_pct:g}%)"})
    out["breaches"] = breaches
    out["rules"] = {k: getattr(rules, k) for k in RULE_KEYS}
    out["data_source"] = provider.name
    return out


async def stress_report(db: Session, user: str, provider: MarketProvider) -> dict:
    snap, book, _ = await book_for(db, user, provider)
    values = book.by_symbol
    now = int(time.time())
    start = _ts(HISTORY_START)
    syms = sorted(values)
    weekly = await asyncio.gather(*(provider.candles(s, "W", start, now) for s in [*syms, BENCHMARK]))
    daily = await asyncio.gather(*(provider.candles(s, "D", now - 365 * 86400, now) for s in [*syms, BENCHMARK]))
    wk = dict(zip([*syms, BENCHMARK], weekly))
    _, aligned = align({s: [(b["t"], b["c"]) for b in bs] for s, bs in zip([*syms, BENCHMARK], daily)})
    bench_r = daily_returns(aligned.get(BENCHMARK, []))
    betas = {s: beta(daily_returns(aligned[s]), bench_r) if s in aligned else None for s in syms}

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
    limit = rules_for(db, user).max_drawdown_pct
    for sc in scenarios:
        sc["breaches_limit"] = sc["change_pct"] < limit
    return {
        "total_value": round(sum(values.values()) + snap["totals"]["cash"], 2),
        "loss_limit_pct": limit,
        "betas": {s: (round(b, 2) if b is not None else None) for s, b in betas.items()},
        "scenarios": scenarios,
        "data_source": provider.name,
        "note": "Replays past crises on today's holdings. Past falls don't predict future ones.",
        "as_of": datetime.now(timezone.utc).date().isoformat(),
    }
