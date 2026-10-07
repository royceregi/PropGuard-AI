"""Legal / business checks for a property transaction (registry validity, not hash integrity)."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.core.hashing import normalize_type, normalize_wallet
from app.models.property import (
    BlockchainTransaction,
    Property,
    PropertyOwnershipHistory,
    PropertyTransaction,
    RegistrationDetail,
    TransactionParty,
)
from app.models.user import User
from app.services.blockchain_hash_service import chain_context

PASS, WARN, FAIL, NA = "PASS", "WARN", "FAIL", "NA"

TIMESTAMP_TOLERANCE = timedelta(hours=24)

# Dataset uses OWNER for the acquiring party; BUYER is the preferred alias.
BUYER_ROLES = ("BUYER", "OWNER")
SELLER_ROLES = ("SELLER",)
REQUIRED_ROLES = {"SELLER": SELLER_ROLES, "BUYER": BUYER_ROLES, "NOTARY": ("NOTARY",)}

# property_transactions.transaction_group → accepted ledger transaction_type prefixes.
GROUP_LEDGER_TYPES = {
    "SALES": ("OWNERSHIP_TRANSFER",),
    "GIFTS": ("GIFT_TRANSFER",),
    "MORTGAGES": ("MORTGAGE",),
}
TRANSFER_GROUPS = {"SALES", "GIFTS"}

ACTIVE_OWNERSHIP_STATUSES = ("CURRENT", "ACTIVE")
CLEAR_ENCUMBRANCES = {"", "NO_ENCUMBRANCES", "NONE"}
BLOCKING_ENCUMBRANCES = {"OWNERSHIP_DISPUTE_FILED", "COURT_ORDER_PENDING"}


def _text(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _check(
    code: str,
    name: str,
    category: str,
    status: str,
    reason: str,
    *,
    expected: Any = None,
    actual: Any = None,
    evidence: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "code": code,
        "name": name,
        "category": category,
        "status": status,
        "expected": _text(expected),
        "actual": _text(actual),
        "reason": reason,
        "evidence": evidence or [],
    }


def _ev(table: str, record_id: Any) -> dict[str, Any]:
    return {"table": table, "id": _text(record_id)}


def _party(parties: list[TransactionParty], roles: tuple[str, ...]) -> TransactionParty | None:
    for role in roles:
        for party in parties:
            if normalize_type(party.role) == role:
                return party
    return None


def _wallet_check(
    code: str,
    name: str,
    party_label: str,
    party: TransactionParty | None,
    user: User | None,
    ledger_wallet: str | None,
    ledger: BlockchainTransaction,
    ledger_field: str,
) -> dict[str, Any]:
    if party is None or not party.user_id:
        return _check(
            code, name, "parties", NA, f"No {party_label} with a user account is recorded."
        )
    evidence = [
        _ev("transaction_parties", party.transaction_party_id),
        _ev("blockchain_transactions", ledger.blockchain_tx_id),
    ]
    wallet = user.wallet_address if user else None
    if not wallet:
        return _check(
            code,
            name,
            "parties",
            NA,
            f"The {party_label} has no wallet address on file.",
            evidence=evidence,
        )
    ok = normalize_wallet(wallet) == normalize_wallet(ledger_wallet)
    return _check(
        code,
        name,
        "parties",
        PASS if ok else FAIL,
        f"{party_label.capitalize()} wallet matches ledger {ledger_field}."
        if ok
        else f"{party_label.capitalize()} wallet does not match ledger {ledger_field}.",
        expected=wallet,
        actual=ledger_wallet,
        evidence=evidence,
    )


def run_checks(db: Session, transaction_id: str) -> dict[str, Any] | None:
    tid = transaction_id.strip()
    tx = db.query(PropertyTransaction).filter(PropertyTransaction.transaction_id == tid).first()
    ledger = (
        db.query(BlockchainTransaction).filter(BlockchainTransaction.transaction_id == tid).first()
    )
    if tx is None and ledger is None:
        return None

    checks: list[dict[str, Any]] = []

    checks.append(
        _check(
            "TX_RECORDED_BOTH",
            "Recorded in registry and ledger",
            "ledger",
            PASS if tx is not None and ledger is not None else FAIL,
            "Transaction exists in property_transactions and blockchain_transactions."
            if tx is not None and ledger is not None
            else "Transaction is missing from "
            + ("the blockchain ledger." if ledger is None else "the registry transactions."),
            evidence=[
                e
                for e in (
                    _ev("property_transactions", tid) if tx else None,
                    _ev("blockchain_transactions", ledger.blockchain_tx_id) if ledger else None,
                )
                if e
            ],
        )
    )

    property_id = _text(tx.property_id if tx else None) or _text(
        ledger.property_id if ledger else None
    )
    prop = db.get(Property, property_id) if property_id else None
    group = normalize_type(tx.transaction_group) if tx else ""

    if tx is not None and ledger is not None:
        checks.extend(_ledger_consistency_checks(tx, ledger, group))

    parties = db.query(TransactionParty).filter(TransactionParty.transaction_id == tid).all()
    seller = _party(parties, SELLER_ROLES)
    buyer = _party(parties, BUYER_ROLES)
    user_ids = [p.user_id for p in (seller, buyer) if p is not None and p.user_id]
    users = (
        {u.user_id: u for u in db.query(User).filter(User.user_id.in_(user_ids)).all()}
        if user_ids
        else {}
    )

    if ledger is not None:
        checks.append(
            _wallet_check(
                "SELLER_WALLET",
                "Seller wallet = ledger from_wallet",
                "seller",
                seller,
                users.get(seller.user_id) if seller else None,
                ledger.from_wallet,
                ledger,
                "from_wallet",
            )
        )
        checks.append(
            _wallet_check(
                "BUYER_WALLET",
                "Buyer wallet = ledger to_wallet",
                "buyer",
                buyer,
                users.get(buyer.user_id) if buyer else None,
                ledger.to_wallet,
                ledger,
                "to_wallet",
            )
        )

    checks.append(_required_parties_check(parties))
    checks.extend(_ownership_checks(db, tid, property_id, prop, seller, buyer, group))
    checks.append(_encumbrance_check(db, prop, ledger, group))
    checks.append(_registration_check(db, tid))

    counts = {
        status: sum(1 for c in checks if c["status"] == status) for status in (PASS, WARN, FAIL, NA)
    }
    overall = FAIL if counts[FAIL] else WARN if counts[WARN] else PASS
    return {
        "transaction_id": tid,
        "property_id": property_id,
        "overall": overall,
        "counts": counts,
        "checks": checks,
    }


def _ledger_consistency_checks(
    tx: PropertyTransaction, ledger: BlockchainTransaction, group: str
) -> list[dict[str, Any]]:
    evidence = [
        _ev("property_transactions", tx.transaction_id),
        _ev("blockchain_transactions", ledger.blockchain_tx_id),
    ]
    out: list[dict[str, Any]] = []

    same_property = _text(ledger.property_id) == _text(tx.property_id)
    out.append(
        _check(
            "PROPERTY_CONSISTENT",
            "Same property in registry and ledger",
            "ledger",
            PASS if same_property else FAIL,
            "Ledger and registry refer to the same property."
            if same_property
            else "Ledger records this transaction against a different property.",
            expected=tx.property_id,
            actual=ledger.property_id,
            evidence=evidence,
        )
    )

    if tx.transaction_value is None or ledger.transaction_value is None:
        out.append(
            _check(
                "VALUE_MATCH",
                "Transaction value",
                "ledger",
                NA,
                "Value missing in registry or ledger.",
                expected=tx.transaction_value,
                actual=ledger.transaction_value,
                evidence=evidence,
            )
        )
    else:
        ok = Decimal(tx.transaction_value) == Decimal(ledger.transaction_value)
        out.append(
            _check(
                "VALUE_MATCH",
                "Transaction value",
                "ledger",
                PASS if ok else FAIL,
                "Ledger value matches the registry."
                if ok
                else "Ledger value differs from the registry.",
                expected=tx.transaction_value,
                actual=ledger.transaction_value,
                evidence=evidence,
            )
        )

    accepted = GROUP_LEDGER_TYPES.get(group)
    ledger_type = normalize_type(ledger.transaction_type)
    if not accepted:
        out.append(
            _check(
                "TYPE_CONSISTENT",
                "Transaction type",
                "ledger",
                NA,
                f"No ledger type mapping for group '{tx.transaction_group or '—'}'.",
                expected=tx.transaction_group,
                actual=ledger.transaction_type,
                evidence=evidence,
            )
        )
    else:
        ok = ledger_type.startswith(accepted)
        out.append(
            _check(
                "TYPE_CONSISTENT",
                "Transaction type",
                "ledger",
                PASS if ok else FAIL,
                f"Ledger type fits registry group {tx.transaction_group}."
                if ok
                else f"Ledger type does not fit registry group {tx.transaction_group}.",
                expected=" / ".join(accepted),
                actual=ledger.transaction_type,
                evidence=evidence,
            )
        )

    if tx.transaction_datetime is None or ledger.block_timestamp is None:
        out.append(
            _check(
                "TIMESTAMP_TOLERANCE",
                "Block time vs transaction time",
                "ledger",
                NA,
                "Timestamp missing in registry or ledger.",
                evidence=evidence,
            )
        )
    else:
        gap = abs(ledger.block_timestamp - tx.transaction_datetime)
        ok = gap <= TIMESTAMP_TOLERANCE
        hours = gap.total_seconds() / 3600
        out.append(
            _check(
                "TIMESTAMP_TOLERANCE",
                "Block time vs transaction time",
                "ledger",
                PASS if ok else FAIL,
                f"Block recorded {hours:.1f}h from the transaction (limit 24h)."
                if ok
                else f"Block recorded {hours:.1f}h from the transaction, beyond the 24h limit.",
                expected=tx.transaction_datetime,
                actual=ledger.block_timestamp,
                evidence=evidence,
            )
        )

    status = normalize_type(ledger.transaction_status)
    if status == "CONFIRMED":
        result, reason = PASS, "Ledger transaction is confirmed."
    elif status == "FAILED":
        result, reason = FAIL, "Ledger transaction failed and was never confirmed."
    else:
        result, reason = (
            WARN,
            f"Ledger transaction is {ledger.transaction_status or 'unconfirmed'}, not confirmed.",
        )
    out.append(
        _check(
            "LEDGER_CONFIRMED",
            "Ledger confirmation",
            "ledger",
            result,
            reason,
            expected="Confirmed",
            actual=ledger.transaction_status,
            evidence=evidence[1:],
        )
    )
    return out


def _required_parties_check(parties: list[TransactionParty]) -> dict[str, Any]:
    if not parties:
        return _check(
            "REQUIRED_PARTIES",
            "Required parties present",
            "parties",
            WARN,
            "No parties are recorded for this transaction.",
            expected=", ".join(REQUIRED_ROLES),
        )
    missing = [label for label, roles in REQUIRED_ROLES.items() if _party(parties, roles) is None]
    present = sorted({normalize_type(p.role) for p in parties if p.role})
    return _check(
        "REQUIRED_PARTIES",
        "Required parties present",
        "parties",
        FAIL if missing else PASS,
        f"Missing: {', '.join(missing)}." if missing else "Seller, buyer, and notary are recorded.",
        expected=", ".join(REQUIRED_ROLES),
        actual=", ".join(present),
        evidence=[_ev("transaction_parties", p.transaction_party_id) for p in parties],
    )


def _ownership_checks(
    db: Session,
    tid: str,
    property_id: str | None,
    prop: Property | None,
    seller: TransactionParty | None,
    buyer: TransactionParty | None,
    group: str,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not property_id:
        return [
            _check(
                "OWNERSHIP",
                "Ownership history",
                "ownership",
                NA,
                "No property linked to this transaction.",
            )
        ]

    history = (
        db.query(PropertyOwnershipHistory)
        .filter(PropertyOwnershipHistory.property_id == property_id)
        .all()
    )
    history.sort(
        key=lambda r: (
            r.ownership_start_date is None,
            r.ownership_start_date or 0,
            r.ownership_id or 0,
        )
    )
    this_index = next((i for i, r in enumerate(history) if r.transaction_id == tid), None)
    this_record = history[this_index] if this_index is not None else None

    # Buyer became owner
    if this_record is None:
        out.append(
            _check(
                "BUYER_BECAME_OWNER",
                "Buyer recorded as resulting owner",
                "ownership",
                NA,
                "No ownership record for this transaction.",
            )
        )
    elif buyer is None or not buyer.user_id or not this_record.owner_id:
        out.append(
            _check(
                "BUYER_BECAME_OWNER",
                "Buyer recorded as resulting owner",
                "ownership",
                NA,
                "Buyer or resulting owner is not identified.",
                expected=buyer.user_id if buyer else None,
                actual=this_record.owner_id,
                evidence=[_ev("property_ownership_history", this_record.ownership_id)],
            )
        )
    else:
        ok = buyer.user_id == this_record.owner_id
        out.append(
            _check(
                "BUYER_BECAME_OWNER",
                "Buyer recorded as resulting owner",
                "ownership",
                PASS if ok else FAIL,
                "Ownership history records the buyer as the resulting owner."
                if ok
                else "Ownership history records a different resulting owner than the buyer.",
                expected=buyer.user_id,
                actual=this_record.owner_id,
                evidence=[
                    _ev("transaction_parties", buyer.transaction_party_id),
                    _ev("property_ownership_history", this_record.ownership_id),
                ],
            )
        )

    # Seller was the owner before this transaction
    if group not in TRANSFER_GROUPS:
        out.append(
            _check(
                "SELLER_WAS_OWNER",
                "Seller owned the property before",
                "ownership",
                NA,
                "Only applies to ownership transfers (sales and gifts).",
            )
        )
    elif seller is None or not seller.user_id:
        out.append(
            _check(
                "SELLER_WAS_OWNER",
                "Seller owned the property before",
                "ownership",
                NA,
                "No seller with a user account is recorded.",
            )
        )
    elif this_index is None:
        out.append(
            _check(
                "SELLER_WAS_OWNER",
                "Seller owned the property before",
                "ownership",
                NA,
                "No ownership record for this transaction to compare against.",
            )
        )
    else:
        previous = next((r for r in reversed(history[:this_index]) if r.owner_id), None)
        if previous is None:
            out.append(
                _check(
                    "SELLER_WAS_OWNER",
                    "Seller owned the property before",
                    "ownership",
                    NA,
                    "No earlier owner is identified in the ownership history.",
                    expected=seller.user_id,
                )
            )
        else:
            ok = previous.owner_id == seller.user_id
            out.append(
                _check(
                    "SELLER_WAS_OWNER",
                    "Seller owned the property before",
                    "ownership",
                    PASS if ok else FAIL,
                    "Seller was the owner of record before this transaction."
                    if ok
                    else "Seller was not the owner of record before this transaction.",
                    expected=previous.owner_id,
                    actual=seller.user_id,
                    evidence=[
                        _ev("transaction_parties", seller.transaction_party_id),
                        _ev("property_ownership_history", previous.ownership_id),
                    ],
                )
            )

    # One active owner
    active = [
        r
        for r in history
        if r.ownership_end_date is None
        and normalize_type(r.ownership_status) in ACTIVE_OWNERSHIP_STATUSES
    ]
    out.append(
        _check(
            "SINGLE_ACTIVE_OWNER",
            "Exactly one active owner",
            "ownership",
            PASS if len(active) == 1 else FAIL,
            "Property has exactly one active ownership record."
            if len(active) == 1
            else f"Property has {len(active)} active ownership records.",
            expected="1",
            actual=str(len(active)),
            evidence=[_ev("property_ownership_history", r.ownership_id) for r in active],
        )
    )

    # Registry current owner agrees with ownership history
    active_owner = active[0].owner_id if len(active) == 1 else None
    current_owner = prop.current_owner_id if prop else None
    if not active_owner or not current_owner:
        out.append(
            _check(
                "CURRENT_OWNER_CONSISTENT",
                "Registry owner = active ownership record",
                "ownership",
                NA,
                "Current owner not identified in the registry or ownership history.",
                expected=active_owner,
                actual=current_owner,
            )
        )
    else:
        ok = active_owner == current_owner
        out.append(
            _check(
                "CURRENT_OWNER_CONSISTENT",
                "Registry owner = active ownership record",
                "ownership",
                PASS if ok else WARN,
                "properties.current_owner_id matches the active ownership record."
                if ok
                else "properties.current_owner_id differs from the active ownership record.",
                expected=active_owner,
                actual=current_owner,
                evidence=[
                    _ev("properties", property_id),
                    _ev("property_ownership_history", active[0].ownership_id),
                ],
            )
        )
    return out


def _encumbrance_check(
    db: Session, prop: Property | None, ledger: BlockchainTransaction | None, group: str
) -> dict[str, Any]:
    if prop is None:
        return _check(
            "ENCUMBRANCE", "No blocking encumbrance", "registration", NA, "Property not found."
        )
    value = normalize_type(prop.encumbrances)
    evidence = [_ev("properties", prop.property_id)]
    if value in CLEAR_ENCUMBRANCES:
        return _check(
            "ENCUMBRANCE",
            "No blocking encumbrance",
            "registration",
            PASS,
            "No encumbrance is recorded on the property.",
            actual=prop.encumbrances,
            evidence=evidence,
        )
    is_head = chain_context(db, ledger)[1] if ledger is not None else True
    blocking = value in BLOCKING_ENCUMBRANCES and group in TRANSFER_GROUPS and is_head
    return _check(
        "ENCUMBRANCE",
        "No blocking encumbrance",
        "registration",
        FAIL if blocking else WARN,
        f"Property currently has '{prop.encumbrances}', which blocks a transfer."
        if blocking
        else f"Property currently has '{prop.encumbrances}' (current state; may post-date this transaction).",
        actual=prop.encumbrances,
        evidence=evidence,
    )


def _registration_check(db: Session, tid: str) -> dict[str, Any]:
    reg = (
        db.query(RegistrationDetail)
        .filter(RegistrationDetail.transaction_id == tid)
        .order_by(RegistrationDetail.registration_id.desc())
        .first()
    )
    if reg is None:
        return _check(
            "REGISTRATION",
            "Registration recorded",
            "registration",
            FAIL,
            "No registration record exists for this transaction.",
        )
    evidence = [_ev("registration_details", reg.registration_id)]
    status = normalize_type(reg.registration_status)
    actual = " · ".join(
        v
        for v in (
            reg.registration_status,
            reg.registration_number,
            str(reg.registration_date) if reg.registration_date else None,
        )
        if v
    )
    if status == "REJECTED":
        return _check(
            "REGISTRATION",
            "Registration recorded",
            "registration",
            FAIL,
            "Registration was rejected.",
            actual=actual,
            evidence=evidence,
        )
    if status == "PENDING":
        return _check(
            "REGISTRATION",
            "Registration recorded",
            "registration",
            WARN,
            "Registration is still pending.",
            actual=actual,
            evidence=evidence,
        )
    if not reg.registration_date:
        return _check(
            "REGISTRATION",
            "Registration recorded",
            "registration",
            FAIL,
            "Registration has no registration date.",
            actual=actual,
            evidence=evidence,
        )
    if status == "VERIFIED" and not _text(reg.registration_number):
        return _check(
            "REGISTRATION",
            "Registration recorded",
            "registration",
            FAIL,
            "Verified registration has no registration number.",
            actual=actual,
            evidence=evidence,
        )
    return _check(
        "REGISTRATION",
        "Registration recorded",
        "registration",
        PASS,
        f"Registration is {reg.registration_status}.",
        actual=actual,
        evidence=evidence,
    )
