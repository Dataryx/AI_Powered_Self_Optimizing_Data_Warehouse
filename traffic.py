#!/usr/bin/env python3
"""
traffic.py — Drive **real** telemetry in your own PostgreSQL warehouse.

Runs parser-aligned SELECT workload + pg_stat_statements collection + ML recommendation
persistence (same pipeline as ``scripts/ml-optimization/run_ml_index_partition_workload.py``).
Optionally executes an extra **slow-query burst** (small ``pg_sleep`` + real bronze/silver/gold
predicates) so mean latency variance shows up in Query Performance, Slow query alerts,
ML Hotspot Timeline, and anomaly detectors — **no fabricated rows outside normal ingestion**.

Prerequisites
-------------
- PostgreSQL reachable (``POSTGRES_*`` env or ``ml-optimization`` ``utils.db_utils``).
- ``pg_stat_statements`` enabled; collector writes ``ml_optimization.query_logs``.
- Models under ``ml-optimization/saved_models/`` for richest Optimizations / anomalies.

Examples (repo root)
--------------------
  python traffic.py
  python traffic.py --slow-burst 800 --slow-sleep-ms 80
  python traffic.py --iterations 15000 --concurrency 20 --heavy

Forward flags to the bundled workload script (place workload flags last):

  python traffic.py --skip-slow-burst -- --iterations 5000 --no-persist
"""

from __future__ import annotations

import argparse
import importlib.util
import logging
import os
import random
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, wait
from pathlib import Path
from typing import List, Tuple

import psycopg2

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [traffic] %(levelname)s %(message)s",
)
logger = logging.getLogger("traffic")


def _project_root() -> Path:
    return Path(__file__).resolve().parent


def _child_env(root: Path) -> dict:
    env = os.environ.copy()
    py = str(root)
    env["PYTHONPATH"] = py + os.pathsep + env.get("PYTHONPATH", "")
    ml = root / "ml-optimization"
    env["PYTHONPATH"] = str(ml) + os.pathsep + env["PYTHONPATH"]
    return env


def _db_conn_str() -> str:
    root = _project_root()
    sys.path.insert(0, str(root))
    sys.path.insert(0, str(root / "ml-optimization"))
    try:
        from utils.db_utils import get_psycopg2_connection_string

        return get_psycopg2_connection_string()
    except ImportError:
        host = os.getenv("POSTGRES_HOST", "localhost")
        if sys.platform == "win32" and host.lower() == "localhost":
            host = "127.0.0.1"
        return (
            f"host={host} "
            f"port={os.getenv('POSTGRES_PORT', '5432')} "
            f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
            f"user={os.getenv('POSTGRES_USER', 'postgres')} "
            f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')} "
            f"connect_timeout=25"
        )


def _discover_slow_statement_templates(cur) -> List[str]:
    """
    Build DISTINCT query texts that touch real warehouse tables.
    Parameterized pg_sleep increases mean_exec_time_ms → slow-query alerts / hotspots.
    """
    cur.execute(
        """
        SELECT c.table_schema, c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema AND t.table_name = c.table_name
        WHERE c.table_schema IN ('bronze', 'silver', 'gold')
          AND t.table_type = 'BASE TABLE'
          AND c.data_type IN ('timestamp without time zone', 'timestamp with time zone', 'date')
        ORDER BY c.table_schema, c.table_name
        LIMIT 40
        """
    )
    rows = cur.fetchall()
    out: List[str] = []
    for schema, table, col in rows:
        out.append(
            f"SELECT count(*) FROM {schema}.{table} AS w "
            f"WHERE w.{col} >= CURRENT_TIMESTAMP - INTERVAL '900 days' "
            f"AND EXISTS (SELECT 1 WHERE pg_sleep(%s) IS NOT NULL)"
        )
        if len(out) >= 12:
            break
    return out


def _slow_burst_worker(
    conn_str: str,
    templates: List[str],
    sleep_ms: float,
    lock: threading.Lock,
    counter: dict,
) -> None:
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    cur = conn.cursor()
    sec = max(0.001, sleep_ms / 1000.0)
    try:
        while True:
            with lock:
                if counter["remaining"] <= 0:
                    break
                counter["remaining"] -= 1
            sql = random.choice(templates)
            try:
                cur.execute(sql, (sec,))
                if cur.description:
                    cur.fetchall()
                with lock:
                    counter["ok"] += 1
            except Exception as ex:
                with lock:
                    counter["err"] += 1
                logger.debug("slow burst stmt failed: %s", ex)
    finally:
        cur.close()
        conn.close()


def run_slow_query_burst(
    conn_str: str,
    *,
    iterations: int,
    concurrency: int,
    sleep_ms: float,
) -> Tuple[int, int]:
    """Execute latency-heavy SELECT shapes against real tables (read-only)."""
    if iterations <= 0:
        return 0, 0
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        templates = _discover_slow_statement_templates(cur)
    finally:
        cur.close()
        conn.close()

    if not templates:
        logger.warning(
            "Slow burst skipped: no timestamp/date columns found in bronze/silver/gold "
            "(load dimensional tables first)."
        )
        return 0, 0

    logger.info(
        "Slow-query burst: %s iterations, concurrency=%s, sleep_ms=%s (%d templates)",
        iterations,
        concurrency,
        sleep_ms,
        len(templates),
    )
    lock = threading.Lock()
    counter = {"remaining": iterations, "ok": 0, "err": 0}
    with ThreadPoolExecutor(max_workers=max(1, concurrency), thread_name_prefix="slow") as pool:
        futs = [
            pool.submit(_slow_burst_worker, conn_str, templates, sleep_ms, lock, counter)
            for _ in range(max(1, concurrency))
        ]
        wait(futs)
    logger.info("Slow burst done: ok=%s err=%s", counter["ok"], counter["err"])
    return counter["ok"], counter["err"]


