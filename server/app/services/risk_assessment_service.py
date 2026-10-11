"""Risk assessment workflow: requester submits → registry reviews/verifies → result shared.

Visibility is property-level: requesters only ever see requests for properties they own
or that were shared with them, and only their own in-progress requests. Verified results
are visible to everyone with access to the property.
"""

from __future__ import annotations

import hashlib
import html
import json
import logging
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import and_, not_, or_
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.core.roles import AccessLevel, normalize_access_level
from app.models.property import (
    BlockchainTransaction,
    Property,
    PropertyDocument,
    PropertyOwnershipHistory,
)
from app.models.risk_assessment import RiskAssessmentRequest
from app.models.user import User
from app.repositories import property_repository
from app.schemas.risk_assessment import VERIFICATION_SECTIONS
from app.services import blockchain_hash_service

logger = logging.getLogger(__name__)

REQUESTER_LEVELS = {AccessLevel.PUBLIC.value, AccessLevel.COMPANY.value}
REGISTRY_LEVEL = AccessLevel.REGISTRY.value

SUBMITTED = "SUBMITTED"
UNDER_REVIEW = "UNDER_REVIEW"
VERIFIED = "VERIFIED"
REJECTED = "REJECTED"
# Not a stored status: a VERIFIED request with at least one section marked as an issue.
ISSUES_FOUND = "ISSUES_FOUND"
ACTIVE_STATUSES = {SUBMITTED, UNDER_REVIEW}

SNAPSHOT_SECTIONS: dict[str, tuple[str, ...]] = {
    "property_details": (
        "property_name",
        "address",
        "district",
        "city",
        "land_area",
        "area_unit",
        "land_type",
        "current_usage_type",
        "current_subtype",
        "legal_status",
        "verification_status",
        "encumbrances",
    ),
    "title_records": ("title_deed_number", "survey_plan_number", "documents"),
    "boundaries": ("boundary_north", "boundary_south", "boundary_east", "boundary_west"),
    "owner_details": ("current_owner_id", "current_owner_name", "ownership_history"),
}

_CLEAR_ENCUMBRANCE = {"", "none", "nil", "n/a", "na", "-", "no", "no encumbrances", "clear"}
_ADVERSE_LEGAL = (
    "DISPUT",
    "LITIG",
    "FROZEN",
    "SUSPEND",
    "CAVEAT",
    "COURT",
    "SEIZ",
    "FRAUD",
    "BLOCK",
)
_VERIFIED_WORDS = ("VERIF", "APPROV", "CONFIRM")
_BAD_DOCUMENT = ("REJECT", "INVALID", "FAIL", "FORG")


# --------------------------------------------------------------------------- helpers


def _level(user: User) -> str:
    return normalize_access_level(user.access_level) or ""


def _now() -> datetime:
    return datetime.now()


def _jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _title(prop: Property | None, snapshot: dict[str, Any] | None = None) -> str | None:
    source = snapshot or {}
    for value in (
        prop.property_name if prop else source.get("property_name"),
        prop.title_deed_number if prop else source.get("title_deed_number"),
    ):
        if _text(value):
            return _text(value)
    return None


def _location(prop: Property) -> str | None:
    parts = [_text(prop.address), _text(prop.district), _text(prop.city)]
    joined = ", ".join(part for part in parts if part)
    return joined or None


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Risk assessment request not found")


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def _add_history(
    req: RiskAssessmentRequest, new_status: str, user: User, note: str | None = None
) -> None:
    events = list(req.history or [])
    events.append(
        {
            "status": new_status,
            "at": _now().isoformat(),
            "by": user.user_id,
            "note": note,
        }
    )
    req.history = events
    flag_modified(req, "history")


def level_for_score(score: int) -> str:
    if score <= 33:
        return "LOW"
    if score <= 66:
        return "MEDIUM"
    return "HIGH"


def access_map_for_user(db: Session, user_id: str) -> dict[str, str]:
    """property_id → OWNER (current owner) or SHARED (history / transaction party / active share)."""
    owned, history, party = property_repository.property_access_sets(db, user_id)
    shared_active = property_repository.active_shared_property_ids_for_user(db, user_id)
    access = {pid: "SHARED" for pid in history | party | shared_active}
    access.update({pid: "OWNER" for pid in owned})
    return access


# --------------------------------------------------------------------------- snapshots


