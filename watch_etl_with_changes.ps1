# Enhanced ETL Monitoring with Change Tracking
# Shows real-time progress with change deltas

param([int]$Interval = 30)

$previousCounts = @{}
$iteration = 0
$startTime = Get-Date

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ETL Monitor with Change Tracking" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Checking every $Interval seconds..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

try {
    while ($true) {
        $iteration++
        $currentTime = Get-Date
        $elapsed = $currentTime - $startTime
        
        Clear-Host
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "ETL Progress Monitor - Check #$iteration" -ForegroundColor Cyan
        Write-Host "Time: $($currentTime.ToString('HH:mm:ss')) | Elapsed: $($elapsed.ToString('hh\:mm\:ss'))" -ForegroundColor Gray
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        
        # Run status check and capture output
        $output = python check_etl_status.py 2>&1 | Out-String
        
        # Display the output
        Write-Host $output
        
        # Parse key table counts from output
        $currentCounts = @{}
        
        # Extract counts from the progress summary section
        $lines = $output -split "`n"
        $inProgressSection = $false
        
        foreach ($line in $lines) {
            if ($line -match "PROGRESS SUMMARY") {
                $inProgressSection = $true
                continue
            }
            
            if ($inProgressSection -and $line -match "^-+$") {
                $inProgressSection = $false
                continue
            }
            
            if ($inProgressSection -and $line -match "^\s*(\w+)\s+(\d[\d,]*)\s+(\d[\d,]*)\s+") {
                $tableName = $matches[1]
                $silverCount = $matches[3] -replace ',',''
                if ($silverCount -match "^\d+$") {
                    $currentCounts[$tableName] = [int]$silverCount
                }
            }
        }
        
        # Show changes
        if ($previousCounts.Count -gt 0) {
            Write-Host ""
            Write-Host "=== CHANGES SINCE LAST CHECK ===" -ForegroundColor Yellow
            $hasChanges = $false
            foreach ($key in $currentCounts.Keys) {
                if ($previousCounts.ContainsKey($key)) {
                    $change = $currentCounts[$key] - $previousCounts[$key]
                    if ($change -gt 0) {
                        Write-Host "  $key`: +$change records" -ForegroundColor Green
                        $hasChanges = $true
                    } elseif ($change -lt 0) {
                        Write-Host "  $key`: $change records" -ForegroundColor Red
                        $hasChanges = $true
                    }
                }
            }
            if (-not $hasChanges) {
                Write-Host "  No changes detected - ETL may have stopped" -ForegroundColor Red
            }
        } else {
            Write-Host ""
            Write-Host "=== Initial baseline established ===" -ForegroundColor Cyan
            foreach ($key in $currentCounts.Keys) {
                Write-Host "  $key`: $($currentCounts[$key]) records" -ForegroundColor Gray
            }
        }
        
        $previousCounts = $currentCounts
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "Next check in $Interval seconds..." -ForegroundColor Gray
        Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
        Write-Host ""
        
        Start-Sleep -Seconds $Interval
    }
} catch {
    Write-Host ""
    Write-Host "Monitoring stopped: $_" -ForegroundColor Red
}















