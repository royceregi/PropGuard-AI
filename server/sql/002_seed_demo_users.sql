-- PropGuard AI — demo login accounts (one per access level).
-- Login is email + password. Auth identity is access_level (not role).
-- Prefer: python scripts/seed_demo_users.py (fresh Argon2 hashes).
--
-- Local demo passwords (never used as production credentials):
--   SYSTEM   maria.s@example.com     DemoAdmin#2026
--   REGISTRY ivan.p@example.net       DemoRegistry#2026
--   COMPANY  george.a@example.org     DemoCompany#2026
--   PUBLIC   bob.m@example.net         DemoPublic#2026

INSERT INTO core.users (
    user_id,
    username,
    full_name,
    email,
    phone_number,
    password_hash,
    wallet_address,
    nic_hash,
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
        '0xDEMO000000000000000000000000000000000001',
        '7098fe0f09940dbb61025931572461af221b2aa047c1b9f94ef27677758a74b5',
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
        '0xDEMO000000000000000000000000000000000002',
        'ee45bc504c49d20d54df2538de62e4604c32d41d8480a206d49e5665bf166a81',
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
        '0xDEMO000000000000000000000000000000000003',
        '4afc2976171c63d55916fa7c1ca1d03688981af15b3375a4c6c1b099cd58d922',
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
        '0xDEMO000000000000000000000000000000000004',
        'd7a034981328c0879df6124d9d3697ae995fa89c27d5f5db2d0fa3c6d0963dcd',
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
    wallet_address = EXCLUDED.wallet_address,
    nic_hash = EXCLUDED.nic_hash,
    kyc_status = EXCLUDED.kyc_status,
    access_level = EXCLUDED.access_level,
    mfa_enabled = EXCLUDED.mfa_enabled,
    is_active = EXCLUDED.is_active;
