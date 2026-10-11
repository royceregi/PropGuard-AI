# PropGuard AI — Backend (FastAPI)

REST API for PropGuard AI: authentication, property and ledger data, blockchain verification, evidence retrieval, the four-agent investigation pipeline, risk assessments, sharing, and notifications. It uses PostgreSQL (schema `core`) through SQLAlchemy.

For the full project overview, architecture, API table, and usage guide, see the [root README](../README.md).

## Setup

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt  # runtime deps + httpx, pytest, ruff, pyright
pip install numpy scikit-learn joblib  # anomaly model (not yet in requirements.txt)
make env                             # .env with a random SECRET_KEY; then set DATABASE_URL
```

The API expects an existing, fully migrated PostgreSQL database with the PropGuard `core` schema and data (not included in this repository; get a dump from the project team).

```bash
PYTHONPATH=. .venv/bin/python scripts/seed_demo_users.py   # four demo accounts
```

On startup the API also creates any missing ORM-managed tables.

## Run

```bash
make dev    # uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API: http://localhost:8000
- Interactive API docs (Swagger UI): http://localhost:8000/docs

## Quality checks

| Command | What it does |
| --- | --- |
| `make test` | pytest on `tests/` (`tests/core` unit tests, `tests/api` endpoint tests) |
| `make lint` | Ruff linter |
| `make format` / `make format-check` | Ruff formatter |
| `make typecheck` | Pyright on `app/` |
| `make check` | lint, format check, type check, and tests |

## Code layout

| Path | Contents |
| --- | --- |
| `app/main.py` | App entry point, CORS, router registration |
| `app/api/deps.py` | `get_current_user`, `require_roles` |
| `app/api/property_access.py` | Record scoping for `PUBLIC` users (own, previous, transaction-party, shared) |
| `app/api/v1/endpoints/` | One module per API area; mounted under `/api/v1` (auth under `/api/auth`) |
| `app/agents/` | Retrieval, Transaction Analysis, Risk, and Report agents, plus `orchestrator.py` |
| `app/core/` | Settings, database, security, `hashing.py`, `signing.py`, `llm.py` |
| `app/services/` | Business logic: retrieval, verification, risk, query guard, assistant, sharing, notifications |
| `app/repositories/`, `app/models/`, `app/schemas/` | DB access, ORM models, Pydantic schemas |
| `scripts/` | Demo seeding, registry key generation, anomaly model training, feature refresh, tamper demo, smoke test |
## Authentication and access levels

Login is email + password (`POST /api/auth/login`), returning a JWT with an `access_level` claim. Send it as `Authorization: Bearer <token>` or the `propguard_access_token` cookie.

| `access_level` | Can sign in | Scope |
| --- | --- | --- |
| `SYSTEM` | Yes | Super Admin: everything, including user access and hash rebuild |
| `REGISTRY` | Yes | Land Registry: all records, risk-request review |
| `COMPANY` | Yes | Real Estate Company: all records, investigations, risk requests |
| `PUBLIC` | Yes | Read-only; own, previously owned, transaction-party, and shared properties |
| `STANDARD`, `ELEVATED` | No | Waiting for access / approval |

Demo accounts (local only) are defined in [`scripts/seed_demo_users.py`](scripts/seed_demo_users.py), one per operational access level. Security details are in [security.md](../security.md).

## Ledger hash formulas

Defined in [`app/core/hashing.py`](app/core/hashing.py) (UTF-8 SHA-256 over canonical, sorted-key JSON):

```text
property_hash          = SHA256(canonical property payload)
transaction_data_hash  = SHA256(canonical transaction payload + property_hash)
tx_hash                = SHA256(previous_hash + transaction_data_hash + block_timestamp)
previous_hash          = "0" for a property's first block, else the previous tx_hash
document_hash          = SHA256(document_text)
digital_signature      = Ed25519(tx_hash) with REGISTRY_SIGNING_KEY  (app/core/signing.py)
```

Generate a registry key pair with `PYTHONPATH=. .venv/bin/python scripts/generate_registry_key.py >> .env`, then rebuild hashes as Super Admin (`POST /api/v1/admin/blockchain/rebuild-hashes`) so every block is re-signed.

## AI / LLM settings (optional)

LLM calls are off by default (`AI_ENABLED=false`); the pipeline then uses its rule and template output. When enabled, the client in `app/core/llm.py` calls an OpenAI-compatible API (`AI_PROVIDER`: `gemini`, `openai`, `ollama`, or `openrouter`). `AI_MODEL` is the fallback, and each agent can use its own model through `AI_RETRIEVAL_MODEL`, `AI_TRANSACTION_ANALYSIS_MODEL`, `AI_RISK_MODEL`, and `AI_REPORT_MODEL`. Retrieval and Transaction Analysis stay rule-based, and an LLM never changes the evidence or the rule-based risk score.

The full list of environment variables is in [`.env.example`](.env.example) and the [root README](../README.md#configuration-and-environment-variables).
