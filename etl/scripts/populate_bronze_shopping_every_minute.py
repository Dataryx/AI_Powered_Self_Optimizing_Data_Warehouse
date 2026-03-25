"""
Cron-like shopping data generator for the Bronze layer.

This script continuously injects synthetic shopping orders into existing
Bronze tables (`bronze.orders` and `bronze.order_item`) every 1 minute.
It does NOT create any new tables.

Run it as a long-lived process from the project root:

    cd "C:/Indominus/College (CSUF)/4th Semester/Final Project/AI-Powered-Self_Optimizing_Data_Warehouse"
    python etl/scripts/populate_bronze_shopping_every_minute.py

As long as this process is running, exactly one new order will be
inserted into `bronze.orders` (with its line items in `bronze.order_item`)
roughly once per minute.
"""

import random
import time
import logging
from datetime import UTC, datetime, date
from typing import Dict, List, Tuple
from pathlib import Path
import sys

from psycopg2.extras import execute_batch

# Ensure project root is on sys.path so ml_optimization can be imported
script_dir = Path(__file__).parent
project_root = script_dir.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Log file for this job (same folder as run_etl.py's etl_pipeline.log)
_shopping_log_path = script_dir / "shopping_ingestion.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(str(_shopping_log_path)),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

from ml_optimization.utils.db_utils import get_db_connection
from ml_optimization.utils.etl_job_tracker import ETLJobTracker


def generate_order_with_items() -> Tuple[Dict, List[Dict]]:
    """
    Generate a single synthetic order plus its order_item lines.

    The schema matches:
      - bronze.orders
      - bronze.order_item
    """
    now = datetime.now(UTC)

    # Keep order_id and order_item_id within PostgreSQL INT range (max 2147483647).
    # order_item_id = order_id * 10 + i (i up to 5), so order_id must be <= 214748363.
    order_id = (int(now.timestamp()) % 214_748_363) + 1

    customer_id = random.randint(1, 150_000)
    sales_rep_id = random.randint(1, 1000)
    order_date = date.today()
    order_status = random.choice(["COMPLETE", "PENDING", "SHIPPED"])
    order_currency = "USD"

    num_items = random.randint(1, 5)
    items: List[Dict] = []
    order_total = 0.0

    for i in range(1, num_items + 1):
        product_id = random.randint(1, 50000)
        unit_price = round(random.uniform(10, 500), 2)
        quantity = random.randint(1, 5)
        line_total = float(unit_price) * quantity
        order_total += line_total

        order_item_id = order_id * 10 + i

        items.append(
            {
                "order_item_id": order_item_id,
                "order_id": order_id,
                "product_id": product_id,
                "unit_price": unit_price,
                "quantity": quantity,
                "_source_system": "shopping_cron",
                "_batch_id": int(now.timestamp() // 60),
            }
        )

    order = {
        "order_id": order_id,
        "customer_id": customer_id,
        "sales_rep_id": sales_rep_id,
        "order_date": order_date,
        "order_code": f"CRON-{order_id}",
        "order_status": order_status,
        "order_total": round(order_total, 2),
        "order_currency": order_currency,
        "promotion_code": None,
        "_source_system": "shopping_cron",
        "_batch_id": int(now.timestamp() // 60),
    }

    return order, items


def is_shopping_job_active() -> bool:
    """
    Return True only if the job 'BRONZE - Shopping Orders Ingestion' exists
    and has active_status = 'A'. When inactive ('I') or any other value, return False.
    """
    try:
        with get_db_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT COALESCE(TRIM(active_status), '') AS active_status
                FROM monitoring.etl_jobs
                WHERE job_name = %s AND job_type = %s
                LIMIT 1
                """,
                ("BRONZE - Shopping Orders Ingestion", "ingestion"),
            )
            row = cur.fetchone()
            if row is None:
                return True  # Job not defined yet; allow run so it gets created
            status = (row[0] or "").strip().upper()
            # Only 'A' means active; 'I' or anything else means do not run
            if status != "A":
                logger.info("active_status in DB is '%s' (not A) -> skipping", status)
                return False
            return True
    except Exception as e:
        logger.warning("Error reading active_status: %s -> skipping to be safe", e)
        return False


def run_once(tracker: ETLJobTracker | None = None) -> None:
    """
    Insert exactly 1 shopping order into existing Bronze tables and
    track it as an ETL job.
    """
    order, items = generate_order_with_items()

    job_run_id = None
    if tracker is not None:
        try:
            job_run_id = tracker.start_job(
                "BRONZE - Shopping Orders Ingestion",
                "ingestion",
                "bronze",
                "orders",
                records_total=1,
                metadata={"line_items": len(items)},
                cron_pattern="*/1 * * * *",
            )
        except Exception:
            job_run_id = None

    try:
        with get_db_connection() as conn:
            cur = conn.cursor()

            # Insert into bronze.orders
            cur.execute(
                """
                INSERT INTO bronze.orders (
                    order_id,
                    customer_id,
                    sales_rep_id,
                    order_date,
                    order_code,
                    order_status,
                    order_total,
                    order_currency,
                    promotion_code,
                    _source_system,
                    _batch_id
                ) VALUES (
                    %(order_id)s,
                    %(customer_id)s,
                    %(sales_rep_id)s,
                    %(order_date)s,
                    %(order_code)s,
                    %(order_status)s,
                    %(order_total)s,
                    %(order_currency)s,
                    %(promotion_code)s,
                    %(_source_system)s,
                    %(_batch_id)s
                )
                """,
                order,
            )

            # Insert order_item rows
            if items:
                execute_batch(
                    cur,
                    """
                    INSERT INTO bronze.order_item (
                        order_item_id,
                        order_id,
                        product_id,
                        unit_price,
                        quantity,
                        _source_system,
                        _batch_id
                    ) VALUES (
                        %(order_item_id)s,
                        %(order_id)s,
                        %(product_id)s,
                        %(unit_price)s,
                        %(quantity)s,
                        %(_source_system)s,
                        %(_batch_id)s
                    )
                    """,
                    items,
                    page_size=len(items),
                )

        if tracker is not None and job_run_id is not None:
            tracker.complete_job(job_run_id, records_processed=1)
    except Exception as e:
        if tracker is not None and job_run_id is not None:
            try:
                tracker.fail_job(job_run_id, str(e))
            except Exception:
                pass
        raise


def main() -> None:
    """Run shopping order ingestion every 1 minute in an infinite loop.
    When active_status is set to 'I' in monitoring.etl_jobs, this process exits
    completely (no background checks). Restart the script after setting active_status back to 'A'.
    """
    interval_seconds = 60  # 1 minute
    logger.info("Starting Bronze shopping order ingestion every %s seconds.", interval_seconds)
    logger.info("Set active_status='I' in monitoring.etl_jobs to stop this process entirely.")

    # Exit immediately if job is inactive — do not run or check in background
    if not is_shopping_job_active():
        logger.info("Job is inactive (active_status=I). Exiting.")
        sys.exit(0)

    # Initialize ETL job tracker so this job appears in monitoring tables
    tracker: ETLJobTracker | None = None
    try:
        tracker = ETLJobTracker()
        tracker.ensure_table_exists()
    except Exception:
        tracker = None

    try:
        while True:
            start = time.time()
            # Re-check only at each tick; if inactive, exit process (no more background checks)
            if not is_shopping_job_active():
                logger.info("Job is now inactive (active_status=I). Exiting.")
                sys.exit(0)
            else:
                try:
                    run_once(tracker=tracker)
                    logger.info("Inserted 1 shopping order at %s", datetime.now(UTC).isoformat(timespec="seconds"))
                except Exception as e:
                    logger.exception("Error during insert: %s", e)

            elapsed = time.time() - start
            remaining = interval_seconds - elapsed
            if remaining > 0:
                time.sleep(remaining)
    except KeyboardInterrupt:
        logger.info("Stopped by user.")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Bronze shopping order ingestion (1 order per run or every 1 min).")
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one insert and exit (for scheduler). When job is inactive, exit without inserting.",
    )
    args = parser.parse_args()
    if args.once:
        if not is_shopping_job_active():
            logger.info("Job inactive (active_status=I). Exiting.")
            sys.exit(0)
        tracker = None
        try:
            tracker = ETLJobTracker()
            tracker.ensure_table_exists()
        except Exception:
            tracker = None
        try:
            run_once(tracker=tracker)
            logger.info("Inserted 1 shopping order (--once).")
        except Exception as e:
            logger.exception("Error during insert: %s", e)
            sys.exit(1)
        sys.exit(0)
    main()
