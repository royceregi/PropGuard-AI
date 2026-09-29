-- PropGuard AI — blockchain verification features on core.transaction_features.
-- Filled by app.services.blockchain_risk_service (per transaction, on assessment or refresh).
-- NULL = check not applicable / not evaluated yet. The API also adds these columns at startup.
-- Existing columns reused: hash_chain_valid, seller_matches_owner, has_active_encumbrance.

ALTER TABLE core.transaction_features
    ADD COLUMN IF NOT EXISTS property_hash_match              BOOLEAN,
    ADD COLUMN IF NOT EXISTS transaction_hash_match           BOOLEAN,
    ADD COLUMN IF NOT EXISTS document_hash_match              BOOLEAN,
    ADD COLUMN IF NOT EXISTS digital_signature_valid          BOOLEAN,
    ADD COLUMN IF NOT EXISTS smart_contract_valid             BOOLEAN,
    ADD COLUMN IF NOT EXISTS blockchain_transaction_confirmed BOOLEAN,
    ADD COLUMN IF NOT EXISTS duplicate_blockchain_tx          BOOLEAN,
    ADD COLUMN IF NOT EXISTS from_wallet_matches_seller       BOOLEAN,
    ADD COLUMN IF NOT EXISTS to_wallet_matches_buyer          BOOLEAN,
    ADD COLUMN IF NOT EXISTS buyer_matches_new_owner          BOOLEAN,
    ADD COLUMN IF NOT EXISTS blockchain_value_matches_db      BOOLEAN,
    ADD COLUMN IF NOT EXISTS blockchain_type_matches_db       BOOLEAN,
    ADD COLUMN IF NOT EXISTS blockchain_timestamp_valid       BOOLEAN,
    ADD COLUMN IF NOT EXISTS blockchain_integrity             VARCHAR(10),
    ADD COLUMN IF NOT EXISTS blockchain_checked_at            TIMESTAMP;
