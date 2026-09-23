from __future__ import annotations

from sqlalchemy import false, func, or_
from sqlalchemy.orm import Session

from app.core.roles import AccessLevel, normalize_access_level
from app.core.security import hash_nic, hash_password, normalize_email
from app.models.user import User
from app.schemas.user import UserCreate, UserStats, UserUpdate

APPROVED_KYC = ("VERIFIED", "APPROVED")
PENDING_KYC = ("PENDING", "PENDING_APPROVAL", "SUBMITTED", "UNDER_REVIEW")
PUBLIC_LEVELS = (
    AccessLevel.PUBLIC.value,
    AccessLevel.STANDARD.value,
    AccessLevel.ELEVATED.value,
)
REGISTRY_VISIBLE_LEVELS = (
    AccessLevel.REGISTRY.value,
    AccessLevel.PUBLIC.value,
    AccessLevel.STANDARD.value,
    AccessLevel.ELEVATED.value,
)
COMPANY_VISIBLE_LEVELS = (
    AccessLevel.PUBLIC.value,
    AccessLevel.STANDARD.value,
    AccessLevel.ELEVATED.value,
)


def visible_access_levels_for(actor_level: str | None) -> list[str] | None:
    """
    None = unrestricted (SYSTEM).
    Empty list = no directory access.
    """
    level = normalize_access_level(actor_level)
    if level == AccessLevel.SYSTEM.value:
        return None
    if level == AccessLevel.REGISTRY.value:
        return list(REGISTRY_VISIBLE_LEVELS)
    if level == AccessLevel.COMPANY.value:
        return list(COMPANY_VISIBLE_LEVELS)
    return []


def _scoped_users_query(db: Session, actor_level: str | None):
    query = db.query(User)
    allowed = visible_access_levels_for(actor_level)
    if allowed is None:
        return query
    if not allowed:
        return query.filter(false())
    return query.filter(func.upper(User.access_level).in_(allowed))


def actor_can_view_user(actor_level: str | None, target: User | None) -> bool:
    if target is None:
        return False
    allowed = visible_access_levels_for(actor_level)
    if allowed is None:
        return True
    target_level = normalize_access_level(target.access_level)
    return bool(target_level and target_level in allowed)


def get_user(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.user_id == user_id).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    return (
        db.query(User)
        .filter(func.lower(User.email) == normalize_email(email))
        .first()
    )


def get_user_by_nic_hash(db: Session, nic_hash: str) -> User | None:
    return db.query(User).filter(User.nic_hash == nic_hash).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_users(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    *,
    actor_access_level: str | None = None,
) -> list[User]:
    return (
        _scoped_users_query(db, actor_access_level)
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_user_stats(db: Session, *, actor_access_level: str | None = None) -> UserStats:
    def scoped():
        return _scoped_users_query(db, actor_access_level)

    total_users = scoped().with_entities(func.count(User.user_id)).scalar() or 0
    approved_users = (
        scoped()
        .filter(User.is_active.is_(True))
        .with_entities(func.count(User.user_id))
        .scalar()
        or 0
    )
    pending_approval = (
        scoped()
        .filter(
            or_(
                User.is_active.is_(False),
                func.upper(User.access_level) == AccessLevel.ELEVATED.value,
                User.kyc_status.is_(None),
                func.btrim(User.kyc_status) == "",
                func.upper(User.kyc_status).in_(PENDING_KYC),
            )
        )
        .with_entities(func.count(User.user_id))
        .scalar()
        or 0
    )
    public_users = (
        scoped()
        .filter(func.upper(User.access_level).in_(PUBLIC_LEVELS))
        .with_entities(func.count(User.user_id))
        .scalar()
        or 0
    )
    return UserStats(
        total_users=int(total_users),
        approved_users=int(approved_users),
        pending_approval=int(pending_approval),
        public_users=int(public_users),
    )


def create_user(
    db: Session,
    user: UserCreate,
    *,
    require_approval: bool = False,
) -> User:
    email = normalize_email(str(user.email))
    nic_digest = hash_nic(user.nic)

    if get_user_by_email(db, email) is not None:
        raise ValueError("Email already registered")
    if get_user_by_nic_hash(db, nic_digest) is not None:
        raise ValueError("NIC already registered")
    if get_user_by_username(db, user.username) is not None:
        raise ValueError("Username already taken")

    level = normalize_access_level(
        user.access_level.value if hasattr(user.access_level, "value") else str(user.access_level)
    ) or AccessLevel.STANDARD.value

    payload = user.model_dump(
        exclude={
            "password",
            "user_id",
            "nic",
            "kyc_status",
            "is_active",
            "access_level",
        }
    )
    payload["email"] = email
    payload["nic_hash"] = nic_digest
    payload["user_id"] = user.user_id or f"USR{email[:8].upper()}"
    payload["access_level"] = level
    payload["mfa_enabled"] = bool(user.mfa_enabled)

    if require_approval:
        payload["kyc_status"] = "PENDING_APPROVAL"
        payload["is_active"] = False
        payload["access_level"] = AccessLevel.ELEVATED.value
    else:
        payload["kyc_status"] = user.kyc_status or "VERIFIED"
        payload["is_active"] = True if user.is_active is None else bool(user.is_active)

    if get_user(db, payload["user_id"]) is not None:
        raise ValueError("User already exists")

    db_user = User(**payload, password_hash=hash_password(user.password))
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def set_user_active(db: Session, user_id: str, is_active: bool) -> User | None:
    """Toggle is_active only — does not grant or revoke access_level."""
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    db_user.is_active = is_active
    if is_active and (
        (db_user.kyc_status or "").strip().upper() in PENDING_KYC or not db_user.kyc_status
    ):
        db_user.kyc_status = "VERIFIED"
    db.commit()
    db.refresh(db_user)
    return db_user


def set_user_access_level(db: Session, user_id: str, access_level: str) -> User | None:
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    level = normalize_access_level(access_level)
    if not level:
        raise ValueError("Invalid access level")
    db_user.access_level = level
    # Approving to PUBLIC grants a usable account flag; is_active alone is not enough.
    if level == AccessLevel.PUBLIC.value:
        db_user.is_active = True
        if (db_user.kyc_status or "").strip().upper() in PENDING_KYC or not db_user.kyc_status:
            db_user.kyc_status = "VERIFIED"
    db.commit()
    db.refresh(db_user)
    return db_user


def approve_user(db: Session, user_id: str) -> User | None:
    """Super-admin admission: pending → public with access."""
    return set_user_access_level(db, user_id, AccessLevel.PUBLIC.value)


def reject_user(db: Session, user_id: str) -> User | None:
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    db_user.kyc_status = "REJECTED"
    db_user.is_active = False
    db_user.access_level = AccessLevel.ELEVATED.value
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: str, user: UserUpdate) -> User | None:
    db_user = get_user(db, user_id)
    if not db_user:
        return None

    data = user.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    raw_nic = data.pop("nic", None)
    if raw_nic is not None:
        data["nic_hash"] = hash_nic(raw_nic)
    if "email" in data and data["email"] is not None:
        data["email"] = normalize_email(str(data["email"]))
    if "access_level" in data and data["access_level"] is not None:
        level = data["access_level"]
        data["access_level"] = normalize_access_level(
            level.value if hasattr(level, "value") else str(level)
        )
    for key, value in data.items():
        setattr(db_user, key, value)
    if password:
        db_user.password_hash = hash_password(password)

    db.commit()
    db.refresh(db_user)
    return db_user


def delete_user(db: Session, user_id: str) -> User | None:
    db_user = get_user(db, user_id)
    if db_user:
        db.delete(db_user)
        db.commit()
    return db_user
