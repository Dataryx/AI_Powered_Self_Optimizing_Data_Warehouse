import logging
import os
import subprocess
import sys
from datetime import datetime, timedelta

# On Windows, run child processes without opening a console window
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0

from ml_optimization.utils.db_utils import get_db_connection


LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOG_DIR, exist_ok=True)
LOG_PATH = os.path.join(LOG_DIR, "job_scheduler.log")

logging.basicConfig(
    filename=LOG_PATH,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


def _matches_cron_field(value: int, field: str) -> bool:
    """
    Minimal cron field matcher.

    Supports:
      *       -> always
      */N     -> every N units
      X       -> exact value
    """
    field = field.strip()
    if field == "*" or field == "":
        return True
    if field.startswith("*/"):
        try:
            step = int(field[2:])
        except ValueError:
            return False
        if step <= 0:
            return False
        return value % step == 0
    try:
        return value == int(field)
    except ValueError:
        return False


def cron_matches_now(pattern: str, now: datetime) -> bool:
    """
    Check if a simple cron pattern matches the current datetime.

    Pattern format: "m h dom mon dow"
    Only minute and hour are meaningfully handled; the rest must be "*" to match.
    """
    if not pattern:
        return False

    parts = pattern.split()
    if len(parts) != 5:
        return False

    minute_s, hour_s, dom_s, mon_s, dow_s = parts

    if not _matches_cron_field(now.minute, minute_s):
        return False
    if not _matches_cron_field(now.hour, hour_s):
        return False

    # For now we only support "*" for day-of-month, month, day-of-week
    if dom_s not in ("*", ""):
        return False
    if mon_s not in ("*", ""):
        return False
    if dow_s not in ("*", ""):
        return False

    return True


def run_due_jobs() -> None:
    """
    Scan monitoring.etl_jobs for active jobs and run ones that are due
    based on their cron_pattern.

    This script is intended to be triggered every minute by the OS
    scheduler (e.g. Windows Task Scheduler). Changing cron_pattern in
    monitoring.etl_jobs will then change when jobs fire.
    """
    now = datetime.utcnow()
    logger.info("Scheduler tick at %s", now.isoformat())

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            # Fetch only active jobs. Inactive (active_status = 'I') are never loaded,
            # so they are not checked or run in the background.
            cur.execute(
                """
                SELECT job_id, job_name, job_type, tables, cron_pattern
                FROM monitoring.etl_jobs
                WHERE cron_pattern IS NOT NULL AND cron_pattern <> ''
                  AND COALESCE(TRIM(active_status), 'A') = 'A'
                """
            )
            rows = cur.fetchall()

            for job_id, job_name, job_type, tables, cron_pattern in rows:
                if not cron_matches_now(cron_pattern, now):
                    continue

                # Avoid double-firing: check if this job_id has a run
                # that started within the last minute.
                cur.execute(
                    """
                    SELECT 1
                    FROM monitoring.job_runs
                    WHERE job_id = %s
                      AND started_at >= (CURRENT_TIMESTAMP - INTERVAL '59 seconds')
                    LIMIT 1
                    """,
                    (job_id,),
                )
                if cur.fetchone():
                    continue

                logger.info(
                    "Dispatching job_id=%s name=%s type=%s cron=%s",
                    job_id,
                    job_name,
                    job_type,
                    cron_pattern,
                )

                etl_scripts_dir = os.path.dirname(os.path.dirname(__file__))
                cwd = os.path.dirname(etl_scripts_dir)

                if job_type == "pipeline":
                    script_path = os.path.join(etl_scripts_dir, "scripts", "run_etl.py")
                    try:
                        subprocess.Popen(
                            ["python", script_path],
                            cwd=cwd,
                            creationflags=CREATE_NO_WINDOW,
                        )
                    except Exception as e:
                        logger.exception("Failed to launch ETL pipeline for job %s: %s", job_id, e)
                elif job_type == "ingestion" and job_name == "BRONZE - Shopping Orders Ingestion":
                    script_path = os.path.join(etl_scripts_dir, "scripts", "populate_bronze_shopping_every_minute.py")
                    try:
                        subprocess.Popen(
                            ["python", script_path, "--once"],
                            cwd=cwd,
                            creationflags=CREATE_NO_WINDOW,
                        )
                    except Exception as e:
                        logger.exception("Failed to launch ingestion job %s: %s", job_id, e)
                elif job_type == "ingestion" and job_name == "BRONZE - Random Bronze Tables Populator (100)":
                    script_path = os.path.join(etl_scripts_dir, "scripts", "populate_bronze_random_tables_with_orders_items.py")
                    try:
                        subprocess.Popen(
                            ["python", script_path, "--once", "--count", "100"],
                            cwd=cwd,
                            creationflags=CREATE_NO_WINDOW,
                        )
                    except Exception as e:
                        logger.exception("Failed to launch ingestion job %s: %s", job_id, e)
                else:
                    logger.warning(
                        "Unknown job_type '%s' for job_id=%s; skipping", job_type, job_id
                    )
    except Exception as e:
        logger.exception("Scheduler tick failed: %s", e)


if __name__ == "__main__":
    run_due_jobs()

