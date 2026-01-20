# PowerShell script to start API Gateway and Dashboard
# Run this script to start both services

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Starting API Gateway and Dashboard" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Start API Gateway
Write-Host "[1/2] Starting API Gateway..." -ForegroundColor Yellow
$apiDir = Join-Path $scriptDir "api-gateway"
if (Test-Path $apiDir) {
    Set-Location $apiDir
    
    # Check if virtual environment exists, if not install dependencies
    if (-not (Test-Path "venv")) {
        Write-Host "Installing API Gateway dependencies..." -ForegroundColor Gray
        python -m pip install -r requirements.txt
    }
    
    # Start API Gateway in new window
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$apiDir'; Write-Host 'API Gateway Starting...' -ForegroundColor Green; python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
    Write-Host "✓ API Gateway started (new window)" -ForegroundColor Green
    Write-Host "  URL: http://localhost:8000" -ForegroundColor Gray
    Write-Host "  Docs: http://localhost:8000/docs" -ForegroundColor Gray
    Start-Sleep -Seconds 3
} else {
    Write-Host "✗ API Gateway directory not found" -ForegroundColor Red
}

# Start Dashboard
Write-Host ""
Write-Host "[2/2] Starting Monitoring Dashboard..." -ForegroundColor Yellow
$dashboardDir = Join-Path $scriptDir "monitoring-dashboard"
if (Test-Path $dashboardDir) {
    Set-Location $dashboardDir
    
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing dashboard dependencies (this may take a while)..." -ForegroundColor Gray
        npm install
    }
    
    # Start Dashboard in new window
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$dashboardDir'; Write-Host 'Dashboard Starting...' -ForegroundColor Green; npm run dev"
    Write-Host "✓ Dashboard started (new window)" -ForegroundColor Green
    Write-Host "  URL: http://localhost:5173" -ForegroundColor Gray
    Start-Sleep -Seconds 2
} else {
    Write-Host "✗ Dashboard directory not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "All Services Started!" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service URLs:" -ForegroundColor Yellow
Write-Host "  - Dashboard: http://localhost:5173" -ForegroundColor White
Write-Host "  - API Gateway: http://localhost:8000" -ForegroundColor White
Write-Host "  - API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "  - Grafana: http://localhost:3001 (admin/admin)" -ForegroundColor White
Write-Host "  - Prometheus: http://localhost:9090" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

