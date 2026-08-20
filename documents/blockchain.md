# PropGuard AI — Project Brief (source)

**Status:** Frozen project brief  
**Read this with:** [answer.md](answer.md) (architecture and schema authority)

This file is the cleaned project source: product idea, agents, roles, original table thinking, and dataset inventory. For day-to-day reading, use the split files in [README.md](README.md). If this brief and `answer.md` disagree, follow **answer.md**.

---

# PropGuard AI: AI-Powered Blockchain Property Transaction Verification and Risk Detection System

## Multi-Agent AI-Based Blockchain Property Transaction Verification and Fraud Detection System

**Tag line:** Protecting Property Transactions with AI + Blockchain

**Module:** Information Retrieval and Web Analytics  
**Domain:** Blockchain  
**Sub-domain:** Transaction verification and fraud-risk detection for land registration

```txt
Retrieve
   ↓
Verify
   ↓
Detect Risk
   ↓
Explain
   ↓
Report
```

```txt
                         PropGuard AI
                              │
                 ┌────────────┴────────────┐
                 │                         │
              BLOCKCHAIN                  AI
                 │                         │
       Transaction Integrity       Multi-Agent Investigation
                 │                         │
        ┌────────┴───────┐       ┌─────────┼─────────┐
        │                │       │         │         │
    SHA-256 Hash     Smart       IR      Blockchain   Risk
                    Contract    Agent     Agent      Agent
        │                │       │         │         │
        └────────────┬───┘       └─────────┼─────────┘
                     │                     │
                     ↓                     ↓
              Blockchain Ledger       Evidence
                                           │
                                           ↓
                                  LLM Report Agent
                                           │
                                           ↓
                                Responsible AI Monitor
                                           │
                                           ↓
                              Investigation Report
```

### Problem that PropGuard AI solves

> PropGuard AI is an intelligent property transaction protection system that combines blockchain-based transaction integrity verification with multi-agent AI analysis to identify suspicious property transactions and generate explainable investigation reports.

### Purpose

> PropGuard AI is a Blockchain-domain intelligent system that uses blockchain technology for property transaction integrity and a multi-agent AI architecture for retrieval, verification, risk analysis and explainable investigation.

The web interface must let users search properties and transactions, retrieve blockchain information, and receive risk assessments and reports. There is commercialization potential as a service to real-estate companies, land registries, and individual owners. That is a future direction; the academic scope is a prototype.

Full product wording and claims/non-claims: [01-overview.md](01-overview.md)

---

## Technology

| Component | Technology |
| --- | --- |
| Frontend | React |
| Backend | Python FastAPI |
| LLM | Gemini / OpenAI / other permitted LLM |
| Agent framework | LangChain / LangGraph |
| Blockchain data | Ledger table / simulated chain (not every property field on-chain) |
| Information retrieval | PostgreSQL full-text search; optional pgvector embeddings |
| Database | PostgreSQL (`property_db`) |
| Agent communication | REST API / HTTP + JSON |
| Authentication | JWT |
| Security | Input validation + authentication |
| Deployment | Academic prototype; cloud optional |

Architecture detail: [02-architecture.md](02-architecture.md)

---

## Agents

At least two interacting agents are required. Four are specified.

| Agent | Responsibility |
| --- | --- |
| Transaction Analysis Agent | Take a transaction, analyze details, identify unusual patterns |
| Blockchain Information Retrieval Agent | Search/retrieve property, ledger, and document evidence |
| Risk and Fraud Detection Agent | Assign Low / Medium / High and explain why |
| Report Agent | Combine findings into a human-readable investigation report |

MVP: Retrieval Agent + Risk Agent.  
Complete: add Transaction Analysis Agent + Report Agent.

Detail: [05-agents.md](05-agents.md)

---

## Responsible AI

These principles are required throughout the project:

| Principle | Meaning |
| --- | --- |
| Fairness | Avoid unfairly labeling legitimate users as fraudulent |
| Explainability | Explain why a transaction received a risk level |
| Transparency | Show the information and sources used |
| Privacy | Do not unnecessarily expose user information |
| Human oversight | AI supports investigation; it does not automatically accuse someone |

---

## Roles

The system has four user types:

1. `LAND_REGISTRY` — acts as the official administrator
2. `REAL_ESTATE_COMPANY` — verifies a property before a transaction (passbook-style check)
3. `PUBLIC_USER` — access only to their own property, like a personal passbook
4. `SUPER_ADMIN` — developer / system operator

Detail: [08-roles-and-permissions.md](08-roles-and-permissions.md)

---

## From datasets to tables (original mapping intent)

This section records the original brainstorming. The **frozen** column lists are in [03-database.md](03-database.md).

### System users

- email, password (hash only), role, nic (hash only), username

### Blockchain (block-level idea; ledger is transaction-linked in the frozen design)

- block_id, timestamp, previous_block_hash, current_block_hash, transaction_count, miner, size

### Transaction

- transaction_id, transaction_hash, prop_area, value, blockchain status, project, primary usage, property type, registration type, sales price, execution time, participant details

### Participants

- buyer details, seller details (frozen design uses `transaction_parties` with many roles)

### Property land record

- deed number, property id, owner, address, land extent, boundaries, land type, survey plan number, registration number, previous owners, market value, legal status, encumbrances, document text, document hash, verification status, subtype, usage, current/previous value, group

### Blockchain transaction ledger

- transaction_id, block number, timestamp, property id, wallets, transaction type, smart contract, status, digital signature, consensus verification

### Query interaction logs

- query_id, user_id, query_text, timestamp, retrieved document/transaction ids (normalized in frozen design), agent response, confidence, flagged suspicious

### Fields that belong on supporting tables

- instance date → `transaction_datetime`
- building name, nearest landmark → `locations`
- procedural area, meter sale price, procedure groups → `property_transactions`

### Suggested tables (confirmed and extended in answer.md)

- properties
- property_ownership_history
- property_transactions
- transaction_types
- property_classifications
- transaction_parties
- registration_details
- property_documents
- blockchain_transactions
- users
- query_logs
- locations

Add: `risk_assessments`, `risk_indicators`, `transaction_features`, `query_retrievals`, `agent_runs`.

### Document-oriented view

- seller, buyer, attorney, title number, registration number

Live catalog dump: [appendix-property-db-snapshot.md](appendix-property-db-snapshot.md)

---

## Datasets

Column inventories and ETL rules: [09-datasets-and-etl.md](09-datasets-and-etl.md)

Files:

- `Transactions.csv`
- `blockchain_transaction_ledger_dubai.csv`
- `dubai_property_MERGED_enriched.csv` — overlaps `Transactions.csv`; upsert, do not double-load
- `query_interaction_logs_dubai.csv`
- `users_stakeholders_dubai.csv` — contains `Auth_Password_Hash`; handle as sensitive

Do not publish raw personal data. Do not use supplied password hashes for real login.

---

## Web interface

The interface must support search, blockchain verification, risk assessment, and reports for the four roles. Screen-by-screen specification: [frontend.md](frontend.md)

---

## Formal documents

- [srs.md](srs.md)
- [pdp.md](pdp.md)
- Implementation order: [10-implementation-plan.md](10-implementation-plan.md)
