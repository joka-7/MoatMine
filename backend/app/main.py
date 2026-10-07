import logging
import re
import uuid
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.config import get_settings
from app.db import schema_is_current
from app.log_config import configure_logging, request_id
from app.mcp_server import build_mcp_app, mcp
from app.routers import ai, portfolio, safety, stocks, targets, watchlist

configure_logging(get_settings().log_level, get_settings().log_format)
logger = logging.getLogger(__name__)

_CLIENT_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{1,64}")

mcp_app = build_mcp_app()


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with mcp.session_manager.run():
        yield


app = FastAPI(title="MoatMine API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_list,
    # e.g. ^https://moatmine-[a-z0-9-]+-yourteam\.vercel\.app$ for your own preview deployments
    allow_origin_regex=get_settings().cors_origin_regex or None,
    allow_credentials=False,  # bearer tokens, no cookies
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Data-Source", "X-Request-ID"],
)


@app.middleware("http")
async def tag_request(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    """Give every request an id (the caller's X-Request-ID if it is well-formed) for logs and the response."""
    given = request.headers.get("x-request-id", "")
    rid = given if _CLIENT_REQUEST_ID.fullmatch(given) else uuid.uuid4().hex
    token = request_id.set(rid)
    try:
        response = await call_next(request)
    finally:
        request_id.reset(token)
    response.headers["X-Request-ID"] = rid
    return response

for r in (portfolio.router, stocks.router, stocks.feed_router, watchlist.router, targets.router, ai.router, safety.router):
    app.include_router(r)

app.mount("/mcp", mcp_app)


@app.get("/health")
def health() -> dict[str, bool]:
    """Liveness: the process is up. Says nothing about its dependencies."""
    return {"ok": True}


@app.get("/health/ready")
def ready(response: Response) -> dict[str, object]:
    """Readiness (Render's deploy health check): the database answers and has the newest migration."""
    try:
        current = schema_is_current()
    except SQLAlchemyError:
        logger.exception("readiness: database unreachable")
        response.status_code = 503
        return {"ok": False, "database": "unreachable"}
    if not current:
        response.status_code = 503
        return {"ok": False, "database": "schema behind the code; run alembic upgrade head"}
    return {"ok": True, "database": "ok"}
