"""Which data actually fed a computation, tracked per task rather than on the shared provider.

Finnhub's candle endpoint is paid on most plans; when it fails, charts fall back to the mock
series. Anything built from those bars must say it is sample data. The providers are
process-wide singletons, so a flag on the provider would be overwritten by concurrent requests;
a ContextVar keeps each request's (and each nested computation's) record separate.
"""

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar

MOCK_FALLBACK = "mock-fallback"

# a stack, so a nested tracker (bad_times inside stock_safety) also reports to the outer one;
# the sets are shared with tasks spawned by asyncio.gather, which copy the context
_trackers: ContextVar[tuple[set[str], ...]] = ContextVar("data_source_trackers", default=())


@contextmanager
def track_sources() -> Iterator[set[str]]:
    """Collect the fallback sources used inside the block (by this task and the tasks it awaits)."""
    used: set[str] = set()
    token = _trackers.set((*_trackers.get(), used))
    try:
        yield used
    finally:
        _trackers.reset(token)


def note_source(source: str) -> None:
    """Record that data from `source` (e.g. MOCK_FALLBACK) was used by the current computation."""
    for used in _trackers.get():
        used.add(source)


def source_label(provider_name: str, used: set[str]) -> str:
    """The `data_source` to show: the provider's name, unless any input fell back to sample data."""
    return MOCK_FALLBACK if MOCK_FALLBACK in used else provider_name


def is_sample_data(label: str) -> bool:
    """Whether a `data_source` label means sample prices: the mock provider or a fallback to it."""
    return label.startswith("mock")
