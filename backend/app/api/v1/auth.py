"""
Secrets Manager Backend - Auth API Routes

Authentication endpoints: login, register, MFA, token refresh.
"""
from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import pyotp

from app.api.deps import ClientInfo, CurrentUser, DbSession
from app.core import (
    AuditAction,
    audit_log,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_kdf_salt,
    hash_password,
    verify_password,
    get_settings,
)
from app.models.user import Organization, User, Role, UserRole
from app.schemas import (
    MFAVerifyRequest,
    PasswordChangeRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: UserRegisterRequest,
    db: DbSession,
    client_info: ClientInfo,
):
    """
    Register a new user and organization.
    
    Creates:
    - New organization
    - Admin user with owner role
    - Default roles (owner, admin, member)
    """
    # Check if email already exists
    existing = await db.execute(
        select(User).where(User.email == request.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    # Create organization
    org = Organization(
        name=request.org_name,
        slug=request.org_name.lower().replace(" ", "-")[:50] + "-" + str(uuid4())[:8],
    )
    db.add(org)
    await db.flush()
    
    # Create default roles
    owner_role = Role(
        org_id=org.id,
        name="owner",
        description="Organization owner with full access",
        is_system=True,
        permissions=["*"],  # Full access
    )
    admin_role = Role(
        org_id=org.id,
        name="admin",
        description="Administrator with elevated access",
        is_system=True,
        permissions=["admin.*", "vault.*", "user.read", "audit.read"],
    )
    member_role = Role(
        org_id=org.id,
        name="member",
        description="Standard member with vault access",
        is_system=True,
        permissions=["vault.read", "vault.write", "item.read", "item.write"],
    )
    db.add_all([owner_role, admin_role, member_role])
    await db.flush()
    
    # Create user
    user = User(
        org_id=org.id,
        email=request.email,
        password_hash=hash_password(request.password),
        kdf_salt=generate_kdf_salt(),
    )
    db.add(user)
    await db.flush()
    
    # Assign owner role
    user_role = UserRole(
        user_id=user.id,
        role_id=owner_role.id,
    )
    db.add(user_role)
    
    # Audit log
    await audit_log(
        db,
        AuditAction.USER_CREATE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=org.id,
        resource_type="user",
        resource_id=user.id,
        details={"email": user.email, "org_name": org.name},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return UserResponse(
        id=user.id,
        email=user.email,
        email_verified=user.email_verified,
        mfa_enabled=user.mfa_enabled,
        status=user.status,
        kdf_salt=user.kdf_salt.hex(),
        public_key=user.public_key.hex() if user.public_key else None,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    request: UserLoginRequest,
    db: DbSession,
    client_info: ClientInfo,
):
    """
    Authenticate user with email and password.
    
    Returns JWT tokens if successful.
    If MFA is enabled, returns mfa_required=true.
    """
    # Find user
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(request.password, user.password_hash):
        # Log failed attempt
        if user:
            await audit_log(
                db,
                AuditAction.LOGIN_FAILURE,
                actor_id=user.id,
                actor_email=user.email,
                org_id=user.org_id,
                details={"reason": "invalid_password"},
                ip_address=client_info.get("ip_address"),
                user_agent=client_info.get("user_agent"),
            )
            await db.commit()
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status}",
        )
    
    # Check if MFA is required
    if user.mfa_enabled:
        # Generate temporary session token for MFA verification
        mfa_token = create_access_token(
            {"sub": str(user.id), "mfa_pending": True},
        )
        return TokenResponse(
            access_token=mfa_token,
            refresh_token="",
            expires_in=300,  # 5 minutes to complete MFA
            mfa_required=True,
        )
    
    # Generate tokens
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    # Update last login
    user.last_login_at = datetime.now(timezone.utc)
    
    # Audit log
    await audit_log(
        db,
        AuditAction.LOGIN_SUCCESS,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
        mfa_required=False,
    )


@router.post("/mfa/verify", response_model=TokenResponse)
async def verify_mfa(
    request: MFAVerifyRequest,
    db: DbSession,
    client_info: ClientInfo,
    # This uses the temporary MFA token from login
    credentials: Annotated[str | None, Depends(lambda: None)] = None,
):
    """
    Verify TOTP code after login.
    
    Requires the temporary token from login response.
    """
    # TODO: Extract MFA pending token and verify TOTP
    # This is a stub - full implementation requires token extraction
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="MFA verification not yet implemented",
    )


@router.post("/mfa/setup")
async def setup_mfa(
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """
    Setup MFA for current user.
    
    Returns QR code URL for authenticator app.
    """
    if user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled",
        )
    
    # Generate TOTP secret
    secret = pyotp.random_base32()
    
    # Store encrypted (in production, encrypt with user's key)
    # For now, store as-is (TODO: encrypt)
    user.mfa_secret_encrypted = secret.encode()
    
    # Generate provisioning URI
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(
        name=user.email,
        issuer_name=settings.mfa_issuer,
    )
    
    await audit_log(
        db,
        AuditAction.MFA_SETUP,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return {
        "secret": secret,
        "provisioning_uri": provisioning_uri,
        "message": "Scan QR code with authenticator app, then verify with /mfa/confirm",
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    db: DbSession,
    # TODO: Extract refresh token from request
):
    """Refresh access token using refresh token."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Token refresh not yet implemented",
    )


@router.post("/logout")
async def logout(
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Logout current user (invalidate session)."""
    await audit_log(
        db,
        AuditAction.LOGOUT,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    # TODO: Add token to blacklist (Redis) for server-side invalidation
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(user: CurrentUser):
    """Get current authenticated user profile."""
    return UserResponse(
        id=user.id,
        email=user.email,
        email_verified=user.email_verified,
        mfa_enabled=user.mfa_enabled,
        status=user.status,
        kdf_salt=user.kdf_salt.hex(),
        public_key=user.public_key.hex() if user.public_key else None,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


@router.post("/password/change")
async def change_password(
    request: PasswordChangeRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """
    Change user password.
    
    Client must re-encrypt vault keys with new master key and send them.
    """
    # Verify current password
    if not verify_password(request.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    
    # Update password hash
    user.password_hash = hash_password(request.new_password)
    user.password_changed_at = datetime.now(timezone.utc)
    
    # Generate new KDF salt
    user.kdf_salt = generate_kdf_salt()
    
    # TODO: Update encrypted vault keys from request.encrypted_vault_keys
    
    await audit_log(
        db,
        AuditAction.PASSWORD_CHANGE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return {
        "message": "Password changed successfully",
        "kdf_salt": user.kdf_salt.hex(),
    }
