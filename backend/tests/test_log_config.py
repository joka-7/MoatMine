import json
import logging

import pytest

from app.log_config import JsonFormatter, TextFormatter, redact, request_id


@pytest.mark.parametrize(
    ("line", "expected"),
    [
        ("GET https://x/stable/profile?symbol=AAPL&apikey=abc123", "GET https://x/stable/profile?symbol=AAPL&apikey=[redacted]"),
        ("url?token=s3cr3t done", "url?token=[redacted] done"),
        ('{"msg": "x?API_KEY=zz\\"}', '{"msg": "x?API_KEY=[redacted]\\"}'),
        ("dedupe_key=risk:position:AAPL", "dedupe_key=risk:position:AAPL"),  # not a secret parameter
    ],
)
def test_redact_masks_secret_query_parameters(line, expected):
    assert redact(line) == expected


def _record(msg: str, **extra) -> logging.LogRecord:
    r = logging.LogRecord("app.test", logging.WARNING, __file__, 1, msg, None, None)
    for k, v in extra.items():
        setattr(r, k, v)
    return r


def test_json_formatter_emits_extras_and_scrubs_secrets():
    out = json.loads(JsonFormatter().format(_record("fetch https://x?apikey=abc failed", symbol="AAPL", request_id="r1")))
    assert out["level"] == "WARNING" and out["logger"] == "app.test" and out["symbol"] == "AAPL" and out["request_id"] == "r1"
    assert "abc" not in out["msg"]


def test_text_formatter_appends_extras():
    line = TextFormatter("%(levelname)s %(message)s").format(_record("quote failed", symbol="MSFT"))
    assert line == 'WARNING quote failed {"symbol": "MSFT"}'


@pytest.mark.parametrize(
    ("sent", "kept"), [("abc-123", True), ("x" * 65, False), ("bad id\nINJECTED", False), (None, False)]
)
def test_tag_request_sets_a_safe_request_id(client, sent, kept):
    r = client.get("/health", headers={"X-Request-ID": sent} if sent else {})
    rid = r.headers["x-request-id"]
    assert (rid == sent) is kept and len(rid) <= 64 and "\n" not in rid
    assert request_id.get() == "-"  # reset after the request
