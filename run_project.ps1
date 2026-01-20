# PowerShell script to run the project
# This script properly sets up the environment and starts all services

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting AI-Powered Data Warehouse" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = $PSScriptRoot
if (-not $projectRoot) {
    $projectRoot = Get-Location
}

# Check PostgreSQL
Write-Host "[1/3] Checking PostgreSQL..." -ForegroundColor Yellow
try {
    python -c "import psycopg2; import os; conn = psycopg2.connect(host=os.getenv('POSTGRES_HOST', 'localhost'), port=int(os.getenv('POSTGRES_PORT', '5432')), database=os.getenv('POSTGRES_DB', 'datawarehouse'), user=os.getenv('POSTGRES_USER', 'postgres'), password=os.getenv('POSTGRES_PASSWORD', 'postgres')); conn.close(); print('OK')" 2>&1 | Out-Null
    Write-Host "  [OK] PostgreSQL is running" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] PostgreSQL connection failed" -ForegroundColor Red
    Write-Host "  Please ensure PostgreSQL is running" -ForegroundColor Yellow
    exit 1
}

# Start API - using a workaround for ml-optimization directory name
Write-Host ""
Write-Host "[2/3] Starting ML Optimization API..." -ForegroundColor Yellow
$apiScript = @"
import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(r'$projectRoot')
sys.path.insert(0, str(project_root))

# Import using importlib to handle ml-optimization directory name
import importlib.util

# Load main module
ml_opt_path = project_root / 'ml-optimization' / 'api' / 'main.py'
spec = importlib.util.spec_from_file_location('main', ml_opt_path)
main_module = importlib.util.module_from_spec(spec)

# Set up module structure
sys.modules['ml_optimization'] = type(sys)('ml_optimization')
sys.modules['ml_optimization.api'] = type(sys)('ml_optimization.api')

# Load route modules first
routes_path = project_root / 'ml-optimization' / 'api' / 'routes'
for route_name in ['optimization_routes', 'metrics_routes', 'recommendation_routes']:
    route_file = routes_path / f'{route_name}.py'
    if route_file.exists():
        route_spec = importlib.util.spec_from_file_location(f'ml_optimization.api.routes.{route_name}', route_file)
        route_module = importlib.util.module_from_spec(route_spec)
        sys.modules[f'ml_optimization.api.routes.{route_name}'] = route_module
        if route_spec.loader:
            route_spec.loader.exec_module(route_module)

# Now load main
if spec.loader:
    spec.loader.exec_module(main_module)

# Get app and run
app = main_module.app

import uvicorn
print('Starting ML Optimization API on http://localhost:8000')
uvicorn.run(app, host='0.0.0.0', port=8000, log_level='info')
"@

$apiScript | Out-File -FilePath "$projectRoot\start_api_temp.py" -Encoding UTF8
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectRoot'; Write-Host 'ML Optimization API' -ForegroundColor Green; python start_api_temp.py"
Start-Sleep -Seconds 2
Write-Host "  [OK] API starting in new window" -ForegroundColor Green

# Start Dashboard
Write-Host ""
Write-Host "[3/3] Starting Monitoring Dashboard..." -ForegroundColor Yellow
$dashboardPath = Join-Path $projectRoot "monitoring-dashboard"
if (Test-Path $dashboardPath) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$dashboardPath'; Write-Host 'Monitoring Dashboard' -ForegroundColor Green; npm run dev"
    Start-Sleep -Seconds 2
    Write-Host "  [OK] Dashboard starting in new window" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Dashboard directory not found" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Services Started!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service URLs:" -ForegroundColor Yellow
Write-Host "  - Dashboard: http://localhost:5173" -ForegroundColor White
Write-Host "  - API: http://localhost:8000" -ForegroundColor White
Write-Host "  - API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "Note: Services are starting in separate windows." -ForegroundColor Gray
Write-Host "Check those windows for any error messages." -ForegroundColor Gray
Write-Host ""



