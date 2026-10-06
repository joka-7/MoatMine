import os
import tempfile

from cryptography.fernet import Fernet

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["FERNET_KEY"] = Fernet.generate_key().decode()
os.environ["MARKET_PROVIDER"] = "mock"
os.environ["AUTH_MODE"] = "dev"
os.environ["ANTHROPIC_API_KEY"] = "server-key"
os.environ.pop("OPENAI_API_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def auth(user: str) -> dict:
    return {"Authorization": f"Bearer {user}"}
