# Start Continuous Query Collection Service

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Starting Continuous Query Collection Service" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Default interval: 5 minutes (300 seconds)
$interval = 300

# Check if interval argument is provided
if ($args.Count -gt 0) {
    try {
        $interval = [int]$args[0]
    } catch {
        Write-Host "Invalid interval, using default: 300 seconds" -ForegroundColor Yellow
    }
}

Write-Host "Collection interval: $interval seconds ($([math]::Round($interval/60, 1)) minutes)" -ForegroundColor Yellow
Write-Host "This will run continuously until stopped (Ctrl+C)" -ForegroundColor Yellow
Write-Host ""

# Try pg_stat_statements first, fallback to alternative collector
Write-Host "Starting continuous collection service..." -ForegroundColor Green
Write-Host "Note: If pg_stat_statements is not enabled, will use alternative collection method" -ForegroundColor Yellow
Write-Host ""

# Start the service (uses alternative collector with pg_stat_statements fallback)
python scripts/ml-optimization/continuous_data_collector.py --interval $interval

