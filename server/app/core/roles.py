from __future__ import annotations

from enum import Enum


class UserRole(str, Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    LAND_REGISTRY = "LAND_REGISTRY"
    REAL_ESTATE_COMPANY = "REAL_ESTATE_COMPANY"
    PUBLIC_USER = "PUBLIC_USER"


ROLE_PERMISSIONS: dict[str, list[str]] = {
    UserRole.SUPER_ADMIN.value: [
        "manage_users",
        "load_datasets",
        "view_system_health",
        "view_all_transactions",
        "view_risk_assessments",
        "review_agent_logs",
        "configure_thresholds",
        "manage_verification_rules",
        "approve_transactions",
        "alter_official_history",
        "search_properties",
        "run_verification",
        "run_risk_analysis",
        "view_own_property",
        "view_audit_trail",
    ],
    UserRole.LAND_REGISTRY.value: [
        "register_properties",
        "approve_transactions",
        "verify_documents",
        "confirm_ownership",
        "add_official_records",
        "view_blockchain_integrity",
        "resolve_flagged_cases",
        "review_risk_reports",
        "mark_case_reviewed",
        "search_properties",
        "run_verification",
        "run_risk_analysis",
        "view_own_property",
        "view_audit_trail",
        "review_agent_logs_limited",
    ],
    UserRole.REAL_ESTATE_COMPANY.value: [
        "search_properties",
        "verify_ownership",
        "verify_title",
        "check_encumbrances",
        "check_transaction_history",
        "submit_transaction_analysis",
        "view_risk_assessment",
        "run_verification",
        "run_risk_analysis",
        "view_own_property",
    ],
    UserRole.PUBLIC_USER.value: [
        "view_own_property",
        "view_own_history",
        "check_own_verification",
        "view_transaction_status",
        "submit_inquiry",
        "view_limited_public_property",
    ],
}


def permissions_for_role(role: str) -> list[str]:
    return list(ROLE_PERMISSIONS.get(role, []))
