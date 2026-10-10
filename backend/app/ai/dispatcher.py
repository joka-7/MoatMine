"""AI calls through ModelDispatcher (https://github.com/joka-7/ModelDispatcher).

Per request we build a provider registry from:
  - the user's own AI settings (vendors in their chosen fallback order, chosen model, pooled keys),
  - vendors the server has a key for (env), and
  - optionally the user's external agent (any OpenAI-compatible base URL).
ModelDispatcher then does triage + cheapest-first routing, cross-vendor and same-vendor key
fallback, the tool-calling loop, per-user quotas and the key-wizard handoff when the shared
server key runs out.

model="auto" lets the gateway route; a vendor id ("anthropic", "openai", "gemini", "groq") pins
that vendor; "external" uses only the user's external agent.
"""

from __future__ import annotations

import asyncio
import re
from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Protocol

import httpx2
from model_dispatcher import (
    CompletionRequest,
    CompletionResponse,
    GatewaySettings,
    InMemoryQuotaStore,
    Message,
    ModelDispatcherError,
    ModelGateway,
    ModelTier,
    ProviderRegistry,
    Role,
    RoutingPolicy,
    RunResult,
    TenantContext,
    TenantId,
    TenantQuota,
    ToolRegistry,
)
from model_dispatcher.byok import adispatch_with_timeout, credential_metadata
from model_dispatcher.providers import AnthropicProvider, GeminiProvider, GroqProvider, OpenAIProvider
from model_dispatcher.providers.base import ModelProvider
from sqlalchemy.orm import Session

from app.ai.settings_store import check_public_https_url, load_ai_settings
from app.config import get_settings
from app.errors import DispatchError
from app.jsontypes import JSONDict

SYSTEM_PROMPT = (
    "You are MoatMine's investment assistant. The app's purpose is safe, risk-aware investing. "
    "Use the tools to look at the user's real portfolio, risk profile, safety scores, targets (PAPI: profit, "
    "amount, period, intent with MAMI min/max bounds), watchlist, company data, earnings, analyst views, news, "
    "crisis history and the valuation models before answering. Always surface downside risk. When discussing "
    "value, show the spread between models and the assumptions behind them rather than one number. Be concise "
    "and numeric. You provide information and analysis, not personalised financial advice; never claim "
    "certainty about future prices and never call an investment safe. You cannot place trades."
)

# vendor id -> (adapter, settings attribute holding the server key, server default model)
class _VendorAdapter(Protocol):
    """How a vendor adapter class is built (model_dispatcher's base class doesn't declare it)."""

    def __call__(self, *, model: str, api_key: str | None, tier: ModelTier) -> ModelProvider: ...


VENDORS: dict[str, tuple[_VendorAdapter, str, str]] = {
    "anthropic": (AnthropicProvider, "anthropic_api_key", "claude-sonnet-4-5"),
    "openai": (OpenAIProvider, "openai_api_key", "gpt-4o-mini"),
    "gemini": (GeminiProvider, "gemini_api_key", "gemini-2.0-flash"),
    "groq": (GroqProvider, "groq_api_key", "llama-3.3-70b-versatile"),
}
EXTERNAL = "external"

_QUOTA_STORE = InMemoryQuotaStore()  # per process; shared across requests so per-user limits accumulate


def tier_for(model: str) -> ModelTier:
    """Cost tier from the model name, so triage sends simple questions to cheap models first."""
    m = model.lower()
    if "opus" in m:
        return ModelTier.PREMIUM
    is_mini = re.search(r"(^|[-_.])mini($|[-_.])", m) is not None  # "gpt-4o-mini", not "gemini"
    if any(k in m for k in ("sonnet", "gpt-4o", "gpt-4.1", "pro", "70b", "120b")) and not is_mini:
        return ModelTier.STANDARD
    return ModelTier.CHEAP


def provider_factory(vendor: str, model: str, api_key: str | None, tier: ModelTier) -> ModelProvider:
    """Construct one vendor adapter. Tests replace this with a MockProvider factory."""
    cls = VENDORS[vendor][0]
    return cls(model=model, api_key=api_key, tier=tier)