def _load_workload_main_module(root: Path):
    path = root / "scripts" / "ml-optimization" / "run_ml_index_partition_workload.py"
    spec = importlib.util.spec_from_file_location("run_ml_index_partition_workload", path)
    if not spec or not spec.loader:
        raise RuntimeError(f"Cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def run_final_collect(root: Path, target_extra_rows: int, poll_seconds: int) -> int:
    """Append pg_stat_statements snapshot rows after workload (real collector)."""
    conn_str = _db_conn_str()
    try:
        conn = psycopg2.connect(conn_str)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM ml_optimization.query_logs;")
        start = int(cur.fetchone()[0] or 0)
        cur.close()
        conn.close()
    except Exception as ex:
        logger.warning("Could not read query_logs baseline: %s", ex)
        start = 0
    target = start + max(500, target_extra_rows)
    coll = root / "scripts" / "ml-optimization" / "run_query_collection.py"
    cmd = [
        sys.executable,
        str(coll),
        "--poll-seconds",
        str(max(1, poll_seconds)),
        "--target-rows",
        str(target),
        "--max-iterations",
        "400",
    ]
    logger.info("Final collect: %s", " ".join(cmd))
    return subprocess.call(cmd, cwd=str(root), env=_child_env(root))


def main() -> int:
    root = _project_root()
    parser = argparse.ArgumentParser(
        description="Warehouse traffic generator (real DB queries + query_logs + ML recommendations).",
        allow_abbrev=False,
    )
    parser.add_argument(
        "--slow-burst",
        type=int,
        default=600,
        metavar="N",
        help="Extra read-only SELECT iterations with pg_sleep (0=disable). Default: 600",
    )
    parser.add_argument(
        "--slow-sleep-ms",
        type=float,
        default=45.0,
        metavar="MS",
        help="pg_sleep duration per slow-burst statement (default 45 ms).",
    )
    parser.add_argument(
        "--slow-concurrency",
        type=int,
        default=8,
        help="Threads for slow burst (default 8).",
    )
    parser.add_argument(
        "--pre-slow-burst",
        action="store_true",
        help="Run slow burst before the main workload (default: after main workload).",
    )
    parser.add_argument(
        "--skip-slow-burst",
        action="store_true",
        help="Disable slow burst entirely.",
    )
    parser.add_argument(
        "--extra-collect-rows",
        type=int,
        default=6000,
        metavar="N",
        help="After workload + burst, run collector until query_logs grows by at least this many rows.",
    )
    parser.add_argument(
        "--collect-poll-seconds",
        type=int,
        default=2,
        help="Poll interval for final query_logs collection.",
    )
    parser.add_argument(
        "--skip-extra-collect",
        action="store_true",
        help="Skip post-run run_query_collection target pass.",
    )
    parser.add_argument(
        "--persist-again",
        action="store_true",
        help="Re-run ML recommendation persistence after final collect (extra DB round-trip).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned steps and exit without executing queries.",
    )
    args, unknown = parser.parse_known_args()

    workload_script = root / "scripts" / "ml-optimization" / "run_ml_index_partition_workload.py"
    if not workload_script.is_file():
        logger.error("Missing %s", workload_script)
        return 2

    default_forward = [
        "--iterations",
        "10000",
        "--concurrency",
        "16",
        "--heavy",
        "--collector-extra-rows",
        "10000",
    ]
    fwd = list(unknown)
    if fwd and fwd[0] == "--":
        fwd = fwd[1:]
    cmd_body = fwd if fwd else default_forward

    logger.info("Workload script: %s", workload_script)
    logger.info("Workload argv: %s", cmd_body)

    if args.dry_run:
        print("Dry run — would execute:")
        print("  1) [optional] slow burst", "disabled" if args.skip_slow_burst else f"n={args.slow_burst}")
        print("  2) subprocess:", sys.executable, str(workload_script), *cmd_body)
        print(
            "  3) [optional] final collect",
            "skipped" if args.skip_extra_collect else f"extra_rows>={args.extra_collect_rows}",
        )
        print("  4) [optional] persist again", "yes" if args.persist_again else "no")
        return 0

    conn_str = _db_conn_str()

    def maybe_burst(when: str) -> None:
        if args.skip_slow_burst or args.slow_burst <= 0:
            return
        logger.info("Starting slow burst (%s)", when)
        run_slow_query_burst(
            conn_str,
            iterations=args.slow_burst,
            concurrency=args.slow_concurrency,
            sleep_ms=args.slow_sleep_ms,
        )

    if args.pre_slow_burst:
        maybe_burst("pre-main")

    rc = subprocess.call(
        [sys.executable, str(workload_script)] + cmd_body,
        cwd=str(root),
        env=_child_env(root),
    )
    if rc != 0:
        logger.error("Main workload exited with code %s", rc)
        return rc

    if not args.pre_slow_burst:
        maybe_burst("post-main")

    if not args.skip_extra_collect:
        rc_c = run_final_collect(root, args.extra_collect_rows, args.collect_poll_seconds)
        if rc_c != 0:
            logger.warning("Final collect exited with code %s (query_logs may still be usable).", rc_c)

    if args.persist_again:
        try:
            mod = _load_workload_main_module(root)
            n_idx, n_part, pre = mod._persist_ml_pipeline_recommendations(conn_str, root)
            logger.info(
                "Re-persist ML recommendations: index=%s partition=%s (live_ml_rows=%s)",
                n_idx,
                n_part,
                pre,
            )
        except Exception as ex:
            logger.exception("Re-persist failed: %s", ex)

    logger.info(
        "Done. Refresh Optimizations, Analytics, Alerts, Monitoring — data is from this database."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
