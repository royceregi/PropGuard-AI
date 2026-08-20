# 05 — Multi-Agent Design

The assignment requires at least **two interacting intelligent agents**. Four agents are specified; they can be added gradually.

Agents may be FastAPI service modules or LangGraph nodes. They communicate with structured JSON. They do not need to be four independent apps.

## Agent map

| Agent | Responsibility |
| --- | --- |
| Transaction Analysis Agent | Analyze transaction details, sequence, values, timestamps, hashes, and required fields |
| Blockchain Information Retrieval Agent | Retrieve property, transaction, ownership, document, and ledger records; return evidence |
| Risk and Fraud Detection Agent | Score risk and explain why |
| Report Agent | Combine findings into a readable investigation report |

## Minimum viable version

Implement these two first, and make them call each other:

1. **Blockchain Information Retrieval Agent**
   - Retrieves property, transaction, ownership, document, and blockchain records.
   - Returns the evidence used for the investigation.
2. **Risk and Fraud Detection Agent**
   - Uses retrieved records and calculated features.
   - Assigns a risk score and explains the reasons.

## Recommended complete version

Add:

3. **Transaction Analysis Agent**
   - Checks ownership, transaction sequence, values, timestamps, hashes, and required fields.
4. **Report Agent**
   - Converts all results into a readable investigation report.

## Interaction flow

```text
USER
  │
  ▼
Retrieval Agent  ──► evidence records, relevance scores
  │
  ▼
Transaction Analysis Agent  ──► field checks, hash/ownership findings
  │
  ▼
Risk Agent  ──► risk_score, risk_level, indicators
  │
  ▼
Report Agent  ──► human-readable investigation report
  │
  ▼
Responsible AI notice + stored agent_runs
```

In the MVP, the backend can call Retrieval then Risk directly and still satisfy “two interacting agents.”

## Persistence

Every agent run should be stored in `agent_runs`:

```text
agent_run_id
query_id
agent_name
input_data
output_data
status
confidence_score
started_at
completed_at
error_message
```

This demonstrates interaction and supports latency/reliability measurement.

Retrieved evidence belongs in `query_retrievals`, not in a comma-separated text column.

## Output contract

Each agent should return JSON similar to:

```text
{
  agent_name,
  status,
  confidence_score,
  findings,
  evidence_ids,
  warnings
}
```

The Report Agent must include:

- Verification summary
- Risk level and score
- Indicator list with evidence
- Responsible AI notice: this is not a legal fraud judgment

## Related files

- Risk rules: [06-risk-detection.md](06-risk-detection.md)
- Retrieval: [07-information-retrieval.md](07-information-retrieval.md)
- Implementation order: [10-implementation-plan.md](10-implementation-plan.md)
