"""Routes for schedulers, not users: start an alert pass (the worker's job) from outside.

On hosting without background workers (Render's free plan), a scheduled job calls
POST /internal/alerts/run with ALERTS_RUN_TOKEN instead of running `python -m app.worker`.
"""

import asyncio
import hmac
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app import worker
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal")
_bearer = HTTPBearer(auto_error=False)

# the pass in progress; holding the reference keeps the task from being garbage-collected
_running: asyncio.Task[int] | None = None


def _scheduler(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> None:
    """Allow only a caller holding ALERTS_RUN_TOKEN; the route doesn't exist when no token is set.

    Raises:
        HTTPException: 404 when ALERTS_RUN_TOKEN is unset, 401 when the token is missing or wrong.
    """
    expected = get_settings().alerts_run_token
    if not expected:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not Found")
    if not creds or not hmac.compare_digest(creds.credentials.encode(), expected.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token")


def _log_outcome(task: asyncio.Task[int]) -> None:
    if task.cancelled():
        logger.warning("alert pass cancelled")
    elif (e := task.exception()) is not None:
        logger.error("alert pass failed", exc_info=e)


@router.post("/alerts/run", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(_scheduler)])
async def run_alerts() -> dict[str, str]:
    """Start one alert pass in the background and return at once; a pass already running is left alone."""
    global _running
    if _running is not None and not _running.done():
        return {"status": "already running"}
    _running = asyncio.create_task(worker.run_once())
    _running.add_done_callback(_log_outcome)
    return {"status": "started"}
