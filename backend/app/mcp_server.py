"""MCP server mounted at /mcp so external agents (Claude Desktop/Code, other MCP clients)
can use the same tools as the in-app agent, scoped to one user by a MoatMine MCP token.

Create a token in Settings → AI → "MCP access", then point your client at
  https://<render-app>/mcp/   with header  Authorization: Bearer <token>
"""

import asyncio
from collections.abc import Awaitable, Callable, Mapping

from mcp.server.mcpserver import Context, MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from sqlalchemy import select
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.ai.tools import TOOL_SPECS, run_tool
from app.auth import email_allowed
from app.config import get_settings
from app.crypto import hash_token
from app.db import SessionLocal
from app.errors import ConfigError
from app.models import MCPToken
from app.portfolio import BookMode

mcp = MCPServer(
    name="moatmine",
    instructions="Read a MoatMine user's portfolio, PAPI/MAMI targets, watchlist and market data. No trading.",
)


def _token_from(headers: Mapping[str, str] | None) -> str | None:
    auth = (headers or {}).get("authorization", "")
    return auth[7:].strip() if auth.lower().startswith("bearer ") else None


def _user_for_token(token: str | None) -> str | None:
    if not token:
        return None
    with SessionLocal() as db:
        row = db.scalar(select(MCPToken).where(MCPToken.token_hash == hash_token(token)))
        # a token is only as good as its owner's place on the allow-list today; one made before
        # the list existed has no email on record and stops working until the owner makes a new one
        if row is None or not email_allowed(row.email, get_settings()):
            return None
        return row.user_id


async def _call(ctx: Context, name: str, **args: object) -> str:
    user = await asyncio.to_thread(_user_for_token, _token_from(ctx.headers))
    if not user:
        return '{"error": "unauthorized"}'
    db = await asyncio.to_thread(SessionLocal)
    try:
        return await run_tool(name, args, db, user)
    finally:
        await asyncio.to_thread(db.close)


# Typed wrappers, one per argument shape: the MCP SDK builds each tool's input schema from its
# function signature. The descriptions come from TOOL_SPECS so both agents read the same text.
def _no_args(name: str) -> Callable[..., Awaitable[str]]:
    async def tool(ctx: Context) -> str:
        return await _call(ctx, name)
    return tool


def _symbol_only(name: str) -> Callable[..., Awaitable[str]]:
    async def tool(symbol: str, ctx: Context) -> str:
        return await _call(ctx, name, symbol=symbol)
    return tool


def _mode_only(name: str) -> Callable[..., Awaitable[str]]:
    async def tool(ctx: Context, mode: BookMode = "real") -> str:
        return await _call(ctx, name, mode=mode)
    return tool


def _symbol_amount_mode(name: str) -> Callable[..., Awaitable[str]]:
    async def tool(symbol: str, amount: float, ctx: Context, mode: BookMode = "real") -> str:
        return await _call(ctx, name, symbol=symbol, amount=amount, mode=mode)
    return tool


def _valuation(name: str) -> Callable[..., Awaitable[str]]:
    async def tool(
        symbol: str, ctx: Context, discount_rate: float | None = None, growth_rate: float | None = None,
        terminal_growth: float | None = None, margin_of_safety: float | None = None,
    ) -> str:
        return await _call(ctx, name, symbol=symbol, discount_rate=discount_rate, growth_rate=growth_rate,
                           terminal_growth=terminal_growth, margin_of_safety=margin_of_safety)
    return tool


_SHAPES: dict[frozenset[str], Callable[[str], Callable[..., Awaitable[str]]]] = {
    frozenset(): _no_args,
    frozenset({"symbol"}): _symbol_only,
    frozenset({"mode"}): _mode_only,
    frozenset({"symbol", "amount", "mode"}): _symbol_amount_mode,
    frozenset({"symbol", "discount_rate", "growth_rate", "terminal_growth", "margin_of_safety"}): _valuation,
}


def _register_read_only_tools() -> None:
    """Serve every read-only tool in TOOL_SPECS over MCP.

    Raises:
        ConfigError: a read-only spec has an argument shape with no wrapper above.
    """
    for spec in TOOL_SPECS:
        if not spec["read_only"]:
            continue
        shape = frozenset(spec["parameters"]["properties"])
        if shape not in _SHAPES:
            raise ConfigError(f"no MCP wrapper for tool {spec['name']} with arguments {sorted(shape)}")
        mcp.add_tool(_SHAPES[shape](spec["name"]), name=spec["name"], description=spec["description"])


_register_read_only_tools()


class _BearerGate:
    """Reject requests without a valid MoatMine MCP token before they reach the MCP transport."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
            if not await asyncio.to_thread(_user_for_token, _token_from(headers)):
                await JSONResponse({"error": "invalid or missing MCP token"}, status_code=401)(scope, receive, send)
                return
        await self.app(scope, receive, send)


def build_mcp_app() -> ASGIApp:
    inner = mcp.streamable_http_app(
        streamable_http_path="/",
        stateless_http=True,
        json_response=True,
        # Host checks are for localhost servers; this runs behind Render's proxy with bearer auth.
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    return _BearerGate(inner)
