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
├── User Management          [Land registry / Super admin]
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

## 3. Property Search

Search **properties** (not transactions). Wired to `GET /api/v1/properties/`.

1. **Property Filters** — `q`, district, city, land type, usage, verification status, legal status.
2. **Property Results** — paginated table of property records.

Natural-language / IR agent search comes later. Transaction forensic search lives on **Transactions**.

```text
┌─────────────────────────────────────────────────────────┐
│ Property Filters                                        │
│ Search | District | City | Land | Usage | Status        │
│                              [Clear] [Search Properties]│
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Property Results                                        │
│ ID | Name/Address | Location | Type | Value | Status    │
└─────────────────────────────────────────────────────────┘
```

## 3b. Transactions

Dedicated transaction investigation page (`/transactions`).

1. **Forensic Filters** — `GET /api/v1/property-transactions/` (`transaction_id`, `registration_type`, `area_name`, date, `project_name`, value range).
2. **Views** — grid uses transaction cards; list uses **Investigation Results** table (risk/export placeholders until those APIs exist).

```text
┌─────────────────────────────────────────────────────────┐
│ Forensic Filters                                        │
│ TXN ID | Type | Area | Date | Project | Value | Usage   │
│                              [Clear] [Run Query]        │
└─────────────────────────────────────────────────────────┘
┌── Results ────────────────────────────── [List] [Grid] ─┐
│ List → Investigation Results table                      │
│ Grid → Transaction cards                                │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Property verification / details page

**Required demo screen.** Route: `/property-search/[id]`.

Loads `GET /api/v1/properties/{property_id}/full`.

Output:

- Property details
- Current owner
- Ownership history
- Registration / legal status
- Encumbrances
- Documents (hash + verification status)
- Related transactions
- Blockchain status (placeholder until Phase 3)
- Risk level (placeholder until Phase 4)

Linked from Property Search (property ID + **View** action) and from Transaction Details when a property ID is present.

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

## 6. Blockchain verification page

Route: `/blockchain-verification`.

Web3-style verification console (white canvas + dark `#0d1117` widgets, emerald `#10b981` accents, monospace technical data):

1. **Document Input & Hash Generator** — Property ID, seller/buyer wallets, value, currency → **Generate SHA-256 Hash** (Web Crypto). Copyable hash output + forward status bar.
2. **Technical Fingerprint** — JSON payload, computed hash, blockchain TX hash (explorer link), block number, UTC timestamp.
3. **Live Hash Comparison** — local vs on-chain hash; on-chain hash supports blur/mask + reveal; green check + **VERIFIED — IMMUTABLE RECORD CONFIRMED** when aligned.

Prototype loads real rows from `core.blockchain_transactions` (joined to `property_transactions` for property id / currency). Payload commitment is SHA-256 of sorted-key JSON of property/wallets/value/currency. Wire deeper chain checks as Phase 3 continues.

Also keep the hash-chain history view as a follow-on:

```text
Property Transaction History
 ┌─────────────┐
 │ Block …     │
 └──────┬──────┘
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
| Land registry | Approve/reject transactions, confirm ownership, resolve flags, User Management (create pending users) | Deleting cases (review instead); approving users |
| Super admin | User Management (approve/reject users), dataset load, thresholds, agent logs, health | — |

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
