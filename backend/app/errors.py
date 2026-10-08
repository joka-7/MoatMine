"""MoatMine's exception hierarchy: every error the app raises on purpose derives from MoatMineError.

The HTTP mapping for these lives in one place, app/main.py's exception handlers.
"""

from app.jsontypes import JSONDict


class MoatMineError(Exception):
    """Base class for MoatMine's own errors."""


class ConfigError(MoatMineError):
    """Settings are missing or unsafe; the process must not start."""


class InsufficientPaperCashError(MoatMineError):
    """A paper buy costs more than the paper account's cash."""


class MarketDataError(MoatMineError):
    """The market-data provider has no usable value (e.g. no price for a symbol). Sent as 502."""


class DispatchError(MoatMineError):
    """An AI gateway failure, carrying the HTTP status and JSON body to send to the client."""

    def __init__(self, status: int, payload: JSONDict):
        super().__init__(str(payload.get("detail") or payload.get("error") or payload))
        self.status = status
        self.payload = payload
