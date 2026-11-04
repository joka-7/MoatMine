"""FMP provider against canned HTTP responses (no network)."""

import asyncio
from datetime import UTC, datetime

import httpx
import pytest

from app.market.fmp import FMPProvider


def provider(routes: dict[str, object], status: int = 200) -> FMPProvider:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json=routes.get(request.url.path.removeprefix("/stable"), []))

    return FMPProvider("test-key", transport=httpx.MockTransport(handler))


@pytest.mark.parametrize(
    ("rows", "expected"),
    [
        (
            [{"description": "Phones.", "website": "https://apple.com", "fullTimeEmployees": "164000", "ceo": "T. Cook",
              "country": "US", "ipoDate": "1980-12-12", "sector": "Technology", "industry": "Consumer Electronics", "image": "x.png"}],
            {"employees": 164000, "sector": "Technology", "ipo": "1980-12-12", "logo": "x.png"},
        ),
        ([{"fullTimeEmployees": "n/a"}], {"employees": None, "sector": "", "description": ""}),  # renamed/missing fields
        ([], {"employees": None, "sector": ""}),  # unknown symbol
    ],
)
def test_company_maps_fields_defensively(rows, expected):
    c = asyncio.run(provider({"/profile": rows}).company("AAPL"))
    assert {k: c[k] for k in expected} == expected


def test_fundamentals_converts_to_millions_and_per_share():
    inc = [{"revenue": 400e9, "grossProfit": 180e9, "netIncome": 100e9, "ebit": 120e9, "epsDiluted": 6.5,
            "weightedAverageShsOutDil": 15e9, "ebitda": 130e9}] * 2
    bal = [{"totalStockholdersEquity": 60e9, "totalAssets": 350e9, "netDebt": 50e9}] * 2
    cf = [{"freeCashFlow": 105e9, "operatingCashFlow": 115e9, "commonDividendsPaid": -15e9}] * 2
    f = asyncio.run(provider({"/income-statement": inc, "/balance-sheet-statement": bal, "/cash-flow-statement": cf}).fundamentals("AAPL"))
    assert f["eps"] == 6.5 and f["shares_outstanding"] == 15_000.0 and f["ebitda"] == 130_000.0
    assert f["fcf_per_share"] == 7.0 and f["dividend_per_share"] == 1.0 and f["bvps"] == 4.0
    assert f["statements"]["current"]["revenue"] == 400_000.0


def test_fundamentals_without_statements():
    assert asyncio.run(provider({}).fundamentals("AAPL")) == {"statements": None}


def test_http_errors_raise_so_the_router_falls_back():
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(provider({}, status=402).company("AAPL"))


def test_routed_provider_logs_fmp_fallback_without_the_key(caplog):
    from app.market import RoutedProvider
    from app.market.mock import MockProvider

    routed = RoutedProvider(MockProvider(), provider({}, status=402))
    with caplog.at_level("WARNING", logger="app.market"):
        company = asyncio.run(routed.company("AAPL"))
    assert company["sector"]  # served by the primary provider
    rec = next(r for r in caplog.records if r.name == "app.market")
    assert rec.status_code == 402 and rec.method == "company" and "test-key" not in rec.getMessage()


def _day(date: str, o: float, h: float, lo: float, c: float, v: float = 100) -> dict[str, object]:
    return {"symbol": "AAPL", "date": date, "open": o, "high": h, "low": lo, "close": c, "volume": v}


def _ts(date: str) -> int:
    return int(datetime.fromisoformat(date).replace(tzinfo=UTC).timestamp())


# FMP returns newest first
WEEKS = [
    _day("2024-01-10", 12, 15, 11, 14, 30),  # Wed, week 2
    _day("2024-01-09", 11, 13, 10, 12, 20),  # Tue, week 2
    _day("2024-01-05", 10, 12, 9, 11, 40),  # Fri, week 1
    _day("2024-01-02", 8, 11, 7, 10, 50),  # Tue, week 1
    _day("2023-12-29", 7, 9, 6, 8, 60),  # Fri, December
]


def test_eod_candles_are_daily_bars_oldest_first_within_the_range():
    p = provider({"/historical-price-eod/full": WEEKS})
    bars = asyncio.run(p.eod_candles("AAPL", "D", _ts("2024-01-01"), _ts("2024-01-09")))
    assert [(b["t"], b["o"], b["h"], b["l"], b["c"], b["v"]) for b in bars] == [
        (_ts("2024-01-02"), 8, 11, 7, 10, 50),
        (_ts("2024-01-05"), 10, 12, 9, 11, 40),
        (_ts("2024-01-09"), 11, 13, 10, 12, 20),
    ]


@pytest.mark.parametrize(
    ("resolution", "expected"),
    [
        # a week opens with its first day, closes with its last, and adds up the volume
        ("W", [(_ts("2023-12-29"), 7, 9, 6, 8, 60), (_ts("2024-01-02"), 8, 12, 7, 11, 90), (_ts("2024-01-09"), 11, 15, 10, 14, 50)]),
        ("M", [(_ts("2023-12-29"), 7, 9, 6, 8, 60), (_ts("2024-01-02"), 8, 15, 7, 14, 140)]),
    ],
)
def test_eod_candles_roll_up_to_weeks_and_months(resolution, expected):
    p = provider({"/historical-price-eod/full": WEEKS})
    bars = asyncio.run(p.eod_candles("AAPL", resolution, _ts("2023-12-01"), _ts("2024-02-01")))
    assert [(b["t"], b["o"], b["h"], b["l"], b["c"], b["v"]) for b in bars] == expected


def test_eod_candles_skip_rows_they_cannot_read_instead_of_failing():
    rows = [_day("2024-01-02", 8, 11, 7, 10), {"date": "2024-01-03"}, {"date": "bad", "open": 1, "high": 1, "low": 1, "close": 1}, "x", None,
            {**_day("2024-01-04", 9, 9, 9, 9), "volume": None}]
    p = provider({"/historical-price-eod/full": rows})
    bars = asyncio.run(p.eod_candles("AAPL", "D", _ts("2024-01-01"), _ts("2024-02-01")))
    assert [(b["t"], b["v"]) for b in bars] == [(_ts("2024-01-02"), 100), (_ts("2024-01-04"), 0.0)]


@pytest.mark.parametrize("body", [[], {"Error Message": "Limit Reach"}, "oops"])
def test_eod_candles_of_an_unknown_symbol_or_a_strange_reply_are_empty(body):
    p = provider({"/historical-price-eod/full": body})
    assert asyncio.run(p.eod_candles("NOPE", "D", _ts("2024-01-01"), _ts("2024-02-01"))) == []


def test_eod_candles_refuse_intraday_resolutions():
    with pytest.raises(ValueError, match="no '60' bars"):
        asyncio.run(provider({}).eod_candles("AAPL", "60", 0, 1))


def test_eod_candles_raise_when_the_plan_refuses_so_the_router_falls_back():
    with pytest.raises(httpx.HTTPStatusError):
        asyncio.run(provider({}, status=402).eod_candles("AAPL", "D", _ts("2024-01-01"), _ts("2024-02-01")))
