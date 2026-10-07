"""Re-hash and upsert the four local demo login accounts (access_level auth)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.database import SessionLocal
from app.core.roles import AccessLevel
from app.core.security import hash_nic, hash_password
from app.models.user import User
from sqlalchemy.orm import Session

DEMO_USERS = (
    {
        "user_id": "SYS000001",
        "username": "superadmin",
        "full_name": "PropGuard Super Admin",
        "email": "maria.s@example.com",
        "phone_number": "+971-50-000-0001",
        "password": "DemoAdmin#2026",
        "nic": "900000001V",
        "wallet_address": "0xDEMO000000000000000000000000000000000001",
        "kyc_status": "VERIFIED",
        "access_level": AccessLevel.SYSTEM.value,
    },
    {
        "user_id": "SYS000002",
        "username": "landregistry",
        "full_name": "Dubai Land Registry Officer",
        "email": "ivan.p@example.net",
        "phone_number": "+971-50-000-0002",
        "password": "DemoRegistry#2026",
        "nic": "900000002V",
        "wallet_address": "0xDEMO000000000000000000000000000000000002",
        "kyc_status": "VERIFIED",
        "access_level": AccessLevel.REGISTRY.value,
    },
    {
        "user_id": "SYS000003",
        "username": "realestate",
        "full_name": "Gulf Property Verification Desk",
        "email": "george.a@example.org",
        "phone_number": "+971-50-000-0003",
        "password": "DemoCompany#2026",
        "nic": "900000003V",
        "wallet_address": "0xDEMO000000000000000000000000000000000003",
        "kyc_status": "VERIFIED",
        "access_level": AccessLevel.COMPANY.value,
    },
    {
        "user_id": "SYS000004",
        "username": "publicuser",
        "full_name": "Public Property Holder",
        "email": "bob.m@example.net",
        "phone_number": "+971-50-000-0004",
        "password": "DemoPublic#2026",
        "nic": "900000004V",
        "wallet_address": "0xDEMO000000000000000000000000000000000004",
        "kyc_status": "VERIFIED",
        "access_level": AccessLevel.PUBLIC.value,
    },
)


def upsert_demo_users(db: Session) -> None:
    for row in DEMO_USERS:
        password = row["password"]
        nic = row["nic"]
        payload = {key: value for key, value in row.items() if key not in {"password", "nic"}}
        payload["email"] = str(payload["email"]).strip().lower()
        payload["nic_hash"] = hash_nic(str(nic))
        payload["password_hash"] = hash_password(str(password))
        payload["mfa_enabled"] = False
        payload["is_active"] = True

        existing = db.query(User).filter(User.user_id == payload["user_id"]).first()
        if existing is None:
            db.add(User(**payload))
            continue
        for key, value in payload.items():
            setattr(existing, key, value)
    db.commit()


if __name__ == "__main__":
    session = SessionLocal()
    try:
        upsert_demo_users(session)
        print("Demo users upserted (access_level auth + Argon2 passwords).")
    finally:
        session.close()
