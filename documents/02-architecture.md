# 02 — Architecture

## Recommended stack

| Layer | Technology | Role |
| --- | --- | --- |
| Frontend | React | Role-based verification dashboard |
| Backend | FastAPI | APIs, auth, orchestration |
| Database | PostgreSQL | Main relational store (`property_db`) |
| Spatial (optional) | PostGIS | Location and boundary analysis |
| Semantic search (optional) | pgvector | Document embeddings inside PostgreSQL |
| Agents | LangGraph / LangChain | Agent workflow if permitted |
| LLM | Gemini / OpenAI / other permitted model | Report wording and NLP |
| Integrity | SHA-256 | Document and transaction hashes |
| Auth | JWT | Login and role-based access |
| Communication | REST + JSON | Frontend, backend, and agents |

PostgreSQL is the main database. Do not replace it with MongoDB unless there is a strong reason. Use a vector extension or separate vector database only if the lecturer requires semantic retrieval.

## System diagram

```text
React frontend
       ↓
FastAPI backend
       ↓
Service layer
 ┌───────────────┬────────────────┬────────────────┐
 │ Verification  │ Retrieval      │ Risk detection │
 │ service       │ service        │ service        │
 └───────────────┴────────────────┴────────────────┘
       ↓
PostgreSQL database
       ↓
Optional vector search using pgvector
```

The four AI agents sit on top of these services. They can be backend modules or LangGraph nodes that exchange structured JSON. They do not need to be four separate applications.

## Product flow

```text
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

## Important design rule

Blockchain is **not** the entire database.

| Store | What belongs there |
| --- | --- |
| PostgreSQL (off-chain) | Full property information, owners, document text, history, fraud features, users, query and agent logs |
| Blockchain ledger (on-chain or simulated) | Transaction ID, property ID, hashes, timestamp, type, wallets, signature, verification status |

Large documents and personal information stay off-chain. Only a cryptographic hash of each document is stored in the ledger. During verification, the system hashes the current document again and compares it with the stored hash.

## Database layers

Use one PostgreSQL database, for example `property_db`, with three logical layers:

```text
staging tables       → raw imported CSV data
core tables          → clean application data
analytics tables     → features, scores, and reports
```

PostgreSQL schemas (`staging`, `core`, `analytics`) are preferred. Table prefixes are acceptable for a student project.

The frontend and backend must query **core** tables, not staging tables.

## Agent implementation levels

### Minimum viable version

Implement at least these two interacting agents:

1. Blockchain Information Retrieval Agent
2. Risk and Fraud Detection Agent

### Recommended complete version

Add:

3. Transaction Analysis Agent
4. Report Agent

Details: [05-agents.md](05-agents.md)

## Confirmed constraints

- Academic prototype, not a live government registry.
- JWT authentication and role-based access.
- Input validation on every write/search endpoint.
- Agent communication uses structured JSON.
- Risk output must include evidence and a Responsible AI notice.

## Related files

- Database: [03-database.md](03-database.md)
- Blockchain checks: [04-blockchain-verification.md](04-blockchain-verification.md)
- Agents: [05-agents.md](05-agents.md)
- Frontend: [frontend.md](frontend.md)
