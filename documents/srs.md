# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

## PropGuard AI: AI-Assisted Property Transaction Verification and Fraud-Risk Detection System

**Project Domain:** Blockchain  
**Sub-domain:** Transaction verification and fraud-risk detection for land registration  
**Module:** Information Retrieval and Web Analytics  
**Primary Dataset:** Dubai real-estate transaction CSVs plus blockchain ledger, user, and query-log enrichments  
**Document Version:** 2.0  
**Status:** Aligned with frozen design (`answer.md`, `blockchain.md`)  
**Related documents:** [PDP](pdp.md) · [Overview](01-overview.md) · [Architecture](02-architecture.md) · [Database](03-database.md)

---

## 1. Introduction

### 1.1 Purpose

This SRS defines the functional and non-functional requirements for **PropGuard AI**.

The system combines:

1. A structured property and transaction database in PostgreSQL.
2. A hash-linked blockchain ledger simulation.
3. Information retrieval over historical property and transaction data.
4. Explainable fraud-risk analysis.
5. Multi-agent investigation reports for four user roles.

The system supports investigation. It does not automatically make a legal accusation.

### 1.2 Scope

The system shall:

- Import historical property datasets through staging tables, then load clean core tables.
- Store properties, ownership history, transactions, parties, documents, and registration details in PostgreSQL.
- Maintain a blockchain ledger table with `tx_hash`, `previous_hash`, and related verification fields.
- Verify transaction existence, property consistency, hashes, ownership, encumbrances, parties, and registration.
- Provide structured search, full-text search, and optional semantic search.
- Provide at least two interacting AI agents (retrieval and risk); ideally four.
- Assign LOW / MEDIUM / HIGH risk with per-indicator evidence.
- Generate explainable reports with a Responsible AI notice.
- Authenticate users with JWT and enforce role-based access.

The system shall **not**:

- Claim that a person committed fraud.
- Replace a government land registry.
- Provide legally valid ownership.
- Guarantee that a transaction is safe.
- Claim to use a real decentralized blockchain unless one is actually deployed.
- Expose another person’s NIC, phone number, password material, or private documents.

### 1.3 Intended audience

Project supervisor, academic evaluators, development team, testers, and future maintainers.

### 1.4 Definitions

| Term | Definition |
| --- | --- |
| PropGuard AI | Name of this prototype |
| IR | Information Retrieval |
| JWT | JSON Web Token |
| SHA-256 | Hash algorithm for document and transaction integrity |
| `tx_hash` | Canonical blockchain transaction hash |
| Risk score | Numeric indicator from 0.00 to 1.00 |
| Core tables | Clean application tables queried by the API and UI |
| Staging tables | Raw CSV import tables, not used by the frontend |

### 1.5 References

- Frozen design: [answer.md](answer.md), [blockchain.md](blockchain.md)
- Split topic docs in this folder
- University assignment briefs for Information Retrieval and Web Analytics
- Dubai real-estate transaction dataset files listed in [09-datasets-and-etl.md](09-datasets-and-etl.md)

---

## 2. Overall description

### 2.1 Product perspective

```text
React frontend
       ↓
FastAPI backend
       ↓
Verification / Retrieval / Risk services + agents
       ↓
PostgreSQL (property_db)
  staging → core → analytics
       ↓
Optional pgvector
```

Product flow: Retrieve → Verify → Detect Risk → Explain → Report.

### 2.2 Product functions

1. Dataset import, cleaning, and upsert into core tables.
2. Property, ownership, transaction, document, and ledger storage.
3. Blockchain hash generation and chain validation.
4. Structured and natural-language retrieval with logged evidence.
5. Transaction verification with explicit pass/fail checks.
6. Rule-based risk scoring, optional anomaly detection.
7. Multi-agent investigation reports.
8. JWT authentication and four-role authorization.
9. Analytics dashboards from real stored data.
10. Explainable AI outputs and human review.

### 2.3 User classes

| Role | Characteristics |
| --- | --- |
| `PUBLIC_USER` | Views own properties, like a passbook; limited public search |
| `REAL_ESTATE_COMPANY` | Pre-transaction verification; cannot alter official history |
| `LAND_REGISTRY` | Authoritative admin: register, approve, verify, resolve flags |
| `SUPER_ADMIN` | Users, datasets, thresholds, agent logs, system health |

### 2.4 Operating environment

