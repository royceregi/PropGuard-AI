# FastAPI Server

PropGuard AI backend (FastAPI + PostgreSQL `property_db`).

## Setup

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set DATABASE_URL, SECRET_KEY, and optional AI_* fields
```

## Auth (`core.users`)

Email + password login. Authorization uses **`access_level`** (the `role` column is removed).

| Access level | Meaning |
| --- | --- |
| `SYSTEM` | Super Admin |
| `REGISTRY` | Land Registry |
| `COMPANY` | Real Estate Company |
| `PUBLIC` | Public user |
| `STANDARD` | Approved / normal access |
| `ELEVATED` | Pending admission (cannot sign in) |

Admitting users: Registry/Company/System toggle `is_active` (no create-user form). Super Admin assigns `access_level`.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/login` | `{ "email", "password" }` → JWT (`access_level` claim) + user |
| `GET /api/auth/me` | Current user (Bearer or cookie) |

Apply / refresh schema and demo accounts:

```bash
psql "$DATABASE_URL" -f sql/001_alter_users_auth.sql
psql "$DATABASE_URL" -f sql/004_access_level_auth.sql
psql "$DATABASE_URL" -f sql/002_seed_demo_users.sql
python scripts/seed_demo_users.py
```

Demo logins (local only):

| Access level | Email | Password |
| --- | --- | --- |
| SYSTEM | `admin@prop.ai` | `DemoAdmin#2026` |
| REGISTRY | `registry@prop.ai` | `DemoRegistry#2026` |
| COMPANY | `estate@prop.ai` | `DemoCompany#2026` |
| PUBLIC | `user@prop.ai` | `DemoPublic#2026` |

## Property view APIs (read-only)

Auth required. Access levels: `SYSTEM`, `REGISTRY`, `COMPANY`.

Mapped to `core.properties`, `core.property_documents`, `core.property_transactions`, `core.property_ownership_history`.

### Properties

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/properties/` | Paginated list (`q`, `district`, `city`, `land_type`, `usage_type`, `verification_status`, `legal_status`, `skip`, `limit`) |
| `GET /api/v1/properties/{property_id}` | Single property |
| `GET /api/v1/properties/{property_id}/full` | Property + documents + transactions + ownership history |
| `GET /api/v1/properties/{property_id}/documents` | Documents for one property |
| `GET /api/v1/properties/{property_id}/transactions` | Transactions for one property |
| `GET /api/v1/properties/{property_id}/ownership-history` | Ownership history (`active_only` optional) |

### Property transactions (forensic / search)

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/property-transactions/` | Paginated list (`q`, `property_id`, `transaction_id`, `status`, `registration_type`, `transaction_group`, `area_name`, `project_name`, `date_from`, `date_to`, `min_value`, `max_value`) |
| `GET /api/v1/property-transactions/{transaction_id}` | Single transaction |

### Property documents

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/property-documents/` | Paginated list (`property_id`, `transaction_id`, `document_type`, `verification_status`) |
| `GET /api/v1/property-documents/{document_id}` | Single document |

### Ownership history

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/property-ownership-history/` | Paginated list (`property_id`, `owner_id`, `ownership_status`, `active_only`) |
| `GET /api/v1/property-ownership-history/{ownership_id}` | Single ownership row |

All list endpoints return `{ items, total, skip, limit }`.

## Blockchain ledger APIs

Auth required. Access levels: `SYSTEM`, `REGISTRY`, `COMPANY`, `PUBLIC`, `STANDARD`.

Mapped to `core.blockchain_transactions` (joined with `core.property_transactions` for `property_id` / currency when the ledger row has a null property id).

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/blockchain-transactions/` | Paginated ledger list (`property_id`, `transaction_id`, `q`) |
| `GET /api/v1/blockchain-transactions/by-property/{property_id}` | Latest ledger row for a property |
| `GET /api/v1/blockchain-transactions/{transaction_id}` | Single ledger row |
| `POST /api/v1/blockchain-transactions/verify` | Compare client `local_hash` to ledger payload commitment |
| `GET /api/v1/blockchain/hash-details` | Paginated `v_blockchain_hash_details` + integrity flags |
| `GET /api/v1/blockchain/verify/{transaction_id}` | Recalculate tx / previous / property / document hashes |

### Admin hash rebuild (SYSTEM only)

Canonical formulas (UTF-8 SHA-256, NULL → `""`, no separators):

```text
tx_hash = SHA256(transaction_id + property_id + previous_hash + block_timestamp + transaction_value)
property_hash = SHA256(property_id + title_deed_number + survey_plan_number + land_area + current_owner_id)
document_hash = SHA256(document_text)   # never overwritten by rebuild
```

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/admin/blockchain/rebuild-hashes` | Clear then regenerate in one transaction (preferred) |
| `POST /api/v1/admin/blockchain/clear-hashes` | Clear `tx_hash`, `previous_hash`, `property_hash` only |
| `POST /api/v1/admin/blockchain/regenerate-hashes` | Ordered chain rebuild only (`previous_hash='0'` for genesis) |

Apply the view / nullable `tx_hash` migration:

```bash
psql "$DATABASE_URL" -f sql/003_blockchain_hash_details_view.sql
```

Verify body (legacy payload commitment): `{ property_id?, transaction_id?, seller_address?, buyer_address?, value_usd?, currency?, local_hash? }`.

Payload commitment = SHA-256 of sorted-key JSON:
`buyerAddress`, `currency`, `propertyId`, `sellerAddress`, `valueUsd`.

## AI / LLM env (optional)

Used later by Report Agent / NL search. Edit `server/.env`:

| Variable | Purpose |
| --- | --- |
| `AI_ENABLED` | `true` when ready to call the model |
| `AI_PROVIDER` | `gemini` \| `openai` \| `ollama` |
| `AI_API_KEY` | Provider API key (leave empty for local Ollama if unused) |
| `AI_MODEL` | Model id, e.g. `gemini-2.0-flash`, `gpt-4o-mini` |
| `AI_BASE_URL` | Optional custom/base URL |
| `AI_TEMPERATURE` | Sampling temperature |
| `AI_MAX_TOKENS` | Max output tokens |
| `AI_TIMEOUT_SECONDS` | Request timeout |

## Run

```bash
uvicorn app.main:app --reload
```

API: `http://127.0.0.1:8000` · Docs: `http://127.0.0.1:8000/docs`
