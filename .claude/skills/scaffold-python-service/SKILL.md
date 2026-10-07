---
name: scaffold-python-service
description: Scaffold a new Python backend service or package with the standard project layout (src layout, pyproject with ruff/mypy/pytest, typed entrypoint). Use whenever the user wants to start a new Python service, API, package, or "set up a fresh Python project" — even if they only name the framework (FastAPI, etc.).
---

# Scaffold Python Service

Create a new Python service that already conforms to the Python and testing rules in this config.

## Layout to produce

```
<name>/
├── pyproject.toml          # ruff + mypy(strict) + pytest configured
├── src/<pkg>/__init__.py
├── src/<pkg>/main.py       # typed entrypoint
├── src/<pkg>/errors.py     # base exception + a couple of concrete ones
├── src/<pkg>/logging_config.py  # dictConfig + JSON formatter, called from the entry point only
├── tests/test_smoke.py
└── README.md
```

## Steps

1. Ask (or infer from context) the package name and whether it's a web service (FastAPI) or a library. Don't block on questions you can answer from the conversation.
2. Read `template/` in this skill folder for the baseline files; adapt names, don't copy verbatim. It scaffolds around a placeholder package named `example_service` — rename every occurrence (directory, `pyproject.toml`'s `name`/`[tool.hatch.build.targets.wheel]`, and every import) to the real package name.
3. Generate the tree above. `pyproject.toml` must enable `mypy --strict`, `ruff` lint+format, and `pytest`. Target Python 3.11+.
4. `main.py` and `errors.py` carry full type hints and a small custom exception hierarchy (see the Python rules).
5. Logging is wired from day one: modules use `logging.getLogger(__name__)`, only the entrypoint calls `configure_logging()`, and ruff enforces no `print` (`T20`). Keep this for libraries too, minus the `configure_logging()` call (libraries never configure handlers).
6. Write one real smoke test that imports and exercises the entrypoint.
7. Print the commands to install (`pip install -e ".[dev]"`) and verify (`ruff check . && mypy src && pytest`).

## Rules

- Everything you emit must pass the project's own lint/type/test gates. Don't scaffold code that fails `mypy --strict`.
- Keep it minimal — a skeleton that runs, not a framework.
- The template is the FastAPI variant. For a plain library, drop `fastapi`/`uvicorn`/`httpx`
  from `pyproject.toml` and `main.py`'s app factory, but keep `errors.py`'s exception
  hierarchy and the strict `mypy`/`ruff`/`pytest` configuration — those aren't framework-specific.