def build_property_snapshot(db: Session, prop: Property) -> dict[str, Any]:
    owner = (
        db.query(User).filter(User.user_id == prop.current_owner_id).first()
        if prop.current_owner_id
        else None
    )
    documents = (
        db.query(PropertyDocument)
        .filter(PropertyDocument.property_id == prop.property_id)
        .order_by(PropertyDocument.document_id)
        .all()
    )
    history_rows = (
        db.query(PropertyOwnershipHistory)
        .filter(PropertyOwnershipHistory.property_id == prop.property_id)
        .order_by(PropertyOwnershipHistory.ownership_start_date.desc().nullslast())
        .limit(10)
        .all()
    )
    owner_names = (
        {
            user.user_id: user.full_name
            for user in db.query(User)
            .filter(User.user_id.in_({row.owner_id for row in history_rows if row.owner_id}))
            .all()
        }
        if history_rows
        else {}
    )

    return {
        "property_id": prop.property_id,
        "property_name": prop.property_name,
        "title_deed_number": prop.title_deed_number,
        "address": prop.address,
        "district": prop.district,
        "city": prop.city,
        "land_area": _jsonable(prop.land_area),
        "area_unit": prop.area_unit,
        "land_type": prop.land_type,
        "survey_plan_number": prop.survey_plan_number,
        "current_usage_type": prop.current_usage_type,
        "current_subtype": prop.current_subtype,
        "legal_status": prop.legal_status,
        "verification_status": prop.verification_status,
        "encumbrances": prop.encumbrances,
        "boundary_north": prop.boundary_north,
        "boundary_south": prop.boundary_south,
        "boundary_east": prop.boundary_east,
        "boundary_west": prop.boundary_west,
        "current_owner_id": prop.current_owner_id,
        "current_owner_name": owner.full_name if owner else None,
        "documents": [
            {
                "document_id": doc.document_id,
                "document_type": doc.document_type,
                "document_number": doc.document_number,
                "document_hash": doc.document_hash,
                "verification_status": doc.verification_status,
                "issued_date": _jsonable(doc.issued_date),
            }
            for doc in documents
        ],
        "ownership_history": [
            {
                "owner_id": row.owner_id,
                "owner_name": owner_names.get(row.owner_id),
                "ownership_type": row.ownership_type,
                "ownership_start_date": _jsonable(row.ownership_start_date),
                "ownership_end_date": _jsonable(row.ownership_end_date),
                "ownership_status": row.ownership_status,
            }
            for row in history_rows
        ],
    }


def snapshot_changes(
    submitted: dict[str, Any], current: dict[str, Any] | None
) -> list[dict[str, Any]]:
    if current is None:
        return [
            {
                "section": "property_details",
                "field": "property_id",
                "submitted": submitted.get("property_id"),
                "current": None,
            }
        ]
    changes = []
    for section, fields in SNAPSHOT_SECTIONS.items():
        for field in fields:
            before, after = submitted.get(field), current.get(field)
            if before != after:
                changes.append(
                    {
                        "section": section,
                        "field": field,
                        "submitted": before
                        if not isinstance(before, list)
                        else f"{len(before)} item(s)",
                        "current": after
                        if not isinstance(after, list)
                        else f"{len(after)} item(s)",
                    }
                )
    return changes


# --------------------------------------------------------------------------- system checks


def _signal(code: str, label: str, state: str, weight: int, detail: str) -> dict[str, Any]:
    return {"code": code, "label": label, "status": state, "weight": weight, "detail": detail}


