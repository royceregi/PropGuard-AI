-- PropGuard AI — remove property coordinates (no longer stored or hashed).
-- The canonical property payload never included latitude/longitude, so no
-- ledger rebuild is needed after running this.
--
-- Existing values are kept in core.property_coordinates_backup. Rollback:
--   ALTER TABLE core.properties
--       ADD COLUMN latitude numeric(12,8), ADD COLUMN longitude numeric(12,8);
--   UPDATE core.properties p SET latitude = b.latitude, longitude = b.longitude
--     FROM core.property_coordinates_backup b WHERE b.property_id = p.property_id;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'properties'
          AND column_name = 'latitude'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'core' AND table_name = 'property_coordinates_backup'
    ) THEN
        EXECUTE 'CREATE TABLE core.property_coordinates_backup AS
                 SELECT property_id, latitude, longitude, now() AS backed_up_at
                 FROM core.properties
                 WHERE latitude IS NOT NULL OR longitude IS NOT NULL';
    END IF;
END $$;

ALTER TABLE core.properties
    DROP COLUMN IF EXISTS latitude,
    DROP COLUMN IF EXISTS longitude;
