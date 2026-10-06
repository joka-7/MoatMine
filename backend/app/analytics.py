"""Price-derived ratios computed locally from candles (no provider needed)."""

import math
from statistics import mean, pstdev

TRADING_DAYS = 252


def returns(closes: list[float]) -> list[float]:
    return [b / a - 1 for a, b in zip(closes, closes[1:]) if a]


def annual_volatility_pct(closes: list[float]) -> float | None:
    r = returns(closes)
    return round(pstdev(r) * math.sqrt(TRADING_DAYS) * 100, 2) if len(r) > 1 else None


def max_drawdown_pct(closes: list[float]) -> float | None:
    if not closes:
        return None
    peak, worst = closes[0], 0.0
    for c in closes:
        peak = max(peak, c)
        worst = min(worst, c / peak - 1)
    return round(worst * 100, 2)


def sharpe(closes: list[float], rf_annual: float = 0.0) -> float | None:
    r = returns(closes)
    if len(r) < 2 or pstdev(r) == 0:
        return None
    excess = mean(r) - rf_annual / TRADING_DAYS
    return round(excess / pstdev(r) * math.sqrt(TRADING_DAYS), 2)


def sortino(closes: list[float]) -> float | None:
    r = returns(closes)
    down = [x for x in r if x < 0]
    if len(r) < 2 or len(down) < 2 or pstdev(down) == 0:
        return None
    return round(mean(r) / pstdev(down) * math.sqrt(TRADING_DAYS), 2)


def sma(closes: list[float], n: int) -> float | None:
    return round(mean(closes[-n:]), 2) if len(closes) >= n else None


def rsi(closes: list[float], n: int = 14) -> float | None:
    r = [b - a for a, b in zip(closes, closes[1:])][-n:]
    if len(r) < n:
        return None
    gain = sum(x for x in r if x > 0) / n
    loss = -sum(x for x in r if x < 0) / n
    return 100.0 if loss == 0 else round(100 - 100 / (1 + gain / loss), 2)


def price_stats(closes: list[float]) -> dict[str, float | None]:
    total = round((closes[-1] / closes[0] - 1) * 100, 2) if len(closes) > 1 and closes[0] else None
    return {
        "total_return_pct": total,
        "volatility_pct": annual_volatility_pct(closes),
        "max_drawdown_pct": max_drawdown_pct(closes),
        "sharpe": sharpe(closes),
        "sortino": sortino(closes),
        "sma50": sma(closes, 50),
        "sma200": sma(closes, 200),
        "rsi14": rsi(closes),
    }
