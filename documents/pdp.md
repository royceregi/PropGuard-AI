# PROJECT DEVELOPMENT PLAN (PDP)

## PropGuard AI: AI-Assisted Property Transaction Verification and Fraud-Risk Detection System

**Document Version:** 2.0  
**Status:** Aligned with frozen design (`answer.md`, `blockchain.md`)  
**Related document:** [Software Requirements Specification (SRS)](srs.md)

Topic guides: [Overview](01-overview.md) · [Architecture](02-architecture.md) · [Implementation](10-implementation-plan.md)

---

## 1. Project overview

PropGuard AI is a prototype decision-support system for property transaction verification and fraud-risk detection. It uses historical Dubai real-estate datasets, PostgreSQL as the main store, a hash-linked blockchain ledger simulation, information retrieval, explainable risk analysis, and multi-agent reporting.

The system helps land registries, real-estate companies, and property owners investigate suspicious or inconsistent transactions. It does not replace a government registry and does not prove legal fraud.

---

## 2. Objectives

1. Freeze and implement the normalized PostgreSQL core schema.
2. Simulate a tamper-evident transaction ledger with SHA-256 chaining.
3. Deliver at least two interacting agents; target four.
4. Meet Information Retrieval and Web Analytics requirements (search, evidence logging, dashboards).
5. Implement JWT security and four roles.
6. Demonstrate Responsible AI: explanation, transparency, privacy, human oversight.
7. Produce a demonstrable web prototype.

---

## 3. Scope

### In scope

- ETL from CSV staging tables into core tables
- PostgreSQL core + analytics tables
- Blockchain ledger simulation and verification checks
- Retrieval, analysis, risk, and report agents
- React verification dashboard
- JWT auth and role-based access
- Explainable risk output
- Testing and academic documentation

### Out of scope

- Legal verification of real ownership
- Integration with an official government land registry
- Real financial fraud enforcement
- Production-scale deployment
- Replacing PostgreSQL with a document database
- Treating the ledger simulation as a public blockchain unless one is deployed

---

## 4. Deliverables

| Deliverable | Description |
| --- | --- |
| Split docs + SRS/PDP | This folder |
| Clean core database | `property_db` core tables, not staging |
| Blockchain module | Hash chain + verification API |
| AI agents | Retrieval + risk minimum; analysis + report preferred |
| Web prototype | Role-based React UI |
| IR evaluation | Query logs, retrievals, latency/relevance |
| Tests | Functional, agent, security, Responsible AI |
| Presentation | Mid and final evaluation |

---

## 5. Methodology

Iterative development:

1. Freeze schema.
2. Implement one phase.
3. Test that phase.
4. Integrate.
5. Review against SRS acceptance criteria.

---

## 6. Team and responsibilities

Named allocations remain with the group.

| Responsibility | Assigned member |
| --- | --- |
| Project coordination | [Team to assign] |
| ETL and database | [Team to assign] |
| Blockchain verification | [Team to assign] |
| AI agents / IR | [Team to assign] |
| Frontend | [Team to assign] |
| Testing and documentation | [Team to assign] |

---

## 7. Development phases

Use the same order as [10-implementation-plan.md](10-implementation-plan.md).

| Phase | Focus |
| --- | --- |
| 1 | Data preparation and masking |
| 2 | Core database, FKs, indexes |
| 3 | Blockchain simulation and verification UI |
| 4 | Features, rules, risk tables |
| 5 | Structured/full-text search, retrieval logs |
| 6 | Agents and reports |
| 7 | JWT, role UI, dashboards |

**Immediate task:** freeze the core tables listed in [03-database.md](03-database.md). Keep `staging_*` for ingest only. Remove or isolate `products`.

---

## 8. Work breakdown

```text
1. Project management
2. Data preparation (inspect, stage, clean, mask, upsert)
3. Core schema (users, properties, txs, parties, ownership, docs, registration)
4. Blockchain module (hashes, previous-hash, document-hash, API)
5. Risk module (features, rules, optional anomaly model)
6. IR module (structured, FTS, optional pgvector, logging)
7. Agents (retrieval, analysis, risk, report + agent_runs)
8. Security (JWT, roles, validation)
9. Web UI (demo screens)
10. Testing and documentation
```

