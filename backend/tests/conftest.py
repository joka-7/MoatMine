import os
import tempfile

from cryptography.fernet import Fernet

# Test modules import helpers from `tests.conftest`, which runs this file a second time under that
# name; a second FERNET_KEY or database there would no longer match the settings already cached.
if "MOATMINE_TEST_ENV" not in os.environ:
    os.environ["MOATMINE_TEST_ENV"] = "1"
    os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
    os.environ["FERNET_KEY"] = Fernet.generate_key().decode()
    os.environ["MARKET_PROVIDER"] = "mock"
    os.environ["AUTH_MODE"] = "dev"
    os.environ["ANTHROPIC_API_KEY"] = "server-key"
    os.environ.pop("OPENAI_API_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import migrate_to_head  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    migrate_to_head()
    with TestClient(app) as c:
        yield c


def auth(user: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {user}"}


# ---------- ModelDispatcher test doubles ----------

from model_dispatcher import Message, ModelTier, Role, ToolCall  # noqa: E402
from model_dispatcher.providers import MockProvider  # noqa: E402
from model_dispatcher.types import JSONValue  # noqa: E402

from app.ai import dispatcher  # noqa: E402


class RecordingMock(MockProvider):
    """MockProvider that also keeps every request it saw."""

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.requests = []

    def complete(self, request, *, api_key=None):
        self.requests.append(request)
        return super().complete(request, api_key=api_key)


def reply(text: str) -> Message:
    return Message(role=Role.ASSISTANT, content=text)


def tool_call(name: str, args: dict[str, JSONValue] | None = None, call_id: str = "c1") -> Message:
    return Message(role=Role.ASSISTANT, tool_calls=(ToolCall(id=call_id, name=name, arguments=args or {}),))


@pytest.fixture
def fake_ai(monkeypatch):
    """Swap real vendor adapters for scripted mocks: fake_ai["openai"] = dict(scripted=[...], fail_times=n)."""
    plans: dict[str, dict[str, object]] = {}
    built: dict[str, RecordingMock] = {}

    def factory(vendor, model, api_key, tier):
        mock = RecordingMock(f"{vendor}:{model}", tier=tier, **plans.get(vendor, {}))
        built[vendor] = mock
        return mock

    def ext_factory(base_url, model):
        mock = RecordingMock(f"external:{model or 'default'}", tier=ModelTier.STANDARD, **plans.get("external", {}))
        built["external"] = mock
        return mock

    monkeypatch.setattr(dispatcher, "provider_factory", factory)
    monkeypatch.setattr(dispatcher, "external_factory", ext_factory)
    return type("FakeAI", (), {"plans": plans, "built": built})()
