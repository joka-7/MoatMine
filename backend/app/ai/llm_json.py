"""Pull the JSON object out of a model reply that was asked to answer in JSON."""

import json

from app.jsontypes import JSONDict


def json_object_in(text: str) -> JSONDict | None:
    """The outermost `{...}` in `text` parsed as a JSON object, or None if there isn't one.

    Models often wrap the JSON in prose or a ```json fence; anything from the first `{` to the
    last `}` is tried. A reply that parses to something other than an object counts as none.
    """
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end < start:
        return None
    try:
        parsed = json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None
