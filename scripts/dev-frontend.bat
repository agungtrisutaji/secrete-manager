@echo off
REM Start frontend development server

echo ====================================
echo  Secrets Manager - Frontend Dev
echo ====================================
echo.

cd /d "%~dp0..\frontend"

if not exist node_modules (
    echo Installing npm dependencies...
    npm install
)

echo.
echo   URL: http://localhost:3000
echo.

npm run dev
