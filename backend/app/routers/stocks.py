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
from app.schemas import NoteIn, NoteOut

router = APIRouter(prefix="/stocks", tags=["stocks"])


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
