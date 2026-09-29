-- PropGuard AI — tamper-detection demo (04-blockchain-verification.md section 5).
--
-- Run with psql (needs psql 10+ for \if):
--   psql "$DATABASE_URL" -f server/scripts/tamper_demo.sql
--   psql "$DATABASE_URL" -v tx=TX000123 -f server/scripts/tamper_demo.sql   -- pick the transaction
--   psql "$DATABASE_URL" -v restore_only=1 -f server/scripts/tamper_demo.sql -- undo an interrupted run
--
-- Each case is committed so the running app can see it, then the script pauses.
-- Open the transaction page (Ledger Verification + Run AI Investigation) or
--   GET /api/v1/blockchain/verify/<tx>
-- and press Enter to restore. Original values are kept in core.tamper_demo_backup
-- until the case is restored, so an interrupted run can always be undone.

\set ON_ERROR_STOP on
\pset footer off

CREATE TABLE IF NOT EXISTS core.tamper_demo_backup (
    tamper_case text NOT NULL,
    table_name text NOT NULL,
    row_id text NOT NULL,
    column_name text NOT NULL,
    original_value text,
    PRIMARY KEY (tamper_case, table_name, row_id, column_name)
);

-- Restore every backed-up value, then empty the backup table.
\set restore_all 'UPDATE core.properties p SET land_area = b.original_value::numeric FROM core.tamper_demo_backup b WHERE b.table_name = ''properties'' AND b.column_name = ''land_area'' AND p.property_id = b.row_id; UPDATE core.blockchain_transactions t SET from_wallet = b.original_value FROM core.tamper_demo_backup b WHERE b.table_name = ''blockchain_transactions'' AND b.column_name = ''from_wallet'' AND t.blockchain_tx_id = b.row_id::bigint; UPDATE core.blockchain_transactions t SET digital_signature = b.original_value FROM core.tamper_demo_backup b WHERE b.table_name = ''blockchain_transactions'' AND b.column_name = ''digital_signature'' AND t.blockchain_tx_id = b.row_id::bigint; UPDATE core.property_documents d SET document_text = b.original_value FROM core.tamper_demo_backup b WHERE b.table_name = ''property_documents'' AND b.column_name = ''document_text'' AND d.document_id = b.row_id::bigint; DELETE FROM core.tamper_demo_backup;'

\if :{?restore_only}
    SELECT count(*) AS values_to_restore FROM core.tamper_demo_backup;
    :restore_all
    \echo 'Restored all tampered values.'
    \quit
\endif

SELECT count(*) AS leftover FROM core.tamper_demo_backup \gset
\if :leftover
    \echo 'core.tamper_demo_backup still holds values from an interrupted run.'
    \echo 'Run again with -v restore_only=1 first.'
    \quit
\endif

-- Pick the chain head of a property whose head block is confirmed, signed, and
-- has a hashed document. Case (a) needs the head: a registry change only fails
-- the latest block, because older blocks anchor an earlier state.
\if :{?tx}
    SELECT blockchain_tx_id AS btx, transaction_id AS tx, property_id AS prop
    FROM core.blockchain_transactions
    WHERE transaction_id = :'tx'
    ORDER BY blockchain_tx_id DESC
    LIMIT 1 \gset
\else
    WITH heads AS (
        SELECT b.blockchain_tx_id, b.transaction_id, b.property_id,
               row_number() OVER (
                   PARTITION BY b.property_id
                   ORDER BY b.block_number DESC NULLS FIRST,
                            b.block_timestamp DESC NULLS FIRST,
                            b.blockchain_tx_id DESC
               ) AS rn
        FROM core.blockchain_transactions b
        WHERE b.property_id IS NOT NULL
    )
    SELECT h.blockchain_tx_id AS btx, h.transaction_id AS tx, h.property_id AS prop
    FROM heads h
    JOIN core.blockchain_transactions b ON b.blockchain_tx_id = h.blockchain_tx_id
    WHERE h.rn = 1
      AND b.digital_signature IS NOT NULL
      AND upper(coalesce(b.transaction_status, '')) = 'CONFIRMED'
      AND EXISTS (
          SELECT 1 FROM core.property_documents d
          WHERE d.transaction_id = h.transaction_id AND d.document_hash IS NOT NULL
      )
    ORDER BY h.property_id
    LIMIT 1 \gset
\endif

SELECT min(document_id) AS doc
FROM core.property_documents
WHERE transaction_id = :'tx' AND document_hash IS NOT NULL \gset

