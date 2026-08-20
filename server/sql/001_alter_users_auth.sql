-- PropGuard AI — users table for NIC + password authentication
-- Target: property_db.core.users
-- Replaces nic_hash with nic (UNIQUE, NOT NULL) and tightens login columns.

CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE IF NOT EXISTS core.users (
    user_id         TEXT PRIMARY KEY,
    username        VARCHAR(100) UNIQUE,
    full_name       VARCHAR(255),
    email           VARCHAR(255),
    phone_number    VARCHAR(50),
    password_hash   TEXT,
    nic             VARCHAR(100),
    role            VARCHAR(50),
    wallet_address  VARCHAR(255),
    kyc_status      VARCHAR(50),
    access_level    VARCHAR(50),
    mfa_enabled     BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login      TIMESTAMP WITHOUT TIME ZONE
);

-- Align legacy column names from earlier snapshots.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'name'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE core.users RENAME COLUMN name TO full_name;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'contact'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE core.users RENAME COLUMN contact TO phone_number;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'nic_hash'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'nic'
        ) THEN
            UPDATE core.users
            SET nic = COALESCE(NULLIF(btrim(nic), ''), nic_hash)
            WHERE nic IS NULL OR btrim(nic) = '';
            ALTER TABLE core.users DROP COLUMN nic_hash;
        ELSE
            ALTER TABLE core.users RENAME COLUMN nic_hash TO nic;
        END IF;
    END IF;
END $$;

ALTER TABLE core.users
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN nic TYPE VARCHAR(100),
    ALTER COLUMN password_hash TYPE TEXT,
    ALTER COLUMN role TYPE VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS users_nic_key ON core.users (nic);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON core.users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON core.users (username);
CREATE INDEX IF NOT EXISTS idx_users_role ON core.users (role);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_role_check'
          AND conrelid = 'core.users'::regclass
    ) THEN
        ALTER TABLE core.users
            ADD CONSTRAINT users_role_check
            CHECK (role IN ('SUPER_ADMIN', 'LAND_REGISTRY', 'REAL_ESTATE_COMPANY', 'PUBLIC_USER'));
    END IF;
END $$;
