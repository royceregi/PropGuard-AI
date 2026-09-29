-- PropGuard AI — anchored property snapshots (content-addressed by property_hash).
-- Lets verification tell a tampered snapshot apart from a legitimate registry change,
-- and show which fields changed since a transaction was anchored.
-- The server also creates this table at startup (Base.metadata.create_all).
-- After running, rebuild ledger hashes (Settings → Update All Hashes) to populate it.

CREATE TABLE IF NOT EXISTS core.property_snapshots (
    property_hash VARCHAR(64) PRIMARY KEY,
    property_id   TEXT,
    payload       JSONB NOT NULL,
    created_at    TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_core_property_snapshots_property_id
    ON core.property_snapshots (property_id);
