import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

import app.models  # ensure models are loaded before creating tables
from app.api.v1.endpoints import auth as auth_endpoints
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import Base, engine
from app.services.blockchain_risk_service import ensure_feature_columns

logger = logging.getLogger(__name__)

# Create missing tables only. Existing core.users is migrated via SQL.
try:
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE core.blockchain_transactions "
                "ADD COLUMN IF NOT EXISTS transaction_data_hash VARCHAR(255)"
            )
        )
        ensure_feature_columns(conn)
except Exception as exc:
    logger.warning("Database startup setup skipped or offline: %s", exc)

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_endpoints.router, prefix="/api/auth", tags=["auth"])
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "Welcome to FastAPI CRUD API"}
