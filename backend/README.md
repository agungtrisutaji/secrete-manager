# Secrets Manager Backend

## Environment Variables

```bash
# Application
APP_NAME=Secrets Manager
APP_VERSION=1.0.0
ENVIRONMENT=development
DEBUG=true

# Database
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/secrets_manager

# Redis
REDIS_URL=redis://localhost:6379/0

# Security (CHANGE IN PRODUCTION!)
SECRET_KEY=CHANGE-THIS-IN-PRODUCTION-USE-64-CHAR-RANDOM-STRING-HERE

# CORS
CORS_ORIGINS=http://localhost:3000
```

## Running Locally

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/macOS
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run with uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Running with Docker

See docker-compose.yml in project root.
