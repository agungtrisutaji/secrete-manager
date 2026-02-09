# Secrets Manager

Compliance-first internal secrets manager with zero-knowledge encryption.

## Features

- **Personal & Team Vault**: Manage passwords, API tokens, SSH keys, TOTP secrets, recovery codes, secure notes
- **Zero-Knowledge Encryption**: Client-side encryption with AES-256-GCM
- **Audit-Ready**: SOC2/ISO-minded controls with complete audit trails
- **Approval Workflows**: Break-glass, sharing, and sensitive operation approvals
- **RBAC**: Role-based access control with least privilege principle

## Tech Stack

### Backend
- Python 3.12+
- FastAPI (async)
- SQLAlchemy 2.0
- PostgreSQL 15+
- Redis (caching/sessions)

### Frontend
- Next.js 14 (TypeScript)
- Tailwind CSS + shadcn/ui
- TanStack Query
- Zod validation

## Quick Start

### Development with Docker

```bash
# Copy environment variables
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Local Development

#### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/macOS
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

## Project Structure

```
secrets-manager/
├── backend/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── core/          # Config, security, audit
│   │   ├── db/            # Database connection
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   └── main.py        # FastAPI application
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js app router
│   │   ├── components/    # React components
│   │   └── lib/           # Utilities, crypto
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml      # Development
├── docker-compose.prod.yml # Production
└── README.md
```

## Security Considerations

- All secrets are encrypted client-side using AES-256-GCM
- Server never receives or stores plaintext secrets
- Keys derived using PBKDF2 (Argon2id recommended when available)
- Envelope encryption: MasterKey → VaultKey → ItemKey
- All actions logged to immutable audit trail

## License

Proprietary - Internal Use Only
