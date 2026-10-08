"""Risk-profile questionnaire and the default rules for each level."""

from typing import TypedDict


class Question(TypedDict):
    id: str
    text: str
    options: list[str]


QUESTIONS: list[Question] = [
    {
        "id": "horizon",
        "text": "When will you need most of this money?",
        "options": ["Within 2 years", "In 2–5 years", "In 5–10 years", "More than 10 years"],
    },
    {
        "id": "drop",
        "text": "Your portfolio falls 20% in a month. What do you do?",
        "options": ["Sell everything", "Sell some", "Hold and wait", "Buy more"],
    },
    {
        "id": "goal",
        "text": "What matters most?",
        "options": ["Not losing money", "Steady income", "Balanced growth", "Maximum growth"],
    },
    {
        "id": "experience",
        "text": "How experienced are you with stocks?",
        "options": ["New to it", "A little", "Several years", "Very experienced"],
    },
    {
        "id": "income",
        "text": "How stable is your income and emergency savings?",
        "options": ["Unstable, no savings", "Some savings", "Stable with savings", "Very secure"],
    },
]

LEVELS = ["conservative", "moderate", "balanced", "growth"]

RULE_KEYS = [
    "max_position_pct", "max_sector_pct", "min_safety_score", "max_volatility_pct",
    "max_drawdown_pct", "min_market_cap_m", "allow_penny_stocks", "cooling_off_hours",
]

DEFAULT_RULES: dict[str, dict[str, float | bool]] = {
    "conservative": {"max_position_pct": 5, "max_sector_pct": 20, "min_safety_score": 70, "max_volatility_pct": 25,
                     "max_drawdown_pct": -15, "min_market_cap_m": 10_000, "allow_penny_stocks": False, "cooling_off_hours": 48},
    "moderate": {"max_position_pct": 8, "max_sector_pct": 25, "min_safety_score": 60, "max_volatility_pct": 35,
                 "max_drawdown_pct": -20, "min_market_cap_m": 2_000, "allow_penny_stocks": False, "cooling_off_hours": 24},
    "balanced": {"max_position_pct": 10, "max_sector_pct": 30, "min_safety_score": 50, "max_volatility_pct": 45,
                 "max_drawdown_pct": -25, "min_market_cap_m": 1_000, "allow_penny_stocks": False, "cooling_off_hours": 24},
    "growth": {"max_position_pct": 15, "max_sector_pct": 40, "min_safety_score": 40, "max_volatility_pct": 60,
               "max_drawdown_pct": -35, "min_market_cap_m": 300, "allow_penny_stocks": False, "cooling_off_hours": 12},
}


def level_from_answers(answers: dict[str, int]) -> str:
    """Each answer is the option index 0–3. Short horizon or 'sell everything' caps the level."""
    missing = [q["id"] for q in QUESTIONS if q["id"] not in answers]
    if missing:
        raise ValueError(f"missing answers: {', '.join(missing)}")
    for k, v in answers.items():
        if not 0 <= v <= 3:
            raise ValueError(f"answer {k} must be 0–3")
    total = sum(answers[q["id"]] for q in QUESTIONS)  # 0–15
    level = LEVELS[min(3, total * 4 // 16)]
    if answers["horizon"] == 0 or answers["drop"] == 0:
        level = "conservative"  # money needed soon, or would panic-sell: protect capital
    elif answers["income"] == 0 and LEVELS.index(level) > 1:
        level = "moderate"
    return level
