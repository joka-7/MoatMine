import asyncio
import time

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics import price_stats
from app.auth import current_user
from app.db import get_db
from app.market import get_provider
from app.market.base import RESOLUTION_SECONDS
from app.models import StockNote
from app.ai.dispatcher import DispatchError
from app.crises import bad_times
from app.research import news_feed, news_summary, valuation
from app.schemas import NoteIn, NoteOut
from app.valuation import Assumptions

router = APIRouter(prefix="/stocks", tags=["stocks"])
feed_router = APIRouter(tags=["news"])


def _sym(symbol: str) -> str:
    return symbol.strip().upper()


@router.get("/search")
async def search(q: str = Query(min_length=1)):
    return await get_provider().search(q)


@router.get("/{symbol}/quote")
async def quote(symbol: str):
    return await get_provider().quote(_sym(symbol))


@router.get("/{symbol}/candles")
async def candles(
    symbol: str,
    response: Response,
    resolution: str = Query("D"),
    start: int | None = None,
    end: int | None = None,
):
    if resolution not in RESOLUTION_SECONDS:
        raise HTTPException(422, f"resolution must be one of {list(RESOLUTION_SECONDS)}")
    end = end or int(time.time())
    start = start or end - 365 * 86400
    provider = get_provider()
    bars = await provider.candles(_sym(symbol), resolution, start, end)
    source = "mock-fallback" if getattr(provider, "candles_fell_back", False) else provider.name
    response.headers["X-Data-Source"] = source
    return bars


@router.get("/{symbol}/profile")
async def profile(symbol: str):
    return await get_provider().profile(_sym(symbol))


@router.get("/{symbol}/ratios")
async def ratios(symbol: str, lookback_days: int = Query(365, ge=30, le=3650)):
    """Fundamental ratios from the provider + price/risk ratios computed from candles."""
    p = get_provider()
    sym = _sym(symbol)
    end = int(time.time())
    bars = await p.candles(sym, "D", end - lookback_days * 86400, end)
    return {"fundamental": await p.metrics(sym), "price": price_stats([b["c"] for b in bars])}


@router.get("/{symbol}/news")
async def news(symbol: str, days: int = Query(14, ge=1, le=90)):
    return await get_provider().news(_sym(symbol), days)


# --- user's own notes / news / thesis per stock ---


@router.get("/{symbol}/notes", response_model=list[NoteOut])
def list_notes(symbol: str, user: str = Depends(current_user), db: Session = Depends(get_db)):
    q = select(StockNote).where(StockNote.user_id == user, StockNote.symbol == _sym(symbol))
    return db.scalars(q.order_by(StockNote.created_at.desc())).all()


@router.post("/{symbol}/notes", response_model=NoteOut, status_code=201)
def add_note(symbol: str, body: NoteIn, user: str = Depends(current_user), db: Session = Depends(get_db)):
    n = StockNote(user_id=user, symbol=_sym(symbol), **body.model_dump())
    db.add(n)
    db.commit()
    return n


@router.delete("/{symbol}/notes/{note_id}", status_code=204)
def delete_note(symbol: str, note_id: int, user: str = Depends(current_user), db: Session = Depends(get_db)):
    n = db.get(StockNote, note_id)
    if not n or n.user_id != user:
        raise HTTPException(404, "note not found")
    db.delete(n)
    db.commit()


# --- company & research ---


@router.get("/{symbol}/company")
async def company(symbol: str):
    p = get_provider()
    sym = _sym(symbol)
    prof, comp = await asyncio.gather(p.profile(sym), p.company(sym))
    return {**prof, **{k: v for k, v in comp.items() if v not in (None, "")}}


@router.get("/{symbol}/earnings")
async def earnings(symbol: str):
    return await get_provider().earnings(_sym(symbol))


@router.get("/{symbol}/analysts")
async def analysts(symbol: str):
    p = get_provider()
    sym = _sym(symbol)
    recs, target, q = await asyncio.gather(p.recommendations(sym), p.price_target(sym), p.quote(sym))
    if target and target.get("mean") and q["price"]:
        target["upside_pct"] = round((target["mean"] / q["price"] - 1) * 100, 1)
    return {"recommendations": recs, "price_target": target, "price": q["price"]}


@router.get("/{symbol}/dividends")
async def dividends(symbol: str):
    p = get_provider()
    sym = _sym(symbol)
    divs, splits = await asyncio.gather(p.dividends(sym), p.splits(sym))
    return {"dividends": divs, "splits": splits}


@router.get("/{symbol}/valuation")
async def stock_valuation(
    symbol: str,
    discount_rate: float = Query(9.0, gt=0, le=40),
    growth_rate: float | None = Query(None, ge=-20, le=60),
    terminal_growth: float = Query(2.5, ge=-2, le=6),
    years: int = Query(10, ge=1, le=30),
    margin_of_safety: float = Query(25.0, ge=0, le=90),
    bond_yield: float = Query(4.5, gt=0, le=20),
    pe_multiple: float = Query(18.0, gt=0, le=100),
    ev_ebitda_multiple: float = Query(12.0, gt=0, le=60),
    dividend_growth: float = Query(4.0, ge=-10, le=20),
):
    """Fair value from several models, valuation indicators and quality scores. All assumptions are overridable."""
    a = Assumptions(discount_rate, growth_rate, terminal_growth, years, margin_of_safety, bond_yield,
                    pe_multiple, ev_ebitda_multiple, dividend_growth)
    return await valuation(get_provider(), _sym(symbol), a)


@router.get("/{symbol}/crises")
async def crises(symbol: str, benchmark: str = Query("SPY", min_length=1, max_length=16)):
    """How the stock behaved in past market crises vs a benchmark, plus its own worst drawdowns."""
    return await bad_times(get_provider(), _sym(symbol), _sym(benchmark))


@router.get("/{symbol}/news/summary")
async def summarize_news(
    symbol: str, days: int = Query(7, ge=1, le=90), user: str = Depends(current_user), db: Session = Depends(get_db)
):
    """AI digest of recent headlines with a sentiment label (fast model, cached 1h)."""
    try:
        return await news_summary(db, user, get_provider(), _sym(symbol), days)
    except DispatchError as e:
        raise HTTPException(502, str(e)) from e


@feed_router.get("/news/feed")
async def feed(days: int = Query(7, ge=1, le=30), user: str = Depends(current_user), db: Session = Depends(get_db)):
    """News across everything you hold or watch."""
    return await news_feed(db, user, get_provider(), days)
