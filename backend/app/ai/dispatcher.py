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

import re
from collections.abc import Awaitable, Callable
from typing import Protocol

from model_dispatcher import (
    CompletionRequest,
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
    Tool,
    ToolRegistry,
    ToolSpec,
)
from model_dispatcher.byok import adispatch_with_timeout, credential_metadata
from model_dispatcher.providers import AnthropicProvider, GeminiProvider, GroqProvider, OpenAIProvider
from model_dispatcher.providers.base import ModelProvider
from sqlalchemy.orm import Session

from app.ai.settings_store import load_ai_settings
from app.ai.tools import TOOL_SPECS, run_tool
from app.config import get_settings
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


class DispatchError(Exception):
    """A gateway failure carrying the HTTP status and JSON body to send to the client."""

    def __init__(self, status: int, payload: JSONDict):
        super().__init__(str(payload.get("detail") or payload.get("error") or payload))
        self.status = status
        self.payload = payload


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


def external_factory(base_url: str, model: str) -> ModelProvider:
    """The user's own agent, reached as an OpenAI-compatible endpoint."""
    return OpenAIProvider(model=model or "default", base_url=base_url, name=f"{EXTERNAL}:{model or 'default'}",
                          tier=ModelTier.STANDARD)


def _registry(db: Session, user: str, requested: str) -> tuple[ProviderRegistry, dict[str, str]]:
    s = get_settings()
    cfg = load_ai_settings(db, user)
    chosen = [p for p in cfg["config"]["providers"] if p["provider"] in VENDORS]
    user_keys = {p["provider"]: list(p.get("apiKeys") or []) for p in chosen}
    user_models = {p["provider"]: p.get("model") for p in chosen}
    order = [p["provider"] for p in chosen] + [v for v in VENDORS if v not in user_models]

    registry = ProviderRegistry()
    if requested != EXTERNAL:
        for vendor in order:
            if requested not in ("auto", vendor):
                continue
            server_key = getattr(s, VENDORS[vendor][1]) or None
            if not server_key and not user_keys.get(vendor):
                continue  # a keyless vendor in the registry would hard-fail the request
            model = user_models.get(vendor) or VENDORS[vendor][2]
            registry.register(provider_factory(vendor, model, server_key, tier_for(model)))

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
            "detail": "No AI provider available. Add your own key in Settings → AI, or ask the server owner to set one.",
            "action": "open_ai_settings",
        })
    return registry, metadata


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


def _tools(db: Session, user: str, used: list[str]) -> ToolRegistry:
    reg = ToolRegistry()

    def handler(name: str) -> Callable[[JSONDict], Awaitable[str]]:
        async def run(args: JSONDict) -> str:
            used.append(name)
            return await run_tool(name, dict(args), db, user)

        return run

    for spec in TOOL_SPECS:
        reg.register(Tool(spec=ToolSpec(spec["name"], spec["description"], spec["parameters"]),
                          ahandler=handler(spec["name"])))
    return reg


def _served_by(result: RunResult) -> str:
    for step in reversed(result.steps):
        for attempt in reversed(step.attempts):
            if attempt.error_class is None:
                return attempt.provider_name
    return "unknown"


async def _run(db: Session, user: str, messages: list[Message], requested: str,
               tools: ToolRegistry | None) -> tuple[str, str]:
    registry, metadata = _registry(db, user, requested)
    request = CompletionRequest(messages=tuple(messages), tenant=TenantId(user))
    try:
        result = await adispatch_with_timeout(
            _gateway(registry), request, _tenant(user, metadata),
            timeout_seconds=get_settings().ai_timeout_seconds, tools=tools,
        )
    except ModelDispatcherError as e:
        raise DispatchError(e.http_status, e.to_payload()) from e
    return result.final_message.content or "", _served_by(result)


_ROLES = {"user": Role.USER, "assistant": Role.ASSISTANT, "system": Role.SYSTEM}


async def chat(db: Session, user: str, messages: list[JSONDict], requested: str = "auto", context: str = "") -> JSONDict:
    convo = [Message(role=Role.SYSTEM, content=SYSTEM_PROMPT + (f"\n{context}" if context else ""))]
    convo += [Message(role=_ROLES[m["role"]], content=m["content"]) for m in messages]
    used: list[str] = []
    content, model = await _run(db, user, convo, requested, _tools(db, user, used))
    return {"model": model, "content": content, "tools_used": used}


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
