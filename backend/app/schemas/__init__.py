"""
Secrets Manager Backend - Pydantic Schemas

Request/Response DTOs for API endpoints.
"""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


# ============================================================
# AUTH SCHEMAS
# ============================================================

class UserRegisterRequest(BaseModel):
    """Registration request."""
    email: EmailStr
    password: str = Field(..., min_length=12, max_length=128)
    org_name: str = Field(..., min_length=1, max_length=255)
    
    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Ensure password meets minimum requirements."""
        if len(v) < 12:
            raise ValueError("Password must be at least 12 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserLoginRequest(BaseModel):
    """Login request."""
    email: EmailStr
    password: str


class MFAVerifyRequest(BaseModel):
    """MFA verification request."""
    code: str = Field(..., min_length=6, max_length=6)


class PasswordChangeRequest(BaseModel):
    """Password change request."""
    current_password: str
    new_password: str = Field(..., min_length=12, max_length=128)
    # Client sends re-encrypted vault keys with new master key
    encrypted_vault_keys: list[dict[str, Any]] = Field(default_factory=list)


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds
    mfa_required: bool = False


class UserResponse(BaseModel):
    """User profile response."""
    id: UUID
    email: str
    email_verified: bool
    mfa_enabled: bool
    status: str
    kdf_salt: str  # hex-encoded for client
    public_key: str | None  # hex-encoded
    created_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


# ============================================================
# VAULT SCHEMAS
# ============================================================

class VaultCreateRequest(BaseModel):
    """Vault creation request."""
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    encrypted_vault_key: str  # base64-encoded


class VaultUpdateRequest(BaseModel):
    """Vault update request."""
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None


class VaultResponse(BaseModel):
    """Vault response."""
    id: UUID
    owner_type: str
    owner_id: UUID
    name: str
    description: str | None
    encrypted_vault_key: str  # base64-encoded
    created_at: datetime
    updated_at: datetime
    item_count: int = 0

    model_config = {"from_attributes": True}


class VaultItemCreateRequest(BaseModel):
    """Vault item creation request."""
    item_type: str = Field(..., pattern="^(password|api_token|ssh_key|totp|secure_note|attachment)$")
    name_searchable: str | None = Field(None, max_length=255)  # Optional cleartext for search
    name_encrypted: str | None = None  # base64, for zero-knowledge
    encrypted_data: str  # base64
    encrypted_item_key: str  # base64
    aad: str  # base64


class VaultItemUpdateRequest(BaseModel):
    """Vault item update request."""
    name_searchable: str | None = Field(None, max_length=255)
    name_encrypted: str | None = None
    encrypted_data: str  # base64
    encrypted_item_key: str  # base64
    aad: str  # base64


class VaultItemResponse(BaseModel):
    """Vault item response."""
    id: UUID
    vault_id: UUID
    item_type: str
    name_searchable: str | None
    name_encrypted: str | None  # base64
    encrypted_data: str  # base64
    encrypted_item_key: str  # base64
    aad: str  # base64
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ============================================================
# SHARING SCHEMAS
# ============================================================

class ShareCreateRequest(BaseModel):
    """Item share creation request."""
    shared_with_type: str = Field(..., pattern="^(user|team)$")
    shared_with_id: UUID
    encrypted_item_key: str  # base64, re-wrapped for recipient
    permission: str = Field("read", pattern="^(read|write)$")
    expires_at: datetime | None = None


class ShareResponse(BaseModel):
    """Item share response."""
    id: UUID
    item_id: UUID
    shared_with_type: str
    shared_with_id: UUID
    permission: str
    shared_by: UUID
    shared_at: datetime
    expires_at: datetime | None

    model_config = {"from_attributes": True}


# ============================================================
# APPROVAL SCHEMAS
# ============================================================

class ApprovalCreateRequest(BaseModel):
    """Approval request creation."""
    request_type: str
    target_resource_type: str | None = None
    target_resource_id: UUID | None = None
    justification: str = Field(..., min_length=10, max_length=2000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ApprovalActionRequest(BaseModel):
    """Approval action (approve/deny)."""
    comment: str | None = Field(None, max_length=1000)


class ApprovalResponse(BaseModel):
    """Approval request response."""
    id: UUID
    request_type: str
    requester_id: UUID
    target_resource_type: str | None
    target_resource_id: UUID | None
    justification: str
    status: str
    required_approvals: int
    approval_count: int
    created_at: datetime
    expires_at: datetime | None
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


# ============================================================
# AUDIT SCHEMAS
# ============================================================

class AuditLogFilter(BaseModel):
    """Audit log filter parameters."""
    actor_id: UUID | None = None
    action: str | None = None
    resource_type: str | None = None
    resource_id: UUID | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    page: int = Field(1, ge=1)
    per_page: int = Field(50, ge=1, le=100)


class AuditLogResponse(BaseModel):
    """Audit log entry response."""
    id: UUID
    actor_id: UUID | None
    actor_email: str | None
    action: str
    resource_type: str | None
    resource_id: UUID | None
    details: dict[str, Any]
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""
    data: list[Any]
    pagination: dict[str, int]  # page, per_page, total, total_pages
