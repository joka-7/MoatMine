from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import init_db
from app.market import get_provider
from app.mcp_server import build_mcp_app, mcp
from app.routers import ai, portfolio, safety, stocks, targets, watchlist

mcp_app = build_mcp_app()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    async with mcp.session_manager.run():
        yield


app = FastAPI(title="Folio API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_list,
    # e.g. ^https://folio-[a-z0-9-]+-yourteam\.vercel\.app$ for your own preview deployments
    allow_origin_regex=get_settings().cors_origin_regex or None,
    allow_credentials=False,  # bearer tokens, no cookies
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Data-Source"],
)

for r in (portfolio.router, stocks.router, stocks.feed_router, watchlist.router, targets.router, ai.router, safety.router):
    app.include_router(r)

app.mount("/mcp", mcp_app)


@app.get("/health")
def health():
    return {"ok": True, "market_provider": get_provider().name}
