"""
Trim monitoring.etl_jobs to only the two allowed scheduled jobs.

Allowed jobs:
  1. Complete ETL Pipeline (pipeline) – main ETL run by scheduler
  2. BRONZE - Shopping Orders Ingestion (ingestion) – shopping data every minute

Run once from project root to remove any extra job definitions created by
Bronze→Silver or Silver→Gold steps (e.g. "SILVER - X Transformation",
"GOLD - Daily Sales Aggregation"):

    python etl/scripts/trim_etl_jobs_to_two.py
"""

import sys
from pathlib import Path

script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from ml_optimization.utils.db_utils import get_db_connection

ALLOWED_JOB_NAMES = (
    "Complete ETL Pipeline",
    "BRONZE - Shopping Orders Ingestion",
)


def main() -> None:
    with get_db_connection() as conn:
        cur = conn.cursor()

        # Count current jobs
        cur.execute(
            "SELECT job_id, job_name, job_type FROM monitoring.etl_jobs ORDER BY job_name"
        )
        rows = cur.fetchall()
        print(f"Current jobs in monitoring.etl_jobs: {len(rows)}")
        for r in rows:
            print(f"  - {r[1]} ({r[2]})")

        # Delete run history for jobs we are about to remove
        cur.execute(
            """
            DELETE FROM monitoring.job_runs
            WHERE job_id IN (
                SELECT job_id FROM monitoring.etl_jobs
                WHERE job_name NOT IN %s
            )
            """,
            (ALLOWED_JOB_NAMES,),
        )
        deleted_runs = cur.rowcount

        # Remove extra job definitions
        cur.execute(
            """
            DELETE FROM monitoring.etl_jobs
            WHERE job_name NOT IN %s
            """,
            (ALLOWED_JOB_NAMES,),
        )
        deleted_jobs = cur.rowcount

        conn.commit()

    print(f"\nDeleted {deleted_runs} run(s) from monitoring.job_runs.")
    print(f"Deleted {deleted_jobs} job(s) from monitoring.etl_jobs.")
    print("\nOnly these two jobs remain (or will be recreated when they run):")
    for name in ALLOWED_JOB_NAMES:
        print(f"  - {name}")


if __name__ == "__main__":
    main()
