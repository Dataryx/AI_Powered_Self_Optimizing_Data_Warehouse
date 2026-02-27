#!/usr/bin/env bash
# Lightweight wrapper for running the ETL pipeline from cron.
#
# Example crontab (runs every 5 minutes):
#   */5 * * * * cd /PATH/TO/AI-Powered-Self_Optimizing_Data_Warehouse && /usr/bin/env bash etl/scripts/run_etl_cron.sh >> etl/logs/etl_cron.log 2>&1
#
# Make sure:
#   1. Python and dependencies are installed in the environment used by cron.
#   2. POSTGRES_* environment variables are set system‑wide or in the crontab.

set -euo pipefail

# Go to repository root (one level above etl/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

PYTHON_BIN="${PYTHON_BIN:-python}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting ETL pipeline from cron..."

"${PYTHON_BIN}" etl/scripts/run_etl.py

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ETL pipeline finished."

