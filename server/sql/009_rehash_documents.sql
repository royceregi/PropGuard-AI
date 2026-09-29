-- PropGuard AI — replace imported placeholder document hashes with real SHA-256.
-- Imported property_documents.document_hash values were '0x' + 40 hex placeholders,
-- not hashes of anything, so document integrity failed for every transaction.
-- New value = SHA256(document_text) as lowercase hex, matching app.core.hashing.compute_document_hash
-- (NULL text hashes as the empty string).
-- The original values are kept in core.property_documents_hash_backup for rollback:
--   UPDATE core.property_documents d SET document_hash = b.document_hash
--   FROM core.property_documents_hash_backup b WHERE b.document_id = d.document_id;
-- Ledger hashes do not include document_hash, so no ledger rebuild is needed.

CREATE TABLE IF NOT EXISTS core.property_documents_hash_backup AS
SELECT document_id, document_hash, now() AS backed_up_at
FROM core.property_documents
WHERE document_hash LIKE '0x%';

UPDATE core.property_documents
SET document_hash = encode(sha256(convert_to(coalesce(document_text, ''), 'UTF8')), 'hex')
WHERE document_hash IS NULL OR document_hash LIKE '0x%';
