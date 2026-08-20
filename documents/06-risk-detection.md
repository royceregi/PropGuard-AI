# 06 — Fraud and Risk Detection

Begin with **rule-based detection**, then add machine learning if needed. This is more reliable for a student project than depending on an LLM for the score.

The result is a **risk indicator**, not a legal fraud judgment. Do not invent fraud labels and claim they are real.

## Score scale

```text
0.00–0.39  LOW
0.40–0.69  MEDIUM
0.70–1.00  HIGH
```

These thresholds are project-defined. Explain them in the report.

## Rule-based indicators

Each rule produces:

```text
indicator_code
severity
description
evidence
```

Recommended rules:

```text
seller != current_owner
duplicate title deed number
duplicate registration number
duplicate document hash
document hash mismatch
broken previous-hash link
active encumbrance
missing required document
unusually high price per area
multiple transfers within a short period
large value change
```

Example indicator codes stored in `risk_indicators`:

```text
SELLER_NOT_CURRENT_OWNER
DOCUMENT_HASH_MISMATCH
DUPLICATE_TITLE_DEED
UNUSUAL_PRICE
FREQUENT_OWNERSHIP_CHANGE
ACTIVE_ENCUMBRANCE
BROKEN_HASH_CHAIN
MISSING_REQUIRED_DOCUMENT
```

## Historical features

Store calculated features in `transaction_features`:

```text
feature_id
transaction_id
property_id
price_per_area
price_deviation_from_area_median
ownership_change_count
transactions_last_90_days
transactions_last_365_days
days_since_previous_transaction
value_change_pct
document_count
missing_document_count
hash_chain_valid
seller_matches_owner
has_active_encumbrance
duplicate_document_count
```

These features feed both the dashboard and any later model.

## Model options

If the dataset has verified fraud labels:

- Logistic regression
- Random forest
- XGBoost, if permitted

If it does not (likely case):

- Isolation Forest
- Local Outlier Factor
- Rule-based risk scoring

Use this wording:

> The dataset did not provide verified fraud labels, so the demonstration uses explainable rules and unsupervised anomaly detection. The output is a risk indicator, not a legal fraud judgment.

## Storage

`risk_assessments` stores the overall score, level, model name/version, explanation, and review status.

`risk_indicators` stores each reason separately so the explanation page can list them.

Land registry users should **mark a case as reviewed**, not delete it.

## Related files

- Tables: [03-database.md](03-database.md)
- Agents: [05-agents.md](05-agents.md)
- Roles: [08-roles-and-permissions.md](08-roles-and-permissions.md)