async def _refuse_private_hosts(request: httpx2.Request) -> None:
    # re-checked on every request, not just when the URL was saved: the host may now resolve
    # elsewhere, and URLs saved before the check existed were never vetted
    await asyncio.to_thread(check_public_https_url, str(request.url))


class _ExternalAgentProvider(OpenAIProvider):
    """OpenAI-compatible provider for a user-supplied URL: never follows redirects (a public host
    could otherwise bounce the request to an internal address) and refuses non-public hosts."""

    async def acomplete(self, request: CompletionRequest, *, api_key: str | None = None) -> CompletionResponse:
        import openai

        async with httpx2.AsyncClient(follow_redirects=False, timeout=get_settings().ai_timeout_seconds,
                                      event_hooks={"request": [_refuse_private_hosts]}) as http:
            client = openai.AsyncOpenAI(api_key=api_key or self._api_key, base_url=self._base_url, http_client=http)
            response = await client.chat.completions.create(**self._build_kwargs(request))
        return self._to_response(response)


def external_factory(base_url: str, model: str) -> ModelProvider:
    """The user's own agent, reached as an OpenAI-compatible endpoint."""
    return _ExternalAgentProvider(model=model or "default", base_url=base_url, name=f"{EXTERNAL}:{model or 'default'}",
                                  tier=ModelTier.STANDARD)


class DailyTokenBudget:
    """Tokens spent on the server's own AI keys today (UTC), across every user. Per process."""

    def __init__(self, today: Callable[[], date] = lambda: datetime.now(UTC).date()):
        self._today = today
        self._day = today()
        self._used = 0

    def used(self) -> int:
        if self._today() != self._day:
            self._day, self._used = self._today(), 0
        return self._used

    def add(self, tokens: int) -> None:
        self.used()  # roll over first
        self._used += tokens

    def exhausted(self, limit: int) -> bool:
        return limit > 0 and self.used() >= limit


# per-user quotas don't stop many accounts together draining the server's keys; this does
SERVER_BUDGET = DailyTokenBudget()


def _registry(db: Session, user: str, requested: str) -> tuple[ProviderRegistry, dict[str, str], set[str]]:
    """The providers this user may use now, the credential metadata, and which providers run on server keys."""
    s = get_settings()
    server_keys_allowed = not SERVER_BUDGET.exhausted(s.ai_server_tokens_per_day)
    cfg = load_ai_settings(db, user)
    chosen = [p for p in cfg["config"]["providers"] if p["provider"] in VENDORS]
    user_keys = {p["provider"]: list(p.get("apiKeys") or []) for p in chosen}
    user_models = {p["provider"]: p.get("model") for p in chosen}
    order = [p["provider"] for p in chosen] + [v for v in VENDORS if v not in user_models]

    registry = ProviderRegistry()
    on_server_key: set[str] = set()
    if requested != EXTERNAL:
        for vendor in order:
            if requested not in ("auto", vendor):
                continue
            server_key = (getattr(s, VENDORS[vendor][1]) or None) if server_keys_allowed else None
            if not server_key and not user_keys.get(vendor):
                continue  # a keyless vendor in the registry would hard-fail the request
            model = user_models.get(vendor) or VENDORS[vendor][2]
            provider = provider_factory(vendor, model, server_key, tier_for(model))
            registry.register(provider)
            if not user_keys.get(vendor):  # the user's own key wins when they have one
                on_server_key.add(provider.name)

    metadata = credential_metadata({v: k for v, k in user_keys.items() if k})
    ext = cfg.get("external")
    if requested == EXTERNAL:
        if not ext:
            raise DispatchError(400, {"error": "no_external_agent", "detail": "No external agent set. Add one in Settings → AI."})
        registry.register(external_factory(ext["base_url"], ext.get("model", "")))
        metadata[f"user_key:{EXTERNAL}"] = ext["api_key"]

    if not len(registry):
        raise DispatchError(503, {
            "error": "no_provider_available",
            "detail": "No AI provider available. Add your own key in Settings → AI, or ask the server owner to set one."
            + ("" if server_keys_allowed else " The server's shared AI budget for today is used up."),
            "action": "open_ai_settings",
        })
    return registry, metadata, on_server_key


