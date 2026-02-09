"""
Secrets Manager Backend - Vault Model

Vault and VaultItem entities with encryption metadata.
"""
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Vault(Base):
    """
    Vault entity - container for secret items.
    
    Can be owned by a user (personal) or team (shared).
    """
    
    __tablename__ = "vaults"
    
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    org_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
    )
    owner_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user' or 'team'
    owner_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # Vault Key encrypted with owner's Master Key
    encrypted_vault_key: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    # Relationships
    items: Mapped[list["VaultItem"]] = relationship(back_populates="vault", cascade="all, delete-orphan")


class VaultItem(Base):
    """
    VaultItem entity - encrypted secret with metadata.
    
    Item types: password, api_token, ssh_key, totp, secure_note, attachment
    """
    
    __tablename__ = "vault_items"
    
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    vault_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("vaults.id", ondelete="CASCADE"),
        nullable=False,
    )
    item_type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Name can be stored encrypted (zero-knowledge) or searchable (tradeoff)
    name_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    name_searchable: Mapped[str | None] = mapped_column(String(255), nullable=True)
    
    # Encrypted payload (JSON structure depends on item_type)
    encrypted_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    
    # Item Key encrypted with Vault Key
    encrypted_item_key: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    
    # Additional Authenticated Data for AEAD
    aad: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    
    version: Mapped[int] = mapped_column(Integer, default=1)
    
    created_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    # Relationships
    vault: Mapped["Vault"] = relationship(back_populates="items")
    versions: Mapped[list["VaultItemVersion"]] = relationship(back_populates="item", cascade="all, delete-orphan")
    shares: Mapped[list["ItemShare"]] = relationship(back_populates="item", cascade="all, delete-orphan")


class VaultItemVersion(Base):
    """Historical versions of vault items for audit trail."""
    
    __tablename__ = "vault_item_versions"
    
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("vault_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    encrypted_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    encrypted_item_key: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    aad: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    modified_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    modified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    
    # Relationships
    item: Mapped["VaultItem"] = relationship(back_populates="versions")


class ItemShare(Base):
    """
    Sharing record - Item Key re-wrapped for recipient.
    
    Recipients can be users or teams.
    """
    
    __tablename__ = "item_shares"
    
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("vault_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    shared_with_type: Mapped[str] = mapped_column(String(20), nullable=False)  # 'user' or 'team'
    shared_with_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    
    # Item Key re-wrapped for recipient's public key
    encrypted_item_key: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    
    permission: Mapped[str] = mapped_column(String(20), default="read")  # read, write
    
    shared_by: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    shared_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    item: Mapped["VaultItem"] = relationship(back_populates="shares")
