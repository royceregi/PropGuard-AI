# PropGuard AI — Master Architecture Note

**Status:** Frozen design source of truth  
**Companion brief:** [blockchain.md](blockchain.md)

This file is the full architecture, schema, verification, IR, and implementation guidance. Split reading copies (same content, easier to study) start at [README.md](README.md).

If a split file disagrees with this note, follow **this file**.

---

I read your `blockchain.md`. Your project should be presented as **PropGuard AI: an AI-assisted property transaction verification and fraud-risk detection system**. It should combine:

1. A structured property and transaction database.
2. A simulated or real blockchain verification layer.
3. Information retrieval over historical transaction/property data.
4. Fraud-risk analysis.
5. Explainable reports for different user roles.

Your current PostgreSQL direction is appropriate. Use **PostgreSQL as the main database**, with a vector-search extension or separate vector database only if your lecturer requires semantic retrieval. Do not replace PostgreSQL with MongoDB for this project unless you have a strong reason.

## 1. What the system must do

Your system should allow a user to search for a property or transaction and answer questions such as:

- Is this property registered?
- Who is the current recorded owner?
- Does the seller match the current owner?
- Has the property changed ownership unusually often?
- Is the transaction present in the blockchain ledger?
- Is the transaction hash valid?
- Does its `previous_hash` connect correctly to the previous transaction?
- Has the document been changed after registration?
- Are there active encumbrances, disputes, or legal restrictions?
- Is the price unusual compared with historical transactions?
- Does the transaction receive a low, medium, or high risk score?
- Why was the transaction flagged?
- What evidence supports the result?

The result should not simply say “this person is fraudulent.” It should say something safer and more explainable, such as:

> High risk: seller does not match the latest recorded owner, the transaction value is 72% above the local historical median, and the document hash does not match the registered hash.

The system should support investigation, not automatically make a legal accusation.

## 2. Recommended architecture

Use this architecture:

```text
React frontend
       ↓
FastAPI backend
       ↓
Service layer
 ┌───────────────┬────────────────┬────────────────┐
 │ Verification  │ Retrieval      │ Risk detection │
 │ service       │ service        │ service        │
 └───────────────┴────────────────┴────────────────┘
       ↓
PostgreSQL database
       ↓
Optional vector search using pgvector
```

The four AI agents in your document can be implemented gradually:

### Minimum viable version

Implement at least these two interacting agents:

1. **Blockchain Information Retrieval Agent**
   - Retrieves property, transaction, ownership, document, and blockchain records.
   - Returns evidence used for the investigation.

2. **Risk and Fraud Detection Agent**
   - Uses the retrieved records and calculated features.
   - Assigns a risk score and explains the reasons.

### Recommended complete version

Add:

3. **Transaction Analysis Agent**
   - Checks ownership, transaction sequence, values, timestamps, hashes, and required fields.

4. **Report Agent**
   - Converts all results into a readable investigation report.

The agents do not need to be independent complex applications. They can be backend modules or LangGraph nodes that communicate through structured JSON.

## 3. Preferred database

### PostgreSQL is the best choice

Your document already specifies PostgreSQL, and it suits this project because it supports:

- Strong relationships between properties, owners, transactions, and documents.
- Foreign keys and constraints.
- Transactions and reliable updates.
- Numeric and timestamp types.
- Aggregation queries for web analytics.
- Full-text search.
- JSONB for flexible blockchain or agent results.
- PostGIS for latitude, longitude, boundaries, and spatial analysis.
- `pgvector` for embedding-based information retrieval.
- Views for investigation dashboards and reports.

Your project has many relational relationships:

```text
Property 1 ──── many Transactions
Property 1 ──── many Ownership History Records
Transaction 1 ──── many Parties
Transaction 1 ──── many Documents
Transaction 1 ──── one Blockchain Record
User 1 ──── many Query Logs
```

That makes PostgreSQL more suitable than a document database for the core system.

### Suggested database arrangement

Use one PostgreSQL database, for example:

```text
property_db
```

Organize it into three logical layers:

```text
staging tables       → raw imported CSV data
core tables          → clean application data
analytics tables     → features, scores, and reports
```

You can use PostgreSQL schemas if desired:

```text
staging
core
analytics
```

For a student project, separate table prefixes are also acceptable, but PostgreSQL schemas are cleaner.

## 4. Important correction: blockchain is not the entire database

Do not claim that every property field is stored on a blockchain. A better design is:

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

The large documents and personal information should remain off-chain. Store a cryptographic hash of each document in the ledger. During verification, calculate the document hash again and compare it with the stored value.