def compute_system_checks(
    db: Session, prop: Property | None, submitted_snapshot: dict[str, Any]
) -> dict[str, Any]:
    signals: list[dict[str, Any]] = []

    if prop is None:
        signals.append(
            _signal(
                "registry_record",
                "Registry record",
                "FAIL",
                100,
                "The property no longer exists in the registry.",
            )
        )
    else:
        ledger_rows = (
            db.query(BlockchainTransaction.transaction_id)
            .filter(BlockchainTransaction.property_id == prop.property_id)
            .all()
        )
        tx_ids = [row[0] for row in ledger_rows if row[0]]
        if not tx_ids:
            signals.append(
                _signal(
                    "blockchain",
                    "Blockchain integrity",
                    "WARN",
                    10,
                    "No blockchain record anchors this property.",
                )
            )
        else:
            invalid: list[str] = []
            try:
                for tx_id in tx_ids:
                    result = blockchain_hash_service.verify_transaction(db, tx_id)
                    if result is not None and result.get("integrity") != "VALID":
                        invalid.append(tx_id)
            except Exception as exc:  # integrity check failures must not block the review
                logger.warning("Blockchain check failed for %s: %s", prop.property_id, exc)
                signals.append(
                    _signal(
                        "blockchain",
                        "Blockchain integrity",
                        "INFO",
                        0,
                        "Blockchain integrity could not be evaluated.",
                    )
                )
            else:
                if invalid:
                    signals.append(
                        _signal(
                            "blockchain",
                            "Blockchain integrity",
                            "FAIL",
                            40,
                            f"{len(invalid)} of {len(tx_ids)} ledger block(s) failed integrity checks: {', '.join(invalid[:5])}.",
                        )
                    )
                else:
                    signals.append(
                        _signal(
                            "blockchain",
                            "Blockchain integrity",
                            "PASS",
                            0,
                            f"All {len(tx_ids)} ledger block(s) verified.",
                        )
                    )

            # Wire 4-agent orchestrator pipeline to risk assessment signals (Phase 8b / Phase 9g)
            try:
                from app.agents import orchestrator

                inv = orchestrator.investigate(db, tx_ids[0])
                if inv and inv.get("report"):
                    rep = inv["report"]
                    r_level = rep.get("risk_summary", {}).get("risk_level", "LOW")
                    r_summary = rep.get("executive_summary") or ""
                    r_rec = rep.get("recommendation") or ""
                    signals.append(
                        _signal(
                            "ai_investigation_report",
                            "AI Investigation Report",
                            "PASS"
                            if r_level == "LOW"
                            else ("FAIL" if r_level == "HIGH" else "WARN"),
                            25 if r_level == "HIGH" else (10 if r_level == "MEDIUM" else 0),
                            f"Risk Level: {r_level}. {r_summary} Recommendation: {r_rec}",
                        )
                    )
            except Exception as exc:
                logger.warning("Orchestrator pipeline signal skipped for %s: %s", tx_ids[0], exc)

        encumbrance = _text(prop.encumbrances)
        if encumbrance.lower() in _CLEAR_ENCUMBRANCE:
            signals.append(
                _signal("encumbrances", "Encumbrances", "PASS", 0, "No encumbrances recorded.")
            )
        else:
            signals.append(
                _signal(
                    "encumbrances",
                    "Encumbrances",
                    "WARN",
                    20,
                    f"Recorded encumbrance: {encumbrance}",
                )
            )

        legal = _text(prop.legal_status).upper()
        if not legal:
            signals.append(
                _signal("legal_status", "Legal status", "INFO", 5, "Legal status is not recorded.")
            )
        elif any(word in legal for word in _ADVERSE_LEGAL):
            signals.append(
                _signal(
                    "legal_status",
                    "Legal status",
                    "FAIL",
                    25,
                    f"Adverse legal status: {prop.legal_status}",
                )
            )
        else:
            signals.append(
                _signal(
                    "legal_status", "Legal status", "PASS", 0, f"Legal status: {prop.legal_status}"
                )
            )

        verification = _text(prop.verification_status).upper()
        if any(word in verification for word in _VERIFIED_WORDS):
            signals.append(
                _signal(
                    "registry_verification",
                    "Registry verification",
                    "PASS",
                    0,
                    f"Status: {prop.verification_status}",
                )
            )
        else:
            signals.append(
                _signal(
                    "registry_verification",
                    "Registry verification",
                    "WARN",
                    10,
                    f"Property is not registry-verified (status: {prop.verification_status or 'not recorded'}).",
                )
            )

        year_ago = date.today() - timedelta(days=365)
        recent_transfers = (
            db.query(PropertyOwnershipHistory.ownership_id)
            .filter(
                PropertyOwnershipHistory.property_id == prop.property_id,
                PropertyOwnershipHistory.ownership_start_date >= year_ago,
            )
            .count()
        )
        if recent_transfers >= 2:
            signals.append(
                _signal(
                    "ownership_turnover",
                    "Ownership turnover",
                    "WARN",
                    15,
                    f"{recent_transfers} ownership changes in the last 12 months.",
                )
            )
        else:
            signals.append(
                _signal(
                    "ownership_turnover",
                    "Ownership turnover",
                    "PASS",
                    0,
                    "No rapid ownership changes in the last 12 months.",
                )
            )

        docs = (
            db.query(PropertyDocument)
            .filter(PropertyDocument.property_id == prop.property_id)
            .all()
        )
        bad = [
            doc
            for doc in docs
            if any(word in _text(doc.verification_status).upper() for word in _BAD_DOCUMENT)
        ]
        pending = [
            doc
            for doc in docs
            if doc not in bad
            and not any(word in _text(doc.verification_status).upper() for word in _VERIFIED_WORDS)
        ]
        if not docs:
            signals.append(
                _signal("documents", "Supporting documents", "WARN", 5, "No documents on file.")
            )
        elif bad:
            signals.append(
                _signal(
                    "documents",
                    "Supporting documents",
                    "FAIL",
                    15,
                    f"{len(bad)} document(s) marked rejected or invalid.",
                )
            )
        elif pending:
            signals.append(
                _signal(
                    "documents",
                    "Supporting documents",
                    "WARN",
                    5,
                    f"{len(pending)} document(s) awaiting verification.",
                )
            )
        else:
            signals.append(
                _signal(
                    "documents",
                    "Supporting documents",
                    "PASS",
                    0,
                    f"All {len(docs)} document(s) verified.",
                )
            )

        changes = snapshot_changes(submitted_snapshot, build_property_snapshot(db, prop))
        if changes:
            fields = ", ".join(sorted({change["field"] for change in changes})[:6])
            signals.append(
                _signal(
                    "record_changes",
                    "Record changes since submission",
                    "WARN",
                    10,
                    f"Changed fields: {fields}.",
                )
            )
        else:
            signals.append(
                _signal(
                    "record_changes",
                    "Record changes since submission",
                    "PASS",
                    0,
                    "Registry record unchanged since submission.",
                )
            )

    score = min(100, sum(item["weight"] for item in signals))
    return {
        "signals": signals,
        "suggested_score": score,
        "suggested_level": level_for_score(score),
        "evaluated_at": _now().isoformat(),
    }


# --------------------------------------------------------------------------- serialization


def _user_map(db: Session, user_ids: set[str]) -> dict[str, User]:
    ids = {uid for uid in user_ids if uid}
    if not ids:
        return {}
    return {user.user_id: user for user in db.query(User).filter(User.user_id.in_(ids)).all()}


def _property_map(db: Session, property_ids: set[str]) -> dict[str, Property]:
    ids = {pid for pid in property_ids if pid}
    if not ids:
        return {}
    return {
        prop.property_id: prop
        for prop in db.query(Property).filter(Property.property_id.in_(ids)).all()
    }


def _issue_sections(req: RiskAssessmentRequest) -> list[str]:
    checks = req.verification_checks or {}
    return [key for key in VERIFICATION_SECTIONS if checks.get(key) is False]


def _api_status(req: RiskAssessmentRequest) -> str:
    if req.status == VERIFIED and _issue_sections(req):
        return ISSUES_FOUND
    return req.status


def _any_issue_filter():
    return or_(
        *(
            RiskAssessmentRequest.verification_checks.contains({key: False})
            for key in VERIFICATION_SECTIONS
        )
    )


def _summary(
    req: RiskAssessmentRequest,
    users: dict[str, User],
    props: dict[str, Property],
    viewer: User,
) -> dict[str, Any]:
    requester = users.get(req.requester_id)
    return {
        "request_id": req.request_id,
        "property_id": req.property_id,
        "property_title": _title(props.get(req.property_id), req.submitted_snapshot),
        "status": _api_status(req),
        "submitted_at": req.submitted_at,
        "completed_at": req.completed_at,
        "risk_score": req.risk_score
        if req.status == VERIFIED or _level(viewer) == REGISTRY_LEVEL
        else None,
        "risk_level": req.risk_level
        if req.status == VERIFIED or _level(viewer) == REGISTRY_LEVEL
        else None,
        "requester": {
            "user_id": req.requester_id,
            "full_name": requester.full_name if requester else None,
            "access_level": req.requester_access_level,
        },
        "is_own_request": req.requester_id == viewer.user_id,
    }


