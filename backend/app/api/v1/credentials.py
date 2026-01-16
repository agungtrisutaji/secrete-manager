"""
Secrets Manager Backend - Credentials API Routes

Simplified credential management for administrators.
Stores email accounts and other credentials with categories.
Now with role-based access control.
"""
import base64
import json
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ClientInfo, CurrentUser, DbSession
from app.core import AuditAction, audit_log
from app.models.vault import Vault, VaultItem
from app.models.permission import CategoryPermission, CredentialRole

router = APIRouter(prefix="/credentials", tags=["credentials"])


# ============================================================
# CREDENTIAL SCHEMAS
# ============================================================

class CredentialCategory(BaseModel):
    """Category for organizing credentials."""
    id: str
    name: str
    icon: str | None = None
    color: str | None = None


# Predefined categories
CATEGORIES = [
    {"id": "email", "name": "Email Accounts", "icon": "mail", "color": "#4285F4"},
    {"id": "social", "name": "Social Media", "icon": "share", "color": "#1DA1F2"},
    {"id": "banking", "name": "Banking & Finance", "icon": "credit-card", "color": "#00C853"},
    {"id": "work", "name": "Work & Business", "icon": "briefcase", "color": "#FF6D00"},
    {"id": "cloud", "name": "Cloud Services", "icon": "cloud", "color": "#9C27B0"},
    {"id": "development", "name": "Development", "icon": "code", "color": "#607D8B"},
    {"id": "shopping", "name": "Shopping", "icon": "shopping-cart", "color": "#E91E63"},
    {"id": "entertainment", "name": "Entertainment", "icon": "play", "color": "#FF5722"},
    {"id": "other", "name": "Other", "icon": "folder", "color": "#9E9E9E"},
]


class CredentialCreateRequest(BaseModel):
    """Request to create a new credential."""
    name: str = Field(..., min_length=1, max_length=255, description="Name/title of the credential")
    category: str = Field("other", description="Category ID")
    username: str | None = Field(None, max_length=255, description="Username or email")
    email: EmailStr | None = Field(None, description="Email address")
    password: str = Field(..., min_length=1, description="Password or secret")
    url: str | None = Field(None, max_length=500, description="Website URL")
    notes: str | None = Field(None, max_length=2000, description="Additional notes")


class CredentialUpdateRequest(BaseModel):
    """Request to update a credential."""
    name: str | None = Field(None, min_length=1, max_length=255)
    category: str | None = None
    username: str | None = Field(None, max_length=255)
    email: EmailStr | None = None
    password: str | None = None
    url: str | None = Field(None, max_length=500)
    notes: str | None = Field(None, max_length=2000)


class CredentialResponse(BaseModel):
    """Response for a credential."""
    id: UUID
    name: str
    category: str
    category_name: str
    username: str | None
    email: str | None
    password: str  # In real app, this would be encrypted
    url: str | None
    notes: str | None
    created_by: UUID | None = None
    can_edit: bool = False
    created_at: str
    updated_at: str


class CredentialListResponse(BaseModel):
    """Response for credential list."""
    credentials: list[CredentialResponse]
    categories: list[dict]
    total: int
    user_role: str


class CategoryPermissionRequest(BaseModel):
    """Request to assign category permission."""
    user_id: UUID
    category_id: str
    permission_type: str = Field("view", pattern="^(view|edit|admin)$")
    notes: str | None = None


class CategoryPermissionResponse(BaseModel):
    """Response for category permission."""
    id: UUID
    user_id: UUID
    category_id: str
    category_name: str
    permission_type: str
    granted_by: UUID | None
    created_at: str
    is_active: bool


class UserRoleRequest(BaseModel):
    """Request to set user role."""
    user_id: UUID
    role: str = Field(..., pattern="^(super_admin|admin|user)$")


class UserRoleResponse(BaseModel):
    """Response for user role."""
    user_id: UUID
    role: str
    email: str | None = None


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def get_category_name(category_id: str) -> str:
    """Get category name from ID."""
    for cat in CATEGORIES:
        if cat["id"] == category_id:
            return cat["name"]
    return "Other"


