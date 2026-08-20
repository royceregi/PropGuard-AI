# 03 — Database Schema

**Database name:** `property_db`  
**Engine:** PostgreSQL, with PostGIS and optionally pgvector

This is the frozen core model. Freeze these tables before expanding the interface.

## Relationships

```text
Property 1 ──── many Transactions
Property 1 ──── many Ownership History Records
Transaction 1 ──── many Parties
Transaction 1 ──── many Documents
Transaction 1 ──── one Blockchain Record
User 1 ──── many Query Logs
```

## Frozen core tables

```text
users
properties
property_transactions
transaction_types
transaction_parties
property_ownership_history
property_documents
registration_details
blockchain_transactions
risk_assessments
risk_indicators
transaction_features
query_logs
query_retrievals
agent_runs
```

Keep `locations` as a supporting table. Keep `property_classifications` if usage/type history is needed.

## Naming rules

Use `snake_case` everywhere.

Choose one canonical name per concept and map CSV names to it during ETL. Example:

| Canonical name | Do not keep using |
| --- | --- |
| `tx_hash` | `blockchain_transaction_hash`, `transaction_hash` |
| `previous_hash` | `previous_transaction_hash` |
| `transaction_value` | `actual_worth`, `transaction_value_aed` mixed in core tables |
| `full_name` | `name` in `users` |

## Data types in core tables

Staging tables may keep everything as text. Core tables must use proper types:

| Kind | Type |
| --- | --- |
| Dates | `DATE` or `TIMESTAMP` |
| Money | `NUMERIC` |
| Area | `NUMERIC` |
| Counts | `INTEGER` |
| Coordinates | `NUMERIC` or PostGIS |
| Flags | `BOOLEAN` |
| Hashes | `VARCHAR` or `TEXT` |

Do not store derived calendar parts (`year`, `month`, `quarter`, `day_of_week`) in core transaction tables unless needed for performance. PostgreSQL can extract them from `transaction_datetime`, or they can live in an analytics table.

## Table definitions

### `users`

Login accounts and roles. Do not store real passwords or raw NIC values in the demonstration dataset.

```text
user_id
username
full_name
email
phone_number
password_hash
role
wallet_address
nic_hash
kyc_status
access_level
mfa_enabled
is_active
created_at
last_login
```

Roles:

```text
SUPER_ADMIN
LAND_REGISTRY
REAL_ESTATE_COMPANY
PUBLIC_USER
```

### `properties`

Stable identity and current state of a property.

```text
property_id
title_deed_number
property_name
address
district
city
latitude
longitude
land_area
area_unit
land_type
survey_plan_number
current_owner_id
current_usage_type
current_subtype
current_value
legal_status
verification_status
encumbrances
boundary_north
boundary_south
boundary_east
boundary_west
created_at
updated_at
```

Add unique constraints on `property_id`, and on `title_deed_number` / `survey_plan_number` depending on dataset quality.

### `property_transactions`

Every historical transaction related to a property.

```text
transaction_id
property_id
transaction_type_id
transaction_group
registration_type
procedure_name
transaction_datetime
transaction_value
previous_value
value_change_pct
procedure_area
meter_sale_price
currency
status
created_at
```

Useful historical fields that may be retained:

```text
procedure_id
trans_group_id
area_id
area_name
project_number
project_name
master_project
nearest_landmark
rooms
has_parking
```

### `transaction_types`

```text
transaction_type_id
transaction_type_name
description
```

Examples: `SALE`, `MORTGAGE`, `MORTGAGE_RELEASE`, `INHERITANCE`, `GIFT`, `TRANSFER`, `REGISTRATION`, `DISPUTE`.

### `transaction_parties`

A transaction may involve several parties. Do not keep only `buyer` and `seller` columns.

```text
transaction_party_id
transaction_id
user_id
party_name
role
is_primary
```

`user_id` may be null for historical parties with no system account. `party_name` must remain available.

Roles: `BUYER`, `SELLER`, `OWNER`, `WITNESS`, `NOTARY`, `ATTORNEY`, `BANK`, `REGISTRAR`.

### `property_ownership_history`

Used to check whether the seller is the current or a previous owner.

```text
ownership_id
property_id
owner_id
ownership_start_date
ownership_end_date
ownership_type
transaction_id
ownership_status
recorded_at
```

Current owner rule:

```text
ownership_end_date IS NULL
AND ownership_status = 'ACTIVE'
```

Prevent two active owners for the same property unless joint ownership is intentionally supported.

### `property_documents`