def _detail(db: Session, req: RiskAssessmentRequest, viewer: User) -> dict[str, Any]:
    is_registry = _level(viewer) == REGISTRY_LEVEL
    history_user_ids = {event.get("by") for event in (req.history or [])}
    users = _user_map(db, {req.requester_id, req.reviewer_id or ""} | history_user_ids)
    props = _property_map(db, {req.property_id})
    data = _summary(req, users, props, viewer)
    reviewer = users.get(req.reviewer_id or "")
    verified = req.status == VERIFIED
    data.update(
        {
            "requester_notes": req.requester_notes
            if (is_registry or data["is_own_request"])
            else None,
            "include_evidence": req.include_evidence,
            "submitted_snapshot": req.submitted_snapshot,
            "verification_checks": {
                key: (req.verification_checks or {}).get(key) for key in VERIFICATION_SECTIONS
            },
            "registry_notes": req.registry_notes if (is_registry or verified) else None,
            "rejection_reason": req.rejection_reason,
            "system_signals": req.system_signals
            if (is_registry or (verified and req.include_evidence))
            else None,
            "result_hash": req.result_hash if verified else None,
            "review_started_at": req.review_started_at,
            "reviewer_name": reviewer.full_name if reviewer and (is_registry or verified) else None,
            "history": [
                {
                    **event,
                    "by": event.get("by") if is_registry else None,
                    "by_name": (
                        getattr(users.get(event.get("by") or ""), "full_name", None)
                        if is_registry
                        else None
                    ),
                }
                for event in (req.history or [])
            ],
            "can_download_certificate": verified and not _issue_sections(req),
        }
    )
    return data


# --------------------------------------------------------------------------- access


def _get_request(db: Session, request_id: str) -> RiskAssessmentRequest:
    req = (
        db.query(RiskAssessmentRequest)
        .filter(RiskAssessmentRequest.request_id == request_id.strip())
        .first()
    )
    if req is None:
        raise _not_found()
    return req


def _ensure_can_view(db: Session, user: User, req: RiskAssessmentRequest) -> None:
    level = _level(user)
    if level == REGISTRY_LEVEL:
        return
    if level in REQUESTER_LEVELS and property_repository.user_can_access_property(
        db, user.user_id, req.property_id
    ):
        if req.requester_id == user.user_id or req.status == VERIFIED:
            return
    raise _not_found()


# --------------------------------------------------------------------------- requester


def preview_snapshot(db: Session, user: User, property_id: str) -> dict[str, Any]:
    prop = property_repository.get_property(db, property_id)
    if prop is None or not property_repository.user_can_access_property(
        db, user.user_id, property_id
    ):
        raise HTTPException(status_code=404, detail="Property not found or not shared with you.")
    return build_property_snapshot(db, prop)


def create_request(
    db: Session, user: User, property_id: str, notes: str | None, include_evidence: bool
) -> dict[str, Any]:
    prop = property_repository.get_property(db, property_id)
    if prop is None or not property_repository.user_can_access_property(
        db, user.user_id, property_id
    ):
        raise HTTPException(
            status_code=404,
            detail="Property not found or not shared with you. You can only request assessments for your own or shared properties.",
        )

    active = (
        db.query(RiskAssessmentRequest.request_id)
        .filter(
            RiskAssessmentRequest.property_id == property_id,
            RiskAssessmentRequest.requester_id == user.user_id,
            RiskAssessmentRequest.status.in_(ACTIVE_STATUSES),
        )
        .first()
    )
    if active is not None:
        raise _conflict(f"You already have an active request ({active[0]}) for this property.")

    snapshot = build_property_snapshot(db, prop)
    system_signals = compute_system_checks(db, prop, snapshot)
    req = RiskAssessmentRequest(
        request_id=f"RAR-{uuid.uuid4().hex[:10].upper()}",
        property_id=property_id,
        requester_id=user.user_id,
        requester_access_level=_level(user),
        requester_notes=(notes or "").strip() or None,
        include_evidence=include_evidence,
        submitted_snapshot=snapshot,
        system_signals=system_signals,
        risk_score=system_signals.get("suggested_score"),
        risk_level=system_signals.get("suggested_level"),
        status=SUBMITTED,
        verification_checks={},
        history=[],
        submitted_at=_now(),
    )
    _add_history(req, SUBMITTED, user, "Request submitted to the land registry.")
    db.add(req)
    db.commit()
    db.refresh(req)

    # Dispatch Notification (Phase 10)
    from app.services import notification_service

    notification_service.notify_risk_request_created(
        db,
        buyer_user_id=user.user_id,
        request_id=req.request_id,
        property_id=req.property_id,
    )

    return _detail(db, req, user)


