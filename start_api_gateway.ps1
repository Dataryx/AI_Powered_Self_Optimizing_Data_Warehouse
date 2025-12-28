# Start API Gateway with proper logging
Write-Host "Starting API Gateway..." -ForegroundColor Green

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Set Python path to include parent directory
$env:PYTHONPATH = $scriptDir

# Start API Gateway
Set-Location "api-gateway"
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host "Python path: $env:PYTHONPATH" -ForegroundColor Yellow

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level info

