# 10 — Implementation Plan

Follow this order so the project does not try to build everything at once.

## Phase 1 — Data preparation

1. Inspect all CSV files.
2. Identify duplicate transaction and property records.
3. Create staging tables.
4. Clean dates, numeric values, empty strings, and Boolean values.
5. Mask sensitive fields.
6. Load normalized records into core tables.

## Phase 2 — Core database

1. Create users and roles.
2. Create properties.
3. Create transactions and transaction types.
4. Create ownership history.
5. Create transaction parties.
6. Create documents and registration details.
7. Add foreign keys, unique constraints, and indexes.

## Phase 3 — Blockchain simulation

1. Import or generate blockchain transaction records.
2. Implement transaction hash calculation.
3. Implement previous-hash validation.
4. Implement document-hash validation.
5. Create a verification result endpoint.
6. Display the verification evidence in the frontend.

## Phase 4 — Fraud-risk analysis

1. Calculate transaction features.
2. Implement transparent rules.
3. Add an optional anomaly-detection model.
4. Store risk assessments.
5. Store individual risk indicators.
6. Generate explanations.

## Phase 5 — Information retrieval

1. Add structured property and transaction search.
2. Add PostgreSQL full-text search.
3. Add document retrieval.
4. Add optional embeddings and `pgvector`.
5. Implement the retrieval agent.
6. Log retrieved evidence and relevance scores.

## Phase 6 — Agents and reports

1. Implement the Transaction Analysis Agent.
2. Implement the Retrieval Agent.
3. Implement the Risk Agent.
4. Combine their outputs.
5. Generate a report.
6. Store agent execution logs.

## Phase 7 — Web application

1. Implement JWT authentication.
2. Implement role-based access.
3. Build property search.
4. Build transaction verification.
5. Build risk report page.
6. Build admin and land-registry dashboards.
7. Add analytics charts.

## Immediate next task

Freeze the normalized schema around the core tables listed in [03-database.md](03-database.md). Keep all `staging_*` tables strictly for CSV ingestion and cleaning.

## Demo screens that must exist

These screens are required for evaluation. Layout details are in [frontend.md](frontend.md).

### Property verification

Input: `property_id`, `title_deed_number`, or `transaction_id`.

Output: property details, current owner, ownership history, registration status, encumbrances, blockchain status, document status, risk level.

### Transaction investigation

Show transaction details, buyer and seller, previous transaction, hash validation, document hash validation, ownership validation, risk indicators, evidence, and a final recommendation.

### Search and retrieval

Natural-language and structured search, with retrieved evidence and relevance.

### Analytics dashboard

Transactions over time, risk, verification failures, query latency, and retrieval relevance. Numbers must come from the dataset.

## Related files

- Architecture: [02-architecture.md](02-architecture.md)
- PDP: [pdp.md](pdp.md)
- SRS acceptance criteria: [srs.md](srs.md)
