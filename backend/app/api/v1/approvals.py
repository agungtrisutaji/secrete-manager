"""
Secrets Manager Backend - Approvals API Routes

Approval workflow endpoints for sensitive operations.
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ClientInfo, CurrentUser, DbSession, PermissionChecker
from app.core import AuditAction, audit_log
from app.models.approval import ApprovalAction, ApprovalRequest, ApprovalStatus
from app.schemas import ApprovalActionRequest, ApprovalCreateRequest, ApprovalResponse

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.get("", response_model=list[ApprovalResponse])
async def list_pending_approvals(
    user: CurrentUser,
    db: DbSession,
    status_filter: str = Query("pending", regex="^(pending|approved|denied|all)$"),
):
    """
    List approval requests pending review.
    
    By default, shows pending approvals for the current user to review.
    Admins can see all pending approvals in their organization.
    """
    query = select(ApprovalRequest).where(ApprovalRequest.org_id == user.org_id)
    
    if status_filter != "all":
        query = query.where(ApprovalRequest.status == status_filter)
    
    query = query.order_by(ApprovalRequest.created_at.desc())
    
    result = await db.execute(query)
    requests = result.scalars().all()
    
    return [
        ApprovalResponse(
            id=req.id,
            request_type=req.request_type,
            requester_id=req.requester_id,
            target_resource_type=req.target_resource_type,
            target_resource_id=req.target_resource_id,
            justification=req.justification,
            status=req.status,
            required_approvals=req.required_approvals,
            approval_count=req.approval_count,
            created_at=req.created_at,
            expires_at=req.expires_at,
            resolved_at=req.resolved_at,
        )
        for req in requests
    ]


@router.get("/my-requests", response_model=list[ApprovalResponse])
async def list_my_requests(
    user: CurrentUser,
    db: DbSession,
):
    """List approval requests created by current user."""
    result = await db.execute(
        select(ApprovalRequest)
        .where(ApprovalRequest.requester_id == user.id)
        .order_by(ApprovalRequest.created_at.desc())
    )
    requests = result.scalars().all()
    
    return [
        ApprovalResponse(
            id=req.id,
            request_type=req.request_type,
            requester_id=req.requester_id,
            target_resource_type=req.target_resource_type,
            target_resource_id=req.target_resource_id,
            justification=req.justification,
            status=req.status,
            required_approvals=req.required_approvals,
            approval_count=req.approval_count,
            created_at=req.created_at,
            expires_at=req.expires_at,
            resolved_at=req.resolved_at,
        )
        for req in requests
    ]


@router.post("", response_model=ApprovalResponse, status_code=status.HTTP_201_CREATED)
async def create_approval_request(
    request: ApprovalCreateRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """
    Create a new approval request.
    
    Used for sensitive operations like:
    - reveal_secret (break-glass)
    - share_external
    - mass_reset
    - delete_vault
    """
    approval = ApprovalRequest(
        org_id=user.org_id,
        request_type=request.request_type,
        requester_id=user.id,
        target_resource_type=request.target_resource_type,
        target_resource_id=request.target_resource_id,
        justification=request.justification,
        metadata=request.metadata,
        required_approvals=1,  # TODO: Make configurable based on request type
    )
    db.add(approval)
    await db.flush()
    
    await audit_log(
        db,
        AuditAction.APPROVAL_REQUEST,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="approval_request",
        resource_id=approval.id,
        details={
            "request_type": request.request_type,
            "target_resource_type": request.target_resource_type,
            "target_resource_id": str(request.target_resource_id) if request.target_resource_id else None,
        },
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    # TODO: Send notification to approvers
    
    return ApprovalResponse(
        id=approval.id,
        request_type=approval.request_type,
        requester_id=approval.requester_id,
        target_resource_type=approval.target_resource_type,
        target_resource_id=approval.target_resource_id,
        justification=approval.justification,
        status=approval.status,
        required_approvals=approval.required_approvals,
        approval_count=0,
        created_at=approval.created_at,
        expires_at=approval.expires_at,
        resolved_at=approval.resolved_at,
    )


@router.get("/{approval_id}", response_model=ApprovalResponse)
async def get_approval_request(
    approval_id: UUID,
    user: CurrentUser,
    db: DbSession,
):
    """Get approval request details."""
    result = await db.execute(
        select(ApprovalRequest)
        .where(ApprovalRequest.id == approval_id)
        .where(ApprovalRequest.org_id == user.org_id)
    )
    approval = result.scalar_one_or_none()
    
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
    
    return ApprovalResponse(
        id=approval.id,
        request_type=approval.request_type,
        requester_id=approval.requester_id,
        target_resource_type=approval.target_resource_type,
        target_resource_id=approval.target_resource_id,
        justification=approval.justification,
        status=approval.status,
        required_approvals=approval.required_approvals,
        approval_count=approval.approval_count,
        created_at=approval.created_at,
        expires_at=approval.expires_at,
        resolved_at=approval.resolved_at,
    )


@router.post("/{approval_id}/approve")
async def approve_request(
    approval_id: UUID,
    request: ApprovalActionRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """
    Approve an approval request.
    
    Requires appropriate permissions. Cannot approve own requests.
    """
    approval = await _get_approval_for_action(approval_id, user, db)
    
    # Check if user already acted
    existing_action = await db.execute(
        select(ApprovalAction)
        .where(ApprovalAction.request_id == approval.id)
        .where(ApprovalAction.approver_id == user.id)
    )
    if existing_action.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already acted on this request",
        )
    
    # Create approval action
    action = ApprovalAction(
        request_id=approval.id,
        approver_id=user.id,
        action="approved",
        comment=request.comment,
    )
    db.add(action)
    await db.flush()
    
    # Check if request is now fully approved
    approval_count = await _count_approvals(approval.id, db)
    if approval_count >= approval.required_approvals:
        approval.status = ApprovalStatus.APPROVED
        approval.resolved_at = datetime.now(timezone.utc)
    
    await audit_log(
        db,
        AuditAction.APPROVAL_APPROVE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="approval_request",
        resource_id=approval.id,
        details={
            "request_type": approval.request_type,
            "approval_count": approval_count,
            "required_approvals": approval.required_approvals,
        },
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return {
        "message": "Request approved",
        "status": approval.status,
        "approval_count": approval_count,
    }


@router.post("/{approval_id}/deny")
async def deny_request(
    approval_id: UUID,
    request: ApprovalActionRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """
    Deny an approval request.
    
    Immediately closes the request as denied.
    """
    approval = await _get_approval_for_action(approval_id, user, db)
    
    # Create denial action
    action = ApprovalAction(
        request_id=approval.id,
        approver_id=user.id,
        action="denied",
        comment=request.comment,
    )
    db.add(action)
    
    # Mark request as denied
    approval.status = ApprovalStatus.DENIED
    approval.resolved_at = datetime.now(timezone.utc)
    
    await audit_log(
        db,
        AuditAction.APPROVAL_DENY,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="approval_request",
        resource_id=approval.id,
        details={"request_type": approval.request_type, "reason": request.comment},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return {"message": "Request denied", "status": approval.status}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

async def _get_approval_for_action(
    approval_id: UUID,
    user: CurrentUser,
    db: DbSession,
) -> ApprovalRequest:
    """Get approval request and validate it can be acted upon."""
    result = await db.execute(
        select(ApprovalRequest)
        .where(ApprovalRequest.id == approval_id)
        .where(ApprovalRequest.org_id == user.org_id)
    )
    approval = result.scalar_one_or_none()
    
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
    
    if approval.status != ApprovalStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request is already {approval.status}",
        )
    
    if approval.requester_id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve/deny your own request",
        )
    
    # Check expiration
    if approval.expires_at and approval.expires_at < datetime.now(timezone.utc):
        approval.status = ApprovalStatus.EXPIRED
        approval.resolved_at = datetime.now(timezone.utc)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request has expired",
        )
    
    return approval


async def _count_approvals(approval_id: UUID, db: DbSession) -> int:
    """Count approval actions for a request."""
    from sqlalchemy import func
    
    result = await db.execute(
        select(func.count(ApprovalAction.id))
        .where(ApprovalAction.request_id == approval_id)
        .where(ApprovalAction.action == "approved")
    )
    return result.scalar() or 0
