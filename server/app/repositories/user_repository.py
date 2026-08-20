from sqlalchemy.orm import Session

from app.core.security import hash_password, normalize_nic
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


def get_user(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.user_id == user_id).first()


def get_user_by_nic(db: Session, nic: str) -> User | None:
    return db.query(User).filter(User.nic == normalize_nic(nic)).first()


def get_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return db.query(User).offset(skip).limit(limit).all()


def create_user(db: Session, user: UserCreate) -> User:
    payload = user.model_dump(exclude={"password"})
    payload["nic"] = normalize_nic(payload["nic"])
    payload["role"] = user.role.value if hasattr(user.role, "value") else str(user.role)
    db_user = User(**payload, password_hash=hash_password(user.password))
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: str, user: UserUpdate) -> User | None:
    db_user = get_user(db, user_id)
    if not db_user:
        return None

    data = user.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    if "nic" in data and data["nic"] is not None:
        data["nic"] = normalize_nic(data["nic"])
    if "role" in data and data["role"] is not None:
        role = data["role"]
        data["role"] = role.value if hasattr(role, "value") else str(role)
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
