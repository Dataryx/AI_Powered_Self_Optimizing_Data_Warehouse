# PowerShell script to monitor ETL progress
# Usage: .\monitor_etl.ps1 [interval_seconds]

param(
    [int]$Interval = 30
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ETL Progress Monitor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Checking every $Interval seconds..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

while ($true) {
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "ETL Status - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    python check_etl_status.py
    
    Write-Host ""
    Write-Host "Next check in $Interval seconds..." -ForegroundColor Gray
    Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Gray
    
    Start-Sleep -Seconds $Interval
}















