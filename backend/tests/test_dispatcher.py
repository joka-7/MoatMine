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


def _external_call(monkeypatch, ip_for: dict[str, str], handler) -> tuple[list[str], BaseException | None]:
    """Call the external-agent provider with DNS and HTTP faked; returns the URLs requested and any error."""
    import asyncio
    import socket

    import httpx2
    from model_dispatcher import CompletionRequest, Message, Role, TenantId

    def resolve(host, port, *a, **k):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip_for[host], port))]

    monkeypatch.setattr(socket, "getaddrinfo", resolve)
    seen: list[str] = []

    def record(request):
        seen.append(str(request.url))
        return handler(request)

    class _Faked(httpx2.AsyncClient):  # keeps the provider's own settings, only the network is faked
        def __init__(self, **kw: object) -> None:
            super().__init__(transport=httpx2.MockTransport(record), **kw)  # type: ignore[arg-type]

    monkeypatch.setattr(httpx2, "AsyncClient", _Faked)
    provider = dispatcher.external_factory("https://agent.example.com/v1", "m")
    request = CompletionRequest(messages=(Message(role=Role.USER, content="hi"),), tenant=TenantId("u"))
    try:
        asyncio.run(provider.acomplete(request, api_key="k"))
    except Exception as e:  # the SDK wraps transport errors in its own types
        return seen, e
    return seen, None


@pytest.mark.parametrize(("ip", "redirect_to", "requests_made"), [
    # a public host bouncing the call to an internal address: the redirect is not followed
    ("93.184.216.34", "http://10.0.0.5/v1/chat/completions", 1),
    # a URL saved before the save-time check, or re-pointed DNS: refused before any request
    ("169.254.169.254", None, 0),
])
def test_external_agent_never_reaches_private_hosts(monkeypatch, ip, redirect_to, requests_made):
    import httpx2

    def handler(request):
        return httpx2.Response(307, headers={"Location": redirect_to}) if redirect_to else httpx2.Response(200, json={})

    seen, error = _external_call(monkeypatch, {"agent.example.com": ip, "10.0.0.5": "10.0.0.5"}, handler)
    assert len(seen) == requests_made and all("10.0.0.5" not in u for u in seen), (seen, repr(error), repr(error.__cause__ if error else None))
    assert error is not None
