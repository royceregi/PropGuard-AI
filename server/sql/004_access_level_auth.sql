-- PropGuard AI — migrate auth from role → access_level.
-- access_level values:
--   SYSTEM   = Super Admin
--   REGISTRY = Land Registry
--   COMPANY  = Real Estate Company
--   PUBLIC   = Public user
--   STANDARD = Approved / normal access
--   ELEVATED = Pending admission into the system

-- 1) Ensure access_level exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'access_level'
    ) THEN
        ALTER TABLE core.users ADD COLUMN access_level VARCHAR(50);
    END IF;
END $$;

-- 2) Backfill access_level from legacy role when missing
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'role'
    ) THEN
        UPDATE core.users
        SET access_level = CASE upper(btrim(role))
            WHEN 'SUPER_ADMIN' THEN 'SYSTEM'
            WHEN 'LAND_REGISTRY' THEN 'REGISTRY'
            WHEN 'REAL_ESTATE_COMPANY' THEN 'COMPANY'
            WHEN 'PUBLIC_USER' THEN 'PUBLIC'
            ELSE coalesce(nullif(upper(btrim(access_level)), ''), 'STANDARD')
        END
        WHERE access_level IS NULL
           OR btrim(access_level) = ''
           OR upper(btrim(access_level)) IN (
                'SUPER_ADMIN', 'LAND_REGISTRY', 'REAL_ESTATE_COMPANY', 'PUBLIC_USER'
           );
    END IF;
END $$;

-- Pending / inactive users without an operational level become ELEVATED
UPDATE core.users
SET access_level = 'ELEVATED'
WHERE (is_active IS FALSE OR is_active IS NULL)
  AND (
        access_level IS NULL
        OR btrim(access_level) = ''
        OR upper(btrim(access_level)) IN ('STANDARD', 'PUBLIC')
      )
  AND (
        kyc_status IS NULL
        OR btrim(kyc_status) = ''
        OR upper(btrim(kyc_status)) IN (
            'PENDING', 'PENDING_APPROVAL', 'SUBMITTED', 'UNDER_REVIEW'
        )
      );

UPDATE core.users
SET access_level = 'STANDARD'
WHERE access_level IS NULL OR btrim(access_level) = '';

ALTER TABLE core.users
    ALTER COLUMN access_level TYPE VARCHAR(50),
    ALTER COLUMN access_level SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_access_level ON core.users (access_level);

-- 3) Drop legacy role column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'role'
    ) THEN
        ALTER TABLE core.users DROP COLUMN role;
    END IF;
END $$;

DROP INDEX IF EXISTS core.idx_users_role;
