from fastapi import APIRouter

from app.api.v1.endpoints import (
    admin_blockchain,
    blockchain,
    blockchain_hash,
    blockchain_risk,
    properties,
    property_documents,
    property_ownership,
    property_transactions,
    risk_assessments,
    users,
)

api_router = APIRouter()
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(properties.router, prefix="/properties", tags=["properties"])
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
