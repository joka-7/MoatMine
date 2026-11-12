"""The matching rules of web/src/lib/i18n/serverText.ts, so a test can ask whether a sentence the API
produces has a Hebrew translation. Keep the two in step: tests/vectors/server_text.json pins both."""

import json
import re
from pathlib import Path

SPEC = json.loads((Path(__file__).parent.parent.parent / "web" / "src" / "lib" / "i18n" / "serverText.he.json").read_text())
NUMBER = r"(-?\d[\d,]*\.?\d*)"


def _compile(pattern: str) -> re.Pattern[str]:
    out = []
    for part in re.split(r"(\{[^}]*\})", pattern):
        if not part.startswith("{"):
            out.append(re.escape(part))
        elif part == "{}":
            out.append("(.+?)")
        elif part == "{n}":
            out.append(NUMBER)
        else:
            out.append("(" + "|".join(re.escape(w) for w in part[1:-1].split("|")) + ")")
    return re.compile("^" + "".join(out) + "$")


TEMPLATES = [(_compile(p["en"]), p["he"]) for p in SPEC["patterns"]]
EXACT: dict[str, str] = SPEC["exact"]


def _lookup(text: str) -> str | None:
    if text in EXACT:
        return EXACT[text]
    if re.match(r"[a-z]", text):
        return EXACT.get(text[0].upper() + text[1:])
    return None


def _via_parts(text: str, separator: str, joiner: str) -> str | None:
    parts = re.split(separator, text)
    if len(parts) < 2:
        return None
    done = [translate(p) for p in parts]
    return joiner.join(done) if done != parts else None


def _fill(he: str, groups: tuple[str | None, ...]) -> str:
    return re.sub(r"\{(\d+)\}", lambda g: translate(groups[int(g.group(1)) - 1] or ""), he)


def translate(text: str) -> str:
    known = _lookup(text)
    if known is not None:
        return known
    sentences = _via_parts(text, r"(?<=\.)\s+(?=[A-Z])", " ")
    if sentences is not None:
        return sentences
    for pattern, he in TEMPLATES:
        m = pattern.match(text)
        if m:
            return _fill(he, m.groups())
    return _via_parts(text, "; ", "; ") or _via_parts(text, ", ", ", ") or text
