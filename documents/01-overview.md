# 01 — Project Overview

**Product:** PropGuard AI  
**Tag line:** Protecting Property Transactions with AI + Blockchain  
**Module:** Information Retrieval and Web Analytics  
**Domain:** Blockchain  
**Sub-domain:** Property transaction verification and fraud-risk detection for land registration

## What the system is

PropGuard AI is an intelligent property transaction protection system. It combines:

1. A structured property and transaction database in PostgreSQL.
2. A simulated (or real, if later deployed) blockchain verification layer.
3. Information retrieval over historical transaction and property data.
4. Fraud-risk analysis with explainable reasons.
5. Investigation reports for different user roles.

High-level flow:

```text
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

## Problem it solves

Property buyers, real-estate companies, and land registries need a way to check whether a transaction looks consistent before they treat it as trustworthy.

Typical questions the system must answer:

- Is this property registered?
- Who is the current recorded owner?
- Does the seller match the current owner?
- Has the property changed ownership unusually often?
- Is the transaction present in the blockchain ledger?
- Is the transaction hash valid?
- Does `previous_hash` connect correctly to the previous transaction?
- Has the document been changed after registration?
- Are there active encumbrances, disputes, or legal restrictions?
- Is the price unusual compared with historical transactions?
- Does the transaction receive a low, medium, or high risk score?
- Why was it flagged, and what evidence supports that result?

## Safe wording for results

Do not say “this person is fraudulent.” Say something explainable, for example:

> High risk: seller does not match the latest recorded owner, the transaction value is 72% above the local historical median, and the document hash does not match the registered hash.

The output is a **risk indicator for investigation**, not a legal fraud judgment.

## Purpose statement

> PropGuard AI is a Blockchain-domain intelligent system that uses blockchain technology for property transaction integrity and a multi-agent AI architecture for retrieval, verification, risk analysis and explainable investigation.

## What the project should claim

Use this wording in proposals and reports:

> PropGuard AI is a prototype decision-support system for property transaction verification and fraud-risk detection. It combines a PostgreSQL property database, a hash-linked blockchain ledger simulation, information retrieval, explainable rule-based and anomaly-based risk analysis, and multi-agent reporting.

## What the project must not claim

Do not claim that the system:

- Proves a person committed fraud.
- Replaces a government land registry.
- Provides legally valid ownership.
- Guarantees that a transaction is safe.
- Uses a real decentralized blockchain unless one is actually deployed.
- Provides real financial or legal verification if the dataset is synthetic or historical.

## Responsible AI principles

These apply to every feature:

| Principle | Meaning in this project |
| --- | --- |
| Fairness | Do not unfairly label legitimate users as fraudulent. |
| Explainability | Always explain why a risk level was assigned. |
| Transparency | Show the records and sources used. |
| Privacy | Do not expose another person's NIC, phone, password data, or private documents. |
| Human oversight | AI supports investigation. It does not automatically accuse someone. |

## Commercialization

The prototype can later be offered as a service to:

- Land registries, as an investigation and integrity-checking workspace.
- Real-estate companies, as a pre-transaction verification check.
- Property owners, as a limited “passbook” view of their own records.

That is a future product direction. The current academic scope is a demonstrable prototype.

## Related files

- Architecture: [02-architecture.md](02-architecture.md)
- Roles: [08-roles-and-permissions.md](08-roles-and-permissions.md)
- Formal requirements: [srs.md](srs.md)
