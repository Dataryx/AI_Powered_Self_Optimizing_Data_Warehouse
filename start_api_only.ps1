# Start API Gateway only with visible logs
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Starting API Gateway" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Set Python path
$env:PYTHONPATH = $scriptDir

# Start API Gateway from parent directory so imports work correctly
Write-Host "Starting API Gateway on port 8000..." -ForegroundColor Yellow
Write-Host "Logs will appear below:" -ForegroundColor Yellow
Write-Host ""

python -m uvicorn api_gateway.main:app --host 0.0.0.0 --port 8000 --log-level info

