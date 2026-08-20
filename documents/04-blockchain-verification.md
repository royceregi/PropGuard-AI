# 04 — Blockchain Verification

## Design rule

Do not claim that every property field is stored on a blockchain.

```text
PostgreSQL:
- Full property information
- Owner information
- Documents and document text
- Historical transactions
- Fraud features and risk results
- User accounts
- Query and agent logs

Blockchain ledger:
- Transaction ID
- Property ID
- Transaction hash
- Previous hash
- Property hash
- Timestamp
- Transaction type
- Wallets
- Digital signature
- Verification status
```

Personal data and large documents stay off-chain. Store SHA-256 of each document in the ledger. During verification, hash the current document again and compare.

This prototype uses a **hash-linked ledger simulation** in `blockchain_transactions` unless a real chain is later deployed. Do not describe it as a live public blockchain if it is not one.

## Ledger table

See `blockchain_transactions` in [03-database.md](03-database.md).

Canonical names:

| Field | Meaning |
| --- | --- |
| `tx_hash` | Hash of this ledger record |
| `previous_hash` | `tx_hash` of the previous related record |
| `property_hash` | Hash of the property identity snapshot |
| `document_hash` | Lives on `property_documents`, compared during verification |

Simulated transaction hash:

```text
tx_hash = SHA256(
    transaction_id
    + property_id
    + previous_hash
    + block_timestamp
    + transaction_value
)
```

The exact formula is a design choice. Document it and use it consistently.

## Checks the verification service must run

### 1. Transaction existence

The transaction must exist in both:

```text
property_transactions
blockchain_transactions
```

### 2. Property consistency

```text
blockchain_transactions.property_id
=
property_transactions.property_id
```

### 3. Transaction hash verification

Recalculate the hash from the canonical fields and compare it with stored `tx_hash`.

### 4. Previous-hash verification

For a transaction that has a predecessor:

```text
current.previous_hash = previous.tx_hash
```

If this fails, report a possible broken chain or inconsistent imported data.

### 5. Document hash verification

```text
calculated_hash = SHA256(document_text_or_file)
calculated_hash = property_documents.document_hash
```

### 6. Ownership verification

The seller must be:

- The active owner, or
- An authorized party according to project rules.

Current owner:

```text
ownership_end_date IS NULL
AND ownership_status = 'ACTIVE'
```

### 7. Encumbrance verification

Flag the transaction if the property has an active mortgage, lien, dispute, or other restriction.

### 8. Required-party verification

Expected parties, depending on procedure:

- Buyer
- Seller
- Registrar
- Notary or witness, if the simulated procedure requires them

### 9. Registration verification

Registration number, date, and status must be present and consistent.

## What the UI should show

For each check, show:

- Pass / fail / not applicable
- The compared values (truncated hashes are fine in the UI; full hashes must be copyable)
- A short reason
- A link to the evidence record

Integrity summary:

```text
Blockchain Integrity
        VALID
```

or:

```text
Blockchain Integrity
        INVALID

Reason:
Transaction hash does not match the stored blockchain hash.
```

## Related files

- Schema: [03-database.md](03-database.md)
- Agents: [05-agents.md](05-agents.md)
- Frontend screens: [frontend.md](frontend.md)
