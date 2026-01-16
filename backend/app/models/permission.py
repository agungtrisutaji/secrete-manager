"""
Secrets Manager Backend - Category Permission Model

Manages user access to credential categories.
"""
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class CategoryPermission(Base):
    """
    Assigns users to credential categories.
    
    Permission levels:
    - admin: Full access to all credentials in all categories
    - category_viewer: Can view credentials in assigned categories
    - creator: Can only see credentials they created (implicit, no record needed)
    """
    __tablename__ = "category_permissions"
    
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    
    # User being granted permission
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Category ID (matches CATEGORIES in credentials.py)
    category_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    
    # Permission type: 'view', 'edit', 'admin'
    permission_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="view"
    )
    
    # Who granted this permission
    granted_by: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    
    # Optional expiration
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    
    # Is this permission active?
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    
    # Notes about why this permission was granted
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True
    )
    
    __table_args__ = (
        # Unique constraint: one permission type per user per category
        {"sqlite_autoincrement": True},
    )


class CredentialRole(Base):
    """
    Global user roles for the credential system.
    
    Roles:
    - super_admin: Full access to everything
    - admin: Can manage all credentials and assign permissions
    - user: Regular user, can only see own credentials + assigned categories
    """
    __tablename__ = "credential_roles"
    
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )
    
    # Role: 'super_admin', 'admin', 'user'
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="user"
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
