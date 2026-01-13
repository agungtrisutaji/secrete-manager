"""
Secrets Manager Backend - Main Application Entry Point

FastAPI application with middleware, CORS, and route configuration.
"""
import structlog
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_router
from app.core.config import get_settings
from app.db.database import init_db

# Import all models so they are registered with SQLAlchemy Base
from app.models import (  # noqa: F401
    Organization, User, Role, UserRole, Team, TeamMember,
    Vault, VaultItem, VaultItemVersion, ItemShare,
    ApprovalRequest, ApprovalAction,
    AuditLog, AccessReview, AccessReviewEntry,
)

settings = get_settings()

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    logger.info("Starting Secrets Manager API", environment=settings.environment)
    
    # Initialize database (in development only - use Alembic in production)
    if settings.environment == "development":
        try:
            await init_db()
            logger.info("Database initialized")
        except Exception as e:
            logger.error("Database initialization failed", error=str(e))
    
    yield
    
    # Shutdown
    logger.info("Shutting down Secrets Manager API")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Compliance-first internal secrets manager with zero-knowledge encryption",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with correlation ID."""
    import uuid
    
    correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
    
    # Bind correlation ID to logger context
    structlog.contextvars.bind_contextvars(correlation_id=correlation_id)
    
    try:
        logger.info(
            "request_started",
            method=request.method,
            path=request.url.path,
            client_ip=request.client.host if request.client else None,
        )
        
        response = await call_next(request)
        
        logger.info(
            "request_completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
        )
        
        # Add correlation ID to response headers
        response.headers["X-Correlation-ID"] = correlation_id
        
        return response
    finally:
        structlog.contextvars.unbind_contextvars("correlation_id")


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions."""
    logger.error(
        "unhandled_exception",
        error=str(exc),
        path=request.url.path,
        method=request.method,
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
            }
        },
    )


# Include API routes
app.include_router(api_router)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for load balancers and monitoring."""
    return {
        "status": "healthy",
        "version": settings.app_version,
        "environment": settings.environment,
    }


# Root redirect
@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs" if settings.debug else "disabled",
    }
