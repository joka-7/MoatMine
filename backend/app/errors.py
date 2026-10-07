"""MoatMine's exception hierarchy: every error the app raises on purpose derives from MoatMineError."""


class MoatMineError(Exception):
    """Base class for MoatMine's own errors."""


class ConfigError(MoatMineError):
    """Settings are missing or unsafe; the process must not start."""