def requester_overview(db: Session, user: User) -> dict[str, Any]:
    access = access_map_for_user(db, user.user_id)
    props = _property_map(db, set(access))
    requests = (
        db.query(RiskAssessmentRequest)
        .filter(RiskAssessmentRequest.property_id.in_(set(access)))
        .filter(
            (RiskAssessmentRequest.requester_id == user.user_id)
            | (RiskAssessmentRequest.status == VERIFIED)
        )
        .order_by(RiskAssessmentRequest.submitted_at.desc())
        .all()
        if access
        else []
    )
    users = _user_map(db, {req.requester_id for req in requests})

    by_property: dict[str, list[RiskAssessmentRequest]] = {}
    for req in requests:
        by_property.setdefault(req.property_id, []).append(req)

    my_rows: list[dict[str, Any]] = []
    shared_rows: list[dict[str, Any]] = []
    active_count = 0
    completed_ids: set[str] = set()

    for property_id, access_type in access.items():
        prop = props.get(property_id)
        if prop is None:
            continue
        rows = by_property.get(property_id, [])
        mine_active = next(
            (r for r in rows if r.requester_id == user.user_id and r.status in ACTIVE_STATUSES),
            None,
        )
        latest_verified = next((r for r in rows if r.status == VERIFIED), None)
        mine_latest = next((r for r in rows if r.requester_id == user.user_id), None)
        chosen = mine_active or latest_verified or mine_latest

        active_count += sum(
            1 for r in rows if r.requester_id == user.user_id and r.status in ACTIVE_STATUSES
        )
        completed_ids.update(r.request_id for r in rows if r.status == VERIFIED)

        row = {
            "property_id": property_id,
            "property_title": _title(prop),
            "location": _location(prop),
            "access": access_type,
            "request": _summary(chosen, users, props, user) if chosen else None,
            "can_request": mine_active is None,
        }
        (my_rows if access_type == "OWNER" else shared_rows).append(row)

    def sort_key(row: dict[str, Any]) -> tuple:
        submitted = row["request"]["submitted_at"] if row["request"] else datetime.min
        return (
            row["request"] is None,
            -submitted.timestamp() if row["request"] else 0,
            row["property_id"],
        )

    my_rows.sort(key=sort_key)
    shared_rows.sort(key=sort_key)

    return {
        "summary": {
            "active_requests": active_count,
            "completed_assessments": len(completed_ids),
            "shared_with_me": len(shared_rows),
        },
        "my_properties": my_rows,
        "shared_with_me": shared_rows,
    }


def get_request_detail(db: Session, user: User, request_id: str) -> dict[str, Any]:
    req = _get_request(db, request_id)
    _ensure_can_view(db, user, req)
    return _detail(db, req, user)


# --------------------------------------------------------------------------- registry


def registry_queue(
    db: Session,
    user: User,
    *,
    status_filter: str | None,
    requester_type: str | None,
    submitted_from: date | None,
    submitted_to: date | None,
    skip: int,
    limit: int,
) -> dict[str, Any]:
    query = db.query(RiskAssessmentRequest)
    if status_filter:
        wanted = status_filter.upper()
        if wanted == ISSUES_FOUND:
            query = query.filter(
                and_(RiskAssessmentRequest.status == VERIFIED, _any_issue_filter())
            )
        elif wanted == VERIFIED:
            query = query.filter(
                and_(RiskAssessmentRequest.status == VERIFIED, not_(_any_issue_filter()))
            )
        else:
            query = query.filter(RiskAssessmentRequest.status == wanted)
    if requester_type:
        query = query.filter(RiskAssessmentRequest.requester_access_level == requester_type.upper())
    if submitted_from:
        query = query.filter(
            RiskAssessmentRequest.submitted_at
            >= datetime.combine(submitted_from, datetime.min.time())
        )
    if submitted_to:
        query = query.filter(
            RiskAssessmentRequest.submitted_at
            < datetime.combine(submitted_to + timedelta(days=1), datetime.min.time())
        )

    total = query.count()
    rows = query.order_by(RiskAssessmentRequest.submitted_at.desc()).offset(skip).limit(limit).all()
    users = _user_map(db, {row.requester_id for row in rows})
    props = _property_map(db, {row.property_id for row in rows})

    under_review = (
        db.query(RiskAssessmentRequest).filter(RiskAssessmentRequest.status == UNDER_REVIEW).all()
    )
    today = datetime.combine(date.today(), datetime.min.time())
    summary = {
        "pending_intake": db.query(RiskAssessmentRequest)
        .filter(RiskAssessmentRequest.status == SUBMITTED)
        .count(),
        "under_review": len(under_review),
        "needs_clarification": sum(
            1
            for row in under_review
            if any(value is False for value in (row.verification_checks or {}).values())
        ),
        "completed_today": db.query(RiskAssessmentRequest)
        .filter(
            RiskAssessmentRequest.status == VERIFIED, RiskAssessmentRequest.completed_at >= today
        )
        .count(),
    }
    return {
        "summary": summary,
        "items": [_summary(row, users, props, user) for row in rows],
        "total": total,
    }


