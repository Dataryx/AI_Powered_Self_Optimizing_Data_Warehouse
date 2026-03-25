# ETL Cron/Task Scheduler Runner (Windows PowerShell)
#
# Run this script via Windows Task Scheduler (or manually) to execute the
# data warehouse ETL pipeline. Each run is recorded in monitoring.etl_jobs
# and shown in the Data Warehouse Dashboard (Recent ETL Runs, ETL metrics,
# Errors & Retries).
#
# Usage:
#   .\run_etl_cron.ps1
#   .\run_etl_cron.ps1 -BatchSize 2000
#
# Task Scheduler: create a task that runs this script; set "Program" to
#   powershell.exe
# and "Arguments" to
#   -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\project\etl\scripts\run_etl_cron.ps1"

param(
    [int] $BatchSize = 1000
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
Set-Location $ProjectRoot

# Load .env if present (optional)
$envPath = Join-Path $ProjectRoot ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$env:PYTHONPATH = if ($env:PYTHONPATH) { "$ProjectRoot;$env:PYTHONPATH" } else { $ProjectRoot }
$EtlScript = Join-Path $ScriptDir "run_etl.py"

if (-not (Test-Path $EtlScript)) {
    Write-Error "ETL script not found: $EtlScript"
    exit 1
}

$python = "python"
if (Test-Path (Join-Path $ProjectRoot "venv\Scripts\python.exe")) {
    $python = Join-Path $ProjectRoot "venv\Scripts\python.exe"
} elseif (Test-Path (Join-Path $ProjectRoot ".venv\Scripts\python.exe")) {
    $python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
}

Write-Host "[$(Get-Date -Format 'o')] Starting ETL pipeline (project_root=$ProjectRoot)"
& $python $EtlScript --batch-size $BatchSize
$exitCode = $LASTEXITCODE
Write-Host "[$(Get-Date -Format 'o')] ETL pipeline finished with exit code $exitCode"
exit $exitCode
