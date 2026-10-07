from __future__ import annotations

from typing import Any

from sqlalchemy import false, func, or_
from sqlalchemy.orm import Session

from app.core.roles import AccessLevel, normalize_access_level
from app.core.security import hash_nic, hash_password, normalize_email
from app.models.user import User
from app.schemas.user import UserStats, UserUpdate

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
    return db.query(User).filter(func.lower(User.email) == normalize_email(email)).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


USER_SORT_COLUMNS = {
    "full_name": func.lower(User.full_name),
    "user_id": User.user_id,
    "email": func.lower(User.email),
    "access_level": func.upper(User.access_level),
    "is_active": User.is_active,
    "created_at": User.created_at,
    "last_login": User.last_login,
}


def get_users(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    *,
    actor_access_level: str | None = None,
    search: str | None = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
) -> list[User]:
    query = _scoped_users_query(db, actor_access_level)

    term = (search or "").strip()
    if term:
        escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        query = query.filter(
            or_(
                *(
                    column.ilike(pattern, escape="\\")
                    for column in (
                        User.full_name,
                        User.username,
                        User.user_id,
                        User.email,
                        User.phone_number,
                    )
                )
            )
        )

    column = USER_SORT_COLUMNS.get(sort_by, User.created_at)
    ordered = column.asc() if sort_dir == "asc" else column.desc()
    return query.order_by(ordered.nulls_last(), User.user_id.asc()).offset(skip).limit(limit).all()


def get_user_stats(db: Session, *, actor_access_level: str | None = None) -> UserStats:
    def scoped():
        return _scoped_users_query(db, actor_access_level)

    total_users = scoped().with_entities(func.count(User.user_id)).scalar() or 0
    approved_users = (
        scoped().filter(User.is_active.is_(True)).with_entities(func.count(User.user_id)).scalar()
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


def confirm_subscription(db: Session, user_id: str, plan: Any) -> User | None:
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    from app.core.plans import PaymentStatus, SubscriptionStatus, calculate_subscription_end_date

    plan_str = plan.value if hasattr(plan, "value") else str(plan)
    db_user.subscription_plan = plan_str
    db_user.payment_status = PaymentStatus.PAID.value
    db_user.subscription_status = SubscriptionStatus.ACTIVE.value
    db_user.subscription_end_date = calculate_subscription_end_date(plan_str)
    db.commit()
    db.refresh(db_user)
    return db_user
