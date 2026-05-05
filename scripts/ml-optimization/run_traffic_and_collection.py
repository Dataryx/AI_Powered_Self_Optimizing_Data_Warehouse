#!/usr/bin/env python3
"""
Run dashboard API traffic + optional direct-warehouse DB traffic + query log collection.

1. **HTTP** — ``generate_dashboard_api_traffic.py`` hits the ML API (drives SQL inside the API).
2. **PostgreSQL** — ``generate_warehouse_db_traffic.py`` runs SELECTs and CALLs procedures against
   gold/silver tables so ``pg_stat_statements`` captures realistic query + stored-proc shapes.
3. **Collector** — ``run_query_collection.py`` pulls stats into ``ml_optimization.query_logs``.

By default (1) and (2) run in the background until Ctrl+C; (3) runs in the foreground.

Usage (from project root):

  python scripts/ml-optimization/run_traffic_and_collection.py \\
    --base-url http://localhost:8000 --poll-seconds 3 \\
    --traffic-concurrency 16 --traffic-profile mixed \\
    --warehouse-db-diversity-mode aggressive

  # API traffic only (no direct DB sessions):
  python scripts/ml-optimization/run_traffic_and_collection.py --no-warehouse-db-traffic

Environment: POSTGRES_* and TRAFFIC_BASE_URL like other ML scripts.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent
    gen = script_dir / "generate_dashboard_api_traffic.py"
    gen_db = script_dir / "generate_warehouse_db_traffic.py"
    coll = script_dir / "run_query_collection.py"

    parser = argparse.ArgumentParser(
        description="Run API traffic + optional warehouse DB traffic (background) and query collector (foreground)."
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("TRAFFIC_BASE_URL", "http://localhost:8000"),
        help="Backend base URL for traffic generator",
    )
    parser.add_argument("--traffic-concurrency", type=int, default=16)
    parser.add_argument("--traffic-min-sleep-ms", type=int, default=5)
    parser.add_argument("--traffic-max-sleep-ms", type=int, default=40)
    parser.add_argument(
        "--traffic-profile",
        choices=("mixed", "light", "heavy"),
        default="mixed",
        help="Endpoint mix for traffic generator",
    )
    parser.add_argument("--traffic-timeout-seconds", type=float, default=120.0)

    parser.add_argument(
        "--no-warehouse-db-traffic",
        action="store_true",
        help="Skip direct PostgreSQL workload (API-only traffic).",
    )
    parser.add_argument(
        "--warehouse-db-diversity-mode",
        choices=("off", "on", "aggressive"),
        default="aggressive",
        help="Extra predicate-diverse DB SQL shapes to increase unique recommendation keys.",
    )
    parser.add_argument(
        "--warehouse-db-concurrency",
        type=int,
        default=8,
        help="Parallel DB sessions for warehouse SQL/CALL traffic (default: 8)",
    )
    parser.add_argument("--warehouse-db-min-sleep-ms", type=int, default=10)
    parser.add_argument("--warehouse-db-max-sleep-ms", type=int, default=120)
    parser.add_argument(
        "--warehouse-db-call-weight",
        type=float,
        default=0.22,
        help="Share of DB iterations that CALL ml_optimization.sp_traffic_* (default: 0.22)",
    )
    parser.add_argument(
        "--no-ensure-db-procedures",
        action="store_true",
        help="Do not CREATE/REPLACE ml_optimization.sp_traffic_* procedures.",
    )

    parser.add_argument(
        "--target-rows",
        type=int,
        default=None,
        metavar="N",
        help="Stop collector after N query_logs rows. Omit to run collector until Ctrl+C.",
    )
    parser.add_argument("--poll-seconds", type=int, default=3)
    parser.add_argument("--max-iterations", type=int, default=0)
    parser.add_argument(
        "--dashboard-only",
        action="store_true",
        help="Collector: restrict to dashboard-like SQL only",
    )
    parser.add_argument(
        "--min-mean-exec-time-ms",
        type=float,
        default=None,
        metavar="MS",
    )
    parser.add_argument("--reset-state", action="store_true")
    parser.add_argument("--expand-calls", action="store_true")

    args = parser.parse_args()

    traffic_cmd = [
        sys.executable,
        str(gen),
        "--base-url",
        args.base_url,
        "--forever",
        "--concurrency",
        str(args.traffic_concurrency),
        "--min-sleep-ms",
        str(args.traffic_min_sleep_ms),
        "--max-sleep-ms",
        str(args.traffic_max_sleep_ms),
        "--timeout-seconds",
        str(args.traffic_timeout_seconds),
        "--profile",
        args.traffic_profile,
    ]

    warehouse_cmd: list[str] | None = None
    if not args.no_warehouse_db_traffic:
        warehouse_cmd = [
            sys.executable,
            str(gen_db),
            "--forever",
            "--diversity-mode",
            args.warehouse_db_diversity_mode,
            "--concurrency",
            str(args.warehouse_db_concurrency),
            "--min-sleep-ms",
            str(args.warehouse_db_min_sleep_ms),
            "--max-sleep-ms",
            str(args.warehouse_db_max_sleep_ms),
            "--call-weight",
            str(args.warehouse_db_call_weight),
        ]
        if args.no_ensure_db_procedures:
            warehouse_cmd.append("--no-ensure-procedures")

    coll_cmd = [sys.executable, str(coll), "--poll-seconds", str(args.poll_seconds)]
    if args.max_iterations:
        coll_cmd.extend(["--max-iterations", str(args.max_iterations)])
    if args.target_rows is not None:
        coll_cmd.extend(["--target-rows", str(args.target_rows)])
    else:
        coll_cmd.append("--forever")
    if args.dashboard_only:
        coll_cmd.append("--dashboard-only")
    if args.min_mean_exec_time_ms is not None:
        coll_cmd.extend(["--min-mean-exec-time-ms", str(args.min_mean_exec_time_ms)])
    if args.reset_state:
        coll_cmd.append("--reset-state")
    if args.expand_calls:
        coll_cmd.append("--expand-calls")

    env = os.environ.copy()
    env.setdefault("PYTHONPATH", str(project_root))
    if "PYTHONPATH" in env and str(project_root) not in env["PYTHONPATH"]:
        env["PYTHONPATH"] = str(project_root) + os.pathsep + env["PYTHONPATH"]

    os.chdir(project_root)

    mode = (
        f"collector until {args.target_rows:,} rows"
        if args.target_rows is not None
        else "until Ctrl+C (collector stops traffic + DB workers)"
    )
    print(f"Mode: {mode}")
    print("Starting HTTP traffic (background)...")
    print(" ", " ".join(traffic_cmd))
    traffic = subprocess.Popen(
        traffic_cmd,
        cwd=str(project_root),
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )

    warehouse: subprocess.Popen | None = None
    if warehouse_cmd:
        print("Starting warehouse DB traffic (background; SELECT + CALL)...")
        print(" ", " ".join(warehouse_cmd))
        warehouse = subprocess.Popen(
            warehouse_cmd,
            cwd=str(project_root),
            env=env,
            stdout=sys.stdout,
            stderr=sys.stderr,
        )

    def stop_proc(proc: subprocess.Popen | None) -> None:
        if proc is None or proc.poll() is not None:
            return
        proc.terminate()
        try:
            proc.wait(timeout=15)
        except subprocess.TimeoutExpired:
            proc.kill()

    try:
        print("Starting query collector (foreground)...")
        print(" ", " ".join(coll_cmd))
        ret = subprocess.call(coll_cmd, cwd=str(project_root), env=env)
    except KeyboardInterrupt:
        print("\nInterrupted; stopping background workers...", file=sys.stderr)
        ret = 130
    finally:
        stop_proc(traffic)
        stop_proc(warehouse)

    sys.exit(ret)


if __name__ == "__main__":
    main()
