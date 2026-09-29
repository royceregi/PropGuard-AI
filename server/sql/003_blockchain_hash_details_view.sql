-- PropGuard AI — blockchain hash details view + allow clearing tx_hash.
-- document_hash on property_documents is left unchanged.

ALTER TABLE core.blockchain_transactions
    ALTER COLUMN tx_hash DROP NOT NULL;

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
  END AS chain_position
FROM core.blockchain_transactions bt
LEFT JOIN core.properties p ON p.property_id = bt.property_id
LEFT JOIN core.property_documents pd ON pd.transaction_id = bt.transaction_id;
