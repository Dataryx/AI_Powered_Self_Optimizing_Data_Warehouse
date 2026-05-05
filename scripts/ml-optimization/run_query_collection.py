"""
Query Log Collection Runner
Runs the ML optimization query log collection and analysis.
"""

import sys
import logging
import psycopg2
import os
import time
from pathlib import Path

# Add parent directory to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "ml-optimization"))

# Try to import - adjust path if needed
try:
    from collectors.query_log_collector import QueryLogCollector
except ImportError:
    # Fallback: try absolute import
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "query_log_collector",
        project_root / "ml-optimization" / "collectors" / "query_log_collector.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    QueryLogCollector = module.QueryLogCollector

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def _log_ml_recommendations_pipeline_hint() -> None:
    """Query collection only fills query_logs; ML suggestions are produced elsewhere."""
    logger.info(
        "Note: This script only updates ml_optimization.query_logs. It does not run ML or "
        "write index recommendations. For ML suggestions: (1) keep API running with "
        "ml-optimization/saved_models (query_time_predictor .pkl or "
        "query_time_predictor_xgboost.json, optionally anomaly_detector.pkl) and open the "
        "Optimizations UI, or (2) run: python scripts/ml-optimization/generate_recommendations_ml.py"
    )


def _db_conn_str() -> str:
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
            f"connect_timeout=15"
        )


def _get_query_logs_count(db_conn_str: str) -> int:
    conn = psycopg2.connect(db_conn_str)
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM ml_optimization.query_logs;")
        count = int(cur.fetchone()[0] or 0)
        cur.close()
        return count
    finally:
        conn.close()


def _reset_collection_state(db_conn_str: str) -> None:
    conn = psycopg2.connect(db_conn_str)
    try:
        cur = conn.cursor()
        cur.execute("TRUNCATE TABLE ml_optimization.query_log_collection_state;")
        conn.commit()
        cur.close()
    finally:
        conn.close()


