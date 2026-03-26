"""
Truncate monitoring.job_runs.

Use when you want to clear ETL run history in the monitoring dashboard.
"""

import os
import psycopg2


def main() -> None:
    conn = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres"),
    )
    try:
        cur = conn.cursor()
        cur.execute("TRUNCATE TABLE monitoring.job_runs;")
        conn.commit()
        cur.close()
        print("Truncated monitoring.job_runs.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()

