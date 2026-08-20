# 07 — Information Retrieval and Web Analytics

This module is **Information Retrieval and Web Analytics**. The product must not be only a CRUD application.

## Structured search

Search by:

- Property ID
- Transaction ID
- Title deed number
- Owner ID
- Registration number
- Wallet address
- Date range
- Location
- Risk level

## Full-text search

Search fields such as:

```text
document_text
property_name
address
procedure_name
legal_status
encumbrances
```

PostgreSQL full-text search is enough for the first version.

## Semantic search (optional)

If embeddings are required, use `pgvector` inside PostgreSQL. Store:

```text
document_id
chunk_text
embedding
metadata
```

Example question:

> Show evidence for suspicious ownership transfers involving this property.

A separate vector database is not required. Keeping embeddings in PostgreSQL keeps the system simpler.

## Example retrieval queries

```text
Find all high-value transactions for this property.
Show previous owners.
Find transactions with document hash mismatches.
Show properties with rapid ownership changes.
```

## Logging and evaluation

`query_logs` stores the query, agent used, latency, and overall scores.

`query_retrievals` stores each retrieved transaction/document with rank and relevance. Do not store retrieved IDs as comma-separated text.

Measure:

- Precision@K
- Recall@K, if relevant-document labels exist
- Relevance score
- Response latency
- Number of retrieved evidence records

## Analytics dashboard

Include:

- Transactions by month
- Transactions by property type
- Average price per area
- High-risk transactions over time
- Risk by location
- Most frequent transaction types
- Verification failures
- Query response latency
- Retrieval relevance

Do not invent dashboard numbers. They must come from the processed dataset.

## Related files

- Schema: [03-database.md](03-database.md)
- Agents: [05-agents.md](05-agents.md)
- Frontend search page: [frontend.md](frontend.md)
