"""API v1 router aggregation."""
from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.vaults import router as vaults_router
from app.api.v1.approvals import router as approvals_router
from app.api.v1.audit import router as audit_router
from app.api.v1.credentials import router as credentials_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router)
api_router.include_router(vaults_router)
api_router.include_router(approvals_router)
api_router.include_router(audit_router)
api_router.include_router(credentials_router)

