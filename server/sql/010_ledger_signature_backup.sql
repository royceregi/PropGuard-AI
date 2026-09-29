-- PropGuard AI — keep the imported ledger signature / contract placeholders before signing.
-- Imported digital_signature values are 32-hex placeholders and smart_contract_address is
-- 'PROTOTYPE_NOT_DEPLOYED'. A hash rebuild with REGISTRY_SIGNING_KEY set replaces them with
-- Ed25519 signatures over tx_hash and REGISTRY_CONTRACT_ADDRESS. Run this once before that rebuild.
-- Rollback:
--   UPDATE core.blockchain_transactions bt
--   SET digital_signature = b.digital_signature, smart_contract_address = b.smart_contract_address
--   FROM core.blockchain_signature_backup b WHERE b.blockchain_tx_id = bt.blockchain_tx_id;

CREATE TABLE IF NOT EXISTS core.blockchain_signature_backup AS
SELECT blockchain_tx_id, digital_signature, smart_contract_address, now() AS backed_up_at
FROM core.blockchain_transactions;
