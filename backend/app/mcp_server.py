"""MCP server mounted at /mcp so external agents (Claude Desktop/Code, other MCP clients)
can use the same tools as the in-app agent, scoped to one user by a MoatMine MCP token.

Create a token in Settings → AI → "MCP access", then point your client at
  https://<render-app>/mcp/   with header  Authorization: Bearer <token>
"""

import asyncio
from collections.abc import Mapping

from mcp.server.mcpserver import Context, MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from sqlalchemy import select
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.ai.tools import run_tool
from app.crypto import hash_token
from app.db import SessionLocal
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
        return row.user_id if row else None


async def _call(ctx: Context, name: str, **args: object) -> str:
    user = await asyncio.to_thread(_user_for_token, _token_from(ctx.headers))
    if not user:
        return '{"error": "unauthorized"}'
    db = await asyncio.to_thread(SessionLocal)
    try:
        return await run_tool(name, args, db, user)
    finally:
        await asyncio.to_thread(db.close)


@mcp.tool(description="User's accounts, holdings with P/L and weights, and totals. mode: 'real' (default) or 'paper'.")
async def get_portfolio(ctx: Context, mode: BookMode = "real") -> str:
    return await _call(ctx, "get_portfolio", mode=mode)


@mcp.tool(description="Latest quote for a ticker symbol.")
async def get_quote(symbol: str, ctx: Context) -> str:
    return await _call(ctx, "get_quote", symbol=symbol)


@mcp.tool(description="Fundamental ratios plus 1-year price/risk stats for a symbol.")
async def get_ratios(symbol: str, ctx: Context) -> str:
    return await _call(ctx, "get_ratios", symbol=symbol)


@mcp.tool(description="Recent company news for a symbol.")
async def get_news(symbol: str, ctx: Context) -> str:
    return await _call(ctx, "get_news", symbol=symbol)


@mcp.tool(description="Company profile: description, sector, employees, website, market cap.")
async def get_company(symbol: str, ctx: Context) -> str:
    return await _call(ctx, "get_company", symbol=symbol)


@mcp.tool(description="Quarterly EPS actual vs estimate.")
async def get_earnings(symbol: str, ctx: Context) -> str:
    return await _call(ctx, "get_earnings", symbol=symbol)


@mcp.tool(description="Analyst recommendation trend and consensus price target.")
async def get_analysts(symbol: str, ctx: Context) -> str:
    return await _call(ctx, "get_analysts", symbol=symbol)


@mcp.tool(description="Dividend history and splits.")
async def get_dividends(symbol: str, ctx: Context) -> str:
    return await _call(ctx, "get_dividends", symbol=symbol)


@mcp.tool(description="Fair-value estimate (DCF, Graham, Lynch, DDM, EPV, multiples), valuation indicators, Piotroski F and Altman Z. Rates in percent.")
async def get_valuation(
    symbol: str, ctx: Context, discount_rate: float | None = None, growth_rate: float | None = None,
    terminal_growth: float | None = None, margin_of_safety: float | None = None,
) -> str:
    return await _call(ctx, "get_valuation", symbol=symbol, discount_rate=discount_rate, growth_rate=growth_rate,
                       terminal_growth=terminal_growth, margin_of_safety=margin_of_safety)


@mcp.tool(description="Stock behaviour in past market crises vs SPY (drawdown, recovery) and its worst drawdowns.")
async def get_bad_times(symbol: str, ctx: Context) -> str:
    return await _call(ctx, "get_bad_times", symbol=symbol)


@mcp.tool(description="The user's risk profile rules.")
async def get_risk_profile(ctx: Context) -> str:
    return await _call(ctx, "get_risk_profile")


@mcp.tool(description="0–100 safety score for a stock with components and red flags.")
async def get_safety_score(symbol: str, ctx: Context) -> str:
    return await _call(ctx, "get_safety_score", symbol=symbol)


@mcp.tool(description="Check a proposed buy (money amount) against the user's risk rules: pass / warn / block. mode: 'real' (default) or 'paper'.")
async def safety_check(symbol: str, amount: float, ctx: Context, mode: BookMode = "real") -> str:
    return await _call(ctx, "safety_check", symbol=symbol, amount=amount, mode=mode)


@mcp.tool(description="Portfolio volatility, beta, VaR, drawdown, concentration, sectors, correlation, rule breaches. mode: 'real' (default) or 'paper'.")
async def get_portfolio_risk(ctx: Context, mode: BookMode = "real") -> str:
    return await _call(ctx, "get_portfolio_risk", mode=mode)


@mcp.tool(description="Portfolio replayed through past crises and 10/20/35% market falls vs the user's loss limit. mode: 'real' (default) or 'paper'.")
async def get_stress_test(ctx: Context, mode: BookMode = "real") -> str:
    return await _call(ctx, "get_stress_test", mode=mode)


@mcp.tool(description="Recent news across the user's holdings and watchlist.")
async def get_news_feed(ctx: Context) -> str:
    return await _call(ctx, "get_news_feed")


@mcp.tool(description="PAPI targets (profit, amount, period, intent) evaluated against MAMI min/max bounds.")
async def get_targets_status(ctx: Context) -> str:
    return await _call(ctx, "get_targets_status")


@mcp.tool(description="User's watchlist with live quotes.")
async def get_watchlist(ctx: Context) -> str:
    return await _call(ctx, "get_watchlist")


@mcp.tool(description="User's saved notes/thesis for a symbol.")
async def get_notes(symbol: str, ctx: Context) -> str:
    return await _call(ctx, "get_notes", symbol=symbol)


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