Web prototype: React frontend, FastAPI backend, PostgreSQL. Cloud hosting is optional for demonstration.

### 2.5 Constraints

- Academic prototype and timeline.
- Source data is historical / enriched; it is not proof of legal title.
- Blockchain layer is a hash-linked simulation unless a live chain is deployed.
- At least two interacting agents are mandatory.
- Sensitive dataset fields must be masked; supplied password hashes must not be used for login.

### 2.6 Assumptions

- Dataset CSVs are available for ETL.
- PostgreSQL is the main database.
- An allowed LLM is available for the Report Agent.
- Fraud labels may be absent; rules plus unsupervised methods are acceptable if stated clearly.

---

## 3. Functional requirements

### FR-01 Dataset import (staging)

The system shall load CSV files into staging tables as text, validate structure, and reject invalid files.

### FR-02 Dataset preprocessing and ETL

The system shall clean dates, numbers, empty strings, and booleans; mask sensitive fields; and upsert into core tables using `transaction_id` / `property_id`. `dubai_property_MERGED_enriched.csv` shall not be loaded as a second independent transaction set.

### FR-03 Core property and transaction storage

The system shall persist the frozen core model in [03-database.md](03-database.md), including users, properties, transactions, types, parties, ownership history, documents, and registration details.

### FR-04 Blockchain ledger

The system shall store ledger records in `blockchain_transactions` with unique `tx_hash` and `transaction_id`, and compute hashes with a documented SHA-256 formula.

### FR-05 Blockchain verification

The verification service shall perform the checks in [04-blockchain-verification.md](04-blockchain-verification.md): existence, property consistency, `tx_hash`, `previous_hash`, document hash, ownership, encumbrances, required parties, and registration.

### FR-06 Structured search

The system shall search by property ID, transaction ID, title deed, owner ID, registration number, wallet, date range, location, and risk level.

### FR-07 Full-text and optional semantic retrieval

The IR component shall search document and property text fields using PostgreSQL full-text search. Semantic search with `pgvector` is optional.

### FR-08 Retrieval logging and evaluation

Each query shall be stored in `query_logs`. Each retrieved item shall be stored in `query_retrievals` with rank and relevance. Comma-separated ID lists are not acceptable in core tables. The system shall support Precision@K, latency, and relevance reporting.

### FR-09 Transaction analysis agent

The agent shall check ownership, sequence, values, timestamps, hashes, and required fields, and return structured JSON findings.

### FR-10 Retrieval agent

The agent shall retrieve property, transaction, ownership, document, and blockchain records and return evidence used for the investigation.

### FR-11 Risk and fraud detection agent

The agent shall apply transparent rules (and optional anomaly detection), write `risk_assessments` and `risk_indicators`, and explain the score. Output is a risk indicator, not a legal judgment.

Risk bands:

```text
0.00–0.39  LOW
0.40–0.69  MEDIUM
0.70–1.00  HIGH
```

### FR-12 Report agent

The Report Agent shall combine retrieval, verification, and risk results into a human-readable report with evidence and a Responsible AI notice.

### FR-13 Agent run logging

Each agent execution shall be stored in `agent_runs` (input, output, status, confidence, timestamps, errors).

### FR-14 Authentication

Protected operations require JWT authentication. Passwords are stored only as secure hashes created by the application.

### FR-15 Authorization

Access follows [08-roles-and-permissions.md](08-roles-and-permissions.md). Real-estate companies cannot alter official history. Public users cannot see other people’s private data. Land registry marks cases reviewed instead of deleting them.

### FR-16 Explainable output

Every risk result shall list indicator codes, severity, description, and evidence. The UI shall not state that a person is fraudulent.

### FR-17 Role-specific web interface

The web UI shall provide the demo screens in [frontend.md](frontend.md): dashboard, search, property verification, transaction investigation, blockchain history, AI investigation, and reports.

### FR-18 Analytics dashboard

The dashboard shall show transaction, risk, verification-failure, and retrieval-latency charts from stored data. Figures shall not be invented.

---

