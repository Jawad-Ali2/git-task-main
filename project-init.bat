@echo off
echo ========================================
echo Starting Git Task Application
echo ========================================
echo.

echo [1/5] Starting Redis in Docker...
docker run -d --name redis-git-task -p 6379:6379 redis:latest
if errorlevel 1 (
    echo Redis container might already exist, trying to start it...
    docker start redis-git-task
)
echo Redis started successfully!
echo.

echo [2/5] Installing API dependencies...
cd api
call npm install
if errorlevel 1 (
    echo Failed to install API dependencies!
    pause
    exit /b 1
)
echo.

echo [3/5] Installing Client dependencies...
cd ..\client
call npm install
if errorlevel 1 (
    echo Failed to install Client dependencies!
    pause
    exit /b 1
)
echo.

echo [4/5] Starting API Server (NestJS)...
cd ..\api
start "API Server" cmd /k "npm run start:dev"
timeout /t 5 /nobreak > nul
echo.

echo [5/5] Starting Client (React/Vite)...
cd ..\client
start "Client Server" cmd /k "npm run dev"
echo.

echo ========================================
echo All services started successfully!
echo ========================================
echo.
echo API Server: http://localhost:3000
echo Client: http://localhost:5173
echo Redis: localhost:6379
echo.
echo Press any key to view this window...
pause