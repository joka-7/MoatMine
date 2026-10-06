"""Model dispatcher.

- model="auto": short/simple questions -> FAST_MODEL, analysis -> DEFAULT_MODEL
- explicit LiteLLM id (e.g. "openai/gpt-4o", "gemini/gemini-2.0-flash"): used as-is
- model="external": forwards to the user's own agent (any OpenAI-compatible /chat/completions URL)

Key resolution per provider: the user's own (BYO) key first, then the server's env key.
On failure the dispatcher walks FALLBACK_MODELS.
"""

import json
import re

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.tools import openai_tools, run_tool
from app.config import get_settings
from app.crypto import decrypt
from app.models import AIKey

MAX_TOOL_ROUNDS = 6

SYSTEM_PROMPT = (
    "You are Folio's investment assistant. Use the tools to look at the user's real portfolio, "
    "targets (PAPI: profit, amount, period, intent with MAMI min/max bounds), watchlist and market data "
    "before answering. Be concise and numeric. You provide information and analysis, not personalised "
    "financial advice; never claim certainty about future prices. You cannot place trades."
)

_ANALYSIS_HINTS = re.compile(
    r"\b(analy[sz]e|compare|why|should|rebalance|risk|strategy|explain|forecast|valuation|portfolio|targets?)\b", re.I
)


class DispatchError(RuntimeError):
    pass


def pick_model(requested: str, last_user_msg: str) -> str:
    s = get_settings()
    if requested != "auto":
        return requested
    if len(last_user_msg) < 160 and not _ANALYSIS_HINTS.search(last_user_msg):
        return s.fast_model
    return s.default_model


def _provider_of(model: str) -> str:
    return model.split("/", 1)[0] if "/" in model else "openai"


def _user_key(db: Session, user: str, provider: str) -> AIKey | None:
    return db.scalar(select(AIKey).where(AIKey.user_id == user, AIKey.provider == provider))


def resolve_key(db: Session, user: str, model: str) -> str | None:
    provider = _provider_of(model)
    row = _user_key(db, user, provider)
    if row:
        return decrypt(row.encrypted_key)
    s = get_settings()
    return {"anthropic": s.anthropic_api_key, "openai": s.openai_api_key, "gemini": s.gemini_api_key}.get(provider) or None


async def _completion(**kwargs):
    import litellm  # imported lazily: heavy, and tests patch this function

    return await litellm.acompletion(**kwargs)


async def _run_with_tools(model: str, api_key: str | None, messages: list[dict], db: Session, user: str) -> tuple[str, list[str]]:
    used_tools: list[str] = []
    for _ in range(MAX_TOOL_ROUNDS):
        resp = await _completion(model=model, messages=messages, tools=openai_tools(), api_key=api_key)
        msg = resp.choices[0].message
        calls = getattr(msg, "tool_calls", None) or []
        if not calls:
            return msg.content or "", used_tools
        messages.append({"role": "assistant", "content": msg.content or "", "tool_calls": [c.model_dump() if hasattr(c, "model_dump") else c for c in calls]})
        for c in calls:
            fn = c.function
            args = json.loads(fn.arguments or "{}")
            used_tools.append(fn.name)
            result = await run_tool(fn.name, args, db, user)
            messages.append({"role": "tool", "tool_call_id": c.id, "content": result})
    return "I hit the tool-call limit before finishing. Try a narrower question.", used_tools


async def _external(db: Session, user: str, messages: list[dict]) -> tuple[str, str]:
    row = _user_key(db, user, "external")
    if not row or not row.base_url:
        raise DispatchError("No external agent configured. Add one under Settings → AI (provider: external).")
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            row.base_url,
            headers={"Authorization": f"Bearer {decrypt(row.encrypted_key)}"},
            json={"model": row.model or "default", "messages": messages},
        )
        r.raise_for_status()
        data = r.json()
    try:
        return data["choices"][0]["message"]["content"], f"external:{row.model or 'default'}"
    except (KeyError, IndexError, TypeError):
        raise DispatchError("External agent response was not OpenAI-compatible") from None


async def chat(db: Session, user: str, messages: list[dict], requested: str = "auto", context: str = "") -> dict:
    system = SYSTEM_PROMPT + (f"\nThe user is currently viewing: {context}" if context else "")
    convo = [{"role": "system", "content": system}, *messages]

    if requested == "external":
        content, model = await _external(db, user, convo)
        return {"model": model, "content": content, "tools_used": []}

    last = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    primary = pick_model(requested, last)
    chain = [primary] + [m for m in get_settings().fallback_list if m != primary]

    errors = []
    for model in chain:
        key = resolve_key(db, user, model)
        if not key:
            errors.append(f"{model}: no API key")
            continue
        try:
            content, tools_used = await _run_with_tools(model, key, list(convo), db, user)
            return {"model": model, "content": content, "tools_used": tools_used}
        except Exception as e:  # provider errors: try the next model
            errors.append(f"{model}: {type(e).__name__}: {e}"[:300])
    raise DispatchError("All models failed — " + " | ".join(errors))
