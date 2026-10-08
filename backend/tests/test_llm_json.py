"""Finding the JSON object in a model reply."""

import pytest

from app.ai.llm_json import json_object_in


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ('{"a": 1}', {"a": 1}),
        ('Sure! ```json\n{"a": {"b": 2}}\n``` hope that helps', {"a": {"b": 2}}),
        ("no json here", None),
        ("{not json}", None),
        ("[1, 2]", None),  # an array isn't an object
        ('} backwards {', None),
        ("", None),
    ],
)
def test_json_object_in(text, expected):
    assert json_object_in(text) == expected
