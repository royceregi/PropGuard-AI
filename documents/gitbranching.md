Here is a clean **4-part fullstack division** for PropGuard AI.

| Part | Part Name | Responsibility | Branch Name |
|------|-----------|----------------|-------------|
| **1** | **Core Foundation** | Database schema freeze, ETL, users & roles, JWT auth, basic CRUD APIs, User Management UI | `feature/core-foundation` |
| **2** | **Blockchain Verification** | Hash generation & chain validation, blockchain APIs, verification service, Blockchain Verification page + Admin Hash Management section | `feature/blockchain-verification` |
| **3** | **Risk & Intelligence** | Transaction features, rule-based risk engine, risk tables, Information Retrieval (search + logging), 2–4 AI agents, Investigation Report generation | `feature/risk-intelligence` |
| **4** | **Frontend & Integration** | Main React dashboard, Property Search, Transaction Investigation, Analytics charts, role-based UI, final API integration & demo screens | `feature/frontend-integration` |

---

### Quick responsibility breakdown

**Part 1 – Core Foundation**
- Freeze and clean `property_db` (core tables only)
- ETL from staging → core
- `users` table + role/access_level logic
- JWT login + role guards
- User Management (create / approve users)
- Basic property & transaction read APIs

**Part 2 – Blockchain Verification**
- SHA-256 `tx_hash`, `previous_hash`, `property_hash`
- Clear & regenerate hashes (admin only)
- Verification checks (existence, chain, document hash, ownership)
- `v_blockchain_hash_details` view
- Blockchain Verification page + Admin Settings hash section

**Part 3 – Risk & Intelligence**
- `transaction_features` calculation
- Risk rules + `risk_assessments` / `risk_indicators`
- Structured + full-text search
- `query_logs` + `query_retrievals`
- Retrieval Agent + Risk Agent (minimum)
- Report Agent + Responsible AI notice

**Part 4 – Frontend & Integration**
- Full React layout + navigation by role
- Dashboard (real numbers only)
- Property Search & Property Verification page
- Transaction Investigation page
- Analytics charts
- Wire all APIs together for the final demo

---

### Suggested workflow

```text
main
 ├── feature/core-foundation
├── feature/blockchain-verification
├── feature/risk-intelligence
└── feature/frontend-integration
```

Each person works on their branch and merges into `main` after review.