async def get_user_role(user_id: UUID, db: AsyncSession) -> str:
    """Get user's credential role. Returns 'user' if not set."""
    result = await db.execute(
        select(CredentialRole).where(CredentialRole.user_id == user_id)
    )
    role = result.scalar_one_or_none()
    return role.role if role else "user"


async def get_user_category_permissions(user_id: UUID, db: AsyncSession) -> list[str]:
    """Get list of category IDs the user has access to."""
    result = await db.execute(
        select(CategoryPermission.category_id)
        .where(CategoryPermission.user_id == user_id)
        .where(CategoryPermission.is_active == True)
        .where(
            or_(
                CategoryPermission.expires_at.is_(None),
                CategoryPermission.expires_at > func.now()
            )
        )
    )
    return [row[0] for row in result.fetchall()]


async def can_access_credential(
    user_id: UUID,
    credential_created_by: UUID | None,
    credential_category: str,
    db: AsyncSession,
    require_edit: bool = False
) -> bool:
    """Check if user can access a credential."""
    # Get user role
    role = await get_user_role(user_id, db)
    
    # Admins can access everything
    if role in ("super_admin", "admin"):
        return True
    
    # Creator can always access their own credentials
    if credential_created_by == user_id:
        return True
    
    # Check category permission
    if require_edit:
        perm_types = ["edit", "admin"]
    else:
        perm_types = ["view", "edit", "admin"]
    
    result = await db.execute(
        select(CategoryPermission)
        .where(CategoryPermission.user_id == user_id)
        .where(CategoryPermission.category_id == credential_category)
        .where(CategoryPermission.permission_type.in_(perm_types))
        .where(CategoryPermission.is_active == True)
        .where(
            or_(
                CategoryPermission.expires_at.is_(None),
                CategoryPermission.expires_at > func.now()
            )
        )
    )
    permission = result.scalar_one_or_none()
    return permission is not None


async def get_or_create_admin_vault(user, db: AsyncSession) -> Vault:
    """Get or create the admin's credential vault."""
    result = await db.execute(
        select(Vault)
        .where(Vault.owner_type == "user")
        .where(Vault.owner_id == user.id)
        .where(Vault.name == "My Credentials")
    )
    vault = result.scalar_one_or_none()
    
    if not vault:
        vault = Vault(
            org_id=user.org_id,
            owner_type="user",
            owner_id=user.id,
            name="My Credentials",
            description="Personal credentials and accounts",
            encrypted_vault_key=b"default_key",
        )
        db.add(vault)
        await db.flush()
    
    return vault


async def get_org_vault(org_id: UUID, db: AsyncSession) -> Vault:
    """Get or create organization-wide credential vault."""
    result = await db.execute(
        select(Vault)
        .where(Vault.org_id == org_id)
        .where(Vault.owner_type == "org")
        .where(Vault.name == "Organization Credentials")
    )
    vault = result.scalar_one_or_none()
    
    if not vault:
        vault = Vault(
            org_id=org_id,
            owner_type="org",
            owner_id=org_id,
            name="Organization Credentials",
            description="Shared organization credentials",
            encrypted_vault_key=b"org_key",
        )
        db.add(vault)
        await db.flush()
    
    return vault


# ============================================================
# API ENDPOINTS - CREDENTIALS
# ============================================================

@router.get("/categories", response_model=list[dict])
async def list_categories():
    """Get all available credential categories."""
    return CATEGORIES


@router.get("/my-permissions")
async def get_my_permissions(
    user: CurrentUser,
    db: DbSession,
):
    """Get current user's role and category permissions."""
    role = await get_user_role(user.id, db)
    categories = await get_user_category_permissions(user.id, db)
    
    return {
        "user_id": str(user.id),
        "email": user.email,
        "role": role,
        "is_admin": role in ("super_admin", "admin"),
        "accessible_categories": categories,
    }


