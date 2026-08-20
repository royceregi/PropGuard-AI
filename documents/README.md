# PropGuard AI — Documentation

**PropGuard AI** is an AI-assisted property transaction verification and fraud-risk detection system. It combines a PostgreSQL property database, a hash-linked blockchain ledger simulation, information retrieval, explainable risk analysis, and multi-agent reporting.

This folder is organized so each topic can be read on its own. Start with the overview, then open only the files you need.

## How to read these docs

| If you want to understand… | Open this file |
| --- | --- |
| What the project is and what it must not claim | [01-overview.md](01-overview.md) |
| Stack, services, and how the pieces connect | [02-architecture.md](02-architecture.md) |
| Tables, relationships, and schema rules | [03-database.md](03-database.md) |
| What lives on-chain vs off-chain, and verification checks | [04-blockchain-verification.md](04-blockchain-verification.md) |
| The four AI agents and how they interact | [05-agents.md](05-agents.md) |
| Risk scores, rules, features, and models | [06-risk-detection.md](06-risk-detection.md) |
| Search, retrieval, and web analytics | [07-information-retrieval.md](07-information-retrieval.md) |
| Super admin, land registry, company, and public user | [08-roles-and-permissions.md](08-roles-and-permissions.md) |
| CSV datasets, ETL, and privacy | [09-datasets-and-etl.md](09-datasets-and-etl.md) |
| Screens, navigation, and UI behaviour | [frontend.md](frontend.md) |
| Build order, demo screens, and next work | [10-implementation-plan.md](10-implementation-plan.md) |
| Formal software requirements | [srs.md](srs.md) |
| Project plan, phases, and risks | [pdp.md](pdp.md) |
| As-is PostgreSQL column dump | [appendix-property-db-snapshot.md](appendix-property-db-snapshot.md) |

## Source of truth

These two files are the frozen design source. All other docs in this folder were rewritten from them:

- [answer.md](answer.md) — final architecture, schema, verification, IR, and implementation guidance
- [blockchain.md](blockchain.md) — cleaned project brief, agents, roles, and original table thinking
- [appendix-property-db-snapshot.md](appendix-property-db-snapshot.md) — as-is `property_db` column dump

If a split file and a source file disagree, follow **answer.md**.

## Confirmed product statement

> PropGuard AI is a prototype decision-support system for property transaction verification and fraud-risk detection. It combines a PostgreSQL property database, a hash-linked blockchain ledger simulation, information retrieval, explainable rule-based and anomaly-based risk analysis, and multi-agent reporting.

The system supports investigation. It does not automatically accuse a person of fraud.