```text
document_id
property_id
transaction_id
document_type
document_number
document_text
document_hash
document_url
issued_date
verification_status
created_at
```

Document types: `TITLE_DEED`, `SURVEY_PLAN`, `SALE_AGREEMENT`, `TAX_RECEIPT`, `MORTGAGE_DOCUMENT`, `IDENTITY_DOCUMENT`.

The most important blockchain-related field is `document_hash` (SHA-256).

### `registration_details`

Keeps registration information separate from the general transaction record.

```text
registration_id
transaction_id
registration_number
registration_date
registration_fee
tax_amount
other_fee
total_amount_paid
currency
registration_status
```

### `blockchain_transactions`

This is the blockchain ledger or blockchain simulation table.

```text
blockchain_tx_id
transaction_id
property_id
tx_hash
previous_hash
property_hash
block_number
block_timestamp
from_wallet
to_wallet
transaction_type
transaction_value
smart_contract_address
digital_signature
transaction_status
consensus_verification
gas_fee
created_at
```

Unique constraints: `tx_hash`, `transaction_id`.

Simulated hash formula (document this clearly in the report):

```text
tx_hash = SHA256(
    transaction_id
    + property_id
    + previous_hash
    + block_timestamp
    + transaction_value
)
```

The exact formula is a project design choice, but it must be consistent.

### `risk_assessments`

```text
assessment_id
transaction_id
property_id
risk_score
risk_level
model_name
model_version
assessment_status
explanation
created_at
reviewed_by
review_status
```

Score bands (project-defined; explain them in the report):

```text
0.00–0.39  LOW
0.40–0.69  MEDIUM
0.70–1.00  HIGH
```

### `risk_indicators`

Store each reason separately. Do not dump all reasons into one text field.

```text
indicator_id
assessment_id
indicator_code
indicator_name
indicator_value
severity
description
evidence_reference
```

Example codes: `SELLER_NOT_CURRENT_OWNER`, `DOCUMENT_HASH_MISMATCH`, `DUPLICATE_TITLE_DEED`, `UNUSUAL_PRICE`, `FREQUENT_OWNERSHIP_CHANGE`, `ACTIVE_ENCUMBRANCE`, `BROKEN_HASH_CHAIN`, `MISSING_REQUIRED_DOCUMENT`.

### `query_logs` and `query_retrievals`

Do not store retrieved IDs as comma-separated text.

```text
query_logs
- query_id
- user_id
- query_text
- log_timestamp
- agent_response
- confidence_score
- relevance_score
- flagged_suspicious
- agent_used
- response_time_ms

query_retrievals
- query_id
- transaction_id
- document_id
- rank
- relevance_score
```

### `agent_runs`

Proves that agents interacted and lets you measure latency and reliability.

```text
agent_run_id
query_id
agent_name
input_data
output_data
status
confidence_score
started_at
completed_at
error_message
```

### `transaction_features`

Analytics table for dashboards and optional ML. See [06-risk-detection.md](06-risk-detection.md).

## What to keep, add, and isolate

### Keep in the application layer

```text
properties
property_transactions
property_ownership_history
property_documents
transaction_parties
transaction_types
registration_details
blockchain_transactions
users
query_logs
locations
```

### Add

```text
risk_assessments
risk_indicators
transaction_features
query_retrievals
agent_runs
```

### Remove or isolate

```text
products                 → unrelated; remove or keep outside this database
staging_* tables         → CSV ingest only; never queried by the UI
```

## Existing views in `property_db`

These views are useful for dashboards and investigation pages:

| View | Purpose |
| --- | --- |
| `v_current_ownership` | Active owner for each property |
| `v_property_full_history` | Ownership and transaction history |
| `v_blockchain_verification` | On-chain hashes plus document hash |
| `v_transaction_with_parties_and_docs` | Parties, fees, and document preview |

A document-oriented view can expose seller, buyer, attorney, title number, and registration number without joining those tables in every query.

## Current database snapshot

The live `property_db` already contains most core tables plus staging tables and the unrelated `products` table. Column-level dump and as-is naming (for example `users.name` instead of `full_name`, `retrieved_transaction_ids` as text) are recorded in [blockchain.md](blockchain.md).

Align the live schema to this frozen model before building more UI against it.

## Related files

- Datasets and ETL: [09-datasets-and-etl.md](09-datasets-and-etl.md)
- Blockchain checks: [04-blockchain-verification.md](04-blockchain-verification.md)
- Original notes and live table dump: [blockchain.md](blockchain.md)
