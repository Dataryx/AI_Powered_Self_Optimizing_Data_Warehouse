# Quick ETL Status Check with Change Detection
# Run this to quickly see if ETL is making progress

$tables = @('product', 'person', 'restricted_info', 'customer', 'orders', 'order_item')
$counts1 = @{}
$counts2 = @{}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Quick ETL Progress Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "First check at $(Get-Date -Format 'HH:mm:ss')..." -ForegroundColor Yellow
Write-Host ""

foreach ($table in $tables) {
    try {
        $result = python -c "import psycopg2, os; conn = psycopg2.connect(host='localhost', database='datawarehouse', user='postgres', password='postgres'); cur = conn.cursor(); cur.execute(f'SELECT COUNT(*) FROM silver.{table}'); print(cur.fetchone()[0]); conn.close()" 2>$null
        if ($result -match "^\d+$") {
            $counts1[$table] = [int]$result
            Write-Host "  $table`: $($counts1[$table]:,)" -ForegroundColor White
        } else {
            Write-Host "  $table`: Error" -ForegroundColor Red
        }
    } catch {
        Write-Host "  $table`: Error" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Waiting 60 seconds..." -ForegroundColor Gray
Start-Sleep -Seconds 60

Write-Host ""
Write-Host "Second check at $(Get-Date -Format 'HH:mm:ss')..." -ForegroundColor Yellow
Write-Host ""

foreach ($table in $tables) {
    try {
        $result = python -c "import psycopg2, os; conn = psycopg2.connect(host='localhost', database='datawarehouse', user='postgres', password='postgres'); cur = conn.cursor(); cur.execute(f'SELECT COUNT(*) FROM silver.{table}'); print(cur.fetchone()[0]); conn.close()" 2>$null
        if ($result -match "^\d+$") {
            $counts2[$table] = [int]$result
            $change = $counts2[$table] - $counts1[$table]
            
            if ($change -gt 0) {
                Write-Host "  $table`: $($counts2[$table]:,) (+$change)" -ForegroundColor Green
            } elseif ($change -lt 0) {
                Write-Host "  $table`: $($counts2[$table]:,) ($change)" -ForegroundColor Red
            } else {
                Write-Host "  $table`: $($counts2[$table]:,) (no change)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  $table`: Error" -ForegroundColor Red
        }
    } catch {
        Write-Host "  $table`: Error" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
$totalChange = ($counts2.Values | Measure-Object -Sum).Sum - ($counts1.Values | Measure-Object -Sum).Sum
if ($totalChange -gt 0) {
    Write-Host "ETL is ACTIVE! Total change: +$totalChange records" -ForegroundColor Green
} elseif ($totalChange -eq 0) {
    Write-Host "No changes detected - ETL may have stopped or completed current table" -ForegroundColor Yellow
} else {
    Write-Host "Negative change detected - something unusual happened" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan















