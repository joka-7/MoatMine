"""FMP provider against canned HTTP responses (no network)."""

import asyncio

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
