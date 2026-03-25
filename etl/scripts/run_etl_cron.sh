#!/usr/bin/env bash
#
# ETL Cron Job Runner
# Run this script from cron (or Windows Task Scheduler via Git Bash/WSL) to execute
# the data warehouse ETL pipeline on a schedule. Each run is recorded in
# monitoring.etl_jobs and shown in the Data Warehouse Dashboard (Recent ETL Runs,
# ETL metrics, Errors & Retries).
#
# Usage:
#   ./run_etl_cron.sh              # run once
#   ./run_etl_cron.sh --batch-size 2000
#
# Crontab example (every 5 minutes):
#   */5 * * * * /path/to/project/etl/scripts/run_etl_cron.sh >> /var/log/etl_cron.log 2>&1
#
# Crontab example (every hour at minute 0):
#   0 * * * * /path/to/project/etl/scripts/run_etl_cron.sh >> /var/log/etl_cron.log 2>&1

set -e

# Project root: two levels up from this script (etl/scripts -> etl -> project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Optional: load env from .env if present (database credentials, etc.)
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.env"
  set +a
fi

# Use project Python if a venv exists
if [ -d "$PROJECT_ROOT/venv" ]; then
  PYTHON="$PROJECT_ROOT/venv/bin/python"
elif [ -d "$PROJECT_ROOT/.venv" ]; then
  PYTHON="$PROJECT_ROOT/.venv/bin/python"
else
  PYTHON="python3"
fi

export PYTHONPATH="$PROJECT_ROOT${PYTHONPATH:+:$PYTHONPATH}"
ETL_SCRIPT="$SCRIPT_DIR/run_etl.py"

if [ ! -f "$ETL_SCRIPT" ]; then
  echo "[ERROR] ETL script not found: $ETL_SCRIPT"
  exit 1
fi

echo "[$(date -Iseconds)] Starting ETL pipeline (project_root=$PROJECT_ROOT)"
"$PYTHON" "$ETL_SCRIPT" "$@"
EXIT_CODE=$?
echo "[$(date -Iseconds)] ETL pipeline finished with exit code $EXIT_CODE"
exit $EXIT_CODE
