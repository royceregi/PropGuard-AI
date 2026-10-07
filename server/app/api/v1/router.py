from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_blockchain,
    analytics,
    anomaly_model,
    blockchain,
    blockchain_hash,
    blockchain_risk,
    investigations,
    notifications,
    properties,
    property_documents,
    property_ownership,
    property_shares,
    property_transactions,
    retrieval,
    risk_assessments,
    subscription,
    users,
)

api_router = APIRouter()
api_router.include_router(subscription.router, prefix="/subscription", tags=["subscription"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(properties.router, prefix="/properties", tags=["properties"])
api_router.include_router(
    property_shares.router,
    prefix="",
    tags=["property-shares"],
)
api_router.include_router(
    property_transactions.router,
    prefix="/property-transactions",
    tags=["property-transactions"],
)
api_router.include_router(
    property_documents.router,
    prefix="/property-documents",
    tags=["property-documents"],
)
api_router.include_router(
    property_ownership.router,
    prefix="/property-ownership-history",
    tags=["property-ownership-history"],
)
api_router.include_router(
    blockchain.router,
    prefix="/blockchain-transactions",
    tags=["blockchain-transactions"],
)
api_router.include_router(
    blockchain_hash.router,
    prefix="/blockchain",
    tags=["blockchain"],
)
api_router.include_router(
    blockchain_risk.router,
    prefix="/blockchain",
    tags=["blockchain-risk"],
)
api_router.include_router(
    admin_blockchain.router,
    prefix="/admin/blockchain",
    tags=["admin-blockchain"],
)
api_router.include_router(
    risk_assessments.router,
    prefix="/risk-assessments",
    tags=["risk-assessments"],
)
api_router.include_router(
    anomaly_model.router,
    prefix="/anomaly-model",
    tags=["anomaly-model"],
)
api_router.include_router(
    retrieval.router,
    prefix="/retrieval",
    tags=["retrieval"],
)
api_router.include_router(
    analytics.router,
    prefix="/analytics",
    tags=["analytics"],
)
api_router.include_router(
    investigations.router,
    prefix="/investigations",
    tags=["investigations"],
)
