-- PropGuard AI — link every ledger row to its property.
-- Imported blockchain_transactions rows had an empty property_id; the link only existed
-- through property_transactions. Without it no per-property hash chain can form.
-- After running, rebuild ledger hashes (Settings → Update All Hashes).
-- (The rebuild also fills empty property_id values the same way.)

UPDATE core.blockchain_transactions bt
SET property_id = pt.property_id
FROM core.property_transactions pt
WHERE pt.transaction_id = bt.transaction_id
  AND pt.property_id IS NOT NULL
  AND (bt.property_id IS NULL OR trim(bt.property_id) = '');
