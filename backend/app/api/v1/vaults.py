"""
Secrets Manager Backend - Vaults API Routes

Vault and item management endpoints.
"""
import base64
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ClientInfo, CurrentUser, DbSession, PermissionChecker
from app.core import AuditAction, audit_log
from app.models.vault import Vault, VaultItem, VaultItemVersion
from app.models.user import Team, TeamMember
from app.schemas import (
    PaginatedResponse,
    VaultCreateRequest,
    VaultItemCreateRequest,
    VaultItemResponse,
    VaultItemUpdateRequest,
    VaultResponse,
    VaultUpdateRequest,
)

router = APIRouter(prefix="/vaults", tags=["vaults"])


# ============================================================
# VAULT ENDPOINTS
# ============================================================

@router.get("", response_model=list[VaultResponse])
async def list_vaults(
    user: CurrentUser,
    db: DbSession,
):
    """
    List all vaults accessible to current user.
    
    Includes:
    - Personal vaults (owner_type='user', owner_id=user.id)
    - Team vaults (where user is a member)
    """
    # Get user's personal vaults
    personal_vaults = await db.execute(
        select(Vault)
        .where(Vault.owner_type == "user")
        .where(Vault.owner_id == user.id)
    )
    
    # Get user's team memberships
    team_memberships = await db.execute(
        select(TeamMember.team_id).where(TeamMember.user_id == user.id)
    )
    team_ids = [tm.team_id for tm in team_memberships.scalars().all()]
    
    # Get team vaults
    team_vaults_result = []
    if team_ids:
        team_vaults = await db.execute(
            select(Vault)
            .where(Vault.owner_type == "team")
            .where(Vault.owner_id.in_(team_ids))
        )
        team_vaults_result = team_vaults.scalars().all()
    
    all_vaults = list(personal_vaults.scalars().all()) + list(team_vaults_result)
    
    # Get item counts
    result = []
    for vault in all_vaults:
        count_result = await db.execute(
            select(func.count(VaultItem.id)).where(VaultItem.vault_id == vault.id)
        )
        item_count = count_result.scalar() or 0
        
        result.append(VaultResponse(
            id=vault.id,
            owner_type=vault.owner_type,
            owner_id=vault.owner_id,
            name=vault.name,
            description=vault.description,
            encrypted_vault_key=base64.b64encode(vault.encrypted_vault_key).decode(),
            created_at=vault.created_at,
            updated_at=vault.updated_at,
            item_count=item_count,
        ))
    
    return result