## 5. Recommended core tables

Your current database contains many useful tables, but it also contains duplicates and staging tables. For the final application, use the following core model.

### `users`

Stores login accounts and roles.

```text
user_id
username
full_name
email
phone_number
password_hash
role
wallet_address
nic_hash
kyc_status
access_level
mfa_enabled
is_active
created_at
last_login
```

Recommended roles:

```text
SUPER_ADMIN
LAND_REGISTRY
REAL_ESTATE_COMPANY
PUBLIC_USER
```

Do not store real passwords or raw NIC values in the demonstration dataset. Passwords must be stored only as secure password hashes, and personal identifiers should be masked or hashed.

### `properties`

Stores the stable identity and current state of a property.

```text
property_id
title_deed_number
property_name
address
district
city
latitude
longitude
land_area
area_unit
land_type
survey_plan_number
current_owner_id
current_usage_type
current_subtype
current_value
legal_status
verification_status
encumbrances
boundary_north
boundary_south
boundary_east
boundary_west
created_at
updated_at
```

Add a unique constraint to:

```text
property_id
title_deed_number
survey_plan_number
```

depending on the quality of your dataset.

### `property_transactions`

Stores every historical transaction related to a property.

```text
transaction_id
property_id
transaction_type_id
transaction_group
registration_type
procedure_name
transaction_datetime
transaction_value
previous_value
value_change_pct
procedure_area
meter_sale_price
currency
status
created_at
```

The following historical fields can also be retained because they are useful for analytics:

```text
procedure_id
trans_group_id
area_id
area_name
project_number
project_name
master_project
nearest_landmark
rooms
has_parking
```

Do not store derived values such as year, month, quarter, and day of week unless you specifically need them for performance. PostgreSQL can extract them from `transaction_datetime`, or you can materialize them in an analytics table.

### `transaction_types`

```text
transaction_type_id
transaction_type_name
description
```

Examples:

```text
SALE
MORTGAGE
MORTGAGE_RELEASE
INHERITANCE
GIFT
TRANSFER
REGISTRATION
DISPUTE
```

### `transaction_parties`

Do not keep only `buyer` and `seller` columns. A transaction may involve several parties.

```text
transaction_party_id
transaction_id
user_id
party_name
role
is_primary
```

Possible roles:

```text
BUYER
SELLER
OWNER
WITNESS
NOTARY
ATTORNEY
BANK
REGISTRAR
```

For historical data where a party does not have a system account, `user_id` can be nullable while `party_name` remains available.

### `property_ownership_history`

This table is essential for verifying whether a seller is actually the current or previous owner.

```text
ownership_id
property_id
owner_id
ownership_start_date
ownership_end_date
ownership_type
transaction_id
ownership_status
recorded_at
```

Example ownership logic:

```text
The current owner is the record where ownership_end_date IS NULL
and ownership_status = 'ACTIVE'.
```

Add a database rule or application validation preventing two active owners for the same property unless joint ownership is intentionally supported.

### `property_documents`

```text
document_id
property_id
transaction_id
document_type
document_number
document_text
document_hash
document_url
issued_date
verification_status
created_at
```

Examples of `document_type`:

```text
TITLE_DEED
SURVEY_PLAN
SALE_AGREEMENT
TAX_RECEIPT
MORTGAGE_DOCUMENT
IDENTITY_DOCUMENT
```

The most important blockchain-related field is:

```text
document_hash
```

For the demonstration, calculate it using SHA-256 and compare it during verification.

### `registration_details`

```text
registration_id
transaction_id
registration_number
registration_date
registration_fee
tax_amount
other_fee
total_amount_paid
currency
registration_status
```

This separates registration information from the general transaction record.

### `blockchain_transactions`

This is your blockchain ledger or blockchain simulation table.

```text
blockchain_tx_id
transaction_id
property_id
tx_hash
previous_hash
property_hash
block_number
block_timestamp
from_wallet
to_wallet
transaction_type
transaction_value
smart_contract_address
digital_signature
transaction_status
consensus_verification
gas_fee
created_at
```

Use a unique constraint on:

```text
tx_hash
transaction_id
```

For a simulated chain, calculate:

```text
tx_hash = SHA256(
    transaction_id
    + property_id
    + previous_hash
    + block_timestamp
    + transaction_value
)
```

The exact formula is your project design choice, but document it clearly.

### `risk_assessments`

Your current schema does not show a proper table for storing fraud-analysis results. Add one.

```text
assessment_id
transaction_id
property_id
risk_score
risk_level
model_name
model_version
assessment_status
explanation
created_at
reviewed_by
review_status
```

