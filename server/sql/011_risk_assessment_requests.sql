-- PropGuard AI — risk assessment requests (requester → registry → verified result).
-- The API also creates this table on startup via create_all; this script is for
-- environments where schema changes are applied manually.

CREATE TABLE IF NOT EXISTS core.risk_assessment_requests (
    request_id              VARCHAR(32) PRIMARY KEY,
    property_id             TEXT        NOT NULL,
    requester_id            TEXT        NOT NULL,
    requester_access_level  VARCHAR(50) NOT NULL,
    requester_notes         TEXT,
    include_evidence        BOOLEAN     NOT NULL DEFAULT TRUE,
    submitted_snapshot      JSONB       NOT NULL,

    status                  VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED'
        CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED')),
    reviewer_id             TEXT,
    verification_checks     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    risk_score              INTEGER     CHECK (risk_score BETWEEN 0 AND 100),
    risk_level              VARCHAR(20) CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
    registry_notes          TEXT,
    rejection_reason        TEXT,
    system_signals          JSONB,
    result_hash             VARCHAR(64),
    history                 JSONB       NOT NULL DEFAULT '[]'::jsonb,

    submitted_at            TIMESTAMP   NOT NULL DEFAULT NOW(),
    review_started_at       TIMESTAMP,
    completed_at            TIMESTAMP,
    updated_at              TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_risk_requests_property ON core.risk_assessment_requests (property_id);
CREATE INDEX IF NOT EXISTS ix_risk_requests_requester ON core.risk_assessment_requests (requester_id);
CREATE INDEX IF NOT EXISTS ix_risk_requests_status ON core.risk_assessment_requests (status);
