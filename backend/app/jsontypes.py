"""The one place `Any` is allowed: JSON-shaped dicts.

Provider responses and report dicts (safety, risk, stress, valuation) are built and returned as
plain JSON objects. Giving each its own TypedDict or response model is backlog item #25; until
then this named alias marks them, instead of a bare `dict` or scattered `Any`.
"""

from typing import Any

type JSONDict = dict[str, Any]
