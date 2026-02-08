# How to Run the Secrets Manager Application

This guide explains how to run the application locally using the provided helper scripts.

## Prerequisites

- **Docker Desktop**: Must be installed and running (for database & Redis).
- **Node.js 18+**: For the frontend.
- **Python 3.12+**: For the backend.
- **PowerShell**: Recommended for Windows users.

## Option 1: Quick Start (Docker Only)

The easiest way to run everything is using Docker Compose.

1.  Open PowerShell in the project root (`d:\Projects\secrete-manager`).
2.  Run the helper script:
    ```powershell
    .\scripts\run.ps1 docker
    ```
3.  Access the app:
    - Frontend: http://localhost:3000
    - Backend API: http://localhost:8000
    - API Docs: http://localhost:8000/docs

To stop:
```powershell
.\scripts\run.ps1 stop
```

## Option 2: Local Development (Hybrid)

Run the database in Docker, but backend and frontend locally for better debugging and performance.

### 1. Start Infrastructure (DB + Redis)

```powershell
docker compose up -d postgres redis
```

### 2. Setup & Run Backend

Open a **new** PowerShell terminal at `d:\Projects\secrete-manager`:

```powershell
.\scripts\run.ps1 backend
```

*This will automatically accept/create the virtual environment `venv`, install dependencies from `requirements.txt`, and start the FastAPI server with hot-reload.*

### 3. Setup & Run Frontend

Open a **new** PowerShell terminal at `d:\Projects\secrete-manager`:

```powershell
.\scripts\run.ps1 frontend
```

*This will install npm dependencies (if missing) and start the Next.js dev server.*

## Troubleshooting

-   **Port Conflicts**: Ensure ports `3000`, `8000`, `5432`, and `6399` are free.
-   **Database Connection**: If the backend fails to connect, ensure Docker is running and the `postgres` container is up (`docker ps`).
-   **Environment Variables**: Ensure `.env` exists in the root directory. If not, copy `.env.example` to `.env`.

## Key Files

-   `scripts/run.ps1`: Main helper script.
-   `docker-compose.yml`: Docker configuration.
-   `backend/app/main.py`: Backend entry point.
-   `frontend/src/app/page.tsx`: Frontend landing page.
