from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.market import get_provider
from app.models import Alert, Target
from app.portfolio import portfolio_snapshot
from app.schemas import AlertOut, TargetIn, TargetOut
from app.targets import evaluate, risk_by_symbol

router = APIRouter(tags=["targets"])


def _own(db: Session, target_id: int, user: str) -> Target:
    t = db.get(Target, target_id)
    if not t or t.user_id != user:
        raise HTTPException(404, "target not found")
    return t


@router.get("/targets", response_model=list[TargetOut])
def list_targets(user: str = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Target).where(Target.user_id == user).order_by(Target.id)).all()


@router.post("/targets", response_model=TargetOut, status_code=201)
def create_target(body: TargetIn, user: str = Depends(current_user), db: Session = Depends(get_db)):
    t = Target(user_id=user, **body.model_dump())
    db.add(t)
    db.commit()
    return t


@router.put("/targets/{target_id}", response_model=TargetOut)
def update_target(target_id: int, body: TargetIn, user: str = Depends(current_user), db: Session = Depends(get_db)):
    t = _own(db, target_id, user)
    for k, v in body.model_dump().items():
        setattr(t, k, v)
    db.commit()
    return t


@router.delete("/targets/{target_id}", status_code=204)
def delete_target(target_id: int, user: str = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_own(db, target_id, user))
    db.commit()


@router.get("/targets/evaluate")
async def evaluate_targets(user: str = Depends(current_user), db: Session = Depends(get_db)):
    """Live PAPI values vs MAMI bounds for every target. Targets track real money only."""
    targets = db.scalars(select(Target).where(Target.user_id == user)).all()
    provider = get_provider()
    snap = await portfolio_snapshot(db, user, provider, "real")
    risks = await risk_by_symbol(provider, {h["symbol"] for h in snap["holdings"]})
    return [evaluate(t, snap, risks) for t in targets]


@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(unread_only: bool = False, user: str = Depends(current_user), db: Session = Depends(get_db)):
    q = select(Alert).where(Alert.user_id == user)
    if unread_only:
        q = q.where(Alert.read.is_(False))
    return db.scalars(q.order_by(Alert.created_at.desc()).limit(100)).all()


@router.post("/alerts/read-all", status_code=204)
def read_all(user: str = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(Alert).where(Alert.user_id == user).values(read=True))
    db.commit()
