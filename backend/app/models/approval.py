"""
Secrets Manager Backend - Approval Model

Approval workflow entities for sensitive operations.
"""
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class ApprovalStatus(str):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    EXPIRED = "expired"
    EXECUTED = "executed"


class ApprovalRequestType(str):
    """Types of actions requiring approval."""
    REVEAL_SECRET = "reveal_secret"
    SHARE_EXTERNAL = "share_external"
    MASS_RESET = "mass_reset"
    MASS_REVOKE = "mass_revoke"
    DELETE_VAULT = "delete_vault"
    EXPORT_DATA = "export_data"
    BREAK_GLASS = "break_glass"


class ApprovalRequest(Base):
    """
    Approval request for sensitive operations.
    
    Supports multi-party approval (e.g., 2 of 3 admins).
    """
    
    __tablename__ = "approval_requests"
    
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
    request_type: Mapped[str] = mapped_column(String(50), nullable=False)
    requester_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    
    # Target resource
    target_resource_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    target_resource_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    
    # Request details
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    request_metadata: Mapped[dict] = mapped_column(JSONB, default=dict)
    
    # Approval settings
    status: Mapped[str] = mapped_column(String(20), default=ApprovalStatus.PENDING)
    required_approvals: Mapped[int] = mapped_column(Integer, default=1)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    actions: Mapped[list["ApprovalAction"]] = relationship(back_populates="request", cascade="all, delete-orphan")
    
    @property
    def approval_count(self) -> int:
        """Count of approved actions."""
        return sum(1 for a in self.actions if a.action == "approved")
    
    @property
    def is_approved(self) -> bool:
        """Check if request has enough approvals."""
        return self.approval_count >= self.required_approvals


class ApprovalAction(Base):
    """Individual approval/denial action by an approver."""
    
    __tablename__ = "approval_actions"
    
    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    request_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("approval_requests.id"),
        nullable=False,
    )
    approver_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # approved, denied
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    acted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    
    # Relationships
    request: Mapped["ApprovalRequest"] = relationship(back_populates="actions")
