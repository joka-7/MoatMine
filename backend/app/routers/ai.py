from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.dispatcher import VENDORS, available, chat
from app.ai.settings_store import SUPPORTED, load_ai_settings, masked, save_ai_settings
from app.ai.tools import registry
from app.auth import current_user
from app.crypto import new_mcp_token
from app.db import get_db
from app.jsontypes import JSONDict
from app.models import MCPToken
from app.safety.service import get_profile, profile_dict
from app.schemas import ChatIn

router = APIRouter(prefix="/ai", tags=["ai"])

VENDOR_LABELS = {"anthropic": "Anthropic Claude", "openai": "OpenAI", "gemini": "Google Gemini", "groq": "Groq"}


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
        "do not help work around them; the user can change the rules only in the Risk profile page. "
        "Real-money and paper (practice) accounts are separate books: the portfolio tools default to real money; "
        "pass mode='paper' only when the user asks about paper trading, and never add the two together."
    )
    return rules + (f" The user is currently viewing {symbol}." if symbol else "")


@router.get("/models")
def models(user: str = Depends(current_user), db: Session = Depends(get_db)) -> list[JSONDict]:
    """Choices for the chat's model picker, with whether each can run right now."""
    av = available(db, user)
    vendors = {v["id"]: v for v in av["vendors"]}
    out = [{"id": "auto", "label": "Auto (ModelDispatcher routes)", "available": bool(vendors)}]
    for vid in VENDORS:
        v = vendors.get(vid)
        label = VENDOR_LABELS[vid] + (f" · {v['model']}" + (" (server key)" if v["source"] == "server" else "") if v else "")
        out.append({"id": vid, "label": label, "available": v is not None})
    out.append({"id": "external", "label": "My external agent", "available": av["external"]})
    return out


@router.post("/chat")
async def chat_endpoint(body: ChatIn, user: str = Depends(current_user), db: Session = Depends(get_db)) -> JSONDict:
    used: list[str] = []
    out = await chat(db, user, [m.model_dump() for m in body.messages], registry(db, user, used),
                     requested=body.model, context=agent_context(db, user, body.symbol))
    return {**out, "tools_used": used}


# --- AI settings: ModelPicker's AgentConfig + favorite external app + external agent ---


class AISettingsIn(BaseModel):
    config: JSONDict
    favorite: str | None = None
    external: JSONDict | None = None


@router.get("/settings")
def get_ai_settings(user: str = Depends(current_user), db: Session = Depends(get_db)) -> JSONDict:
    data = masked(load_ai_settings(db, user))
    return {**data, "supported": list(SUPPORTED), "server_vendors": [v["id"] for v in available(db, user)["vendors"] if v["source"] == "server"]}


@router.put("/settings")
def put_ai_settings(body: AISettingsIn, user: str = Depends(current_user), db: Session = Depends(get_db)) -> JSONDict:
    try:
        data = save_ai_settings(db, user, body.config, body.external, body.favorite)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    except RuntimeError as e:  # FERNET_KEY missing
        raise HTTPException(500, str(e)) from e
    return {**data, "supported": list(SUPPORTED), "server_vendors": [v["id"] for v in available(db, user)["vendors"] if v["source"] == "server"]}


# --- tokens that let an external agent (Claude Desktop, Claude Code, etc.) reach /mcp ---


@router.get("/mcp-tokens")
def list_mcp_tokens(user: str = Depends(current_user), db: Session = Depends(get_db)) -> list[JSONDict]:
    rows = db.scalars(select(MCPToken).where(MCPToken.user_id == user)).all()
    return [{"id": r.id, "label": r.label, "created_at": r.created_at} for r in rows]


@router.post("/mcp-tokens", status_code=201)
def create_mcp_token(label: str = "", user: str = Depends(current_user), db: Session = Depends(get_db)) -> JSONDict:
    token, digest = new_mcp_token()
    row = MCPToken(user_id=user, token_hash=digest, label=label[:120])
    db.add(row)
    db.commit()
    return {"id": row.id, "token": token, "note": "Shown once. Use as: Authorization: Bearer <token> against /mcp"}


@router.delete("/mcp-tokens/{token_id}", status_code=204)
def delete_mcp_token(token_id: int, user: str = Depends(current_user), db: Session = Depends(get_db)) -> None:
    row = db.get(MCPToken, token_id)
    if not row or row.user_id != user:
        raise HTTPException(404, "not found")
    db.delete(row)
    db.commit()
