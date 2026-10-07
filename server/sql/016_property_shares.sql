-- 016_property_shares.sql
-- Phase 8a: Seller -> buyer property sharing table

CREATE TABLE IF NOT EXISTS core.property_shares (
    share_id VARCHAR(36) PRIMARY KEY,
    property_id VARCHAR(255) NOT NULL,
    owner_user_id VARCHAR(255) NOT NULL,
    buyer_user_id VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    revoked_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_property_shares_property ON core.property_shares(property_id);
CREATE INDEX IF NOT EXISTS idx_property_shares_buyer ON core.property_shares(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_property_shares_owner ON core.property_shares(owner_user_id);