@router.post("", response_model=VaultResponse, status_code=status.HTTP_201_CREATED)
async def create_vault(
    request: VaultCreateRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Create a new personal vault."""
    vault = Vault(
        org_id=user.org_id,
        owner_type="user",
        owner_id=user.id,
        name=request.name,
        description=request.description,
        encrypted_vault_key=base64.b64decode(request.encrypted_vault_key),
    )
    db.add(vault)
    await db.flush()
    
    await audit_log(
        db,
        AuditAction.VAULT_CREATE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="vault",
        resource_id=vault.id,
        details={"name": vault.name, "owner_type": vault.owner_type},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return VaultResponse(
        id=vault.id,
        owner_type=vault.owner_type,
        owner_id=vault.owner_id,
        name=vault.name,
        description=vault.description,
        encrypted_vault_key=request.encrypted_vault_key,
        created_at=vault.created_at,
        updated_at=vault.updated_at,
        item_count=0,
    )


@router.get("/{vault_id}", response_model=VaultResponse)
async def get_vault(
    vault_id: UUID,
    user: CurrentUser,
    db: DbSession,
):
    """Get vault details by ID."""
    vault = await _get_vault_with_access_check(vault_id, user, db)
    
    count_result = await db.execute(
        select(func.count(VaultItem.id)).where(VaultItem.vault_id == vault.id)
    )
    item_count = count_result.scalar() or 0
    
    return VaultResponse(
        id=vault.id,
        owner_type=vault.owner_type,
        owner_id=vault.owner_id,
        name=vault.name,
        description=vault.description,
        encrypted_vault_key=base64.b64encode(vault.encrypted_vault_key).decode(),
        created_at=vault.created_at,
        updated_at=vault.updated_at,
        item_count=item_count,
    )


@router.patch("/{vault_id}", response_model=VaultResponse)
async def update_vault(
    vault_id: UUID,
    request: VaultUpdateRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Update vault metadata."""
    vault = await _get_vault_with_access_check(vault_id, user, db, require_owner=True)
    
    if request.name is not None:
        vault.name = request.name
    if request.description is not None:
        vault.description = request.description
    
    await audit_log(
        db,
        AuditAction.VAULT_UPDATE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="vault",
        resource_id=vault.id,
        details={"updated_fields": list(request.model_dump(exclude_unset=True).keys())},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return VaultResponse(
        id=vault.id,
        owner_type=vault.owner_type,
        owner_id=vault.owner_id,
        name=vault.name,
        description=vault.description,
        encrypted_vault_key=base64.b64encode(vault.encrypted_vault_key).decode(),
        created_at=vault.created_at,
        updated_at=vault.updated_at,
        item_count=0,
    )


@router.delete("/{vault_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vault(
    vault_id: UUID,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Delete a vault and all its items."""
    vault = await _get_vault_with_access_check(vault_id, user, db, require_owner=True)
    
    await audit_log(
        db,
        AuditAction.VAULT_DELETE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="vault",
        resource_id=vault.id,
        details={"name": vault.name},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.delete(vault)
    await db.commit()


# ============================================================
# VAULT ITEM ENDPOINTS
# ============================================================

@router.get("/{vault_id}/items", response_model=list[VaultItemResponse])
async def list_vault_items(
    vault_id: UUID,
    user: CurrentUser,
    db: DbSession,
    item_type: str | None = Query(None),
    search: str | None = Query(None, max_length=100),
):
    """List items in a vault with optional filtering."""
    vault = await _get_vault_with_access_check(vault_id, user, db)
    
    query = select(VaultItem).where(VaultItem.vault_id == vault.id)
    
    if item_type:
        query = query.where(VaultItem.item_type == item_type)
    
    if search:
        query = query.where(VaultItem.name_searchable.ilike(f"%{search}%"))
    
    result = await db.execute(query.order_by(VaultItem.updated_at.desc()))
    items = result.scalars().all()
    
    return [
        VaultItemResponse(
            id=item.id,
            vault_id=item.vault_id,
            item_type=item.item_type,
            name_searchable=item.name_searchable,
            name_encrypted=base64.b64encode(item.name_encrypted).decode() if item.name_encrypted else None,
            encrypted_data=base64.b64encode(item.encrypted_data).decode(),
            encrypted_item_key=base64.b64encode(item.encrypted_item_key).decode(),
            aad=base64.b64encode(item.aad).decode(),
            version=item.version,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item in items
    ]


@router.post("/{vault_id}/items", response_model=VaultItemResponse, status_code=status.HTTP_201_CREATED)
async def create_vault_item(
    vault_id: UUID,
    request: VaultItemCreateRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Create a new item in a vault."""
    vault = await _get_vault_with_access_check(vault_id, user, db)
    
    item = VaultItem(
        vault_id=vault.id,
        item_type=request.item_type,
        name_searchable=request.name_searchable,
        name_encrypted=base64.b64decode(request.name_encrypted) if request.name_encrypted else None,
        encrypted_data=base64.b64decode(request.encrypted_data),
        encrypted_item_key=base64.b64decode(request.encrypted_item_key),
        aad=base64.b64decode(request.aad),
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
        resource_type="vault_item",
        resource_id=item.id,
        details={"vault_id": str(vault.id), "item_type": item.item_type},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return VaultItemResponse(
        id=item.id,
        vault_id=item.vault_id,
        item_type=item.item_type,
        name_searchable=item.name_searchable,
        name_encrypted=request.name_encrypted,
        encrypted_data=request.encrypted_data,
        encrypted_item_key=request.encrypted_item_key,
        aad=request.aad,
        version=item.version,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/{vault_id}/items/{item_id}", response_model=VaultItemResponse)
async def get_vault_item(
    vault_id: UUID,
    item_id: UUID,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
    justification: str | None = Query(None, min_length=5, max_length=500),
):
    """
    Get a vault item by ID.
    
    This action is logged for audit. Justification is recommended.
    """
    vault = await _get_vault_with_access_check(vault_id, user, db)
    
    result = await db.execute(
        select(VaultItem)
        .where(VaultItem.id == item_id)
        .where(VaultItem.vault_id == vault.id)
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Audit log for item access
    await audit_log(
        db,
        AuditAction.ITEM_VIEW,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="vault_item",
        resource_id=item.id,
        details={
            "vault_id": str(vault.id),
            "justification": justification or "No justification provided",
        },
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return VaultItemResponse(
        id=item.id,
        vault_id=item.vault_id,
        item_type=item.item_type,
        name_searchable=item.name_searchable,
        name_encrypted=base64.b64encode(item.name_encrypted).decode() if item.name_encrypted else None,
        encrypted_data=base64.b64encode(item.encrypted_data).decode(),
        encrypted_item_key=base64.b64encode(item.encrypted_item_key).decode(),
        aad=base64.b64encode(item.aad).decode(),
        version=item.version,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.patch("/{vault_id}/items/{item_id}", response_model=VaultItemResponse)
async def update_vault_item(
    vault_id: UUID,
    item_id: UUID,
    request: VaultItemUpdateRequest,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Update a vault item. Creates a new version for audit trail."""
    vault = await _get_vault_with_access_check(vault_id, user, db)
    
    result = await db.execute(
        select(VaultItem)
        .where(VaultItem.id == item_id)
        .where(VaultItem.vault_id == vault.id)
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Save current version to history
    version = VaultItemVersion(
        item_id=item.id,
        version=item.version,
        encrypted_data=item.encrypted_data,
        encrypted_item_key=item.encrypted_item_key,
        aad=item.aad,
        modified_by=user.id,
    )
    db.add(version)
    
    # Update item
    item.name_searchable = request.name_searchable
    item.name_encrypted = base64.b64decode(request.name_encrypted) if request.name_encrypted else None
    item.encrypted_data = base64.b64decode(request.encrypted_data)
    item.encrypted_item_key = base64.b64decode(request.encrypted_item_key)
    item.aad = base64.b64decode(request.aad)
    item.version += 1
    
    await audit_log(
        db,
        AuditAction.ITEM_UPDATE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="vault_item",
        resource_id=item.id,
        details={"vault_id": str(vault.id), "new_version": item.version},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.commit()
    
    return VaultItemResponse(
        id=item.id,
        vault_id=item.vault_id,
        item_type=item.item_type,
        name_searchable=item.name_searchable,
        name_encrypted=request.name_encrypted,
        encrypted_data=request.encrypted_data,
        encrypted_item_key=request.encrypted_item_key,
        aad=request.aad,
        version=item.version,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.delete("/{vault_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vault_item(
    vault_id: UUID,
    item_id: UUID,
    user: CurrentUser,
    db: DbSession,
    client_info: ClientInfo,
):
    """Delete a vault item."""
    vault = await _get_vault_with_access_check(vault_id, user, db)
    
    result = await db.execute(
        select(VaultItem)
        .where(VaultItem.id == item_id)
        .where(VaultItem.vault_id == vault.id)
    )
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    await audit_log(
        db,
        AuditAction.ITEM_DELETE,
        actor_id=user.id,
        actor_email=user.email,
        org_id=user.org_id,
        resource_type="vault_item",
        resource_id=item.id,
        details={"vault_id": str(vault.id)},
        ip_address=client_info.get("ip_address"),
        user_agent=client_info.get("user_agent"),
    )
    
    await db.delete(item)
    await db.commit()


# ============================================================
# HELPER FUNCTIONS
# ============================================================

async def _get_vault_with_access_check(
    vault_id: UUID,
    user: CurrentUser,
    db: AsyncSession,
    require_owner: bool = False,
) -> Vault:
    """Get vault and verify user has access."""
    result = await db.execute(
        select(Vault).where(Vault.id == vault_id)
    )
    vault = result.scalar_one_or_none()
    
    if not vault:
        raise HTTPException(status_code=404, detail="Vault not found")
    
    # Check access
    has_access = False
    is_owner = False
    
    if vault.owner_type == "user" and vault.owner_id == user.id:
        has_access = True
        is_owner = True
    elif vault.owner_type == "team":
        # Check team membership
        membership = await db.execute(
            select(TeamMember)
            .where(TeamMember.team_id == vault.owner_id)
            .where(TeamMember.user_id == user.id)
        )
        if membership.scalar_one_or_none():
            has_access = True
            # Check if team owner/admin
            member = membership.scalar_one_or_none()
            if member and member.role in ("owner", "admin"):
                is_owner = True
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if require_owner and not is_owner:
        raise HTTPException(status_code=403, detail="Owner permission required")
    
    return vault