def registry_workspace(db: Session, user: User, request_id: str) -> dict[str, Any]:
    req = _get_request(db, request_id)
    prop = property_repository.get_property(db, req.property_id)
    current = build_property_snapshot(db, prop) if prop else None
    return {
        "request": _detail(db, req, user),
        "current_property": current,
        "snapshot_changes": snapshot_changes(req.submitted_snapshot or {}, current),
        "system_checks": compute_system_checks(db, prop, req.submitted_snapshot or {}),
    }


def start_review(db: Session, user: User, request_id: str) -> dict[str, Any]:
    req = _get_request(db, request_id)
    if req.status == UNDER_REVIEW:
        return registry_workspace(db, user, request_id)
    if req.status != SUBMITTED:
        raise _conflict(f"Request is already {req.status.lower().replace('_', ' ')}.")
    req.status = UNDER_REVIEW
    req.reviewer_id = user.user_id
    req.review_started_at = _now()
    _add_history(req, UNDER_REVIEW, user, "Registry started the review.")
    db.commit()
    return registry_workspace(db, user, request_id)


def _require_under_review(req: RiskAssessmentRequest) -> None:
    if req.status != UNDER_REVIEW:
        raise _conflict("Start the review before saving or verifying this request.")


def _merge_checks(req: RiskAssessmentRequest, checks: dict[str, bool | None] | None) -> None:
    if checks is None:
        return
    merged = dict(req.verification_checks or {})
    merged.update({key: checks.get(key) for key in VERIFICATION_SECTIONS if key in checks})
    req.verification_checks = merged
    flag_modified(req, "verification_checks")


def save_draft(
    db: Session,
    user: User,
    request_id: str,
    *,
    checks: dict[str, bool | None] | None,
    risk_score: int | None,
    registry_notes: str | None,
) -> dict[str, Any]:
    req = _get_request(db, request_id)
    _require_under_review(req)
    _merge_checks(req, checks)
    if risk_score is not None:
        req.risk_score = risk_score
        req.risk_level = level_for_score(risk_score)
    if registry_notes is not None:
        req.registry_notes = registry_notes.strip() or None
    req.reviewer_id = user.user_id
    db.commit()
    return _detail(db, req, user)


