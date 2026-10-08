"""Price-derived ratios with hand-checkable numbers."""

import pytest

from app import analytics


@pytest.mark.parametrize(
    ("closes", "expected"),
    [
        ([100, 110, 99], [0.1, -0.1]),
        ([100, 0, 50], [-1.0]),  # a zero close can't be divided by, so that step is skipped
        ([100], []),
        ([], []),
    ],
)
def test_returns(closes, expected):
    assert analytics.returns(closes) == pytest.approx(expected)


@pytest.mark.parametrize(
    ("closes", "expected"),
    [
        ([100, 120, 90, 130, 104], -25.0),  # 120 -> 90
        ([100, 80, 60, 70], -40.0),
        ([1, 2, 3], 0.0),  # never fell
        ([5], 0.0),
        ([], None),
    ],
)
def test_max_drawdown_pct(closes, expected):
    assert analytics.max_drawdown_pct(closes) == expected


@pytest.mark.parametrize(
    ("closes", "expected"),
    [
        ([100, 101, 99.99], 15.87),  # +1%, -1%: daily sd 1% x sqrt(252)
        ([100, 100, 100], 0.0),
        ([100, 101], None),  # one return isn't a spread
    ],
)
def test_annual_volatility_pct(closes, expected):
    assert analytics.annual_volatility_pct(closes) == expected


@pytest.mark.parametrize(
    ("closes", "n", "expected"),
    [([1, 2, 3, 4], 2, 3.5), ([1, 2, 3, 4], 4, 2.5), ([1, 2], 3, None)],
)
def test_sma(closes, n, expected):
    assert analytics.sma(closes, n) == expected


@pytest.mark.parametrize(
    ("closes", "expected"),
    [
        ([1, 2, 3, 4], 100.0),  # only gains
        ([1, 2, 1, 2], 66.67),  # gains 2, losses 1 over 3 moves
        ([1, 2], None),  # fewer moves than the window
    ],
)
def test_rsi(closes, expected):
    assert analytics.rsi(closes, n=3) == expected


def test_price_stats():
    stats = analytics.price_stats([100, 120, 90, 130, 104])
    assert stats["total_return_pct"] == 4.0 and stats["max_drawdown_pct"] == -25.0 and stats["sma200"] is None
