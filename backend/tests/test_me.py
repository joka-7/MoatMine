"""Export and delete of the signed-in user's own data."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from tests.conftest import auth

ME = auth("export-user")
OTHER = auth("export-other")


def _seed(client: Any, headers: dict[str, str]) -> int:
    acc = client.post("/accounts", json={"name": "IBKR", "cash": 1000}, headers=headers).json()["id"]
    opened = (datetime.now(UTC) - timedelta(days=40)).isoformat()
    assert client.post("/holdings", json={"account_id": acc, "symbol": "AAPL", "quantity": 10, "avg_cost": 150, "opened_at": opened}, headers=headers).status_code == 201
    assert client.post("/watchlist", json={"symbol": "MSFT", "note": "why", "alert_above": 500}, headers=headers).status_code == 201
    assert client.post("/stocks/AAPL/notes", json={"kind": "thesis", "title": "t", "body": "b"}, headers=headers).status_code == 201
    assert client.post("/targets", json={"name": "Growth", "profit_min": -10}, headers=headers).status_code == 201
    assert client.put("/safety/profile", json={"level": "growth", "paper_mode": False}, headers=headers).status_code == 200
    return int(acc)


@pytest.fixture
def seeded(client: Any) -> int:
    client.delete("/me/data", headers=ME)
    client.delete("/me/data", headers=OTHER)
    return _seed(client, ME)


def test_export_returns_every_kind_of_the_users_data(client: Any, seeded: int) -> None:
    data = client.get("/me/data", headers=ME).json()

    assert [a["name"] for a in data["accounts"]] == ["IBKR"]
    assert data["holdings"][0] | {"id": 0} == {"id": 0, "account_id": seeded, "symbol": "AAPL", "quantity": 10.0, "avg_cost": 150.0, "opened_at": data["holdings"][0]["opened_at"]}
    assert [w["symbol"] for w in data["watchlist"]] == ["MSFT"]
    assert data["watchlist"][0]["alert_above"] == 500
    assert [(n["symbol"], n["kind"]) for n in data["notes"]] == [("AAPL", "thesis")]
    assert [t["name"] for t in data["targets"]] == ["Growth", "Risk profile (auto)"]
    assert data["risk_profile"]["level"] == "growth"
    assert data["alerts"] == [] and data["plans"] == []


def test_export_of_a_user_with_nothing_is_empty(client: Any) -> None:
    client.delete("/me/data", headers=OTHER)
    data = client.get("/me/data", headers=OTHER).json()
    assert all(data[k] == [] for k in ("accounts", "holdings", "watchlist", "notes", "targets", "alerts", "plans"))
    assert data["risk_profile"] is None


def test_export_never_includes_another_users_data(client: Any, seeded: int) -> None:
    data = client.get("/me/data", headers=OTHER).json()
    assert data["accounts"] == [] and data["holdings"] == []


def test_delete_removes_everything_for_that_user_and_reports_counts(client: Any, seeded: int) -> None:
    counts = client.delete("/me/data", headers=ME).json()

    assert counts["accounts"] == 1 and counts["holdings"] == 1 and counts["watchlist"] == 1
    assert counts["stock_notes"] == 1 and counts["targets"] == 2 and counts["risk_profiles"] == 1
    data = client.get("/me/data", headers=ME).json()
    assert all(data[k] == [] for k in ("accounts", "holdings", "watchlist", "notes", "targets"))
    assert data["risk_profile"] is None


def test_delete_leaves_other_users_untouched(client: Any, seeded: int) -> None:
    _seed(client, OTHER)
    client.delete("/me/data", headers=ME)
    other = client.get("/me/data", headers=OTHER).json()
    assert len(other["accounts"]) == 1 and len(other["holdings"]) == 1


def test_delete_twice_is_harmless(client: Any, seeded: int) -> None:
    client.delete("/me/data", headers=ME)
    counts = client.delete("/me/data", headers=ME).json()
    assert set(counts.values()) == {0}


def test_both_routes_require_a_signed_in_user() -> None:
    """Dev mode lets a missing header through as the dev user, so check the contract: both depend on current_user."""
    from fastapi.routing import APIRoute

    from app.auth import current_user
    from app.routers.me import router

    routes = [r for r in router.routes if isinstance(r, APIRoute)]
    assert {r.path for r in routes} == {"/me/data"}
    assert all(any(d.call is current_user for d in r.dependant.dependencies) for r in routes)
    assert {m for r in routes for m in (r.methods or set())} == {"GET", "DELETE"}
