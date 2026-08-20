# 09 — Datasets and ETL

Datasets are **not** inserted directly into final tables. Use ETL:

```text
CSV files
   ↓
staging tables
   ↓ clean and normalize
core tables
   ↓ calculate features
analytics tables
```

Staging tables stay in the `staging` schema (or `staging_*` prefix). The frontend and backend query core tables only.

## Source files

### `Transactions.csv`

Historical Dubai Land Department-style transaction records.

| # | Column |
| --- | --- |
| 1 | `transaction_id` |
| 2 | `procedure_id` |
| 3 | `trans_group_id` |
| 4 | `trans_group` |
| 5 | `procedure_name` |
| 6 | `instance_date` |
| 7 | `property_type_id` |
| 8 | `property_type` |
| 9 | `property_sub_type_id` |
| 10 | `property_sub_type` |
| 11 | `property_usage` |
| 12 | `reg_type_id` |
| 13 | `reg_type` |
| 14 | `area_id` |
| 15 | `area_name` |
| 16 | `building_name` |
| 17 | `project_number` |
| 18 | `project_name` |
| 19 | `master_project` |
| 20 | `nearest_landmark` |
| 21 | `nearest_metro` |
| 22 | `nearest_mall` |
| 23 | `rooms` |
| 24 | `has_parking` |
| 25 | `procedure_area` |
| 26 | `actual_worth` |
| 27 | `meter_sale_price` |
| 28 | `rent_value` |
| 29 | `meter_rent_price` |
| 30 | `no_of_parties_role_1` |
| 31 | `no_of_parties_role_2` |
| 32 | `no_of_parties_role_3` |

### `blockchain_transaction_ledger_dubai.csv`

| # | Column |
| --- | --- |
| 1 | `Transaction_ID` |
| 2 | `Blockchain_Transaction_Hash` |
| 3 | `Previous_Transaction_Hash` |
| 4 | `Property_Hash` |
| 5 | `Block_Number` |
| 6 | `Block_Timestamp` |
| 7 | `Property_ID` |
| 8 | `From_Wallet` |
| 9 | `To_Wallet` |
| 10 | `Transaction_Type` |
| 11 | `Transaction_Value_AED` |
| 12 | `Smart_Contract_Address` |
| 13 | `Transaction_Status` |
| 14 | `Digital_Signature` |
| 15 | `Consensus_Verification` |
| 16 | `Gas_Fee_AED` |

### `dubai_property_MERGED_enriched.csv`

This file overlaps heavily with `Transactions.csv`. It appears to merge transactions with the blockchain ledger and extra enrichment fields (owner, seller, title deed, boundaries, GPS, document text/hash, fees, witnesses).

Do **not** load both as independent transaction records. Use `transaction_id` as the stable key and upsert enrichment columns into the same property/transaction rows.

### `query_interaction_logs_dubai.csv`

| # | Column |
| --- | --- |
| 1 | `Query_ID` |
| 2 | `User_ID` |
| 3 | `Query_Text` |
| 4 | `Retrieved_Transaction_IDs` |
| 5 | `Relevance_Score` |
| 6 | `Response_Latency_ms` |
| 7 | `Flagged_Suspicious` |

Split `Retrieved_Transaction_IDs` into `query_retrievals` rows. Do not keep them as comma-separated text in core tables.

### `users_stakeholders_dubai.csv`

| # | Column |
| --- | --- |
| 1 | `User_ID` |
| 2 | `Full_Name` |
| 3 | `Role` |
| 4 | `Owner_NIC` |
| 5 | `Email` |
| 6 | `Phone_Number` |
| 7 | `Wallet_Address` |
| 8 | `Auth_Password_Hash` |
| 9 | `KYC_Status` |
| 10 | `Access_Level` |
| 11 | `MFA_Enabled` |

## Field mapping

| Dataset field | Destination |
| --- | --- |
| `transaction_id` | `property_transactions.transaction_id` |
| `property_id` | `properties.property_id` |
| `instance_date` | `property_transactions.transaction_datetime` |
| `property_type` | `property_classifications` or transaction attributes |
| `property_sub_type` | `property_classifications` |
| `property_usage` | `properties.current_usage_type` / classification history |
| `procedure_area` | `property_transactions.procedure_area` |
| `actual_worth` | `property_transactions.transaction_value` |
| `meter_sale_price` | `property_transactions.meter_sale_price` |
| `Owner_ID` | `users` or a historical party record |
| `Seller_ID` | `transaction_parties` |
| `Document_Hash` | `property_documents.document_hash` |
| `Blockchain_Transaction_Hash` | `blockchain_transactions.tx_hash` |
| `Previous_Transaction_Hash` | `blockchain_transactions.previous_hash` |
| `Block_Number` | `blockchain_transactions.block_number` |
| `From_Wallet` | `blockchain_transactions.from_wallet` |
| `To_Wallet` | `blockchain_transactions.to_wallet` |
| `Verification_Status` | `properties` or `property_documents`, depending on meaning |
| `Query_Text` | `query_logs.query_text` |
| `Flagged_Suspicious` | `risk_assessments` or `query_logs` |

Where to put leftover enrichment fields:

| Field | Destination |
| --- | --- |
| `building_name`, landmarks, metro, mall | `locations` |
| `nearest_landmark` | `locations` or retained on the transaction |
| `meter_sale_price` | `property_transactions.meter_sale_price` |
| `no_of_parties_*` | counts derived from `transaction_parties`, not stored as source of truth |
| `trans_group` / procedure group | `property_transactions.transaction_group` |

## Privacy

Sensitive columns include:

```text
Owner_NIC
Auth_Password_Hash
Email
Phone_Number
```

For a university demonstration:

- Do not expose them in the public interface.
- Do not publish them to GitHub.
- Use masked or synthetic values.
- Never use the supplied password hashes for real authentication.
- Add the raw dataset to `.gitignore` if it contains personal data.
- Store NIC only as `nic_hash`. Store passwords only as new secure password hashes.

## ETL checklist

1. Inspect all CSV files.
2. Identify duplicate transaction and property records.
3. Load into staging tables as text.
4. Clean dates, numeric values, empty strings, and booleans.
5. Mask sensitive fields.
6. Upsert into core tables using `transaction_id` / `property_id`.
7. Calculate features into analytics tables.

## Related files

- Core schema: [03-database.md](03-database.md)
- Original column lists and live DB dump: [blockchain.md](blockchain.md)
