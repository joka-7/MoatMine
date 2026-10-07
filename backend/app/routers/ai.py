from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.dispatcher import DispatchError, chat
from app.auth import current_user
from app.config import get_settings
from app.crypto import decrypt, encrypt, mask, new_mcp_token
from app.db import get_db
from app.models import AIKey, MCPToken
from app.safety.service import get_profile, profile_dict
from app.schemas import AIKeyIn, AIKeyOut, ChatIn

router = APIRouter(prefix="/ai", tags=["ai"])


def agent_context(db: Session, user: str, symbol: str | None) -> str:
    """Bind the agent to the user's own risk rules for this conversation."""
    p = profile_dict(get_profile(db, user))
    rules = (
        f"The user's risk profile is '{p['level']}'{'' if p['saved'] else ' (default, not yet set by the user)'}: "
        f"max {p['max_position_pct']:g}% in one stock, max {p['max_sector_pct']:g}% in one sector, "
        f"minimum safety score {p['min_safety_score']:g}, max volatility {p['max_volatility_pct']:g}%/yr, "
        f"portfolio loss limit {p['max_drawdown_pct']:g}%, minimum market cap ${p['min_market_cap_m']:,.0f}M, "
        f"penny stocks {'allowed' if p['allow_penny_stocks'] else 'not allowed'}. "
        "Run safety_check before discussing any buy. If something breaks these rules, say so plainly and "
        "do not help work around them; the user can change the rules only in the Risk profile page."
    )
    return rules + (f" The user is currently viewing {symbol}." if symbol else "")

MODEL_CHOICES = [
    {"id": "auto", "label": "Auto (dispatcher)"},
    {"id": "anthropic/claude-sonnet-5-5", "label": "Claude Sonnet 5.5"},
    {"id": "anthropic/claude-haiku-4-5-20251001", "label": "Claude Haiku 4.5"},
    {"id": "openai/gpt-4o", "label": "GPT-4o"},
    {"id": "openai/gpt-4o-mini", "label": "GPT-4o mini"},
    {"id": "gemini/gemini-2.0-flash", "label": "Gemini 2.0 Flash"},
    {"id": "external", "label": "My external agent"},
]


@router.get("/models")
def models(user: str = Depends(current_user), db: Session = Depends(get_db)):
    s = get_settings()
    user_providers = set(db.scalars(select(AIKey.provider).where(AIKey.user_id == user)).all())
    server = {p for p, k in [("anthropic", s.anthropic_api_key), ("openai", s.openai_api_key), ("gemini", s.gemini_api_key)] if k}
    available = user_providers | server
    out = []
    for m in MODEL_CHOICES:
        prov = "auto" if m["id"] == "auto" else m["id"].split("/")[0]
        ok = bool(available) if prov == "auto" else prov in available
        out.append({**m, "available": ok})
    return out


@router.post("/chat")
async def chat_endpoint(body: ChatIn, user: str = Depends(current_user), db: Session = Depends(get_db)):
    try:
        return await chat(
            db,
            user,
            [m.model_dump() for m in body.messages],
            requested=body.model,
            context=agent_context(db, user, body.symbol),
        )
    except DispatchError as e:
        raise HTTPException(502, str(e)) from e


@router.get("/keys", response_model=list[AIKeyOut])
def list_keys(user: str = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(AIKey).where(AIKey.user_id == user)).all()
    return [AIKeyOut(provider=r.provider, masked=mask(decrypt(r.encrypted_key)), base_url=r.base_url, model=r.model) for r in rows]


@router.put("/keys", response_model=AIKeyOut)
def put_key(body: AIKeyIn, user: str = Depends(current_user), db: Session = Depends(get_db)):
    if body.provider == "external" and not body.base_url.startswith("https://"):
        raise HTTPException(422, "external agent needs an https:// base_url (OpenAI-compatible chat completions)")
    try:
        enc = encrypt(body.api_key)
    except RuntimeError as e:
        raise HTTPException(500, str(e)) from e
    row = db.scalar(select(AIKey).where(AIKey.user_id == user, AIKey.provider == body.provider))
    if row:
        row.encrypted_key, row.base_url, row.model = enc, body.base_url, body.model
    else:
        row = AIKey(user_id=user, provider=body.provider, encrypted_key=enc, base_url=body.base_url, model=body.model)
        db.add(row)
    db.commit()
    return AIKeyOut(provider=row.provider, masked=mask(body.api_key), base_url=row.base_url, model=row.model)


@router.delete("/keys/{provider}", status_code=204)
def delete_key(provider: str, user: str = Depends(current_user), db: Session = Depends(get_db)):
    row = db.scalar(select(AIKey).where(AIKey.user_id == user, AIKey.provider == provider))
    if not row:
        raise HTTPException(404, "no key for provider")
    db.delete(row)
    db.commit()


# --- tokens that let an external agent (Claude Desktop, Claude Code, etc.) reach /mcp ---


@router.get("/mcp-tokens")
def list_mcp_tokens(user: str = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(MCPToken).where(MCPToken.user_id == user)).all()
    return [{"id": r.id, "label": r.label, "created_at": r.created_at} for r in rows]


@router.post("/mcp-tokens", status_code=201)
def create_mcp_token(label: str = "", user: str = Depends(current_user), db: Session = Depends(get_db)):
    token, digest = new_mcp_token()
    row = MCPToken(user_id=user, token_hash=digest, label=label[:120])
    db.add(row)
    db.commit()
    return {"id": row.id, "token": token, "note": "Shown once. Use as: Authorization: Bearer <token> against /mcp"}


@router.delete("/mcp-tokens/{token_id}", status_code=204)
def delete_mcp_token(token_id: int, user: str = Depends(current_user), db: Session = Depends(get_db)):
    row = db.get(MCPToken, token_id)
    if not row or row.user_id != user:
        raise HTTPException(404, "not found")
    db.delete(row)
    db.commit()
