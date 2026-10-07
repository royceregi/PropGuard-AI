-- PropGuard AI — PostgreSQL full-text search for the Information Retrieval Agent (Phase 5).
-- Expression GIN indexes only: the frozen core tables are not altered.
-- The expressions must stay identical to the *_TSV constants in app/services/retrieval_service.py,
-- otherwise PostgreSQL will not use these indexes.
--
-- Apply:  psql "$DATABASE_URL" -f sql/013_full_text_search.sql

CREATE INDEX IF NOT EXISTS idx_documents_fts
    ON core.property_documents
    USING gin (to_tsvector('english'::regconfig, coalesce(document_text, '')));

CREATE INDEX IF NOT EXISTS idx_properties_fts
    ON core.properties
    USING gin (to_tsvector('english'::regconfig,
        coalesce(property_name, '') || ' ' || coalesce(address, '') || ' ' ||
        coalesce(district, '') || ' ' || coalesce(city, '') || ' ' ||
        coalesce(land_type, '') || ' ' || coalesce(current_usage_type, '') || ' ' ||
        coalesce(legal_status, '') || ' ' || coalesce(encumbrances, '')));

CREATE INDEX IF NOT EXISTS idx_transactions_fts
    ON core.property_transactions
    USING gin (to_tsvector('english'::regconfig,
        coalesce(procedure_name, '') || ' ' || coalesce(area_name, '') || ' ' ||
        coalesce(project_name, '') || ' ' || coalesce(master_project, '') || ' ' ||
        coalesce(nearest_landmark, '')));

-- Retrieval history and analytics read the newest queries per agent.
CREATE INDEX IF NOT EXISTS idx_query_logs_agent_time
    ON core.query_logs (agent_used, log_timestamp DESC);
