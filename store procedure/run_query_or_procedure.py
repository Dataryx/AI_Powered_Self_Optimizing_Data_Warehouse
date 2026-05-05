#!/usr/bin/env python3
"""
Run any SQL (query/CALL/procedure) N times, then collect into ml_optimization.query_logs.

Examples:
  python "store procedure/run_query_or_procedure.py" --sql "CALL ml_optimization.sp_generate_orders_workload(50);" --times 5
  python "store procedure/run_query_or_procedure.py" --sql "SELECT COUNT(*) FROM gold.fact_sales;" --times 100
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

import psycopg2


def db_conn_str() -> str:
    host = os.getenv("POSTGRES_HOST", "localhost")
    if sys.platform == "win32" and host.lower() == "localhost":
        host = "127.0.0.1"
    return (
        f"host={host} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')} "
        f"connect_timeout=15"
    )


def execute_sql_many(sql: str, times: int) -> None:
    if times <= 0:
        raise ValueError("--times must be > 0")
    with psycopg2.connect(db_conn_str()) as conn:
        with conn.cursor() as cur:
            for i in range(times):
                cur.execute(sql)
                if (i + 1) % 25 == 0 or i + 1 == times:
                    print(f"Executed {i + 1}/{times}")
        conn.commit()


def run_query_log_collection_once(project_root: Path) -> None:
    collector = project_root / "scripts" / "ml-optimization" / "run_query_collection.py"
    cmd = [sys.executable, str(collector)]
    print("Collecting pg_stat_statements into ml_optimization.query_logs...")
    subprocess.check_call(cmd, cwd=str(project_root))


def main() -> None:
    parser = argparse.ArgumentParser(description="Run SQL/procedure multiple times and push to query_logs.")
    parser.add_argument("--sql", type=str, default="", help="CALL ml_optimization.sp_generate_orders_report(7)")
    parser.add_argument("--times", type=int, default=1, help="100")
    args = parser.parse_args()

    sql = args.sql.strip()
    if not sql:
        print("Enter SQL to run (single line). Example: CALL ml_optimization.sp_generate_orders_workload(10);")
        sql = input("SQL> ").strip()
    if not sql:
        raise SystemExit("No SQL provided.")

    project_root = Path(__file__).resolve().parents[1]
    print(f"Running SQL {args.times} time(s)...")
    execute_sql_many(sql, args.times)
    run_query_log_collection_once(project_root)
    print("Done. Query should now be available in ml_optimization.query_logs.")


if __name__ == "__main__":
    main()
