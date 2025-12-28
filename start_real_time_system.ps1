# Start Real-Time Data Collection System
# This script starts both the data generator and collection service

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Starting Real-Time Data Collection System" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Parse arguments
$dataInterval = 60  # Data generation interval (seconds) - default 1 minute
$collectionInterval = 300  # Collection interval (seconds) - default 5 minutes

if ($args.Count -gt 0) {
    try {
        $dataInterval = [int]$args[0]
    } catch {
        Write-Host "Invalid data interval, using default: 60 seconds" -ForegroundColor Yellow
    }
}

if ($args.Count -gt 1) {
    try {
        $collectionInterval = [int]$args[1]
    } catch {
        Write-Host "Invalid collection interval, using default: 300 seconds" -ForegroundColor Yellow
    }
}

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Data Generation: Every $dataInterval seconds ($([math]::Round($dataInterval/60, 1)) minutes)" -ForegroundColor White
Write-Host "  Data Collection: Every $collectionInterval seconds ($([math]::Round($collectionInterval/60, 1)) minutes)" -ForegroundColor White
Write-Host ""

# Start Data Generator in new window
Write-Host "Starting Data Generator..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir'; Write-Host 'Data Generator Running...' -ForegroundColor Green; python scripts/data-generator/continuous_data_generator.py --interval $dataInterval"

Start-Sleep -Seconds 2

# Start Collection Service in new window
Write-Host "Starting Collection Service..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$scriptDir'; Write-Host 'Collection Service Running...' -ForegroundColor Green; python scripts/ml-optimization/continuous_data_collector.py --interval $collectionInterval"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Real-Time System Started!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Two windows opened:" -ForegroundColor Yellow
Write-Host "  1. Data Generator - Generates queries every $dataInterval seconds" -ForegroundColor White
Write-Host "  2. Collection Service - Collects statistics every $collectionInterval seconds" -ForegroundColor White
Write-Host ""
Write-Host "Your dashboard will automatically show real-time data!" -ForegroundColor Green
Write-Host ""
Write-Host "To stop: Close the PowerShell windows or press Ctrl+C in each" -ForegroundColor Yellow

