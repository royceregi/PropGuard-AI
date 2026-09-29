-- PropGuard AI — anchor the full canonical transaction payload on each ledger row.
-- tx_hash now = SHA256(previous_hash + transaction_data_hash + block_timestamp),
-- so wallets, type, currency, date, and property_hash are all tamper-evident.
-- After running, rebuild ledger hashes (Settings → Update All Hashes).

ALTER TABLE core.blockchain_transactions
    ADD COLUMN IF NOT EXISTS transaction_data_hash VARCHAR(255);

CREATE OR REPLACE VIEW core.v_blockchain_hash_details AS
SELECT
  bt.blockchain_tx_id,
  bt.transaction_id,
  bt.property_id,
  p.title_deed_number,
  bt.tx_hash,
  bt.previous_hash,
  bt.property_hash,
  bt.block_number,
  bt.block_timestamp,
  bt.transaction_value,
  bt.transaction_status,
  pd.document_hash,
  CASE
    WHEN bt.previous_hash IS NULL OR bt.previous_hash = '0' THEN 'GENESIS'
    ELSE 'LINKED'
  END AS chain_position,
  bt.transaction_data_hash
FROM core.blockchain_transactions bt
LEFT JOIN core.properties p ON p.property_id = bt.property_id
LEFT JOIN core.property_documents pd ON pd.transaction_id = bt.transaction_id;