Use a numeric scale such as:

```text
0.00–0.39  LOW
0.40–0.69  MEDIUM
0.70–1.00  HIGH
```

These thresholds are project-defined, so explain them in your report.

### `risk_indicators`

Store each reason separately instead of storing all reasons in one text field.

```text
indicator_id
assessment_id
indicator_code
indicator_name
indicator_value
severity
description
evidence_reference
```

Example indicators:

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

This makes your explanation page much easier to build.

### `query_logs`

Your current table is useful, but `retrieved_transaction_ids` should not be a comma-separated text field.

Use:

```text
query_logs
- query_id
- user_id
- query_text
- log_timestamp
- agent_response
- confidence_score
- relevance_score
- flagged_suspicious
- agent_used
- response_time_ms
```

Then add:

```text
query_retrievals
- query_id
- transaction_id
- document_id
- rank
- relevance_score
```

This is more normalized and useful for information-retrieval analytics.

### `agent_runs`

Because your project explicitly uses agents, add a table for agent interaction.

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

This helps demonstrate that at least two agents interacted and lets you measure response time and reliability.

## 6. How to use your datasets

Your datasets should not all be inserted directly into final tables. Use an ETL process:

```text
CSV files
   ↓
staging tables
   ↓ clean and normalize
core tables
   ↓ calculate features
analytics tables
```

### Dataset mapping

| Dataset field                 | Destination                                                  |
| ----------------------------- | ------------------------------------------------------------ |
| `transaction_id`              | `property_transactions.transaction_id`                       |
| `property_id`                 | `properties.property_id`                                     |
| `instance_date`               | `property_transactions.transaction_datetime`                 |
| `property_type`               | `property_classifications` or transaction attributes         |
| `property_sub_type`           | `property_classifications`                                   |
| `property_usage`              | `properties.current_usage_type` / classification history     |
| `procedure_area`              | `property_transactions.procedure_area`                       |
| `actual_worth`                | `property_transactions.transaction_value` or valuation field |
| `meter_sale_price`            | `property_transactions.meter_sale_price`                     |
| `Owner_ID`                    | `users` or a separate historical party record                |
| `Seller_ID`                   | `transaction_parties`                                        |
| `Document_Hash`               | `property_documents.document_hash`                           |
| `Blockchain_Transaction_Hash` | `blockchain_transactions.tx_hash`                            |
| `Previous_Transaction_Hash`   | `blockchain_transactions.previous_hash`                      |
| `Block_Number`                | `blockchain_transactions.block_number`                       |
| `From_Wallet`                 | `blockchain_transactions.from_wallet`                        |
| `To_Wallet`                   | `blockchain_transactions.to_wallet`                          |
| `Verification_Status`         | `properties` or `property_documents`, depending on meaning   |
| `Query_Text`                  | `query_logs.query_text`                                      |
| `Flagged_Suspicious`          | `risk_assessments` or `query_logs`                           |

### Important dataset warning

Your document says that `dubai_property_MERGED_enriched.csv` overlaps significantly with `Transactions.csv`. Do not load both as independent transaction records, or you may create duplicate transactions.

Use a stable key such as:

```text
transaction_id
```

Then merge or upsert the enrichment columns into the same transaction/property records.

Also, the dataset contains fields such as:

```text
Owner_NIC
Auth_Password_Hash
Email
Phone_Number
```

Treat these as sensitive. For a university demonstration:

- Do not expose them in the public interface.
- Do not publish them to GitHub.
- Use masked or synthetic values.
- Never use the supplied password hashes for real authentication.
- Add the raw dataset to `.gitignore` if it contains personal data.

## 7. What blockchain verification should check

Your verification service should perform at least these checks.

### Transaction existence

Check whether the transaction exists in:

```text
property_transactions
blockchain_transactions
```

### Property consistency

Verify that:

```text
blockchain_transactions.property_id
=
property_transactions.property_id
```

### Transaction hash verification

Recalculate the transaction hash from the canonical transaction fields and compare it with `tx_hash`.

### Previous-hash verification

For a transaction with a previous transaction:

```text
current.previous_hash = previous.tx_hash
```

If this fails, report a possible broken chain or inconsistent imported data.

### Document hash verification

Calculate SHA-256 from the current document content:

```text
calculated_hash = SHA256(document_text_or_file)
```

Then compare:

```text
calculated_hash = property_documents.document_hash
```

### Ownership verification

Check that the seller is:

- The active owner, or
- An authorized party according to your rules.

### Encumbrance verification