## 4. Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-01 | Prototype search and verification shall return within a time acceptable for live demonstration. |
| NFR-02 | Protected APIs require authentication. |
| NFR-03 | All user input is validated. |
| NFR-04 | Agents exchange structured JSON over HTTP/REST or an internal workflow. |
| NFR-05 | UI is an investigation dashboard, not a property marketplace. |
| NFR-06 | Hashes provide tamper-evidence for stored ledger and document records. |
| NFR-07 | Additional agents can be added without redesigning the whole system. |
| NFR-08 | Source/core data, staging data, and ledger metadata remain logically separated. |
| NFR-09 | AI outputs are explainable and include sources. |
| NFR-10 | Risk classifications are not presented as proof of crime. |
| NFR-11 | Sensitive dataset fields are masked; raw PII is not published. |
| NFR-12 | Core tables use proper types (`NUMERIC`, `TIMESTAMP`, `BOOLEAN`), not text copies of staging. |
| NFR-13 | Naming is `snake_case`; canonical hash field is `tx_hash`. |
| NFR-14 | Source code and documentation are maintainable. |

---

## 5. External interfaces

### 5.1 User interface

Login; role-based dashboard; property search; property verification; transaction investigation; blockchain history; AI investigation; reports; admin/dataset tools for super admin.

### 5.2 Hardware

No specialized hardware.

### 5.3 Software

PostgreSQL (`property_db`), FastAPI, React, optional PostGIS, optional pgvector, permitted LLM, SHA-256.

### 5.4 Communication

HTTP/REST and JSON between frontend, backend, and agents.

---

## 6. Data requirements

Primary entities: User, Property, PropertyTransaction, TransactionParty, OwnershipHistory, PropertyDocument, RegistrationDetails, BlockchainTransaction, RiskAssessment, RiskIndicator, TransactionFeature, QueryLog, QueryRetrieval, AgentRun.

ETL mapping, privacy rules, and duplicate-file warning: [09-datasets-and-etl.md](09-datasets-and-etl.md).

Relationships:

```text
Property 1 ──── many Transactions
Property 1 ──── many Ownership History Records
Transaction 1 ──── many Parties
Transaction 1 ──── many Documents
Transaction 1 ──── one Blockchain Record
User 1 ──── many Query Logs
```

---

## 7. Use cases

### UC-01 Search property or transaction

**Actors:** All authenticated roles (public user limited).  
User submits structured or natural-language query → retrieval agent returns ranked evidence → results displayed and logged.

### UC-02 Verify property / transaction

**Actors:** Real estate company, land registry, super admin; public user for own records.  
System runs the verification checklist and shows pass/fail with evidence.

### UC-03 Analyze risk

**Actors:** Real estate company (submit/view), land registry, super admin.  
Risk agent scores the transaction, stores indicators, and explains the result.

### UC-04 Generate investigation report

**Actors:** Same as UC-03.  
Report agent combines findings. Land registry may mark reviewed.

### UC-05 Administer official records

**Actor:** Land registry.  
Register property, approve/reject transaction, confirm ownership, add official records. History is not silently deleted.

### UC-06 Administer system

**Actor:** Super admin.  
Manage users, load datasets, set thresholds, inspect agent logs and health.

---

## 8. Requirement traceability

| Requirement | Component |
| --- | --- |
| FR-01, FR-02 | ETL / staging |
| FR-03 | Core PostgreSQL model |
| FR-04, FR-05 | Blockchain ledger and verification service |
| FR-06, FR-07, FR-08 | IR and web analytics |
| FR-09–FR-13 | Agents |
| FR-14, FR-15 | Security |
| FR-16 | Responsible AI |
| FR-17, FR-18 | Web application |

---

## 9. Acceptance criteria

The system is acceptable when:

1. CSVs can be staged, cleaned, and upserted without duplicating overlapping files.
2. Core tables and constraints exist as specified.
3. Ledger records chain with `tx_hash` / `previous_hash` and document hashes can be rechecked.
4. A structured or natural-language query retrieves ranked evidence and is logged.
5. Verification returns explicit check results.
6. Risk score, level, and separate indicators are stored and explained.
7. At least two agents interact and `agent_runs` are recorded.
8. A readable report includes a Responsible AI notice.
9. JWT and role rules are enforced.
10. Dashboard numbers come from the database.
11. The demo screens in [frontend.md](frontend.md) can be shown.

---

## 10. Constraints, assumptions, remaining confirmations

Decided: PostgreSQL, FastAPI, React, JWT, SHA-256 ledger simulation, four roles, frozen core schema.

Still optional / team-specific:

- Exact LLM provider.
- Whether pgvector is enabled.
- Whether a live blockchain is ever deployed (default: no).
- Hosting platform.
- Named team-member allocation (see PDP).
