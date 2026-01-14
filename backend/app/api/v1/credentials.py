"""
Secrets Manager Backend - Credentials API Routes

Simplified credential management for administrators.
Stores email accounts and other credentials with categories.
"""
import base64
import json
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ClientInfo, CurrentUser, DbSession
from app.core import AuditAction, audit_log
from app.models.vault import Vault, VaultItem

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
    created_at: str
    updated_at: str


class CredentialListResponse(BaseModel):
    """Response for credential list."""
    credentials: list[CredentialResponse]
    categories: list[dict]
    total: int


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def get_category_name(category_id: str) -> str:
    """Get category name from ID."""
    for cat in CATEGORIES:
        if cat["id"] == category_id:
            return cat["name"]
    return "Other"


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
        # Create a default vault for credentials
        vault = Vault(
            org_id=user.org_id,
            owner_type="user",
            owner_id=user.id,
            name="My Credentials",
            description="Personal credentials and accounts",
            encrypted_vault_key=b"default_key",  # Simplified for admin use
        )
        db.add(vault)
        await db.flush()
    
    return vault


# ============================================================
# API ENDPOINTS
# ============================================================

@router.get("/categories", response_model=list[dict])
async def list_categories():
    """Get all available credential categories."""
    return CATEGORIES


@router.get("", response_model=CredentialListResponse)
async def list_credentials(
    user: CurrentUser,
    db: DbSession,
    category: str | None = Query(None, description="Filter by category"),
    search: str | None = Query(None, max_length=100, description="Search by name"),
):
    """List all credentials for the current user."""
    vault = await get_or_create_admin_vault(user, db)
    
    query = select(VaultItem).where(
        VaultItem.vault_id == vault.id,
        VaultItem.item_type == "credential"
    )
    
    result = await db.execute(query.order_by(VaultItem.updated_at.desc()))
    items = result.scalars().all()
    
    credentials = []
    for item in items:
        try:
            # Decode stored data
            data = json.loads(item.encrypted_data.decode() if isinstance(item.encrypted_data, bytes) else item.encrypted_data)
            
            # Apply filters
            if category and data.get("category") != category:
                continue
            if search and search.lower() not in (item.name_searchable or "").lower():
                continue
            
            credentials.append(CredentialResponse(
                id=item.id,
                name=item.name_searchable or data.get("name", "Unnamed"),
                category=data.get("category", "other"),
                category_name=get_category_name(data.get("category", "other")),
                username=data.get("username"),
                email=data.get("email"),
                password=data.get("password", ""),
                url=data.get("url"),
                notes=data.get("notes"),
                created_at=item.created_at.isoformat(),
                updated_at=item.updated_at.isoformat(),
            ))
        except (json.JSONDecodeError, AttributeError):
            continue
    
    return CredentialListResponse(
        credentials=credentials,
        categories=CATEGORIES,
        total=len(credentials),
    )


@router.post("", response_model=CredentialResponse, status_code=status.HTTP_201_CREATED)
async def create_credential(
    request: CredentialCreateRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Create a new credential."""
    vault = await get_or_create_admin_vault(user, db)
    
    # Store credential data as JSON
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
    """Get a specific credential by ID."""
    vault = await get_or_create_admin_vault(user, db)
    
    result = await db.execute(
        select(VaultItem)
        .where(VaultItem.id == credential_id)
        .where(VaultItem.vault_id == vault.id)
        .where(VaultItem.item_type == "credential")
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Credential not found")
    
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
    
    data = json.loads(item.encrypted_data.decode() if isinstance(item.encrypted_data, bytes) else item.encrypted_data)
    
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
    """Update a credential."""
    vault = await get_or_create_admin_vault(user, db)
    
    result = await db.execute(
        select(VaultItem)
        .where(VaultItem.id == credential_id)
        .where(VaultItem.vault_id == vault.id)
        .where(VaultItem.item_type == "credential")
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    # Load existing data
    data = json.loads(item.encrypted_data.decode() if isinstance(item.encrypted_data, bytes) else item.encrypted_data)
    
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
    """Delete a credential."""
    vault = await get_or_create_admin_vault(user, db)
    
    result = await db.execute(
        select(VaultItem)
        .where(VaultItem.id == credential_id)
        .where(VaultItem.vault_id == vault.id)
        .where(VaultItem.item_type == "credential")
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Credential not found")
    
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