---

## 9. Milestones

| Milestone | Status |
| --- | --- |
| Domain and product concept (PropGuard AI) | Completed |
| Dataset identification | Completed |
| Frozen architecture and schema | Completed (this documentation set) |
| Schema alignment of live `property_db` | Current |
| ETL without duplicate merged transactions | Planned |
| Blockchain verification prototype | Planned |
| Two-agent MVP | Planned |
| IR search + analytics | Planned |
| Full web demo | Planned |
| Testing and final presentation | Planned |

Exact calendar dates after mid-evaluation are set by the group timetable.

---

## 10. Technology stack

| Layer | Choice |
| --- | --- |
| Frontend | React |
| Backend | FastAPI |
| Database | PostgreSQL (`property_db`) |
| Spatial (optional) | PostGIS |
| Semantic search (optional) | pgvector |
| Agents | LangGraph / LangChain modules |
| LLM | Gemini / OpenAI / other permitted model |
| Integrity | SHA-256 |
| Auth | JWT |
| Agent I/O | REST / JSON |

---

## 11. Risks

| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| Duplicate load of Transactions + merged enriched CSV | High | High | Upsert on `transaction_id` |
| Sensitive PII in CSVs | High | High | Mask, gitignore, hash NIC, never reuse dataset passwords |
| No verified fraud labels | High | Medium | Rules + unsupervised methods; honest wording |
| Agent integration complexity | Medium | High | Two-agent MVP first |
| Limited time | High | High | Prioritize demo screens in frontend.md |
| LLM / API availability | Medium | Medium | Confirm provider early; keep rule-based score independent of LLM |
| Claiming too much legally | Medium | High | Responsible AI notice on every report |

---

## 12. Quality and testing

### Functional

Verify FR-01 through FR-18 in the SRS.

### Integration

Retrieval → analysis → risk → report, with `agent_runs` written.

### Security

Authentication, role denial tests, input validation, no PII leakage in public views.

### Responsible AI

Explanations present; no “confirmed fraud” language; evidence visible; human review path for land registry.

### IR / analytics

Precision@K if labels exist; otherwise relevance score, latency, and retrieved-evidence counts from logs.

---

## 13. Configuration, change, and communication

- Version-control source, docs, and tests. Do not commit raw personal datasets.
- Any schema change must be reflected in `03-database.md` and the SRS.
- Team communication method is chosen by the group.

---

## 14. Deployment and maintenance

First deployment is a local or small-cloud academic prototype:

1. Configure environment.
2. Run migrations / create core schema.
3. Load cleaned data (not staging as the app source).
4. Verify agent and verification endpoints.
5. Demonstrate the required screens.

Production maintenance is out of scope. During the course: fix defects, update docs, correct ETL, improve agent integration.

---

## 15. Traceability to SRS

| SRS | Development work |
| --- | --- |
| FR-01, FR-02 | ETL |
| FR-03 | Core schema |
| FR-04, FR-05 | Blockchain module |
| FR-06–FR-08 | IR |
| FR-09–FR-13 | Agents |
| FR-14, FR-15 | Security |
| FR-16 | Responsible AI |
| FR-17, FR-18 | Frontend and dashboards |

---

## 16. Acceptance

The project is complete when the SRS acceptance criteria are met and the university evaluation materials are ready. Completeness means a working prototype with frozen schema, verification, retrieval, explainable risk, two interacting agents, and role-based UI — not a production land registry.

---

## Appendix A. Remaining team decisions

Already decided by the frozen design: PostgreSQL, FastAPI, React, four roles, SHA-256 ledger simulation, core table list.

Still for the team to fill in:

1. Member names against the responsibility table.
2. Exact LLM provider.
3. Whether to enable pgvector in the first demo.
4. Hosting platform for the live demo, if any.
5. Repository hosting and communication tools.
6. Calendar dates after mid-evaluation.
