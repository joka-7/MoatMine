"""Demo data for local dev:  python -m app.seed [user_id]   (default user: dev)"""

import sys
from datetime import datetime, timedelta, timezone

from app.db import SessionLocal, init_db
from app.models import Account, Holding, StockNote, Target, WatchItem


def seed(user: str = "dev") -> None:
    init_db()
    with SessionLocal() as db:
        if db.query(Account).filter_by(user_id=user).first():
            print(f"user {user!r} already has data; skipping")
            return
        now = datetime.now(timezone.utc)
        acc = Account(user_id=user, name="Brokerage", broker="manual", cash=4200)
        db.add_all([acc, Account(user_id=user, name="Paper", broker="paper", cash=50_000)])
        db.flush()
        for sym, qty, cost, days in [("AAPL", 25, 168, 400), ("MSFT", 12, 380, 260), ("NVDA", 40, 95, 150), ("SPY", 10, 510, 600)]:
            db.add(Holding(user_id=user, account_id=acc.id, symbol=sym, quantity=qty, avg_cost=cost, opened_at=now - timedelta(days=days)))
        db.add_all([
            WatchItem(user_id=user, symbol="TSLA", note="wait for a pullback", alert_below=200),
            WatchItem(user_id=user, symbol="GOOGL", note="AI search moat?", alert_above=200),
            Target(user_id=user, name="Core growth", symbol=None, profit_target=30, profit_min=-15, profit_max=80,
                   amount_target=60000, amount_min=20000, period_target_days=1825, period_min_days=365,
                   intent="growth", intent_note="long-term compounding", risk_max=30),
            Target(user_id=user, name="NVDA trade", symbol="NVDA", profit_target=40, profit_min=-12, profit_max=60,
                   amount_max=8000, period_max_days=365, intent="speculation", intent_note="AI capex cycle", risk_max=60),
            StockNote(user_id=user, symbol="NVDA", kind="thesis", title="AI capex cycle", body="Exit if hyperscaler capex guidance turns down."),
        ])
        db.commit()
        print(f"seeded demo data for {user!r}")


if __name__ == "__main__":
    seed(sys.argv[1] if len(sys.argv) > 1 else "dev")