Flag the transaction if the property has an active mortgage, lien, dispute, or other restriction.

### Required-party verification

Check whether the expected parties are present:

- Buyer.
- Seller.
- Registrar.
- Notary or witness, if your simulated procedure requires them.

### Registration verification

Check that the registration number, date, and status are present and consistent.

## 8. Fraud and risk detection

You can begin with rule-based detection and then add machine learning. This is more reliable for a student project than immediately depending on an LLM.

### Rule-based indicators

Create rules such as:

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

Each rule should produce:

```text
indicator_code
severity
description
evidence
```

### Useful historical features

Create an analytics table such as `transaction_features`:

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

These features support both dashboard analytics and ML.

### Model options

If your dataset has fraud labels:

- Logistic regression.
- Random forest.
- XGBoost, if permitted.

If it does not have fraud labels:

- Isolation Forest.
- Local Outlier Factor.
- Rule-based risk scoring.

You should not invent fraud labels and claim they are real. You can say:

> The dataset did not provide verified fraud labels, so the demonstration uses explainable rules and unsupervised anomaly detection. The output is a risk indicator, not a legal fraud judgment.

## 9. Information retrieval requirements

Because your module is **Information Retrieval and Web Analytics**, do not build only a CRUD application.

Your system should support at least:

### Structured search

Search by:

- Property ID.
- Transaction ID.
- Title deed number.
- Owner ID.
- Registration number.
- Wallet address.
- Date range.
- Location.
- Risk level.

### Full-text search

Search fields such as:

```text
document_text
property_name
address
procedure_name
legal_status
encumbrances
```

PostgreSQL full-text search is sufficient for the first version.

### Semantic search

If you need embeddings, use `pgvector` inside PostgreSQL. Store:

```text
document_id
chunk_text
embedding
metadata
```

The retrieval agent can retrieve relevant documents based on a question such as:

> Show evidence for suspicious ownership transfers involving this property.

You do not necessarily need a separate vector database. PostgreSQL with `pgvector` keeps the system simpler.

### Retrieval evaluation

Measure:

- Precision@K.
- Recall@K, if you have relevant-document labels.
- Relevance score.
- Response latency.
- Number of retrieved evidence records.

Your `query_logs` and `query_retrievals` tables can support these measurements.

## 10. Role-based functionality

### Super admin

The super admin should be able to:

- Manage users and roles.
- Load or refresh datasets.
- View system health.
- View all transactions and risk assessments.
- Review agent logs.
- Configure risk thresholds.
- Manage transaction types and verification rules.

### Land registry

The land registry acts as the authoritative administrator. It should be able to:

- Register properties.
- Approve or reject transactions.
- Verify documents.
- Confirm ownership changes.
- Add official records.
- View blockchain integrity.
- Resolve flagged cases.
- Review risk reports.
- Mark a case as reviewed, not simply delete it.

### Real estate company

It should be able to:

- Search a property before a transaction.
- Verify ownership.
- Verify title and registration details.
- Check encumbrances.
- Check transaction history.
- Submit a transaction for analysis.
- Receive a risk assessment and evidence report.

It should not be able to alter official property history.

### Public user

It should be able to:

- View properties they own.
- View their ownership history.
- Check document and blockchain verification.
- View transaction status.
- Submit an inquiry.
- See limited public property information.

Do not expose another person’s NIC, phone number, password-related data, or private documents.

## 11. Improvements to your current database

Your current PostgreSQL database is a good starting point, but make these changes before building the interface.

### Keep

```text
properties
property_transactions
property_ownership_history
property_documents
transaction_parties
transaction_types
registration_details
blockchain_transactions
users
query_logs
locations
```

### Add

```text
risk_assessments
risk_indicators
transaction_features
query_retrievals
agent_runs
```

### Remove or isolate

```text
products
staging_* tables from the application layer
```

The `products` table appears unrelated to this project and should be removed or kept outside the project database.

The `staging_*` tables should remain only for importing and cleaning CSV data. The frontend and backend should query the clean core tables, not the staging tables.

### Fix data types

Your staging tables correctly use text for raw CSV import, but the final tables should use proper types:

```text
dates        → DATE or TIMESTAMP
money        → NUMERIC
area         → NUMERIC
counts       → INTEGER
coordinates  → NUMERIC or PostGIS
flags        → BOOLEAN
hashes       → VARCHAR or TEXT
```

Avoid using text for fields such as:

```text
block_number
block_timestamp
transaction_value
gas_fee
latitude
longitude
has_parking
```

### Fix naming consistency