def _result_hash(req: RiskAssessmentRequest) -> str:
    payload = {
        "request_id": req.request_id,
        "property_id": req.property_id,
        "risk_score": req.risk_score,
        "risk_level": req.risk_level,
        "registry_notes": req.registry_notes,
        "verification_checks": {
            key: (req.verification_checks or {}).get(key) for key in VERIFICATION_SECTIONS
        },
        "reviewer_id": req.reviewer_id,
        "completed_at": req.completed_at.isoformat() if req.completed_at else None,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def verify_and_send(
    db: Session,
    user: User,
    request_id: str,
    *,
    checks: dict[str, bool | None],
    risk_score: int,
    registry_notes: str,
) -> dict[str, Any]:
    req = _get_request(db, request_id)
    _require_under_review(req)
    _merge_checks(req, checks)

    unchecked = [
        key for key in VERIFICATION_SECTIONS if (req.verification_checks or {}).get(key) is None
    ]
    if unchecked:
        labels = ", ".join(key.replace("_", " ") for key in unchecked)
        raise HTTPException(
            status_code=400,
            detail=f"Mark every section as Verified or Issue found before sending the result (not checked: {labels}).",
        )

    prop = property_repository.get_property(db, req.property_id)
    req.system_signals = compute_system_checks(db, prop, req.submitted_snapshot or {})
    req.risk_score = risk_score
    req.risk_level = level_for_score(risk_score)
    req.registry_notes = registry_notes
    req.reviewer_id = user.user_id
    req.completed_at = _now()
    req.status = VERIFIED
    req.result_hash = _result_hash(req)
    issues = _issue_sections(req)
    if issues:
        labels = ", ".join(key.replace("_", " ") for key in issues)
        _add_history(
            req,
            ISSUES_FOUND,
            user,
            f"Review completed with issues found ({labels}): {req.risk_level} risk "
            f"({risk_score}/100). The requester should visit the Land Registry to resolve them.",
        )
    else:
        _add_history(
            req,
            VERIFIED,
            user,
            f"Assessment verified: {req.risk_level} risk ({risk_score}/100). Result sent to requester.",
        )
    db.commit()

    # Dispatch Notification (Phase 10)
    from app.services import notification_service

    notification_service.notify_risk_request_completed(
        db,
        buyer_user_id=req.requester_id,
        request_id=req.request_id,
        property_id=req.property_id,
        status=_api_status(req),
        risk_level=req.risk_level,
    )

    return _detail(db, req, user)


def reject(db: Session, user: User, request_id: str, reason: str) -> dict[str, Any]:
    req = _get_request(db, request_id)
    if req.status not in ACTIVE_STATUSES:
        raise _conflict(f"Request is already {req.status.lower().replace('_', ' ')}.")
    req.status = REJECTED
    req.rejection_reason = reason
    req.reviewer_id = user.user_id
    req.completed_at = _now()
    _add_history(req, REJECTED, user, reason)
    db.commit()

    # Dispatch Notification (Phase 10)
    from app.services import notification_service

    notification_service.notify_risk_request_completed(
        db,
        buyer_user_id=req.requester_id,
        request_id=req.request_id,
        property_id=req.property_id,
        status=REJECTED,
    )

    return _detail(db, req, user)


# --------------------------------------------------------------------------- certificate


def certificate_html(db: Session, user: User, request_id: str) -> tuple[str, str]:
    req = _get_request(db, request_id)
    _ensure_can_view(db, user, req)
    if req.status != VERIFIED or _issue_sections(req):
        raise _conflict("A certificate is only available for fully verified assessments.")

    snapshot = req.submitted_snapshot or {}
    reviewer = _user_map(db, {req.reviewer_id or ""}).get(req.reviewer_id or "")
    esc = lambda value: html.escape(_text(value) or "—")  # noqa: E731
    location = ", ".join(
        part
        for part in (
            _text(snapshot.get("address")),
            _text(snapshot.get("district")),
            _text(snapshot.get("city")),
        )
        if part
    )
    signals = (req.system_signals or {}).get("signals", []) if req.include_evidence else []
    signal_rows = "".join(
        f"<tr><td>{esc(s.get('label'))}</td><td>{esc(s.get('status'))}</td><td>{esc(s.get('detail'))}</td></tr>"
        for s in signals
    )
    evidence = (
        f"<h2>Evidence signals</h2><table><tr><th>Check</th><th>Result</th><th>Detail</th></tr>{signal_rows}</table>"
        if signal_rows
        else ""
    )
    body = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Risk Assessment Certificate {esc(req.request_id)}</title>
<style>body{{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;color:#1f2937}}
table{{width:100%;border-collapse:collapse;margin:12px 0}}td,th{{border:1px solid #d1d5db;padding:6px 8px;text-align:left;font-size:14px}}
th{{background:#f3f4f6}}code{{word-break:break-all}}</style></head><body>
<h1>Land Registry Risk Assessment Certificate</h1>
<table>
<tr><th>Request ID</th><td>{esc(req.request_id)}</td></tr>
<tr><th>Property ID</th><td>{esc(req.property_id)}</td></tr>
<tr><th>Title deed</th><td>{esc(snapshot.get("title_deed_number"))}</td></tr>
<tr><th>Location</th><td>{esc(location)}</td></tr>
<tr><th>Risk level</th><td>{esc(req.risk_level)}</td></tr>
<tr><th>Risk score</th><td>{esc(req.risk_score)} / 100</td></tr>
<tr><th>Verified by</th><td>{esc(reviewer.full_name if reviewer else "Land Registry")}</td></tr>
<tr><th>Verified at</th><td>{esc(req.completed_at.strftime("%Y-%m-%d %H:%M") if req.completed_at else None)}</td></tr>
</table>
<h2>Registry findings</h2><p>{esc(req.registry_notes)}</p>
{evidence}
<p>Result fingerprint (SHA-256): <code>{esc(req.result_hash)}</code></p>
</body></html>"""
    return f"risk-assessment-{req.request_id}.html", body