def run_query_collection(
    dashboard_only: bool = False,
    target_rows: int | None = None,
    poll_seconds: int = 2,
    max_iterations: int = 0,
    bootstrap_if_empty: bool = True,
    reset_state: bool = False,
    expand_calls: bool = False,
    max_rows_per_queryid: int = 50,
    min_mean_exec_time_ms: float = 0.0,
    min_total_exec_time_ms: float = 0.0,
    forever: bool = False,
):
    """Run query log collection from pg_stat_statements."""
    db_conn_str = _db_conn_str()
    
    try:
        logger.info("=" * 60)
        logger.info("Starting Query Log Collection")
        logger.info("=" * 60)
        logger.info(
            "pg_stat_statements filter: dashboard_only=%s, mean_exec_time>=%s ms, total_exec_time>=%s ms",
            dashboard_only,
            min_mean_exec_time_ms or 0,
            min_total_exec_time_ms or 0,
        )
        
        # Initialize collector
        collector = QueryLogCollector(
            db_conn_str,
            schema="ml_optimization",
            dashboard_only=dashboard_only,
            min_mean_exec_time_ms=min_mean_exec_time_ms,
            min_total_exec_time_ms=min_total_exec_time_ms,
        )

        if reset_state:
            _reset_collection_state(db_conn_str)
            logger.info("Reset ml_optimization.query_log_collection_state")

        if forever:
            if poll_seconds < 0:
                raise ValueError("poll_seconds must be >= 0")
            iterations = 0
            logger.info("Forever mode: collecting until interrupted (Ctrl+C).")
            try:
                while True:
                    if max_iterations > 0 and iterations >= max_iterations:
                        logger.info("Reached max_iterations=%s.", max_iterations)
                        break
                    current_before = _get_query_logs_count(db_conn_str)
                    force_snapshot = bootstrap_if_empty and current_before == 0 and iterations == 0
                    if force_snapshot:
                        logger.info("query_logs is empty; running bootstrap snapshot from current pg_stat_statements.")
                    inserted = collector.collect_and_store(
                        force_snapshot=force_snapshot,
                        expand_calls=expand_calls,
                        max_rows_per_queryid=max_rows_per_queryid,
                    )
                    iterations += 1
                    current_total = _get_query_logs_count(db_conn_str)
                    logger.info(
                        "Iteration %s: inserted=%s, total_rows=%s",
                        iterations,
                        f"{inserted:,}",
                        f"{current_total:,}",
                    )
                    if poll_seconds > 0:
                        time.sleep(poll_seconds)
            except KeyboardInterrupt:
                logger.info("Query log collection stopped by user.")
            logger.info("=" * 60)
            logger.info("Query Log Collection Loop Complete!")
            logger.info("=" * 60)
            _log_ml_recommendations_pipeline_hint()
            return

        if target_rows is None:
            # Single-shot mode
            count = collector.collect_and_store()
            logger.info("=" * 60)
            logger.info("Query Log Collection Complete!")
            logger.info("Collected %s query log records", count)
            logger.info("=" * 60)
            _log_ml_recommendations_pipeline_hint()
            return

        # Target mode: collect until query_logs reaches target_rows
        if target_rows <= 0:
            raise ValueError("target_rows must be > 0 when provided")
        if poll_seconds < 0:
            raise ValueError("poll_seconds must be >= 0")

        start_total = _get_query_logs_count(db_conn_str)
        logger.info("Target mode enabled: target_rows=%s, current_rows=%s", f"{target_rows:,}", f"{start_total:,}")

        iterations = 0
        while True:
            if max_iterations > 0 and iterations >= max_iterations:
                logger.info("Reached max_iterations=%s before target.", max_iterations)
                break

            current_before = _get_query_logs_count(db_conn_str)
            force_snapshot = bootstrap_if_empty and current_before == 0 and iterations == 0
            if force_snapshot:
                logger.info("query_logs is empty; running bootstrap snapshot from current pg_stat_statements.")
            inserted = collector.collect_and_store(
                force_snapshot=force_snapshot,
                expand_calls=expand_calls,
                max_rows_per_queryid=max_rows_per_queryid,
            )
            iterations += 1
            current_total = _get_query_logs_count(db_conn_str)
            logger.info(
                "Iteration %s: inserted=%s, total_rows=%s, remaining=%s",
                iterations,
                f"{inserted:,}",
                f"{current_total:,}",
                f"{max(0, target_rows - current_total):,}",
            )

            if current_total >= target_rows:
                logger.info("Target reached: ml_optimization.query_logs has %s rows.", f"{current_total:,}")
                break

            if poll_seconds > 0:
                time.sleep(poll_seconds)

        logger.info("=" * 60)
        logger.info("Query Log Collection Loop Complete!")
        logger.info("=" * 60)
        _log_ml_recommendations_pipeline_hint()

    except Exception as e:
        logger.error(f"Error in query log collection: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Collect real query logs from pg_stat_statements.")
    parser.add_argument(
        "--dashboard-only",
        action="store_true",
        help="Restrict to dashboard/warehouse SQL patterns (gold./silver./bronze./monitoring./pg_*). Default: collect all pg_stat_statements rows.",
    )
    parser.add_argument(
        "--all-queries",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--forever",
        action="store_true",
        help="Poll pg_stat_statements until Ctrl+C (ignores --target-rows).",
    )
    parser.add_argument(
        "--target-rows",
        type=int,
        default=0,
        help="Keep collecting until ml_optimization.query_logs reaches this row count (omit with --forever).",
    )
    parser.add_argument(
        "--poll-seconds",
        type=int,
        default=2,
        help="Sleep between collection loops in target mode (default: 2).",
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=0,
        help="Optional safety cap for target mode; 0 means unlimited.",
    )
    parser.add_argument(
        "--no-bootstrap-if-empty",
        action="store_true",
        help="Disable bootstrap snapshot when query_logs is empty.",
    )
    parser.add_argument(
        "--reset-state",
        action="store_true",
        help="Truncate query_log_collection_state before collecting.",
    )
    parser.add_argument(
        "--expand-calls",
        action="store_true",
        help="Expand delta_calls into multiple per-call rows (faster dataset growth; still derived from real pg_stat_statements counters).",
    )
    parser.add_argument(
        "--max-rows-per-queryid",
        type=int,
        default=50,
        help="Safety cap when --expand-calls is enabled.",
    )
    parser.add_argument(
        "--no-heavy-filter",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    parser.add_argument(
        "--min-mean-exec-time-ms",
        type=float,
        default=None,
        metavar="MS",
        help="Minimum pg_stat_statements.mean_exec_time (ms) to collect (default: 0 = all).",
    )
    parser.add_argument(
        "--min-total-exec-time-ms",
        type=float,
        default=None,
        metavar="MS",
        help="Minimum pg_stat_statements.total_exec_time (ms) to collect (default: 0).",
    )
    args = parser.parse_args()

    target_rows_opt = None if args.forever else (args.target_rows if args.target_rows > 0 else None)
    if args.min_mean_exec_time_ms is not None:
        min_mean = float(args.min_mean_exec_time_ms)
    else:
        min_mean = 0.0

    if args.min_total_exec_time_ms is not None:
        min_total = float(args.min_total_exec_time_ms)
    else:
        min_total = 0.0

    # Default: all statement types; --dashboard-only or legacy --all-queries False pattern
    dashboard_only = args.dashboard_only
    if args.all_queries:
        dashboard_only = False

    run_query_collection(
        dashboard_only=dashboard_only,
        target_rows=target_rows_opt,
        poll_seconds=args.poll_seconds,
        max_iterations=args.max_iterations,
        bootstrap_if_empty=(not args.no_bootstrap_if_empty),
        reset_state=args.reset_state,
        expand_calls=args.expand_calls,
        max_rows_per_queryid=args.max_rows_per_queryid,
        min_mean_exec_time_ms=min_mean,
        min_total_exec_time_ms=min_total,
        forever=args.forever,
    )

