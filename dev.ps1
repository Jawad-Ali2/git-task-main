# GitTask Development Startup Script
# Run all services: API, Client, Redis, ngrok

Write-Host "🚀 Starting GitTask Development Environment..." -ForegroundColor Green
Write-Host ""

# Check if Redis is installed
$redisInstalled = Get-Command redis-server -ErrorAction SilentlyContinue
if (-not $redisInstalled) {
    Write-Host "⚠️  Redis not found. Please install Redis first." -ForegroundColor Yellow
    Write-Host "   Download from: https://github.com/microsoftarchive/redis/releases" -ForegroundColor Cyan
    Write-Host ""
}

# Check if ngrok is installed
$ngrokInstalled = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokInstalled) {
    Write-Host "⚠️  ngrok not found (optional for webhooks)." -ForegroundColor Yellow
    Write-Host "   Download from: https://ngrok.com/download" -ForegroundColor Cyan
    Write-Host ""
}

# Check if node_modules exist
if (-not (Test-Path ".\api\node_modules")) {
    Write-Host "📦 Installing API dependencies..." -ForegroundColor Cyan
    Set-Location api
    npm install
    Set-Location ..
}

if (-not (Test-Path ".\client\node_modules")) {
    Write-Host "📦 Installing Client dependencies..." -ForegroundColor Cyan
    Set-Location client
    npm install
    Set-Location ..
}

Write-Host "✅ All dependencies installed!" -ForegroundColor Green
Write-Host ""

# Start services using npm run dev (which uses concurrently)
Write-Host "🚀 Starting all services..." -ForegroundColor Green
Write-Host "   - API (NestJS) on port 5000" -ForegroundColor Cyan
Write-Host "   - Client (Next.js) on port 3000" -ForegroundColor Cyan
Write-Host "   - Redis on port 6379" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

npm run dev
