# Secrets Manager - Build and Run Script for Windows
# Run with: powershell -ExecutionPolicy Bypass -File .\scripts\run.ps1

param(
    [Parameter(Position=0)]
    [string]$Command = "dev"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "====================================" -ForegroundColor Cyan
Write-Host " Secrets Manager - Build & Run" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

function Start-Docker {
    Write-Host "[Docker] Starting all services..." -ForegroundColor Yellow
    Set-Location $ProjectRoot
    docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Error] Docker Compose failed" -ForegroundColor Red
        exit 1
    }
    Write-Host ""
    Write-Host "[Success] Services started!" -ForegroundColor Green
    Write-Host "  - Frontend: http://localhost:3000" -ForegroundColor White
    Write-Host "  - Backend API: http://localhost:8000" -ForegroundColor White
    Write-Host "  - API Docs: http://localhost:8000/docs" -ForegroundColor White
}

function Stop-Docker {
    Write-Host "[Docker] Stopping all services..." -ForegroundColor Yellow
    Set-Location $ProjectRoot
    docker compose down
    Write-Host "[Success] Services stopped!" -ForegroundColor Green
}

function Start-Backend {
    Write-Host "[Backend] Setting up Python environment..." -ForegroundColor Yellow
    Set-Location "$ProjectRoot\backend"
    
    # Create venv if not exists
    if (-not (Test-Path "venv")) {
        Write-Host "[Backend] Creating virtual environment..." -ForegroundColor Yellow
        python -m venv venv
    }
    
    # Activate and install
    Write-Host "[Backend] Activating venv and installing dependencies..." -ForegroundColor Yellow
    & ".\venv\Scripts\Activate.ps1"
    pip install -r requirements.txt
    
    # Run
    Write-Host "[Backend] Starting FastAPI server..." -ForegroundColor Green
    Write-Host "  API: http://localhost:8000" -ForegroundColor White
    Write-Host "  Docs: http://localhost:8000/docs" -ForegroundColor White
    Write-Host ""
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}

function Start-Frontend {
    Write-Host "[Frontend] Setting up Node.js environment..." -ForegroundColor Yellow
    Set-Location "$ProjectRoot\frontend"
    
    # Install if needed
    if (-not (Test-Path "node_modules")) {
        Write-Host "[Frontend] Installing npm dependencies..." -ForegroundColor Yellow
        npm install
    }
    
    # Run
    Write-Host "[Frontend] Starting Next.js dev server..." -ForegroundColor Green
    Write-Host "  URL: http://localhost:3000" -ForegroundColor White
    Write-Host ""
    npm run dev
}

function Build-All {
    Write-Host "[Build] Building Docker images..." -ForegroundColor Yellow
    Set-Location $ProjectRoot
    docker compose build
    Write-Host "[Success] Build complete!" -ForegroundColor Green
}

function Show-Logs {
    Set-Location $ProjectRoot
    docker compose logs -f
}

# Main command router
switch ($Command.ToLower()) {
    "docker" { Start-Docker }
    "stop" { Stop-Docker }
    "backend" { Start-Backend }
    "frontend" { Start-Frontend }
    "build" { Build-All }
    "logs" { Show-Logs }
    "dev" {
        Write-Host "Starting development environment..."
        Write-Host "Please run in separate terminals:" -ForegroundColor Yellow
        Write-Host "  Backend:  .\scripts\run.ps1 backend" -ForegroundColor White
        Write-Host "  Frontend: .\scripts\run.ps1 frontend" -ForegroundColor White
        Write-Host ""
        Write-Host "Or use Docker:" -ForegroundColor Yellow
        Write-Host "  .\scripts\run.ps1 docker" -ForegroundColor White
    }
    default {
        Write-Host "Usage: .\scripts\run.ps1 <command>" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Commands:" -ForegroundColor White
        Write-Host "  docker    - Start with Docker Compose"
        Write-Host "  stop      - Stop Docker containers"
        Write-Host "  backend   - Run backend locally"
        Write-Host "  frontend  - Run frontend locally"
        Write-Host "  build     - Build Docker images"
        Write-Host "  logs      - View Docker logs"
        Write-Host "  dev       - Show development instructions"
    }
}
