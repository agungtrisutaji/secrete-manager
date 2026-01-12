@echo off
REM Secrets Manager - Quick Start Script for Windows
REM Double-click this file or run: scripts\start.bat

echo ====================================
echo  Secrets Manager - Quick Start
echo ====================================
echo.

REM Check for Docker
docker --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [INFO] Starting Docker containers...
cd /d "%~dp0.."
docker compose up -d

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Failed to start containers
    echo Make sure Docker Desktop is running
    pause
    exit /b 1
)

echo.
echo ====================================
echo  Services Started Successfully!
echo ====================================
echo.
echo   Frontend:  http://localhost:3000
echo   Backend:   http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo.
echo To view logs: docker compose logs -f
echo To stop:      docker compose down
echo.
pause
