from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import HTTPException, status
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Precomputed dummy hash so missing-user logins take a similar amount of time.
_DUMMY_PASSWORD_HASH = pwd_context.hash("propguard-timing-dummy")


def normalize_nic(value: str) -> str:
    return "".join(value.split()).upper()


def normalize_email(value: str) -> str:
    return value.strip().lower()


def hash_nic(value: str) -> str:
    """SHA-256 hex digest of the normalized NIC (never store raw NIC)."""
    return hashlib.sha256(normalize_nic(value).encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str | None) -> bool:
    if not password_hash:
        try:
            pwd_context.verify(plain_password, _DUMMY_PASSWORD_HASH)
        except Exception:
            pass
        return False
    try:
        return bool(pwd_context.verify(plain_password, password_hash))
    except Exception:
        return False


def create_access_token(
    *,
    user_id: str,
    email: str | None,
    access_level: str,
    full_name: str | None,
) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "access_level": access_level,
        "full_name": full_name,
        "iat": int(now.timestamp()),
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if payload.get("type") != "access" or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload
