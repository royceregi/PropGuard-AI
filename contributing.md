# Contributing to PropGuard AI

PropGuard AI is a multi-agent, blockchain-backed property transaction verification and fraud-risk detection system (FastAPI + PostgreSQL backend, Next.js frontend). The work is split into four parts, one per team member, each on its own branch.

Repository: [royceregi/PropGuard-AI](https://github.com/royceregi/PropGuard-AI)

## Branches

| Branch | Purpose | Who merges into it |
| --- | --- | --- |
| `main` | **Working deliverables only**, at their best stable stage. Every commit on `main` must build, run, and be demo-ready. Never commit directly. | Release PRs from `develop`, after the team agrees the build is stable |
| `develop` | **Integration branch.** The four individual branches merge here, get tested together, and are fixed before anything reaches `main`. | PRs from the four part branches |
| `feature/core-foundation` | Part 1, individual contribution | Owner of Part 1 |
| `feature/blockchain-verification` | Part 2, individual contribution | Owner of Part 2 |
| `feature/risk-intelligence` | Part 3, individual contribution | Owner of Part 3 |
| `feature/frontend-integration` | Part 4, individual contribution | Owner of Part 4 |

```text
main                          ← stable, demo-ready deliverables only
 └── develop                  ← integration of all four parts
      ├── feature/core-foundation
      ├── feature/blockchain-verification
      ├── feature/risk-intelligence
      └── feature/frontend-integration
```

Rules:

- Work only on your own part branch. Create it from `develop`, not from `main`.
- Never push directly to `main` or `develop`; always open a pull request.
- Keep your branch up to date: `git fetch origin && git merge origin/develop` (or rebase) before opening a PR, and resolve conflicts on your branch.
- Short-lived sub-branches are fine for bigger tasks (for example `feature/risk-intelligence-agents`); merge them back into your part branch, not into `develop`.
- `develop` → `main` only when every merged part works together, the checks below pass, and the demo flow has been run end to end.

## The four parts

| Part | Branch | Responsibility |
| --- | --- | --- |
| **1. Core Foundation** | `feature/core-foundation` | Database schema, ETL (staging → core), users and access levels, JWT auth and role guards, User Management (approve / grant access to existing users), basic property and transaction read APIs |
| **2. Blockchain Verification** | `feature/blockchain-verification` | SHA-256 `property_hash`, `transaction_data_hash`, `tx_hash` / `previous_hash` chain, document hashes, Ed25519 registry signatures, verification and registry checks, hash rebuild (Super Admin), Blockchain Verification page, Settings hash section |
| **3. Risk & Intelligence** | `feature/risk-intelligence` | `transaction_features`, rule-based risk engine, `risk_assessments` / `risk_indicators`, information retrieval (search + `query_logs`), AI agents (Retrieval, Risk, Report), investigation reports, Responsible AI notice |
| **4. Frontend & Integration** | `feature/frontend-integration` | Next.js layout and role-based navigation, dashboards, Property Search, Transaction Investigation, Risk Analysis, analytics charts, wiring every API together for the final demo |

Users are never created from the app: every account already exists in `core.users`. Part 1 only manages access (`access_level`, `is_active`, approval).

Detailed design for each part is in [`Documents/`](Documents/): architecture (02), database (03), blockchain (04), agents (05), risk (06), retrieval (07), roles (08), frontend (10), and the phase checklist (11).

## Local setup

Prerequisites: Python 3.12+, Node.js 20+, PostgreSQL with the `property_db` database (schema `core`).

Backend:

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # DATABASE_URL, SECRET_KEY, optional REGISTRY_* and AI_* keys
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd client
npm install
npm run dev                 # http://localhost:3000
```

Database changes go in a new numbered file under `server/sql/` (`NNN_short_name.sql`). Make it idempotent (`IF NOT EXISTS`), back up any data it overwrites, and put the rollback SQL in the file header.

## Before opening a pull request

```bash
# backend
cd server && .venv/bin/python -m pytest

# frontend
cd client && npx tsc --noEmit -p . && npm run lint
```

- Both checks pass, and the app starts without errors.
- No secrets in the diff: `.env`, private keys (`REGISTRY_SIGNING_KEY`), API keys, and real personal data (NIC, phone numbers) must never be committed. See [security.md](security.md).
- New endpoints use `require_roles(...)` and, for property or transaction data, `ensure_property_access` / `ensure_transaction_access`.
- Update the relevant file in `Documents/` if you change behaviour, an API, or the schema.

## Commits and pull requests

Commit messages follow the style already in the history (Conventional Commits):

```text
feat: add registry checks panel to transaction page
fix: return 403 for unshared properties on verify
refactor: move hash formulas into core/hashing.py
docs: update blockchain verification roadmap
test: cover Ed25519 signature verification
chore: bump dependencies
```

Pull request checklist:

- Title in the same style as the commits; target `develop` (or `main` only for a release PR).
- Describe what changed, why, and how you tested it; add screenshots for UI changes.
- At least one other team member reviews and approves before merging.
- Prefer **squash merge** into `develop`, and a normal merge commit from `develop` into `main`, so `main` shows one commit per release.

## Code style

- **Python:** type hints, `from __future__ import annotations`, business logic in `services/`, DB access in `repositories/`, routes in `api/v1/endpoints/`.
- **TypeScript:** strict types, no `any`; Prettier config in `client/.prettierrc` (`npm run format`); components in `client/src/components/<area>/`.
- Comments explain constraints the code can't show, not what the next line does.