@router.get("", response_model=CredentialListResponse)
async def list_credentials(
    user: CurrentUser,
    db: DbSession,
    category: str | None = Query(None, description="Filter by category"),
    search: str | None = Query(None, max_length=100, description="Search by name"),
):
    """
    List credentials based on user permissions:
    - Admins see all credentials
    - Users see their own + credentials in assigned categories
    """
    # Get user role and permissions
    role = await get_user_role(user.id, db)
    is_admin = role in ("super_admin", "admin")
    accessible_categories = await get_user_category_permissions(user.id, db) if not is_admin else None
    
    # Get organization vault
    vault = await get_org_vault(user.org_id, db)
    
    # Query all credentials in org vault
    query = select(VaultItem).where(
        VaultItem.vault_id == vault.id,
        VaultItem.item_type == "credential"
    )
    
    result = await db.execute(query.order_by(VaultItem.updated_at.desc()))
    items = result.scalars().all()
    
    credentials = []
    for item in items:
        try:
            data = json.loads(item.encrypted_data.decode() if isinstance(item.encrypted_data, bytes) else item.encrypted_data)
            item_category = data.get("category", "other")
            item_created_by = item.created_by
            
            # Check access
            if not is_admin:
                # User can see: their own credentials OR credentials in accessible categories
                if item_created_by != user.id and item_category not in accessible_categories:
                    continue
            
            # Apply filters
            if category and item_category != category:
                continue
            if search and search.lower() not in (item.name_searchable or "").lower():
                continue
            
            # Check if user can edit
            can_edit = is_admin or item_created_by == user.id
            
            credentials.append(CredentialResponse(
                id=item.id,
                name=item.name_searchable or data.get("name", "Unnamed"),
                category=item_category,
                category_name=get_category_name(item_category),
                username=data.get("username"),
                email=data.get("email"),
                password=data.get("password", ""),
                url=data.get("url"),
                notes=data.get("notes"),
                created_by=item_created_by,
                can_edit=can_edit,
                created_at=item.created_at.isoformat(),
                updated_at=item.updated_at.isoformat(),
            ))
        except (json.JSONDecodeError, AttributeError):
            continue
    
    return CredentialListResponse(
        credentials=credentials,
        categories=CATEGORIES,
        total=len(credentials),
        user_role=role,
    )


