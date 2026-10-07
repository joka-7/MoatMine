"""Logging for the two entry points (API and worker): one dictConfig, JSON in production, secrets scrubbed.

Other modules only call logging.getLogger(__name__); this is the only place handlers are set.
"""

import json
import logging
import logging.config
import re
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Literal

# set per HTTP request by the API's middleware; "-" outside a request (worker, startup)
request_id: ContextVar[str] = ContextVar("request_id", default="-")

# provider keys travel as query parameters (FMP's apikey=…) and appear in URLs inside httpx errors
_SECRET_PARAM = re.compile(r"(?i)\b(token|apikey|api_key)=([^&\s\"'\\]+)")
_RECORD_ATTRS = set(vars(logging.LogRecord("", 0, "", 0, "", None, None))) | {"message", "asctime"}


def redact(text: str) -> str:
    """Mask secret-looking query parameters (token=…, apikey=…) in a formatted log line."""
    return _SECRET_PARAM.sub(r"\1=[redacted]", text)


def _extras(record: logging.LogRecord) -> dict[str, object]:
    return {k: v for k, v in vars(record).items() if k not in _RECORD_ATTRS}


class RequestIdFilter(logging.Filter):
    """Stamp every record with the current request id."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id.get()
        return True


class JsonFormatter(logging.Formatter):
    """One JSON object per line: ts, level, logger, msg, any `extra=` fields, and the traceback."""

    def format(self, record: logging.LogRecord) -> str:
        out: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            **_extras(record),
        }
        if record.exc_info:
            out["exc"] = self.formatException(record.exc_info)
        return redact(json.dumps(out, default=str))


class TextFormatter(logging.Formatter):
    """Readable lines for local runs, with `extra=` fields appended as JSON."""

    def format(self, record: logging.LogRecord) -> str:
        line = super().format(record)
        extras = {k: v for k, v in _extras(record).items() if k != "request_id"}
        return redact(f"{line} {json.dumps(extras, default=str)}" if extras else line)


def configure_logging(level: str, fmt: Literal["json", "text"]) -> None:
    """Install the root handler. Call once, from an entry point (app.main, app.worker, app.seed)."""
    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "filters": {"request_id": {"()": RequestIdFilter}},
        "formatters": {
            "json": {"()": JsonFormatter},
            "text": {"()": TextFormatter, "format": "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"},
        },
        "handlers": {"console": {"class": "logging.StreamHandler", "formatter": fmt, "filters": ["request_id"]}},
        "root": {"level": level.upper(), "handlers": ["console"]},
        # httpx logs every request URL at INFO, query string included; alembic chatters on each readiness probe
        "loggers": {"httpx": {"level": "WARNING"}, "httpcore": {"level": "WARNING"}, "alembic": {"level": "WARNING"}},
    })
