# Frontend Specification — PropGuard AI

The frontend is a **professional property transaction verification dashboard**, not a real-estate marketplace.

It must not look like:

> Buy apartment / Rent villa / Contact agent.

It should feel like:

> Property Transaction Intelligence and Verification Platform

User journey:

```text
Search → Verify → Blockchain → Analyze → Explain → Report
```

**Stack:** React (current client uses Next.js App Router).  
**Auth:** JWT.  
**Roles:** Super admin, Land registry, Real estate company, Public user.

Related: [08-roles-and-permissions.md](08-roles-and-permissions.md), [10-implementation-plan.md](10-implementation-plan.md)

---

## Navigation

Match the current client sidebar, then extend it by role.

```text
PropGuard AI
│
├── Dashboard
├── Property Search
├── Transactions
├── Blockchain Verification
├── AI Investigation
├── Risk Analysis
├── Investigation Reports
├── Audit Trail              [Land registry / Super admin]
├── Users                    [Super admin]
└── Settings
```

Public users see a smaller set: Dashboard, My Properties, Verification, Reports, Settings.

---

## 1. Login

```text
┌─────────────────────────────────────────────┐
│              PropGuard AI                   │
│   Property Transaction Verification         │
│                                             │
│   Email                                     │
│   [____________________]                    │
│                                             │
│   Password                                  │
│   [____________________]                    │
│                                             │
│   [        LOGIN        ]                   │
└─────────────────────────────────────────────┘
```

Forgot-password can exist, but demo accounts should use hashed passwords created by the team, never dataset `Auth_Password_Hash` values.

---

## 2. Dashboard

Role-aware overview. **Do not invent numbers.** Cards come from the processed database.

```text
┌──────────────┬───────────────────────────────────────────┐
│ PropGuard AI │  Dashboard                                │
│              │  ┌────────┐ ┌────────┐ ┌────────┐        │
│ Dashboard    │  │Transactions│Verified│High Risk│       │
│ Search       │  └────────┘ └────────┘ └────────┘        │
│ Transactions │                                           │
│ Blockchain   │  Transaction activity chart               │
│ AI           │  Recent investigations                    │
│ Reports      │  Verification failures                    │
└──────────────┴───────────────────────────────────────────┘
```

Suggested cards:

- Total transactions
- Verified transactions
- High-risk transactions
- Properties analyzed
- Query latency (IR / web analytics)

Public-user dashboard shows only that user’s properties and their verification status.

Analytics to include when data exists:

- Transactions by month and property type
- Average price per area
- High-risk transactions over time
- Risk by location
- Most frequent transaction types
- Verification failures
- Retrieval relevance

---

## 3. Property Search / Retrieval

This page demonstrates Information Retrieval.

Support:

- Structured search: property ID, transaction ID, title deed, owner ID, registration number, wallet, date range, location, risk level
- Natural-language search for the IR agent

```text
┌─────────────────────────────────────────────────────────┐
│ Search Property Transactions                            │
│                                                         │
│ 🔍 "Show high-value transactions for this property"     │
│                         [ Search ]                      │
└─────────────────────────────────────────────────────────┘

Search understanding
  Property ID: ...
  Intent: high-value history
  Filters: risk, date, location

Results
  Transaction ID | Date | Type | Value | Risk | Relevance
```

Example queries:

```text
Find all high-value transactions for this property.
Show previous owners.
Find transactions with document hash mismatches.
Show properties with rapid ownership changes.
```

Show retrieved evidence rank and relevance. Log the query in `query_logs` / `query_retrievals`.

---

## 4. Property verification page

**Required demo screen.**

Input:

```text
property_id
title_deed_number
transaction_id
```

Output:

- Property details
- Current owner
- Ownership history
- Registration status
- Encumbrances
- Blockchain status
- Document status
- Risk level

Real-estate company users use this before a transaction. Public users see it only for properties they own.

---

## 5. Transaction details / investigation page

**Required demo screen.**

```text
Transaction Details
  Transaction ID, type, datetime, value, area, procedure

Parties
  Buyer / Seller / Registrar / Notary / Witness

Property
  Title deed, survey plan, legal status, encumbrances

Blockchain
  tx_hash, previous_hash, property_hash, block number
  Integrity: VALID / INVALID

Documents
  Type, hash, match / mismatch

Ownership check
  Seller matches current owner: Yes / No

Risk
  Score, level, indicators, evidence
  Recommendation: proceed with caution / investigate / low concern
```

Every failed check must show the compared values and a short reason.

---

## 6. Blockchain history page

Show the hash chain for a property:

```text
Property Transaction History

 ┌─────────────┐
 │ Block 10201 │  TX-001   Hash: A123
 └──────┬──────┘
        ▼
 ┌─────────────┐
 │ Block 10342 │  TX-002   Hash: B782   Prev: A123
 └──────┬──────┘
        ▼
 ┌─────────────┐
 │ Block 10482 │  TX-003   Hash: C921   Prev: B782
 └─────────────┘

Blockchain Integrity    VALID / INVALID
```

Hashes should be copyable. Truncate in the layout, not in the stored value.

---

## 7. AI investigation page

Make the multi-agent run visible.

```text
AI PROPERTY ANALYSIS    Transaction: TX10231

┌──────────────────────────────────────────┐
│ Retrieval Agent                          │
│ Retrieved N evidence records             │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ Transaction Analysis Agent               │
│ Ownership / hash / required-field checks │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ Risk Detection Agent                     │
│ Risk Score: 0.64     Level: MEDIUM       │
│ Indicators listed with evidence          │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ Report Agent                             │
│ Investigation report generated           │
└──────────────────────────────────────────┘
```

An Agent Activity / Audit Trail page is useful for mid-evaluation. It does not need to be a public-facing page.

---

## 8. Investigation report page

```text
PROPERTY TRANSACTION INVESTIGATION
Transaction ID: TX10231

VERIFICATION
  Blockchain record: verified / failed
  Document hash: match / mismatch
  Ownership: match / mismatch

RISK ASSESSMENT
  Medium Risk    0.64

AI FINDINGS
  Explainable bullets with evidence references

SUPPORTING DATA
  Dates, parties, values, hashes, documents

RESPONSIBLE AI NOTICE
  This assessment identifies potential anomalies.
  It does not establish that fraud has occurred.
  Human review is required.
```

Land registry can mark the case as **reviewed**. Do not offer “delete investigation.”

---

## 9. Role-specific UI rules

| Role | Extra screens | Hidden or read-only |
| --- | --- | --- |
| Public user | My properties, own verification | Other people’s PII and private documents |
| Real estate company | Pre-transaction check, submit for analysis | Official history edits |
| Land registry | Approve/reject, confirm ownership, resolve flags | Deleting cases (review instead) |
| Super admin | Users, dataset load, thresholds, agent logs, health | — |

---

## Priority if time is limited

| Priority | Page | Why |
| --- | --- | --- |
| Highest | Property search | IR requirement |
| Highest | Property verification | Core demo |
| Highest | Transaction investigation | Blockchain + risk evidence |
| Highest | Investigation report | LLM + explainability |
| Highest | Dashboard | Web analytics |
| High | Blockchain history | Domain demonstration |
| Medium | Admin / users | Security |
| Medium | Agent audit trail | Mid-evaluation |

---

## UI principles

- Professional investigation tool, not a listing site.
- Show evidence, not only a red/green badge.
- Never display raw NIC, phone, or password material in the public UI.
- Risk language: “flagged for investigation,” never “this person is a fraudster.”
- Dashboard figures must come from the database.
