# Security

How PropGuard AI protects accounts, data, and ledger integrity, and what is still missing. Role details are in [Documents/08-roles-and-permissions.md](Documents/08-roles-and-permissions.md); ledger details in [Documents/04-blockchain-verification.md](Documents/04-blockchain-verification.md).

## Reporting a vulnerability

Do not open a public GitHub issue. Contact the repository owner privately (GitHub: [@royceregi](https://github.com/royceregi)) with the steps to reproduce. This is an academic prototype; no production data should ever be loaded into it.

## Authentication

| Aspect | Implementation | Code |
| --- | --- | --- |
| Login | Email + password: `POST /api/auth/login` | `server/app/api/v1/endpoints/auth.py` |
| Password storage | **Argon2** hashes (`passlib`); plaintext is never stored or logged | `server/app/core/security.py` |
| Login errors | One generic message ("Invalid email or password") for unknown email and wrong password; a dummy Argon2 check runs for unknown emails so response time doesn't reveal which accounts exist | `verify_password()` |
| Account state | Login is refused for `STANDARD` (no access yet), `ELEVATED` (pending approval), rejected, or inactive accounts | `auth.py` |
| Session token | **JWT (HS256)** signed with `SECRET_KEY`; claims `sub`, `access_level`, `iat`, `exp`, `type=access`; expires after 8 hours (`ACCESS_TOKEN_EXPIRE_MINUTES=480`) | `create_access_token()` |
| Token check on every request | Signature, expiry, and `type` are validated, then the user is re-loaded from the DB: a deactivated or deleted user is rejected immediately, even with a valid token | `server/app/api/deps.py` `get_current_user()` |
| Cookie | The Next.js route `/api/auth/login` stores the JWT in the `propguard_access_token` cookie: **HttpOnly**, **SameSite=Lax**, **Secure** in production, 8-hour max age. Logout clears it | `client/src/app/api/auth/*/route.ts` |
| Token transport | The API accepts `Authorization: Bearer <token>` or the cookie | `_extract_token()` |
| Password change | `POST /api/auth/change-password` requires the current password; the new one must differ and be 8–128 characters | `auth.py` |

Accounts are never created from the app (no sign-up, no create-user API). All users already exist in `core.users`; only their access changes.

## Authorization

Authorization uses `core.users.access_level`, enforced on the **server** for every endpoint. The frontend checks are only for navigation.

| `access_level` | Can sign in | Scope |
| --- | --- | --- |
| `SYSTEM` (Super Admin) | Yes | Everything, including user access, hash rebuild, and settings |
| `REGISTRY` (Land Registry) | Yes | All properties and transactions; official review; nominate end users |
| `COMPANY` (Real Estate Company) | Yes | All properties and transactions (read / verify / analyse); nominate end users |
| `PUBLIC` (Property Owner / buyer) | Yes | **Read-only**, own and shared properties only |
| `STANDARD`, `ELEVATED` | No | None until nominated and approved |

Layers:

1. **Role guard:** `require_roles([...])` on each route returns **403** if the caller's level isn't allowed (`server/app/api/deps.py`).
2. **Record scope for public users:** `ensure_property_access` / `ensure_transaction_access` / `scoped_property_ids` (`server/app/api/property_access.py`) limit `PUBLIC` users to properties they own, owned before, or are a party on. Out-of-scope records return **404**, as if they don't exist, and lists are filtered, so IDs can't be probed. Blockchain verification returns the same **403** for "not shared" and "doesn't exist" for the same reason.
3. **User directory scope:** Registry and Company only see end-user accounts (Registry also sees Registry). They can move a user between `STANDARD` and `ELEVATED` and toggle `is_active` / `kyc_status`, but can't grant `PUBLIC`, `REGISTRY`, `COMPANY`, or `SYSTEM` through the access-level endpoint, or edit any other field (`server/app/api/v1/endpoints/users.py`).
4. **Admin-only actions:** ledger hash rebuild (`/api/v1/admin/blockchain/*`), rejecting users, and deleting users are `SYSTEM` only.
5. **Frontend guard:** `client/src/proxy.ts` redirects signed-out users to `/login` and blocks pages not allowed for the role (`client/src/lib/auth/roles.ts`); the UI hides actions the role can't use. This is convenience only: the server checks are what protect the data.

## Data protection

- **NIC numbers** are stored only as a SHA-256 hash (`nic_hash`), never raw.
- **Passwords** are stored only as Argon2 hashes.
- API responses for other users never include password hashes; public users cannot see other people's NIC, phone number, or private documents.
- **SQL injection:** all queries use SQLAlchemy ORM or bound parameters (`:name`); dynamic SQL only joins fixed column names and placeholders, never user input.
- **Input validation:** every request body is a Pydantic schema (types, lengths, required fields, `EmailStr`).
- **CORS:** only origins in `CORS_ORIGINS` (default `http://localhost:3000`) may call the API with credentials.
- The demo dataset is synthetic; don't load real personal data.

## Secrets

| Secret | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `server/.env` | DB credentials |
| `SECRET_KEY` | `server/.env` | Signs JWTs; use a long random value (`python -c "import secrets; print(secrets.token_urlsafe(64))"`). Changing it signs everyone out |
| `REGISTRY_SIGNING_KEY` | `server/.env` | Ed25519 private key that signs ledger blocks; only needed for a hash rebuild. Generate with `server/scripts/generate_registry_key.py` |
| `REGISTRY_PUBLIC_KEY` | `server/.env` | Enough to verify signatures |
| `AI_API_KEY` | `server/.env` | LLM provider key |

`.env`, `.env.*`, `*.pem`, and `*.key` are gitignored; only `.env.example` is committed. Never paste secrets into code, docs, issues, or chat. If a secret leaks, rotate it: a new `SECRET_KEY` invalidates all sessions, and a new registry key needs a hash rebuild.

## Ledger integrity (tamper detection)

The simulated blockchain detects changes made directly in the database:

- `property_hash`, `transaction_data_hash`, and `document_hash` (SHA-256) detect edited property, transaction, or document data.
- `tx_hash = SHA256(previous_hash + transaction_data_hash + block_timestamp)` chains the blocks of each property, so editing one block breaks the link to the next.
- Each block's `tx_hash` is signed with the registry's **Ed25519** key. Someone with DB access could recompute every SHA-256, but can't produce a valid signature without the private key.
- `smart_contract_address` must match `REGISTRY_CONTRACT_ADDRESS`; duplicate `tx_hash` values are flagged.
- Any failure makes integrity **INVALID** and raises a risk indicator with evidence. `server/scripts/tamper_demo.sql` demonstrates each case.

The ledger proves a record **wasn't altered** after anchoring; it doesn't prove the record was legally correct. That's what the registry checks and risk analysis are for.

## Audit trail

- AI agent runs are logged in `core.agent_runs` (agent, input, output, status, timing).
- Risk assessments and indicators are stored with the evidence they used (`risk_assessments`, `risk_indicators`).
- Users' `last_login` is recorded.

## Known limitations

These are open items, not yet protected:

- **No login rate limiting or lockout.** Brute-force attempts are only slowed by Argon2. Add rate limiting before any public deployment.
- **Token also kept in `sessionStorage`** by the frontend auth store and sent as a Bearer header. Any XSS could read it; relying on the HttpOnly cookie alone would be safer.
- **No token revocation.** Logout clears the cookie, but an issued JWT stays valid until it expires (8 hours), unless the user is deactivated.
- **No CSRF token.** SameSite=Lax cookies and the CORS allow-list mitigate it; state-changing requests should still move to an explicit CSRF check.
- **No MFA.** The `mfa_enabled` column exists but isn't enforced.
- **HTTP in development.** Run behind HTTPS in any shared deployment (the cookie becomes `Secure` in production).
- **Approve endpoint:** `POST /api/v1/users/{id}/approve` currently accepts Registry and Company callers as well as Super Admin, so they can promote an end user straight to `PUBLIC`. The documented rule is Super Admin only.
- **Buyer read-only audit** of every write endpoint is pending (Phase 8c in [Documents/11-implementation-phases.md](Documents/11-implementation-phases.md)).
