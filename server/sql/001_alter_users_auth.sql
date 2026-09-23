-- PropGuard AI — align core.users to email login + nic_hash schema.
-- Target: property_db.core.users
--
-- Columns:
--   user_id, username, full_name, email, phone_number, password_hash,
--   role, wallet_address, nic_hash, kyc_status, access_level,
--   mfa_enabled, is_active, created_at, last_login

CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE IF NOT EXISTS core.users (
    user_id         TEXT PRIMARY KEY,
    username        VARCHAR(100) UNIQUE,
    full_name       VARCHAR(255),
    email           VARCHAR(255),
    phone_number    VARCHAR(50),
    password_hash   TEXT,
    role            VARCHAR(50),
    wallet_address  VARCHAR(255),
    nic_hash        VARCHAR(64),
    kyc_status      VARCHAR(50),
    access_level    VARCHAR(50),
    mfa_enabled     BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login      TIMESTAMP WITHOUT TIME ZONE
);

DO $$
BEGIN
    -- Legacy renames
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

    -- Prefer nic_hash; if only nic exists, rename it.
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'nic'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'nic_hash'
    ) THEN
        ALTER TABLE core.users RENAME COLUMN nic TO nic_hash;
    END IF;

    -- If both exist, drop plain nic (hashes should already be in nic_hash).
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'nic'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'nic_hash'
    ) THEN
        ALTER TABLE core.users DROP COLUMN nic;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'nic_hash'
    ) THEN
        ALTER TABLE core.users ADD COLUMN nic_hash VARCHAR(64);
    END IF;
END $$;

ALTER TABLE core.users
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN nic_hash TYPE VARCHAR(64),
    ALTER COLUMN password_hash TYPE TEXT,
    ALTER COLUMN role TYPE VARCHAR(50),
    ALTER COLUMN email TYPE VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON core.users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON core.users (username);
CREATE INDEX IF NOT EXISTS idx_users_nic_hash ON core.users (nic_hash);
CREATE INDEX IF NOT EXISTS idx_users_role ON core.users (role);
CREATE INDEX IF NOT EXISTS idx_users_email ON core.users (email);