def _gateway(registry: ProviderRegistry) -> ModelGateway:
    # Cap each complexity's tier floor at the best tier available, so a user with only cheap
    # models still gets answers to complex questions instead of "no candidates".
    best = max(p.tier for p in registry.at_or_above(ModelTier.FREE))
    floors = {c: min(t, best) for c, t in RoutingPolicy().complexity_floor.items()}
    settings = GatewaySettings(routing=RoutingPolicy(complexity_floor=floors, max_candidates=6))
    return ModelGateway.create(registry, settings=settings, quota_store=_QUOTA_STORE)


def _tenant(user: str, metadata: dict[str, str]) -> TenantContext:
    s = get_settings()
    return TenantContext(
        tenant_id=TenantId(user),
        quota=TenantQuota(requests_per_min=s.ai_requests_per_min, tokens_per_min=s.ai_tokens_per_min,
                          tokens_per_day=s.ai_tokens_per_day),
        # lets vendors the user has no key for ride the server key; the user's own keys still win
        is_zero_setup=True,
        metadata=metadata,
    )


def _served_by(result: RunResult) -> str:
    for step in reversed(result.steps):
        for attempt in reversed(step.attempts):
            if attempt.error_class is None:
                return attempt.provider_name
    return "unknown"


async def _run(db: Session, user: str, messages: list[Message], requested: str,
               tools: ToolRegistry | None) -> tuple[str, str]:
    registry, metadata, on_server_key = await asyncio.to_thread(_registry, db, user, requested)  # reads the user's AI settings
    request = CompletionRequest(messages=tuple(messages), tenant=TenantId(user))
    try:
        result = await adispatch_with_timeout(
            _gateway(registry), request, _tenant(user, metadata),
            timeout_seconds=get_settings().ai_timeout_seconds, tools=tools,
        )
    except ModelDispatcherError as e:
        raise DispatchError(e.http_status, e.to_payload()) from e
    served = _served_by(result)
    if served in on_server_key:
        SERVER_BUDGET.add(result.usage.total_tokens)
    return result.final_message.content or "", served


_ROLES = {"user": Role.USER, "assistant": Role.ASSISTANT, "system": Role.SYSTEM}

# tool results and numbers stay as they are; only the prose switches language
_ANSWER_IN = {"en": "", "he": "\nAnswer in Hebrew. Keep ticker symbols, company names and numbers as they are."}


async def chat(db: Session, user: str, messages: list[JSONDict], tools: ToolRegistry,
               requested: str = "auto", context: str = "", language: str = "en") -> JSONDict:
    """One agent turn with tool use. The caller supplies the tools (see app.ai.tools.registry).

    Raises:
        KeyError: language isn't one of _ANSWER_IN's keys (ChatIn already restricts it).
    """
    system = SYSTEM_PROMPT + _ANSWER_IN[language] + (f"\n{context}" if context else "")
    convo = [Message(role=Role.SYSTEM, content=system)]
    convo += [Message(role=_ROLES[m["role"]], content=m["content"]) for m in messages]
    content, model = await _run(db, user, convo, requested, tools)
    return {"model": model, "content": content}


async def complete(db: Session, user: str, prompt: str, system: str = "") -> JSONDict:
    """One tool-free completion (news digests, the safety analyzer). Routed like chat."""
    convo = ([Message(role=Role.SYSTEM, content=system)] if system else []) + [Message(role=Role.USER, content=prompt)]
    content, model = await _run(db, user, convo, "auto", None)
    return {"model": model, "content": content}


def available(db: Session, user: str) -> JSONDict:
    """Which vendors can serve this user right now, and from whose key."""
    s = get_settings()
    cfg = load_ai_settings(db, user)
    mine = {p["provider"]: p for p in cfg["config"]["providers"] if p["provider"] in VENDORS and p.get("apiKeys")}
    out = []
    for vendor, (_, key_attr, default_model) in VENDORS.items():
        if vendor in mine or getattr(s, key_attr):
            out.append({"id": vendor, "model": (mine.get(vendor) or {}).get("model") or default_model,
                        "source": "yours" if vendor in mine else "server"})
    return {"vendors": out, "external": bool(cfg.get("external"))}