@router.post("", response_model=CredentialResponse, status_code=status.HTTP_201_CREATED)
async def create_credential(
    request: CredentialCreateRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Create a new credential. Any authenticated user can create credentials."""
    # Use org vault so credentials are shared
    vault = await get_org_vault(user.org_id, db)
    
    credential_data = {
        "name": request.name,
        "category": request.category,
        "username": request.username,
        "email": request.email,
        "password": request.password,
        "url": request.url,
        "notes": request.notes,
    }
    
    item = VaultItem(
        vault_id=vault.id,
        item_type="credential",
        name_searchable=request.name,
        name_encrypted=None,
        encrypted_data=json.dumps(credential_data).encode(),
        encrypted_item_key=b"admin_key",
        aad=b"credential",
        created_by=user.id,
    )
    db.add(item)
    await db.flush()
    
    await audit_log(
        db,
        AuditAction.ITEM_CREATE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="credential",
        resource_id=item.id,
        details={"name": request.name, "category": request.category},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return CredentialResponse(
        id=item.id,
        name=request.name,
        category=request.category,
        category_name=get_category_name(request.category),
        username=request.username,
        email=request.email,
        password=request.password,
        url=request.url,
        notes=request.notes,
        created_by=user.id,
        can_edit=True,
        created_at=item.created_at.isoformat(),
        updated_at=item.updated_at.isoformat(),
    )


@router.get("/{credential_id}", response_model=CredentialResponse)
async def get_credential(
    credential_id: UUID,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Get a specific credential by ID. Checks permissions."""
    vault = await get_org_vault(user.org_id, db)
    
    result = await db.execute(
        select(VaultItem)
        .where(VaultItem.id == credential_id)
        .where(VaultItem.vault_id == vault.id)
        .where(VaultItem.item_type == "credential")
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    data = json.loads(item.encrypted_data.decode() if isinstance(item.encrypted_data, bytes) else item.encrypted_data)
    
    # Check permission
    has_access = await can_access_credential(
        user.id, item.created_by, data.get("category", "other"), db
    )
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Log access
    await audit_log(
        db,
        AuditAction.ITEM_VIEW,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="credential",
        resource_id=item.id,
        details={"action": "view_credential"},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    await db.commit()
    
    role = await get_user_role(user.id, db)
    can_edit = role in ("super_admin", "admin") or item.created_by == user.id
    
    return CredentialResponse(
        id=item.id,
        name=item.name_searchable or data.get("name", "Unnamed"),
        category=data.get("category", "other"),
        category_name=get_category_name(data.get("category", "other")),
        username=data.get("username"),
        email=data.get("email"),
        password=data.get("password", ""),
        url=data.get("url"),
        notes=data.get("notes"),
        created_by=item.created_by,
        can_edit=can_edit,
        created_at=item.created_at.isoformat(),
        updated_at=item.updated_at.isoformat(),
    )


@router.patch("/{credential_id}", response_model=CredentialResponse)
async def update_credential(
    credential_id: UUID,
    request: CredentialUpdateRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Update a credential. Only admin or creator can update."""
    vault = await get_org_vault(user.org_id, db)
    
    result = await db.execute(
        select(VaultItem)
        .where(VaultItem.id == credential_id)
        .where(VaultItem.vault_id == vault.id)
        .where(VaultItem.item_type == "credential")
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    data = json.loads(item.encrypted_data.decode() if isinstance(item.encrypted_data, bytes) else item.encrypted_data)
    
    # Check edit permission
    role = await get_user_role(user.id, db)
    if role not in ("super_admin", "admin") and item.created_by != user.id:
        raise HTTPException(status_code=403, detail="Only admin or creator can update")
    
    # Update fields
    if request.name is not None:
        data["name"] = request.name
        item.name_searchable = request.name
    if request.category is not None:
        data["category"] = request.category
    if request.username is not None:
        data["username"] = request.username
    if request.email is not None:
        data["email"] = request.email
    if request.password is not None:
        data["password"] = request.password
    if request.url is not None:
        data["url"] = request.url
    if request.notes is not None:
        data["notes"] = request.notes
    
    item.encrypted_data = json.dumps(data).encode()
    item.version += 1
    
    await audit_log(
        db,
        AuditAction.ITEM_UPDATE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="credential",
        resource_id=item.id,
        details={"action": "update_credential"},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return CredentialResponse(
        id=item.id,
        name=item.name_searchable or data.get("name", "Unnamed"),
        category=data.get("category", "other"),
        category_name=get_category_name(data.get("category", "other")),
        username=data.get("username"),
        email=data.get("email"),
        password=data.get("password", ""),
        url=data.get("url"),
        notes=data.get("notes"),
        created_by=item.created_by,
        can_edit=True,
        created_at=item.created_at.isoformat(),
        updated_at=item.updated_at.isoformat(),
    )


@router.delete("/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credential(
    credential_id: UUID,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Delete a credential. Only admin or creator can delete."""
    vault = await get_org_vault(user.org_id, db)
    
    result = await db.execute(
        select(VaultItem)
        .where(VaultItem.id == credential_id)
        .where(VaultItem.vault_id == vault.id)
        .where(VaultItem.item_type == "credential")
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    # Check delete permission
    role = await get_user_role(user.id, db)
    if role not in ("super_admin", "admin") and item.created_by != user.id:
        raise HTTPException(status_code=403, detail="Only admin or creator can delete")
    
    await audit_log(
        db,
        AuditAction.ITEM_DELETE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="credential",
        resource_id=item.id,
        details={"action": "delete_credential"},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.delete(item)
    await db.commit()


# ============================================================
# API ENDPOINTS - PERMISSIONS (Admin only)
# ============================================================

@router.get("/admin/roles", response_model=list[UserRoleResponse])
async def list_user_roles(
    user: CurrentUser,
    db: DbSession,
):
    """List all user roles. Admin only."""
    role = await get_user_role(user.id, db)
    if role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.execute(select(CredentialRole))
    roles = result.scalars().all()
    
    return [
        UserRoleResponse(user_id=r.user_id, role=r.role)
        for r in roles
    ]


@router.post("/admin/roles", response_model=UserRoleResponse)
async def set_user_role(
    request: UserRoleRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Set user role. Admin only."""
    role = await get_user_role(user.id, db)
    if role != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    # Check if role exists
    result = await db.execute(
        select(CredentialRole).where(CredentialRole.user_id == request.user_id)
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        existing.role = request.role
    else:
        new_role = CredentialRole(user_id=request.user_id, role=request.role)
        db.add(new_role)
    
    await audit_log(
        db,
        AuditAction.PERMISSION_GRANT,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="user_role",
        resource_id=request.user_id,
        details={"role": request.role},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return UserRoleResponse(user_id=request.user_id, role=request.role)


@router.get("/admin/category-permissions", response_model=list[CategoryPermissionResponse])
async def list_category_permissions(
    user: CurrentUser,
    db: DbSession,
):
    """List all category permissions. Admin only."""
    role = await get_user_role(user.id, db)
    if role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.execute(select(CategoryPermission))
    permissions = result.scalars().all()
    
    return [
        CategoryPermissionResponse(
            id=p.id,
            user_id=p.user_id,
            category_id=p.category_id,
            category_name=get_category_name(p.category_id),
            permission_type=p.permission_type,
            granted_by=p.granted_by,
            created_at=p.created_at.isoformat(),
            is_active=p.is_active,
        )
        for p in permissions
    ]


@router.post("/admin/category-permissions", response_model=CategoryPermissionResponse)
async def grant_category_permission(
    request: CategoryPermissionRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Grant category permission to user. Admin only."""
    role = await get_user_role(user.id, db)
    if role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if category is valid
    if request.category_id not in [c["id"] for c in CATEGORIES]:
        raise HTTPException(status_code=400, detail="Invalid category ID")
    
    # Check if permission already exists
    result = await db.execute(
        select(CategoryPermission)
        .where(CategoryPermission.user_id == request.user_id)
        .where(CategoryPermission.category_id == request.category_id)
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        existing.permission_type = request.permission_type
        existing.is_active = True
        existing.notes = request.notes
        permission = existing
    else:
        permission = CategoryPermission(
            user_id=request.user_id,
            category_id=request.category_id,
            permission_type=request.permission_type,
            granted_by=user.id,
            notes=request.notes,
        )
        db.add(permission)
        await db.flush()
    
    await audit_log(
        db,
        AuditAction.PERMISSION_GRANT,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="category_permission",
        resource_id=permission.id,
        details={
            "target_user": str(request.user_id),
            "category": request.category_id,
            "permission": request.permission_type,
        },
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return CategoryPermissionResponse(
        id=permission.id,
        user_id=permission.user_id,
        category_id=permission.category_id,
        category_name=get_category_name(permission.category_id),
        permission_type=permission.permission_type,
        granted_by=permission.granted_by,
        created_at=permission.created_at.isoformat(),
        is_active=permission.is_active,
    )


@router.delete("/admin/category-permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_category_permission(
    permission_id: UUID,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Revoke category permission. Admin only."""
    role = await get_user_role(user.id, db)
    if role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.execute(
        select(CategoryPermission).where(CategoryPermission.id == permission_id)
    )
    permission = result.scalar_one_or_none()
    
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    
    await audit_log(
        db,
        AuditAction.PERMISSION_REVOKE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="category_permission",
        resource_id=permission.id,
        details={
            "target_user": str(permission.user_id),
            "category": permission.category_id,
        },
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.delete(permission)
    await db.commit()
