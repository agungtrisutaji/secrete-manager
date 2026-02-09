"""
Secrets Manager Backend - Audit API Routes

Audit log viewing and export endpoints.
"""
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import json
import csv
import io

from app.api.deps import ClientInfo, CurrentUser, DbSession, PermissionChecker
from app.core import AuditAction, audit_log
from app.models.audit import AuditLog
from app.schemas import AuditLogFilter, AuditLogResponse, PaginatedResponse

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs", response_model=PaginatedResponse)
async def list_audit_logs(
    user: CurrentUser,
    db: DbSession,
    actor_id: UUID | None = Query(None),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    resource_id: UUID | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
):
    """
    List audit logs with filtering.
    
    Requires admin permissions to view organization-wide logs.
    """
    # TODO: Add permission check for admin access
    
    query = select(AuditLog).where(AuditLog.org_id == user.org_id)
    count_query = select(func.count(AuditLog.id)).where(AuditLog.org_id == user.org_id)
    
    # Apply filters
    if actor_id:
        query = query.where(AuditLog.actor_id == actor_id)
        count_query = count_query.where(AuditLog.actor_id == actor_id)
    
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
        count_query = count_query.where(AuditLog.resource_type == resource_type)
    
    if resource_id:
        query = query.where(AuditLog.resource_id == resource_id)
        count_query = count_query.where(AuditLog.resource_id == resource_id)
    
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
        count_query = count_query.where(AuditLog.created_at >= start_date)
    
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)
        count_query = count_query.where(AuditLog.created_at <= end_date)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Paginate
    offset = (page - 1) * per_page
    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(per_page)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return PaginatedResponse(
        data=[
            AuditLogResponse(
                id=log.id,
                actor_id=log.actor_id,
                actor_email=log.actor_email,
                action=log.action,
                resource_type=log.resource_type,
                resource_id=log.resource_id,
                details=log.details,
                ip_address=str(log.ip_address) if log.ip_address else None,
                created_at=log.created_at,
            )
            for log in logs
        ],
        pagination={
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page,
        },
    )


@router.get("/logs/export")
async def export_audit_logs(
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
    format: str = Query("json", regex="^(json|csv)$"),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
):
    """
    Export audit logs for compliance reporting.
    
    Supports JSON and CSV formats.
    """
    # TODO: Add permission check for export access
    
    query = select(AuditLog).where(AuditLog.org_id == user.org_id)
    
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)
    
    query = query.order_by(AuditLog.created_at.desc()).limit(10000)  # Cap at 10k records
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    # Log the export action
    await audit_log(
        db,
        AuditAction.AUDIT_EXPORT,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        details={
            "format": format,
            "record_count": len(logs),
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
        },
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    await db.commit()
    
    if format == "json":
        data = [
            {
                "id": str(log.id),
                "actor_id": str(log.actor_id) if log.actor_id else None,
                "actor_email": log.actor_email,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": str(log.resource_id) if log.resource_id else None,
                "details": log.details,
                "ip_address": str(log.ip_address) if log.ip_address else None,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ]
        
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={
                "Content-Disposition": f"attachment; filename=audit_logs_{datetime.now().strftime('%Y%m%d')}.json"
            },
        )
    else:
        # CSV format
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "id", "actor_id", "actor_email", "action", "resource_type",
            "resource_id", "ip_address", "created_at"
        ])
        
        # Data
        for log in logs:
            writer.writerow([
                str(log.id),
                str(log.actor_id) if log.actor_id else "",
                log.actor_email or "",
                log.action,
                log.resource_type or "",
                str(log.resource_id) if log.resource_id else "",
                str(log.ip_address) if log.ip_address else "",
                log.created_at.isoformat(),
            ])
        
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=audit_logs_{datetime.now().strftime('%Y%m%d')}.csv"
            },
        )


@router.get("/actions")
async def list_audit_actions():
    """List all available audit action types."""
    return {
        "actions": [
            {"value": action.value, "name": action.name}
            for action in AuditAction
        ]
    }
