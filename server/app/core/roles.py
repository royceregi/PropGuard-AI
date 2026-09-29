from __future__ import annotations

from enum import Enum


class AccessLevel(str, Enum):
    """Authorization identity stored on core.users.access_level."""

    SYSTEM = "SYSTEM"  # Super Admin
    REGISTRY = "REGISTRY"  # Land Registry
    COMPANY = "COMPANY"  # Real Estate Company
    PUBLIC = "PUBLIC"  # End user added by registry/company; read-only property access
    STANDARD = "STANDARD"  # End user in DB, no system access yet
    ELEVATED = "ELEVATED"  # Nominated by registry/company; awaiting super admin


# Backward-compatible alias used by older imports.
UserRole = AccessLevel

ACCESS_LEVEL_LABELS: dict[str, str] = {
    AccessLevel.SYSTEM.value: "Super Admin",
    AccessLevel.REGISTRY.value: "Land Registry",
    AccessLevel.COMPANY.value: "Real Estate Company",
    AccessLevel.PUBLIC.value: "Public User",
    AccessLevel.STANDARD.value: "Standard",
    AccessLevel.ELEVATED.value: "Pending Approval",
}

# Levels that may sign in and use the app (must also be is_active).
# STANDARD / ELEVATED end users have no system access until promoted to PUBLIC.
OPERATIONAL_ACCESS_LEVELS = {
    AccessLevel.SYSTEM.value,
    AccessLevel.REGISTRY.value,
    AccessLevel.COMPANY.value,
    AccessLevel.PUBLIC.value,
}

ROLE_PERMISSIONS: dict[str, list[str]] = {
    AccessLevel.SYSTEM.value: [
        "manage_users",
        "approve_users",
        "set_access_level",
        "load_datasets",
        "view_system_health",
        "view_all_transactions",
        "review_agent_logs",
        "configure_thresholds",
        "manage_verification_rules",
        "approve_transactions",
        "alter_official_history",
        "search_properties",
        "run_verification",
        "view_own_property",
        "view_audit_trail",
    ],
    AccessLevel.REGISTRY.value: [
        "manage_users",
        "activate_users",
        "register_properties",
        "approve_transactions",
        "verify_documents",
        "confirm_ownership",
        "add_official_records",
        "view_blockchain_integrity",
        "resolve_flagged_cases",
        "review_risk_reports",
        "process_risk_assessment_requests",
        "send_risk_assessment_results",
        "mark_case_reviewed",
        "search_properties",
        "run_verification",
        "run_risk_analysis",
        "view_own_property",
        "view_audit_trail",
        "review_agent_logs_limited",
    ],
    AccessLevel.COMPANY.value: [
        "activate_users",
        "search_properties",
        "verify_ownership",
        "verify_title",
        "check_encumbrances",
        "check_transaction_history",
        "submit_transaction_analysis",
        "submit_risk_assessment_request",
        "view_risk_assessment",
        "run_verification",
        "view_own_property",
    ],
    AccessLevel.PUBLIC.value: [
        "view_own_property",
        "view_own_history",
        "view_shared_property",
        "check_encumbrances",
        "check_own_verification",
        "view_transaction_status",
        "submit_inquiry",
        "submit_risk_assessment_request",
        "view_risk_assessment",
        "run_verification",
    ],
    AccessLevel.STANDARD.value: [
        "view_own_property",
        "view_own_history",
        "check_own_verification",
        "view_transaction_status",
        "submit_inquiry",
        "view_limited_public_property",
    ],
}


def normalize_access_level(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip().upper()
    return cleaned or None


def permissions_for_role(access_level: str) -> list[str]:
    key = normalize_access_level(access_level) or ""
    return list(ROLE_PERMISSIONS.get(key, []))


def permissions_for_access_level(access_level: str) -> list[str]:
    return permissions_for_role(access_level)


def is_operational_access(access_level: str | None) -> bool:
    key = normalize_access_level(access_level)
    return key in OPERATIONAL_ACCESS_LEVELS