\echo
\echo 'Demo transaction:' :tx ' property:' :prop ' ledger row:' :btx ' document:' :doc
\echo 'Check it is VALID first:  GET /api/v1/blockchain/verify/':tx
\prompt 'Press Enter to start case (a) ...' _

-- (a) Registry edit: property land_area changed after anchoring.
BEGIN;
INSERT INTO core.tamper_demo_backup
SELECT 'a', 'properties', property_id, 'land_area', land_area::text
FROM core.properties WHERE property_id = :'prop';
UPDATE core.properties SET land_area = coalesce(land_area, 0) + 1 WHERE property_id = :'prop';
COMMIT;
\echo '(a) land_area + 1 on' :prop
\echo '    expect: property_hash_match = false (chain head only), integrity INVALID,'
\echo '            property_changes shows land_area anchored vs current'
\prompt 'Press Enter to restore (a) ...' _
BEGIN;
UPDATE core.properties p SET land_area = b.original_value::numeric
FROM core.tamper_demo_backup b
WHERE b.tamper_case = 'a' AND p.property_id = b.row_id;
DELETE FROM core.tamper_demo_backup WHERE tamper_case = 'a';
COMMIT;

-- (b) Ledger edit: seller wallet changed on the block.
BEGIN;
INSERT INTO core.tamper_demo_backup
SELECT 'b', 'blockchain_transactions', blockchain_tx_id::text, 'from_wallet', from_wallet
FROM core.blockchain_transactions WHERE blockchain_tx_id = :btx;
UPDATE core.blockchain_transactions SET from_wallet = '0xattacker' WHERE blockchain_tx_id = :btx;
COMMIT;
\echo '(b) from_wallet = 0xattacker on' :tx
\echo '    expect: transaction_data_hash_match = false, tx_hash_match = false,'
\echo '            Registry Check SELLER_WALLET fails, AI Investigation HIGH risk'
\prompt 'Press Enter to restore (b) ...' _
BEGIN;
UPDATE core.blockchain_transactions t SET from_wallet = b.original_value
FROM core.tamper_demo_backup b
WHERE b.tamper_case = 'b' AND t.blockchain_tx_id = b.row_id::bigint;
DELETE FROM core.tamper_demo_backup WHERE tamper_case = 'b';
COMMIT;

-- (c) Document edit: one space appended to the deed text.
BEGIN;
INSERT INTO core.tamper_demo_backup
SELECT 'c', 'property_documents', document_id::text, 'document_text', document_text
FROM core.property_documents WHERE document_id = :doc;
UPDATE core.property_documents
SET document_text = coalesce(document_text, '') || ' '
WHERE document_id = :doc;
COMMIT;
\echo '(c) one space appended to document' :doc
\echo '    expect: document_hash_match = false, that document flagged in details.documents'
\prompt 'Press Enter to restore (c) ...' _
BEGIN;
UPDATE core.property_documents d SET document_text = b.original_value
FROM core.tamper_demo_backup b
WHERE b.tamper_case = 'c' AND d.document_id = b.row_id::bigint;
DELETE FROM core.tamper_demo_backup WHERE tamper_case = 'c';
COMMIT;

-- (d) Forged signature: first byte of the registry signature replaced.
BEGIN;
INSERT INTO core.tamper_demo_backup
SELECT 'd', 'blockchain_transactions', blockchain_tx_id::text, 'digital_signature', digital_signature
FROM core.blockchain_transactions WHERE blockchain_tx_id = :btx;
UPDATE core.blockchain_transactions
SET digital_signature = CASE WHEN left(digital_signature, 2) = 'ab' THEN 'cd' ELSE 'ab' END
                        || substr(digital_signature, 3)
WHERE blockchain_tx_id = :btx;
COMMIT;
\echo '(d) digital_signature altered on' :tx
\echo '    expect: digital_signature_valid = false, integrity INVALID (every hash still matches)'
\prompt 'Press Enter to restore (d) ...' _
BEGIN;
UPDATE core.blockchain_transactions t SET digital_signature = b.original_value
FROM core.tamper_demo_backup b
WHERE b.tamper_case = 'd' AND t.blockchain_tx_id = b.row_id::bigint;
DELETE FROM core.tamper_demo_backup WHERE tamper_case = 'd';
COMMIT;

\echo
\echo 'All cases restored.' :tx 'should be VALID again.'
\echo 'Case (e), a "perfect forgery" that recomputes every SHA-256, is case (d) in effect:'
\echo 'the hashes all match, but without the registry private key the signature cannot be re-made.'
