# Monitor ETL Progress
# Shows real-time progress of data population

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ETL Progress Monitor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$iteration = 0
while ($true) {
    $iteration++
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "ETL Progress Check #$iteration - $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    python check_etl_status.py
    
    Write-Host ""
    Write-Host "Checking again in 30 seconds..." -ForegroundColor Gray
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    
    Start-Sleep -Seconds 30
}















