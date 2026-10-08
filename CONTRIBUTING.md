# Contributing to MoatMine

The coding, testing, security and documentation rules are in [`AGENTS.md`](AGENTS.md)
(generated from the `.ai` submodule; edit `ai-config.toml` / `ai-config.local.md` and run
`python .ai/bin/ai-sync`, never the generated files or anything under `.ai/`). This page is the
short version of how to get a change merged.

## Set up

Follow [README → Getting started](README.md#getting-started). Everything runs without API keys:
the mock market provider serves labelled sample data.

## Make the change

- One logical change per commit, as a [Conventional Commit](https://www.conventionalcommits.org/):
  `type(scope): summary`, imperative, ≤ 72 characters. The body says *why*.
- A bug fix starts with a failing test that reproduces it.
- Valuation, safety and crisis maths are pure functions with unit tests using numbers you can
  check by hand.
- UI copy never calls an investment or its returns safe or guaranteed (`web/src/copy.test.ts`
  checks). MoatMine is risk control and information, not advice.
- Anything shown from sample data must say so (`isSampleData` in `web/src/lib/dataSource.ts`).
- AI calls go through ModelDispatcher (`backend/app/ai/dispatcher.py`). Don't add another LLM SDK.
- Docs change in the same commit as the behaviour they describe: `docs/HLD.md`, `docs/LLD.md`,
  `docs/RUNBOOK.md`, the README.

### When you change…

| …this | also do this |
|---|---|
| `backend/app/models.py` | `alembic revision --autogenerate -m "..."`, review it, commit it with the model (`tests/test_db.py` fails on drift) |
| a response model in `backend/app/schemas.py` | `python -m app.openapi_spec ../web/openapi.json` in `backend/`, then `npm run gen:api` in `web/` |
| files or folders | `python .ai/skills/repo_tree/gen_tree.py --project . --output docs/STRUCTURE.md --max-depth 4 --max-entries 25` and `--output README.md --max-depth 1` |
| `backend/requirements.txt` | `uv pip compile requirements.txt -o requirements.lock --python-version 3.12 --no-header` (in `backend/`) |
| an agent tool in `backend/app/ai/tools.py` | set its `read_only` flag and list it in the README's AI agent row |

## Check before you push

```bash
cd backend && ruff check . && mypy && pytest -q
cd web && npx tsc --noEmit && npm run lint && npm test && npm run build && npm run build:desktop
```

CI (`.github/workflows/ci.yml`) runs the same, plus `cargo check` for the desktop shell and the
repo-map and OpenAPI drift checks. A pull request needs it green.