Choose one naming style:

```text
snake_case
```

Use the same names everywhere. For example, do not alternate between:

```text
tx_hash
blockchain_transaction_hash
transaction_hash
```

Choose one canonical name, such as:

```text
tx_hash
```

and map imported CSV names to it during ETL.

## 12. Suggested implementation order

Follow this order to avoid building too much at once.

### Phase 1: Data preparation

1. Inspect all CSV files.
2. Identify duplicate transaction and property records.
3. Create staging tables.
4. Clean dates, numeric values, empty strings, and Boolean values.
5. Mask sensitive fields.
6. Load normalized records into core tables.

### Phase 2: Core database

1. Create users and roles.
2. Create properties.
3. Create transactions and transaction types.
4. Create ownership history.
5. Create transaction parties.
6. Create documents and registration details.
7. Add foreign keys, unique constraints, and indexes.

### Phase 3: Blockchain simulation

1. Import or generate blockchain transaction records.
2. Implement transaction hash calculation.
3. Implement previous-hash validation.
4. Implement document-hash validation.
5. Create a verification result endpoint.
6. Display the verification evidence in the frontend.

### Phase 4: Fraud-risk analysis

1. Calculate transaction features.
2. Implement transparent rules.
3. Add an optional anomaly-detection model.
4. Store risk assessments.
5. Store individual risk indicators.
6. Generate explanations.

### Phase 5: Information retrieval

1. Add structured property and transaction search.
2. Add PostgreSQL full-text search.
3. Add document retrieval.
4. Add optional embeddings and `pgvector`.
5. Implement the retrieval agent.
6. Log retrieved evidence and relevance scores.

### Phase 6: Agents and reports

1. Implement the Transaction Analysis Agent.
2. Implement the Retrieval Agent.
3. Implement the Risk Agent.
4. Combine their outputs.
5. Generate a report.
6. Store agent execution logs.

### Phase 7: Web application

1. Implement JWT authentication.
2. Implement role-based access.
3. Build property search.
4. Build transaction verification.
5. Build risk report page.
6. Build admin and land-registry dashboards.
7. Add analytics charts.

## 13. Important demo screens

Your final web application should include:

### Property verification page

Input:

```text
property_id
title_deed_number
transaction_id
```

Output:

- Property details.
- Current owner.
- Ownership history.
- Registration status.
- Encumbrances.
- Blockchain status.
- Document status.
- Risk level.

### Transaction investigation page

Show:

- Transaction details.
- Buyer and seller.
- Previous transaction.
- Hash validation.
- Document hash validation.
- Ownership validation.
- Risk indicators.
- Evidence records.
- Final recommendation.

### Search and retrieval page

Allow users to ask:

```text
Find all high-value transactions for this property.
Show previous owners.
Find transactions with document hash mismatches.
Show properties with rapid ownership changes.
```

### Analytics dashboard

Include:

- Transactions by month.
- Transactions by property type.
- Average price per area.
- High-risk transactions over time.
- Risk by location.
- Most frequent transaction types.
- Verification failures.
- Query response latency.
- Retrieval relevance.

## 14. What your project should claim

Use careful wording in your proposal:

> PropGuard AI is a prototype decision-support system for property transaction verification and fraud-risk detection. It combines a PostgreSQL property database, a hash-linked blockchain ledger simulation, information retrieval, explainable rule-based and anomaly-based risk analysis, and multi-agent reporting.

Do not claim that it:

- Proves a person committed fraud.
- Replaces a government land registry.
- Provides legally valid ownership.
- Guarantees that a transaction is safe.
- Uses a real decentralized blockchain unless you actually deploy one.
- Provides real financial or legal verification if the dataset is synthetic or historical.

## Final recommendation

Use **PostgreSQL with PostGIS and optionally pgvector**:

```text
PostgreSQL        → main relational database
PostGIS            → location and boundary analysis
pgvector           → semantic document retrieval, if required
FastAPI            → backend
React              → frontend
LangGraph          → agent workflow, if permitted
SHA-256            → document and transaction integrity checks
JWT                → authentication
```

Your immediate next task should be to freeze the normalized schema around these core tables:

```text
users
properties
property_transactions
transaction_types
transaction_parties
property_ownership_history
property_documents
registration_details
blockchain_transactions
risk_assessments
risk_indicators
transaction_features
query_logs
query_retrievals
agent_runs
```

Then keep all `staging_*` tables strictly for CSV ingestion and cleaning. This will give you a clear, defensible project scope and directly connect the database, blockchain verification, information retrieval, fraud detection, and web analytics requirements.