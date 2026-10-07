"""Logging configuration — called once, from the application entry point only.

Library modules just do ``logger = logging.getLogger(__name__)``; they never configure
handlers. Output is one JSON object per line (stdlib only), ready for a log aggregator.
"""

from __future__ import annotations

import json
import logging
import logging.config

# LogRecord attributes that are not caller-supplied ``extra=`` context.
_STANDARD_ATTRS = frozenset(vars(logging.makeLogRecord({}))) | {"message", "asctime"}


class JsonFormatter(logging.Formatter):
    """Render a record as a single JSON line, including ``extra=`` fields and tracebacks."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "time": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        payload.update({k: v for k, v in vars(record).items() if k not in _STANDARD_ATTRS})
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO") -> None:
    """Install the JSON handler on the root logger. Safe to call more than once."""
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {"json": {"()": JsonFormatter}},
            "handlers": {"stderr": {"class": "logging.StreamHandler", "formatter": "json"}},
            "root": {"level": level, "handlers": ["stderr"]},
        }
    )
