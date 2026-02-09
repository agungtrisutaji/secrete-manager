"""
Secrets Manager Backend - Audit Module

Provides immutable, append-only audit logging with hash chain integrity.
CRITICAL: This module must NEVER log plaintext secrets.
"""
import hashlib
import json
from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()


class AuditAction(str, Enum):
    """Enumeration of auditable actions."""
    
    # Authentication
    LOGIN_SUCCESS = "auth.login.success"
    LOGIN_FAILURE = "auth.login.failure"
    LOGOUT = "auth.logout"
    MFA_SETUP = "auth.mfa.setup"
    MFA_VERIFY = "auth.mfa.verify"
    PASSWORD_CHANGE = "auth.password.change"
    
    # Vault operations
    VAULT_CREATE = "vault.create"
    VAULT_UPDATE = "vault.update"
    VAULT_DELETE = "vault.delete"
    
    # Item operations
    ITEM_CREATE = "item.create"
    ITEM_VIEW = "item.view"
    ITEM_REVEAL = "item.reveal"
    ITEM_UPDATE = "item.update"
    ITEM_DELETE = "item.delete"
    ITEM_COPY = "item.copy"
    
    # Sharing
    SHARE_CREATE = "share.create"
    SHARE_REVOKE = "share.revoke"
    
    # Approvals
    APPROVAL_REQUEST = "approval.request"
    APPROVAL_APPROVE = "approval.approve"
    APPROVAL_DENY = "approval.deny"
    APPROVAL_EXECUTE = "approval.execute"
    
    # Admin
    USER_CREATE = "admin.user.create"
    USER_UPDATE = "admin.user.update"
    USER_SUSPEND = "admin.user.suspend"
    USER_OFFBOARD = "admin.user.offboard"
    ROLE_ASSIGN = "admin.role.assign"
    ROLE_REVOKE = "admin.role.revoke"
    
    # Email integration
    EMAIL_RESET = "email.reset"
    EMAIL_MFA_ENFORCE = "email.mfa.enforce"
    
    # Access review
    ACCESS_REVIEW_START = "review.start"
    ACCESS_REVIEW_DECISION = "review.decision"
    ACCESS_REVIEW_COMPLETE = "review.complete"
    
    # Export
    AUDIT_EXPORT = "audit.export"
    DATA_EXPORT = "data.export"


class AuditLogger:
    """
    Audit logger that creates immutable, hash-chained entries.
    
    SECURITY NOTES:
    - NEVER log plaintext secrets, passwords, or keys
    - Log only metadata: IDs, types, timestamps, actors
    - Use hash chain for tamper detection
    """
    
    _last_hash: bytes | None = None
    
    @classmethod
    def _compute_hash(
        cls,
        prev_hash: bytes | None,
        action: str,
        actor_id: str | None,
        resource_id: str | None,
        timestamp: str,
        details: dict[str, Any],
    ) -> bytes:
        """Compute SHA-256 hash for hash chain."""
        data = json.dumps({
            "prev_hash": prev_hash.hex() if prev_hash else None,
            "action": action,
            "actor_id": actor_id,
            "resource_id": resource_id,
            "timestamp": timestamp,
            "details": details,
        }, sort_keys=True)
        return hashlib.sha256(data.encode()).digest()
    
    @classmethod
    async def log(
        cls,
        db: AsyncSession,
        action: AuditAction,
        actor_id: UUID | None = None,
        actor_email: str | None = None,
        org_id: UUID | None = None,
        resource_type: str | None = None,
        resource_id: UUID | None = None,
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        session_id: UUID | None = None,
        approval_id: UUID | None = None,
    ) -> UUID:
        """
        Create an immutable audit log entry.
        
        Args:
            db: Database session
            action: The action being logged
            actor_id: ID of user performing action
            actor_email: Email of actor (denormalized for archival)
            org_id: Organization ID
            resource_type: Type of resource (vault, item, user, etc.)
            resource_id: ID of the resource
            details: Additional metadata (NEVER secrets!)
            ip_address: Client IP address
            user_agent: Client user agent
            session_id: Current session ID
            approval_id: Related approval request ID
            
        Returns:
            UUID of created audit log entry
        """
        # Sanitize details - remove any potential secrets
        safe_details = cls._sanitize_details(details or {})
        
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # Compute hash chain
        prev_hash = cls._last_hash
        entry_hash = cls._compute_hash(
            prev_hash=prev_hash,
            action=action.value,
            actor_id=str(actor_id) if actor_id else None,
            resource_id=str(resource_id) if resource_id else None,
            timestamp=timestamp,
            details=safe_details,
        )
        cls._last_hash = entry_hash
        
        # Import here to avoid circular imports
        from app.models.audit import AuditLog
        
        log_entry = AuditLog(
            org_id=org_id,
            actor_id=actor_id,
            actor_email=actor_email,
            action=action.value,
            resource_type=resource_type,
            resource_id=resource_id,
            details=safe_details,
            ip_address=ip_address,
            user_agent=user_agent,
            session_id=session_id,
            approval_id=approval_id,
            prev_hash=prev_hash,
        )
        
        db.add(log_entry)
        await db.flush()
        
        # Also log to structured logger for observability
        logger.info(
            "audit_event",
            action=action.value,
            actor_id=str(actor_id) if actor_id else None,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            org_id=str(org_id) if org_id else None,
        )
        
        return log_entry.id
    
    @classmethod
    def _sanitize_details(cls, details: dict[str, Any]) -> dict[str, Any]:
        """
        Remove any potentially sensitive data from details.
        
        CRITICAL: This is a safety net, but callers should never pass secrets.
        """
        sensitive_keys = {
            "password", "secret", "key", "token", "credential", "private",
            "encrypted", "plaintext", "decrypted", "master", "salt",
        }
        
        sanitized = {}
        for key, value in details.items():
            key_lower = key.lower()
            if any(sensitive in key_lower for sensitive in sensitive_keys):
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, dict):
                sanitized[key] = cls._sanitize_details(value)
            else:
                sanitized[key] = value
        
        return sanitized


# Convenience function for quick logging
async def audit_log(
    db: AsyncSession,
    action: AuditAction,
    **kwargs,
) -> UUID:
    """Convenience wrapper for AuditLogger.log()."""
    return await AuditLogger.log(db, action, **kwargs)
