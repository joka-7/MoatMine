"""The server-wide AI budget: per-user quotas alone don't stop many accounts draining the server's keys."""

from datetime import date

import pytest

from app.ai import dispatcher
from app.config import get_settings
from tests.conftest import auth, reply


def test_daily_token_budget_resets_each_day():
    day = [date(2026, 1, 1)]
    b = dispatcher.DailyTokenBudget(today=lambda: day[0])
    b.add(700)
    b.add(300)
    assert b.used() == 1_000 and b.exhausted(1_000) and not b.exhausted(0)  # 0 means no cap
    day[0] = date(2026, 1, 2)
    assert b.used() == 0 and not b.exhausted(1_000)


@pytest.fixture
def fresh_budget(monkeypatch):
    budget = dispatcher.DailyTokenBudget()
    monkeypatch.setattr(dispatcher, "SERVER_BUDGET", budget)
    return budget


def test_chat_on_the_server_key_counts_against_the_budget(client, fake_ai, fresh_budget):
    fake_ai.plans["anthropic"] = {"scripted": [reply("hello")]}
    r = client.post("/ai/chat", json={"model": "anthropic", "messages": [{"role": "user", "content": "hi"}]}, headers=auth("budget-user"))
    assert r.status_code == 200, r.text
    assert fresh_budget.used() > 0  # the mock reports prompt + completion tokens


def test_chat_on_the_users_own_key_doesnt_touch_the_budget(client, fake_ai, fresh_budget):
    who = auth("own-key-user")
    cfg = {"providers": [{"provider": "anthropic", "model": "claude-haiku-4-5-20251001", "apiKeys": ["sk-ant-own-key-123456"]}], "ollamaUrl": ""}
    assert client.put("/ai/settings", json={"config": cfg}, headers=who).status_code == 200
    fake_ai.plans["anthropic"] = {"scripted": [reply("hello")]}
    r = client.post("/ai/chat", json={"model": "anthropic", "messages": [{"role": "user", "content": "hi"}]}, headers=who)
    assert r.status_code == 200, r.text
    assert fresh_budget.used() == 0


def test_spent_budget_turns_server_keys_off(client, fake_ai, fresh_budget, monkeypatch):
    monkeypatch.setattr(get_settings(), "ai_server_tokens_per_day", 100)
    fresh_budget.add(100)
    fake_ai.plans["anthropic"] = {"scripted": [reply("should not run")]}
    r = client.post("/ai/chat", json={"model": "anthropic", "messages": [{"role": "user", "content": "hi"}]}, headers=auth("budget-user-2"))
    assert r.status_code == 503 and "budget" in r.json()["detail"]["detail"]
    assert "anthropic" not in fake_ai.built  # the server-key adapter was never built
