-- PropGuard AI — Reset Admin User password to DemoAdmin#2026
-- Target: property_db.core.users

-- Keep this recovery migration safe when the subscription migration was not
-- applied yet. The application model selects these columns during login.
ALTER TABLE core.users
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50),
    ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITHOUT TIME ZONE,
    ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITHOUT TIME ZONE;

UPDATE core.users
SET payment_status = COALESCE(payment_status, 'PENDING'),
    subscription_status = COALESCE(subscription_status, 'NONE')
WHERE payment_status IS NULL
   OR subscription_status IS NULL;

UPDATE core.users
SET password_hash = '$argon2id$v=19$m=65536,t=3,p=4$oxRCCMGYcw4BoLR2jnGuNQ$DpLrf6iYzKOKldmmCHW9lfxulhHWO/9U7D0aZubvtrg',
    is_active = TRUE,
    access_level = 'SYSTEM',
    kyc_status = 'VERIFIED'
WHERE user_id = 'SYS000001'
   OR lower(email) = 'maria.s@example.com'
   OR username = 'superadmin';
