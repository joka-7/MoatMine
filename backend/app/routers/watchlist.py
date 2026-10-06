from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.market import get_provider
from app.models import WatchItem
from app.portfolio import quotes_for
from app.schemas import WatchIn, WatchOut

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


@router.get("")
async def list_watch(user: str = Depends(current_user), db: Session = Depends(get_db)):
    items = db.scalars(select(WatchItem).where(WatchItem.user_id == user).order_by(WatchItem.symbol)).all()
    quotes = await quotes_for(get_provider(), {i.symbol for i in items})
    return [{**WatchOut.model_validate(i).model_dump(), "quote": quotes.get(i.symbol)} for i in items]


@router.post("", response_model=WatchOut, status_code=201)
def add_watch(body: WatchIn, user: str = Depends(current_user), db: Session = Depends(get_db)):
    item = WatchItem(user_id=user, **body.model_dump())
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, f"{body.symbol} already on watchlist") from None
    return item


@router.put("/{item_id}", response_model=WatchOut)
def update_watch(item_id: int, body: WatchIn, user: str = Depends(current_user), db: Session = Depends(get_db)):
    item = db.get(WatchItem, item_id)
    if not item or item.user_id != user:
        raise HTTPException(404, "not found")
    for k, v in body.model_dump().items():
        setattr(item, k, v)
    db.commit()
    return item


@router.delete("/{item_id}", status_code=204)
def delete_watch(item_id: int, user: str = Depends(current_user), db: Session = Depends(get_db)):
    item = db.get(WatchItem, item_id)
    if not item or item.user_id != user:
        raise HTTPException(404, "not found")
    db.delete(item)
    db.commit()
