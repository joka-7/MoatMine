"""Safety check for a proposed buy, against the user's own risk rules.

Pure function: the service layer supplies the stock's safety report, its sector, and the current
portfolio. Each rule yields pass / warn / fail; any fail blocks, any warn marks the buy as risky
(needs a written reason and a cooling-off period before it can run).
"""

from dataclasses import dataclass

from app.jsontypes import JSONDict


@dataclass(frozen=True)
class Rules:
    max_position_pct: float
    max_sector_pct: float
    min_safety_score: float
    max_volatility_pct: float
    max_drawdown_pct: float
    min_market_cap_m: float
    allow_penny_stocks: bool
    cooling_off_hours: int


@dataclass(frozen=True)
class Candidate:
    symbol: str
    amount: float  # money being added
    sector: str | None
    price: float | None
    fair_value: float | None
    market_cap_m: float | None
    volatility_pct: float | None
    safety: JSONDict  # output of safety_score()


@dataclass(frozen=True)
class Book:
    total_value: float  # holdings + cash, before the buy
    by_symbol: dict[str, float]  # current market value per symbol
    by_sector: dict[str, float]
    cash: float = 0.0  # part of total_value; a buy is paid from it first


@dataclass(frozen=True)
class Breach:
    rule: str  # "position_size" | "sector"
    subject: str  # symbol or sector
    pct: float  # share of the book
    limit: float

    @property
    def message(self) -> str:
        return f"{self.subject} is {self.pct:.1f}% of your portfolio — above your {self.limit:g}% limit"


def portfolio_breaches(rules: Rules, book: Book) -> list[Breach]:
    """Holdings and sectors over the user's concentration limits, as a share of the whole book (cash included).

    Holdings whose sector is unknown aren't grouped into a pretend "Unknown" sector.
    """
    total = book.total_value
    if not total:
        return []
    by_symbol = [Breach("position_size", s, v / total * 100, rules.max_position_pct) for s, v in book.by_symbol.items()]
    by_sector = [Breach("sector", s, v / total * 100, rules.max_sector_pct) for s, v in book.by_sector.items() if s != "Unknown"]
    return [b for b in by_symbol + by_sector if b.pct > b.limit]


def _r(rule: str, status: str, message: str) -> JSONDict:
    return {"rule": rule, "status": status, "message": message}


def check_buy(rules: Rules, c: Candidate, book: Book) -> JSONDict:
    results = []
    s = c.safety
    flag_codes = {f["code"] for f in s.get("flags", [])}

    score = s.get("score")
    if score is None:
        results.append(_r("safety_score", "warn", "Not enough data to score this stock"))
    elif score < rules.min_safety_score:
        results.append(_r("safety_score", "fail", f"Safety score {score} is below your minimum {rules.min_safety_score:g}"))
    else:
        results.append(_r("safety_score", "pass", f"Safety score {score} (minimum {rules.min_safety_score:g})"))

    if "distress" in flag_codes:
        results.append(_r("distress", "fail", "Bankruptcy-risk zone (Altman Z distress)"))
    if "penny" in flag_codes and not rules.allow_penny_stocks:
        results.append(_r("penny", "fail", "Penny stocks are off in your risk profile"))

    # cash already counts in total_value, so only the part of the buy that cash can't cover is new money
    after_total = book.total_value + c.amount - min(c.amount, max(book.cash, 0.0))
    pos = book.by_symbol.get(c.symbol, 0.0) + c.amount
    pos_pct = pos / after_total * 100 if after_total else 100.0
    if pos_pct > rules.max_position_pct:
        results.append(_r("position_size", "fail",
                          f"{c.symbol} would be {pos_pct:.1f}% of your portfolio (limit {rules.max_position_pct:g}%)"))
    else:
        results.append(_r("position_size", "pass", f"{c.symbol} would be {pos_pct:.1f}% of your portfolio"))

    if c.sector:
        sec_pct = (book.by_sector.get(c.sector, 0.0) + c.amount) / after_total * 100 if after_total else 100.0
        status = "warn" if sec_pct > rules.max_sector_pct else "pass"
        results.append(_r("sector", status, f"{c.sector} would be {sec_pct:.1f}% of your portfolio (limit {rules.max_sector_pct:g}%)"))

    if c.volatility_pct is not None:
        status = "warn" if c.volatility_pct > rules.max_volatility_pct else "pass"
        results.append(_r("volatility", status, f"Volatility {c.volatility_pct:.0f}% a year (limit {rules.max_volatility_pct:g}%)"))

    if c.market_cap_m is not None and c.market_cap_m < rules.min_market_cap_m:
        results.append(_r("size", "warn", f"Company is smaller than your minimum (${c.market_cap_m:,.0f}M < ${rules.min_market_cap_m:,.0f}M)"))

    if c.price and c.fair_value and c.price > c.fair_value * 1.15:
        results.append(_r("valuation", "warn", f"Price is {((c.price / c.fair_value) - 1) * 100:.0f}% above the models' fair value"))

    statuses = {r["status"] for r in results}
    verdict = "block" if "fail" in statuses else "warn" if "warn" in statuses else "pass"
    return {
        "symbol": c.symbol,
        "amount": round(c.amount, 2),
        "verdict": verdict,
        "risky": verdict != "pass",
        "requires_note": verdict == "warn",
        "cooling_off_hours": rules.cooling_off_hours if verdict == "warn" else 0,
        "checks": results,
    }
