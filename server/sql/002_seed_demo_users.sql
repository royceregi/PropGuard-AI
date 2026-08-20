-- PropGuard AI — demo login accounts (one per role).
-- Passwords are Argon2id hashes generated locally. Raw dataset hashes are not reused.
--
-- Local demo passwords (never used as production credentials):
--   SUPER_ADMIN         NIC 900000001V   password DemoAdmin#2026
--   LAND_REGISTRY       NIC 900000002V   password DemoRegistry#2026
--   REAL_ESTATE_COMPANY NIC 900000003V   password DemoCompany#2026
--   PUBLIC_USER         NIC 900000004V   password DemoPublic#2026

INSERT INTO core.users (
    user_id,
    username,
    full_name,
    email,
    phone_number,
    password_hash,
    nic,
    role,
    wallet_address,
    kyc_status,
    access_level,
    mfa_enabled,
    is_active,
    created_at
) VALUES
    (
        'SYS000001',
        'superadmin',
        'PropGuard Super Admin',
        'maria.s@example.com',
        '+971-50-000-0001',
        '$argon2id$v=19$m=65536,t=3,p=4$dy5FiHEOYey9F4JwDmFsrQ$dQfKku1LDJ2ETEqNJSHjP2SoBBQtRw7SSNiACkfTrSI',
        '900000001V',
        'SUPER_ADMIN',
        '0xDEMO000000000000000000000000000000000001',
        'VERIFIED',
        'SYSTEM',
        FALSE,
        TRUE,
        CURRENT_TIMESTAMP
    ),
    (
        'SYS000002',
        'landregistry',
        'Dubai Land Registry Officer',
        'ivan.p@example.net',
        '+971-50-000-0002',
        '$argon2id$v=19$m=65536,t=3,p=4$UmrtvVcqpbRWCuEc41wrRQ$td7fknyQ9ymm4I+XqCG0MhLwiby6ZQczGkdUGBET40M',
        '900000002V',
        'LAND_REGISTRY',
        '0xDEMO000000000000000000000000000000000002',
        'VERIFIED',
        'REGISTRY',
        FALSE,
        TRUE,
        CURRENT_TIMESTAMP
    ),
    (
        'SYS000003',
        'realestate',
        'Gulf Property Verification Desk',
        'george.a@example.org',
        '+971-50-000-0003',
        '$argon2id$v=19$m=65536,t=3,p=4$HWPs/b93DsGYU8qZM2aMMQ$gtp8BCaOdufTYRjfYUX3f4ogvu9wL8YahckXfGU+8II',
        '900000003V',
        'REAL_ESTATE_COMPANY',
        '0xDEMO000000000000000000000000000000000003',
        'VERIFIED',
        'COMPANY',
        FALSE,
        TRUE,
        CURRENT_TIMESTAMP
    ),
    (
        'SYS000004',
        'publicuser',
        'Public Property Holder',
        'bob.m@example.net',
        '+971-50-000-0004',
        '$argon2id$v=19$m=65536,t=3,p=4$JSREqLV27j0npFSqtRbCeA$Th8itsaW4ie2LagHpEoILKx10K9I8D7HXH7EhbOPdV8',
        '900000004V',
        'PUBLIC_USER',
        '0xDEMO000000000000000000000000000000000004',
        'VERIFIED',
        'PUBLIC',
        FALSE,
        TRUE,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone_number = EXCLUDED.phone_number,
    password_hash = EXCLUDED.password_hash,
    nic = EXCLUDED.nic,
    role = EXCLUDED.role,
    wallet_address = EXCLUDED.wallet_address,
    kyc_status = EXCLUDED.kyc_status,
    access_level = EXCLUDED.access_level,
    mfa_enabled = EXCLUDED.mfa_enabled,
    is_active = TRUE;

-- Enforce login-required columns after demo rows exist.
ALTER TABLE core.users
    ALTER COLUMN nic SET NOT NULL,
    ALTER COLUMN password_hash SET NOT NULL,
    ALTER COLUMN role SET NOT NULL;

ALTER TABLE core.users
    ALTER COLUMN mfa_enabled SET DEFAULT FALSE,
    ALTER COLUMN is_active SET DEFAULT TRUE,
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
