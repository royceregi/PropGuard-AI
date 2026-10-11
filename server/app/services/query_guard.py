"""Shared access guard for natural-language queries (AI assistant and Evidence Retrieval).

Both entry points must apply the same rules:
- Authority users (SYSTEM / REGISTRY / COMPANY) search everything (scope None).
- PUBLIC users search only their own + shared properties. An empty set means "nothing",
  never "unrestricted".
- Identifiers in the question (transaction ID, property ID, title deed) that the user cannot
  access are reported, so callers can refuse instead of answering around them.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.core.roles import AccessLevel, normalize_access_level
from app.models.property import Property
from app.models.user import User as UserModel
from app.repositories import property_repository
from app.services.retrieval_service import ParsedQuery, parse_query

AUTHORITY_LEVELS = {
    AccessLevel.SYSTEM.value,
    AccessLevel.REGISTRY.value,
    AccessLevel.COMPANY.value,
}


@dataclass
class QueryGuard:
    parsed: ParsedQuery
    property_scope: set[str] | None
    unauthorized: list[str] = field(default_factory=list)

    @property
    def restricted_message(self) -> str:
        return (
            "Access Restricted: You are authorized to query properties and transactions "
            "associated with your account. The identifier "
            f"'{', '.join(self.unauthorized)}' is not linked to your registered or shared "
            "property records."
        )


def property_scope_for(db: Session, user: UserModel) -> set[str] | None:
    level = normalize_access_level(user.access_level)
    if level in AUTHORITY_LEVELS:
        return None
    if level == AccessLevel.PUBLIC.value:
        return property_repository.accessible_property_ids_for_user(db, user.user_id)
    return set()


def guard_query(db: Session, user: UserModel, question: str) -> QueryGuard:
    parsed = parse_query(question)
    scope = property_scope_for(db, user)
    if scope is None:
        return QueryGuard(parsed=parsed, property_scope=None)

    unauthorized = [pid for pid in parsed.property_ids if pid not in scope]
    if parsed.title_deeds:
        allowed_deeds = {
            (deed or "").upper()
            for (deed,) in db.query(Property.title_deed_number)
            .filter(Property.property_id.in_(scope))
            .all()
        }
        unauthorized += [d for d in parsed.title_deeds if d not in allowed_deeds]
    unauthorized += [
        tid
        for tid in parsed.transaction_ids
        if not property_repository.user_can_access_transaction(db, user.user_id, tid)
    ]
    return QueryGuard(parsed=parsed, property_scope=scope, unauthorized=unauthorized)
