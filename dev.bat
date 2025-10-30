@echo off
REM GitTask Development Startup Script (Windows Batch)

echo.
echo ========================================
echo   GitTask Development Environment
echo ========================================
echo.

REM Check if Redis is installed
where redis-server >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo WARNING: Redis not found!
    echo Please install Redis from: https://github.com/microsoftarchive/redis/releases
    echo.
)

REM Check if ngrok is installed
where ngrok >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo WARNING: ngrok not found (optional for webhooks^)
    echo Download from: https://ngrok.com/download
    echo.
)

REM Install dependencies if needed
if not exist "api\node_modules\" (
    echo Installing API dependencies...
    cd api
    call npm install
    cd ..
)

if not exist "client\node_modules\" (
    echo Installing Client dependencies...
    cd client
    call npm install
    cd ..
)

echo.
echo Starting all services...
echo   - API (NestJS^) on port 5000
echo   - Client (Next.js^) on port 3000
echo   - Redis on port 6379
echo.
echo Press Ctrl+C to stop all services
echo.

npm run dev
