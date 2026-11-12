"""The user's own stored data: export it all, or delete it all.

Part of keeping the portfolio on the user's device: the app downloads everything here, copies it
to the device, checks the counts, and only then asks for `DELETE /me/data`. AI settings and MCP
tokens are left alone: they are not portfolio data and the AI settings hold the user's keys.
"""

import json
from collections.abc import Sequence

from fastapi import APIRouter, Depends
from sqlalchemy import CursorResult, delete, select
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.jsontypes import JSONDict
from app.models import Account, Alert, BuyPlan, Holding, RiskProfile, StockNote, Target, WatchItem
from app.safety.service import profile_dict

router = APIRouter(prefix="/me", tags=["me"])

Owned = Account | Holding | WatchItem | StockNote | Target | Alert | BuyPlan | RiskProfile

# deleted children first: holdings and plans belong to accounts
_DELETE_ORDER: tuple[type[Owned], ...] = (BuyPlan, Holding, Account, WatchItem, StockNote, Target, Alert, RiskProfile)


def _rows[Row: (Account, Holding, WatchItem, StockNote, Target, Alert, BuyPlan)](db: Session, model: type[Row], user: str) -> Sequence[Row]:
    return db.scalars(select(model).where(model.user_id == user).order_by(model.id)).all()


def _iso(value: object) -> str:
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _export(db: Session, user: str) -> JSONDict:
    profile = db.scalar(select(RiskProfile).where(RiskProfile.user_id == user))
    return {
        "accounts": [{"id": a.id, "name": a.name, "broker": a.broker, "currency": a.currency, "cash": a.cash,
                      "created_at": _iso(a.created_at)} for a in _rows(db, Account, user)],
        "holdings": [{"id": h.id, "account_id": h.account_id, "symbol": h.symbol, "quantity": h.quantity,
                      "avg_cost": h.avg_cost, "opened_at": _iso(h.opened_at)} for h in _rows(db, Holding, user)],
        "watchlist": [{"id": w.id, "symbol": w.symbol, "note": w.note, "alert_above": w.alert_above,
                       "alert_below": w.alert_below, "created_at": _iso(w.created_at)} for w in _rows(db, WatchItem, user)],
        "notes": [{"id": n.id, "symbol": n.symbol, "kind": n.kind, "title": n.title, "body": n.body, "url": n.url,
                   "created_at": _iso(n.created_at)} for n in _rows(db, StockNote, user)],
        "targets": [{c.name: _iso(getattr(t, c.name)) if c.name == "created_at" else getattr(t, c.name)
                     for c in Target.__table__.columns if c.name != "user_id"} for t in _rows(db, Target, user)],
        "alerts": [{"id": a.id, "source": a.source, "ref_id": a.ref_id, "symbol": a.symbol, "message": a.message,
                    "dedupe_key": a.dedupe_key, "read": a.read, "created_at": _iso(a.created_at)} for a in _rows(db, Alert, user)],
        "plans": [{"id": p.id, "account_id": p.account_id, "symbol": p.symbol, "quantity": p.quantity, "price": p.price,
                   "note": p.note, "verdict": p.verdict, "check": json.loads(p.check_json), "status": p.status,
                   "available_at": _iso(p.available_at), "created_at": _iso(p.created_at),
                   "executed_holding_id": p.executed_holding_id} for p in _rows(db, BuyPlan, user)],
        "risk_profile": profile_dict(profile) if profile else None,
    }


def _delete_for(db: Session, model: type[Owned], user: str) -> int:
    result = db.execute(delete(model).where(model.user_id == user))
    if not isinstance(result, CursorResult):  # a DELETE always returns one; refuse to report a count we do not have
        raise TypeError(f"unexpected result type {type(result).__name__} from DELETE on {model.__tablename__}")
    return result.rowcount


@router.get("/data")
def export_data(user: str = Depends(current_user), db: Session = Depends(get_db)) -> JSONDict:
    """Everything stored for the signed-in user, in the API's own field names."""
    return _export(db, user)


@router.delete("/data")
def delete_data(user: str = Depends(current_user), db: Session = Depends(get_db)) -> dict[str, int]:
    """Delete the signed-in user's portfolio data for good and return how many rows of each kind went.

    Accounts, positions, buy plans, watchlist, notes, targets, alerts and the risk profile. AI
    settings and MCP tokens are kept.
    """
    counts = {model.__tablename__: _delete_for(db, model, user) for model in _DELETE_ORDER}
    db.commit()
    return counts
