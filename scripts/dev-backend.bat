@echo off
REM Quick test script - Start infrastructure and run backend

echo ====================================
echo  Secrets Manager - Dev Setup
echo ====================================
echo.

cd /d "%~dp0.."

echo [1/3] Starting PostgreSQL and Redis...
docker compose -f docker-compose.infra.yml up -d

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to start infrastructure
    pause
    exit /b 1
)

echo [2/3] Waiting for services to be ready...
timeout /t 5 /nobreak > nul

echo [3/3] Setting up backend...
cd backend

if not exist venv (
    echo Creating Python virtual environment...
    python -m venv venv
)

echo Activating venv and installing dependencies...
call venv\Scripts\activate.bat
pip install -r requirements.txt

echo.
echo ====================================
echo  Starting Backend Server...
echo ====================================
echo.
echo   API:  http://localhost:8000
echo   Docs: http://localhost:8000/docs
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
