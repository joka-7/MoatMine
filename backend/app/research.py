"""Research helpers shared by the API, AI tools and MCP: valuation, news feed, AI news summary."""

import asyncio
import hashlib
import json
import re
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.market.base import MarketProvider
from app.models import Holding, WatchItem
from app.valuation import Assumptions, estimate


async def valuation(provider: MarketProvider, symbol: str, a: Assumptions) -> dict:
    q, f = await asyncio.gather(provider.quote(symbol), provider.fundamentals(symbol))
    out = estimate(q["price"], f, a)
    out["symbol"] = symbol
    out["data_source"] = provider.name
    return out


async def news_feed(db: Session, user: str, provider: MarketProvider, days: int = 7, limit: int = 60) -> list[dict]:
    """Merged, de-duplicated news for everything the user holds or watches, newest first."""
    held = set(db.scalars(select(Holding.symbol).where(Holding.user_id == user)).all())
    watched = set(db.scalars(select(WatchItem.symbol).where(WatchItem.user_id == user)).all())
    syms = sorted(held | watched)[:25]  # stay inside provider rate limits
    results = await asyncio.gather(*(provider.news(s, days) for s in syms), return_exceptions=True)
    seen, out = set(), []
    for sym, items in zip(syms, results):
        if isinstance(items, Exception):
            continue
        for n in items:
            key = n["url"] or n["headline"]
            if key in seen:
                continue
            seen.add(key)
            out.append({**n, "symbol": sym, "held": sym in held})
    return sorted(out, key=lambda n: n["datetime"], reverse=True)[:limit]


_SUMMARY_SYSTEM = (
    "You summarise stock news for an investor. Reply with JSON only: "
    '{"summary": "2-3 sentences", "sentiment": "bullish|neutral|bearish|mixed", '
    '"points": ["up to 4 short key points"], "watch": "one thing to watch next"}. '
    "Base it only on the headlines given; say so if they are thin or irrelevant."
)
_cache: dict[str, tuple[float, dict]] = {}
_TTL = 3600


def _parse_json(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.S)
    try:
        d = json.loads(m.group(0) if m else text)
    except (json.JSONDecodeError, AttributeError):
        return {"summary": text.strip()[:1200], "sentiment": "unknown", "points": [], "watch": ""}
    sentiment = str(d.get("sentiment", "unknown")).lower()
    if sentiment not in ("bullish", "neutral", "bearish", "mixed"):
        sentiment = "unknown"
    return {
        "summary": str(d.get("summary", ""))[:1200],
        "sentiment": sentiment,
        "points": [str(p)[:300] for p in (d.get("points") or [])][:4],
        "watch": str(d.get("watch", ""))[:300],
    }


async def news_summary(db: Session, user: str, provider: MarketProvider, symbol: str, days: int = 7) -> dict:
    items = (await provider.news(symbol, days))[:20]
    if not items:
        return {"symbol": symbol, "summary": "No news in this window.", "sentiment": "neutral", "points": [], "watch": "", "count": 0}
    lines = "\n".join(f"- [{time.strftime('%Y-%m-%d', time.gmtime(n['datetime']))}] {n['headline']} — {n['summary'][:240]}" for n in items)
    digest = hashlib.sha256(f"{user}|{symbol}|{days}|{lines}".encode()).hexdigest()
    hit = _cache.get(digest)
    if hit and time.time() - hit[0] < _TTL:
        return {**hit[1], "cached": True}
    from app.ai.dispatcher import complete  # lazy: dispatcher -> tools -> research

    r = await complete(db, user, f"Stock: {symbol}\nNews from the last {days} days:\n{lines}", system=_SUMMARY_SYSTEM)
    out = {"symbol": symbol, **_parse_json(r["content"]), "model": r["model"], "count": len(items)}
    _cache[digest] = (time.time(), out)
    return out
