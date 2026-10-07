-- PropGuard AI — customer commercial subscription plans & payment status.
-- Target: property_db.core.users
--
-- Columns added:
--   payment_status           VARCHAR(50) DEFAULT 'PENDING' NOT NULL
--   subscription_status      VARCHAR(50) DEFAULT 'NONE' NOT NULL
--   subscription_plan        VARCHAR(50) NULL
--   subscription_start_date  TIMESTAMP WITHOUT TIME ZONE NULL
--   subscription_end_date    TIMESTAMP WITHOUT TIME ZONE NULL

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE core.users ADD COLUMN payment_status VARCHAR(50) DEFAULT 'PENDING';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'subscription_status'
    ) THEN
        ALTER TABLE core.users ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'NONE';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'subscription_plan'
    ) THEN
        ALTER TABLE core.users ADD COLUMN subscription_plan VARCHAR(50);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'subscription_start_date'
    ) THEN
        ALTER TABLE core.users ADD COLUMN subscription_start_date TIMESTAMP WITHOUT TIME ZONE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'core' AND table_name = 'users' AND column_name = 'subscription_end_date'
    ) THEN
        ALTER TABLE core.users ADD COLUMN subscription_end_date TIMESTAMP WITHOUT TIME ZONE;
    END IF;
END $$;

-- Default existing active operational users to PAID and ACTIVE so demo/system access continues seamlessly
UPDATE core.users
SET payment_status = 'PAID',
    subscription_status = 'ACTIVE',
    subscription_plan = 'YEARLY',
    subscription_start_date = CURRENT_TIMESTAMP,
    subscription_end_date = CURRENT_TIMESTAMP + INTERVAL '1 year'
WHERE (payment_status IS NULL OR payment_status = 'PENDING')
  AND is_active IS TRUE
  AND upper(btrim(access_level)) IN ('SYSTEM', 'REGISTRY', 'COMPANY');

-- Default existing active public users to PAID and ACTIVE for backward compatibility
UPDATE core.users
SET payment_status = 'PAID',
    subscription_status = 'ACTIVE',
    subscription_plan = 'MONTHLY',
    subscription_start_date = CURRENT_TIMESTAMP,
    subscription_end_date = CURRENT_TIMESTAMP + INTERVAL '1 month'
WHERE (payment_status IS NULL OR payment_status = 'PENDING')
  AND is_active IS TRUE
  AND upper(btrim(access_level)) = 'PUBLIC'
  AND user_id = 'SYS000004';

-- Ensure all remaining NULLs get default state
UPDATE core.users
SET payment_status = 'PENDING'
WHERE payment_status IS NULL;

UPDATE core.users
SET subscription_status = 'NONE'
WHERE subscription_status IS NULL;

ALTER TABLE core.users
    ALTER COLUMN payment_status SET DEFAULT 'PENDING',
    ALTER COLUMN payment_status SET NOT NULL,
    ALTER COLUMN subscription_status SET DEFAULT 'NONE',
    ALTER COLUMN subscription_status SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_payment_status ON core.users (payment_status);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON core.users (subscription_status);

