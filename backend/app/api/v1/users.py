"""
Secrets Manager Backend - Users API Routes

Admin-only user management endpoints.
"""
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ClientInfo, CurrentUser, DbSession
from app.core import AuditAction, audit_log, hash_password, generate_kdf_salt
from app.models.user import User, UserStatus
from app.models.permission import CredentialRole

router = APIRouter(prefix="/users", tags=["users"])


# ============================================================
# SCHEMAS
# ============================================================

class UserCreateRequest(BaseModel):
    """Request to create a new user by admin."""
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field("user", pattern="^(super_admin|admin|user)$")


class UserUpdateRequest(BaseModel):
    """Request to update a user."""
    status: str | None = Field(None, pattern="^(active|suspended|offboarded)$")
    role: str | None = Field(None, pattern="^(super_admin|admin|user)$")


class UserResponse(BaseModel):
    """Response for a user."""
    id: UUID
    email: str
    role: str
    status: str
    mfa_enabled: bool
    created_at: str
    last_login: str | None


class UserListResponse(BaseModel):
    """Response for user list."""
    users: list[UserResponse]
    total: int


class PasswordResetRequest(BaseModel):
    """Request to reset user password by admin."""
    new_password: str = Field(..., min_length=8, max_length=128)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

async def get_user_role(user_id: UUID, db: AsyncSession) -> str:
    """Get user's credential role. Returns 'user' if not set."""
    result = await db.execute(
        select(CredentialRole).where(CredentialRole.user_id == user_id)
    )
    role = result.scalar_one_or_none()
    return role.role if role else "user"


async def check_admin_access(user: User, db: AsyncSession) -> str:
    """Check if user has admin access, raise exception if not."""
    role = await get_user_role(user.id, db)
    if role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return role


def build_user_response(u: User, role: str) -> UserResponse:
    """Build a UserResponse from a User model instance."""
    return UserResponse(
        id=u.id,
        email=u.email,
        role=role,
        status=u.status or "active",
        mfa_enabled=u.mfa_enabled,
        created_at=u.created_at.isoformat(),
        last_login=u.last_login_at.isoformat() if u.last_login_at else None,
    )


# ============================================================
# API ENDPOINTS
# ============================================================

@router.get("", response_model=UserListResponse)
async def list_users(
    user: CurrentUser,
    db: DbSession,
    search: str | None = Query(None, max_length=100),
    status_filter: str | None = Query(None, alias="status"),
):
    """List all users in the organization. Admin only."""
    await check_admin_access(user, db)
    
    query = select(User).where(User.org_id == user.org_id)
    
    if search:
        query = query.where(User.email.ilike(f"%{search}%"))
    
    if status_filter:
        query = query.where(User.status == status_filter)
    
    result = await db.execute(query.order_by(User.created_at.desc()))
    users = result.scalars().all()
    
    # Get roles for all users
    user_responses = []
    for u in users:
        role = await get_user_role(u.id, db)
        user_responses.append(build_user_response(u, role))
    
    return UserListResponse(users=user_responses, total=len(user_responses))


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    request: UserCreateRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Create a new user. Admin only."""
    current_role = await check_admin_access(user, db)
    
    # Only super_admin can create super_admin users
    if request.role == "super_admin" and current_role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super_admin can create super_admin users")
    
    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    kdf_salt = generate_kdf_salt()
    password_hash = hash_password(request.password)
    
    new_user = User(
        org_id=user.org_id,
        email=request.email,
        password_hash=password_hash,
        kdf_salt=kdf_salt,
        status=UserStatus.ACTIVE,
    )
    db.add(new_user)
    await db.flush()
    
    # Set role if not 'user'
    if request.role != "user":
        credential_role = CredentialRole(
            user_id=new_user.id,
            role=request.role,
        )
        db.add(credential_role)
    
    await audit_log(
        db,
        AuditAction.USER_CREATE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="user",
        resource_id=new_user.id,
        details={"email": request.email, "role": request.role},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return build_user_response(new_user, request.role)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_detail(
    user_id: UUID,
    user: CurrentUser,
    db: DbSession,
):
    """Get a specific user. Admin only."""
    await check_admin_access(user, db)
    
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == user.org_id)
    )
    target_user = result.scalar_one_or_none()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    role = await get_user_role(target_user.id, db)
    return build_user_response(target_user, role)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    request: UserUpdateRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Update a user. Admin only."""
    current_role = await check_admin_access(user, db)
    
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == user.org_id)
    )
    target_user = result.scalar_one_or_none()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update status if provided
    if request.status is not None:
        target_user.status = request.status
    
    # Update role if provided
    target_role = await get_user_role(target_user.id, db)
    if request.role is not None and request.role != target_role:
        # Only super_admin can set super_admin role
        if request.role == "super_admin" and current_role != "super_admin":
            raise HTTPException(status_code=403, detail="Only super_admin can set super_admin role")
        
        # Find or create role record
        result = await db.execute(
            select(CredentialRole).where(CredentialRole.user_id == target_user.id)
        )
        existing_role = result.scalar_one_or_none()
        
        if existing_role:
            existing_role.role = request.role
        else:
            new_role = CredentialRole(user_id=target_user.id, role=request.role)
            db.add(new_role)
        
        target_role = request.role
    
    await audit_log(
        db,
        AuditAction.USER_UPDATE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="user",
        resource_id=target_user.id,
        details={"updated_fields": request.model_dump(exclude_none=True)},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    return build_user_response(target_user, target_role)


@router.post("/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_user_password(
    user_id: UUID,
    request: PasswordResetRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Reset a user's password. Admin only."""
    await check_admin_access(user, db)
    
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == user.org_id)
    )
    target_user = result.scalar_one_or_none()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    target_user.password_hash = hash_password(request.new_password)
    
    await audit_log(
        db,
        AuditAction.PASSWORD_CHANGE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="user",
        resource_id=target_user.id,
        details={"action": "admin_password_reset"},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: UUID,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Deactivate a user (soft delete). Admin only."""
    current_role = await check_admin_access(user, db)
    
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    
    result = await db.execute(
        select(User).where(User.id == user_id, User.org_id == user.org_id)
    )
    target_user = result.scalar_one_or_none()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if trying to deactivate a super_admin
    target_role = await get_user_role(target_user.id, db)
    if target_role == "super_admin" and current_role != "super_admin":
        raise HTTPException(status_code=403, detail="Only super_admin can deactivate super_admin users")
    
    target_user.status = UserStatus.SUSPENDED
    
    await audit_log(
        db,
        AuditAction.USER_SUSPEND,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="user",
        resource_id=target_user.id,
        details={"action": "deactivate"},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
