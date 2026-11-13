import re
import time

from fastapi import APIRouter, Depends, HTTPException, Query

from app.jsontypes import JSONDict
from app.market import get_provider
from app.market.base import MarketProvider
from app.market.sources import source_label, track_sources
from app.ratelimit import rate_limited
from app.screener import MAX_SYMBOLS, screen

router = APIRouter(prefix="/screener", tags=["screener"], dependencies=[Depends(rate_limited("market"))])

_SYMBOL = re.compile(r"[A-Z0-9][A-Z0-9.\-]{0,15}")


def _symbols(raw: str) -> list[str]:
    symbols = list(dict.fromkeys(s.strip().upper() for s in raw.split(",") if s.strip()))
    if not symbols:
        raise HTTPException(422, "send at least one symbol")
    if len(symbols) > MAX_SYMBOLS:
        raise HTTPException(422, f"at most {MAX_SYMBOLS} symbols per request")
    bad = [s for s in symbols if not _SYMBOL.fullmatch(s)]
    if bad:
        raise HTTPException(422, f"not a ticker symbol: {', '.join(bad[:3])}")
    return symbols


@router.get("/metrics")
async def metrics(symbols: str = Query(description="comma-separated ticker symbols"), provider: MarketProvider = Depends(get_provider)) -> JSONDict:
    """Performance, momentum, yearly high and low, risk and valuation ratios for up to 30 symbols in one call.

    Only ticker symbols are sent: nothing about the user's holdings or watchlist. Each row carries an
    `error` instead of numbers when that symbol's data could not be fetched.
    """
    wanted = _symbols(symbols)
    with track_sources() as used:
        rows = await screen(provider, wanted, int(time.time()))
    return {"rows": rows, "data_source": source_label(provider.name, used)}
