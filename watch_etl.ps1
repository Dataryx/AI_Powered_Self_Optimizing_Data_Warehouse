# Continuous ETL Monitoring Script
# Shows real-time progress updates every 30 seconds

param(
    [int]$Interval = 30
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ETL Continuous Monitor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Checking every $Interval seconds..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

$iteration = 0
$startTime = Get-Date

try {
    while ($true) {
        $iteration++
        $elapsed = (Get-Date) - $startTime
        
        Clear-Host
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "ETL Progress Monitor" -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Check #$iteration | Elapsed: $($elapsed.ToString('hh\:mm\:ss')) | $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Gray
        Write-Host ""
        
        # Run status check
        python check_etl_status.py
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Next update in $Interval seconds..." -ForegroundColor Gray
        Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
        Write-Host ""
        
        Start-Sleep -Seconds $Interval
    }
} catch {
    Write-Host ""
    Write-Host "Monitoring stopped." -ForegroundColor Yellow
}















