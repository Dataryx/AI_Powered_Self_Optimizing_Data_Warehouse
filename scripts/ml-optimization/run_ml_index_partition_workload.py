#!/usr/bin/env python3
"""
Heavy, parser-aligned PostgreSQL workload to drive **both** ML index and partition
recommendations.

**Default pipeline**

1. Start ``run_query_collection.py`` in the **background** (polls ``pg_stat_statements``
   into ``ml_optimization.query_logs``) while the workload runs.
2. Run concurrent warehouse SELECTs (parser-friendly ``schema.table.column`` predicates).
3. Stop the background collector and run a short **final** collect pass until ``query_logs``
   reaches at least ``start_count + --collector-extra-rows``.
4. **Persist** live ML recommendations (same logic as the API's
   ``_generate_model_based_recommendations``) into ``ml_optimization.index_recommendations``
   for both ``index`` and ``partition`` types (rows tagged with explanation prefix
   ``WorkloadMLPipeline|``; previous rows with that tag are replaced).

Requirements:

- Saved models under ``ml-optimization/saved_models`` (predictor .pkl or
  ``query_time_predictor_xgboost.json``, and/or ``anomaly_detector.pkl``) for ML output.
- Warehouse tables (e.g. ``silver.orders``, ``gold.fact_inventory_snapshot``).

Skip persistence with ``--no-persist``. Skip all collection with ``--no-collector``.

From project root (PowerShell):

  python scripts/ml-optimization/run_ml_index_partition_workload.py --iterations 8000 --concurrency 16

  python scripts/ml-optimization/run_ml_index_partition_workload.py --iterations 8000 --collector-extra-rows 5000 --collector-after-only
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
    format="%(asctime)s [%(threadName)s] %(levelname)s %(message)s",
)
logger = logging.getLogger("ml_index_partition_workload")

PIPELINE_TAG = "WorkloadMLPipeline|"


def _project_root_path() -> Path:
    return Path(__file__).resolve().parent.parent.parent


def _child_env(root: Path) -> dict:
    env = os.environ.copy()
    env.setdefault("PYTHONPATH", str(root))
    if str(root) not in env.get("PYTHONPATH", ""):
        env["PYTHONPATH"] = str(root) + os.pathsep + env.get("PYTHONPATH", "")
    return env


def _query_logs_count(conn_str: str) -> int | None:
    try:
        c = psycopg2.connect(conn_str)
        try:
            cur = c.cursor()
            cur.execute("SELECT COUNT(*) FROM ml_optimization.query_logs;")
            return int(cur.fetchone()[0] or 0)
        finally:
            c.close()
    except Exception:
        return None


def _load_optimization_routes_module(ml_opt: Path):
    if "ml_optimization.api.routes.optimization_routes" in sys.modules:
        return sys.modules["ml_optimization.api.routes.optimization_routes"]

    class FakeModule:
        def __init__(self, name: str):
            self.__name__ = name
            self.__path__ = []
            self.__file__ = None
            self.__spec__ = None

    root = ml_opt.parent
    sys.path.insert(0, str(root))
    sys.path.insert(0, str(ml_opt))
    sys.modules["ml_optimization"] = FakeModule("ml_optimization")
    sys.modules["ml_optimization.api"] = FakeModule("ml_optimization.api")
    sys.modules["ml_optimization.api.routes"] = FakeModule("ml_optimization.api.routes")
    sys.modules["ml_optimization.utils"] = FakeModule("ml_optimization.utils")
    sys.modules["ml_optimization.config"] = FakeModule("ml_optimization.config")

    db_utils_path = ml_opt / "utils" / "db_utils.py"
    spec = importlib.util.spec_from_file_location("ml_optimization.utils.db_utils", db_utils_path)
    if spec and spec.loader:
        m = importlib.util.module_from_spec(spec)
        sys.modules["ml_optimization.utils.db_utils"] = m
        spec.loader.exec_module(m)

    model_config_path = ml_opt / "config" / "model_config.py"
    spec = importlib.util.spec_from_file_location(
        "ml_optimization.config.model_config", model_config_path
    )
    if spec and spec.loader:
        m = importlib.util.module_from_spec(spec)
        sys.modules["ml_optimization.config.model_config"] = m
        spec.loader.exec_module(m)

    route_path = ml_opt / "api" / "routes" / "optimization_routes.py"
    spec = importlib.util.spec_from_file_location(
        "ml_optimization.api.routes.optimization_routes", route_path
    )
    if not spec or not spec.loader:
        raise RuntimeError("Cannot load optimization_routes.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["ml_optimization.api.routes.optimization_routes"] = mod
    spec.loader.exec_module(mod)
    return mod


def _ensure_index_recommendations_table(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS ml_optimization.index_recommendations (
            recommendation_id BIGSERIAL PRIMARY KEY,
            table_name VARCHAR(255) NOT NULL,
            column_name VARCHAR(255) NOT NULL,
            recommendation_type VARCHAR(50),
            priority VARCHAR(20),
            estimated_improvement NUMERIC,
            query_count INTEGER,
            avg_execution_time_ms NUMERIC,
            sql_statement TEXT,
            explanation TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    try:
        cur.execute(
            """
            ALTER TABLE ml_optimization.index_recommendations
            ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'pending'
            """
        )
    except Exception:
        pass


def _persist_ml_pipeline_recommendations(conn_str: str, root: Path) -> tuple[int, int, int]:
    """
    Replace prior pipeline-tagged rows; insert live ML index + partition recommendations
    (same grouping as the API). Returns (n_index, n_partition, n_live_pre_filter).
    """
    ml_opt = root / "ml-optimization"
    mod = _load_optimization_routes_module(ml_opt)
    conn = psycopg2.connect(conn_str)
    try:
        conn.autocommit = False
        cur = conn.cursor()
        _ensure_index_recommendations_table(cur)
        cur.execute(
            """
            DELETE FROM ml_optimization.index_recommendations
            WHERE COALESCE(explanation, '') LIKE %s
            """,
            (PIPELINE_TAG + "%",),
        )
        live, _scores = mod._generate_model_based_recommendations(conn, type_filter=None, return_cap=200)
        pre = len(live)
        source = "live_ml"
        if not live:
            # Recovery path when models are absent/unloaded or live sample extracted no groups.
            # Keep pipeline usable by falling back to catalog/query-log heuristics.
            idx_res = mod._get_fallback_index_recommendations(conn, None)
            part_res = mod._get_fallback_partition_recommendations(conn)
            live = list(idx_res.get("recommendations") or []) + list(part_res or [])
            source = "fallback"
            logger.warning(
                "Live ML returned 0 rows; fallback generated %s candidate recommendations.",
                len(live),
            )
        vetted = mod._filter_genuine_recommendations(conn, list(live))
        if not vetted and live:
            # If catalog filters are too strict for this environment, keep raw rows so users can
            # still see actionable candidates from this pipeline run.
            logger.warning("Catalog filtering removed all candidates; persisting unfiltered rows.")
            vetted = list(live)
        n_idx = n_part = 0
        for r in vetted:
            rtype = str(r.get("type") or "index").lower()
            if rtype not in ("index", "partition"):
                continue
            table = str(r.get("table") or "").strip()
            cols = r.get("columns") or []
            col = cols[0] if isinstance(cols, list) and cols else None
            if not col:
                continue
            reason = str(r.get("explanation") or r.get("reason") or "")
            expl = (PIPELINE_TAG + f"[{source}] " + reason)[:8000]
            cur.execute(
                """
                INSERT INTO ml_optimization.index_recommendations
                (table_name, column_name, recommendation_type, priority,
                 estimated_improvement, query_count, avg_execution_time_ms,
                 sql_statement, explanation)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    table,
                    str(col),
                    rtype,
                    str(r.get("priority") or "medium"),
                    float(r.get("estimated_improvement") or 0.2),
                    int(r.get("query_count") or 0),
                    float(r.get("avg_execution_time_ms") or 0),
                    str(r.get("sql_statement") or ""),
                    expl,
                ),
            )
            if rtype == "partition":
                n_part += 1
            else:
                n_idx += 1
        if n_part == 0 and n_idx > 0:
            # Ensure at least one partition candidate when workload clearly carries time/range filters.
            for r in vetted:
                table = str(r.get("table") or "").strip()
                cols = r.get("columns") or []
                col = str(cols[0]).strip().lower() if isinstance(cols, list) and cols else ""
                if not table or not col:
                    continue
                if not (col.endswith("_date") or col.endswith("_at") or col.endswith("_ts") or col in ("date", "timestamp")):
                    continue
                cur.execute(
                    """
                    INSERT INTO ml_optimization.index_recommendations
                    (table_name, column_name, recommendation_type, priority,
                     estimated_improvement, query_count, avg_execution_time_ms,
                     sql_statement, explanation)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        table,
                        col,
                        "partition",
                        "medium",
                        0.2,
                        int(r.get("query_count") or 0),
                        float(r.get("avg_execution_time_ms") or 0),
                        (
                            f"-- Template: CREATE TABLE {table}_partitioned (LIKE {table} INCLUDING ALL) "
                            f"PARTITION BY RANGE ({col});"
                        ),
                        (PIPELINE_TAG + f"[{source}] Auto-added partition hint for time column {table}.{col}")[:8000],
                    ),
                )
                n_part = 1
                break
        conn.commit()
        return n_idx, n_part, pre
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _db_conn_str() -> str:
    project_root = Path(__file__).resolve().parent.parent.parent
    sys.path.insert(0, str(project_root))
    sys.path.insert(0, str(project_root / "ml-optimization"))
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
            f"connect_timeout=20"
        )


def _table_exists(cur, schema: str, rel: str) -> bool:
    cur.execute(
        """
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = %s AND c.relname = %s AND c.relkind IN ('r','p','v','m')
        """,
        (schema, rel),
    )
    return cur.fetchone() is not None


def _strict_friendly_id_predicate(qualified_table: str, col: str) -> str:
    """Use ``> 0`` so ``_parse_*`` strict ops match; fall back to ``IS NOT NULL``."""
    if col in ("order_key", "order_id", "customer_id", "event_id", "user_id", "product_key"):
        return f" AND {qualified_table}.{col} > 0"
    return f" AND {qualified_table}.{col} IS NOT NULL"


def _column_exists(cur, schema: str, rel: str, column: str) -> bool:
    cur.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s AND lower(column_name) = lower(%s)
        LIMIT 1
        """,
        (schema, rel, column),
    )
    return cur.fetchone() is not None


def _build_parser_aligned_statements(cur, heavy: bool) -> Tuple[List[str], List[str]]:
    """
    Return (sql_list, notes). Every statement uses schema.table.column in predicates
    so ``_parse_index_candidates`` / ``_parse_partition_candidates`` can attach keys.
    """
    g = lambda s, t: _table_exists(cur, s, t)  # noqa: E731
    c = lambda s, t, col: _column_exists(cur, s, t, col)  # noqa: E731
    stmts: List[str] = []
    notes: List[str] = []

    lim = 25000 if heavy else 8000

    # --- gold.fact_inventory_snapshot: snapshot_date (partition) + product_key (index) ---
    if g("gold", "fact_inventory_snapshot") and c("gold", "fact_inventory_snapshot", "snapshot_date"):
        pk = "product_key" if c("gold", "fact_inventory_snapshot", "product_key") else None
        if pk:
            stmts.append(
                "SELECT count(*) FROM gold.fact_inventory_snapshot "
                "WHERE gold.fact_inventory_snapshot.snapshot_date >= current_date - interval '500 day' "
                f"AND gold.fact_inventory_snapshot.{pk} > 0"
            )
            if heavy:
                stmts.append(
                    "SELECT gold.fact_inventory_snapshot.product_key, "
                    "sum(gold.fact_inventory_snapshot.quantity_on_hand) "
                    "FROM gold.fact_inventory_snapshot "
                    "WHERE gold.fact_inventory_snapshot.snapshot_date >= current_date - interval '500 day' "
                    "AND gold.fact_inventory_snapshot.product_key > 0 "
                    "GROUP BY gold.fact_inventory_snapshot.product_key "
                    f"ORDER BY sum DESC NULLS LAST LIMIT {lim}"
                )
        else:
            notes.append("gold.fact_inventory_snapshot: product_key missing; skipped composite")

    # --- silver.orders: order_date (partition) + customer_id (index) ---
    if g("silver", "orders") and c("silver", "orders", "order_date"):
        idx_col = None
        for cand in ("customer_id", "order_key", "order_id"):
            if c("silver", "orders", cand):
                idx_col = cand
                break
        if idx_col:
            pred = _strict_friendly_id_predicate("silver.orders", idx_col)
            stmts.append(
                "SELECT count(*) FROM silver.orders "
                "WHERE silver.orders.order_date >= current_date - interval '540 day' "
                f"{pred}"
            )
            if heavy:
                stmts.append(
                    "SELECT silver.orders.order_date, count(*) FROM silver.orders "
                    "WHERE silver.orders.order_date >= current_date - interval '540 day' "
                    f"{pred} "
                    "GROUP BY silver.orders.order_date "
                    f"ORDER BY silver.orders.order_date DESC LIMIT {min(lim, 6000)}"
                )
        else:
            notes.append("silver.orders: no customer_id/order_key/order_id; time-only shape")
            stmts.append(
                "SELECT count(*) FROM silver.orders "
                "WHERE silver.orders.order_date >= current_date - interval '540 day'"
            )

    # --- bronze.customer_events: created_at (partition) + customer_id (index) ---
    if g("bronze", "customer_events") and c("bronze", "customer_events", "created_at"):
        idx_col = None
        for cand in ("customer_id", "user_id", "event_id"):
            if c("bronze", "customer_events", cand):
                idx_col = cand
                break
        if idx_col:
            pred = _strict_friendly_id_predicate("bronze.customer_events", idx_col)
            stmts.append(
                "SELECT count(*) FROM bronze.customer_events "
                "WHERE bronze.customer_events.created_at >= now() - interval '720 hour' "
                f"{pred}"
            )
            if heavy:
                stmts.append(
                    "SELECT date_trunc('day', bronze.customer_events.created_at) AS d, count(*) "
                    "FROM bronze.customer_events "
                    "WHERE bronze.customer_events.created_at >= now() - interval '720 hour' "
                    f"{pred} "
                    "GROUP BY d ORDER BY d DESC "
                    f"LIMIT {min(lim, 4000)}"
                )
        else:
            stmts.append(
                "SELECT count(*) FROM bronze.customer_events "
                "WHERE bronze.customer_events.created_at >= now() - interval '720 hour'"
            )

    # --- bronze.events: event_ts (partition) + strict inequality on another column (index) ---
    if g("bronze", "events") and c("bronze", "events", "event_ts"):
        extra = ""
        if c("bronze", "events", "event_id"):
            extra = " AND bronze.events.event_id > 0"
        elif c("bronze", "events", "user_id"):
            extra = " AND bronze.events.user_id > 0"
        stmts.append(
            "SELECT count(*) FROM bronze.events "
            "WHERE bronze.events.event_ts >= now() - interval '90 day'" + extra
        )
        if heavy:
            stmts.append(
                "SELECT date_trunc('hour', bronze.events.event_ts) AS hr, count(*) FROM bronze.events "
                "WHERE bronze.events.event_ts >= now() - interval '90 day'" + extra + " "
                "GROUP BY hr ORDER BY hr DESC LIMIT 3000"
            )

    # --- gold.fact_sales: join dim for category_name token + strict time on silver.orders if present ---
    if g("gold", "fact_sales") and g("gold", "dim_product") and c("gold", "fact_sales", "product_key"):
        stmts.append(
            "SELECT count(*) FROM gold.fact_sales "
            "JOIN gold.dim_product ON gold.dim_product.product_key = gold.fact_sales.product_key "
            "WHERE gold.fact_sales.product_key > 0 "
            "AND gold.dim_product.category_name IS NOT NULL"
        )

    if (
        g("gold", "fact_sales")
        and c("gold", "fact_sales", "net_amount")
        and c("gold", "fact_sales", "quantity")
    ):
        stmts.append(
            "SELECT count(*) FROM gold.fact_sales "
            "WHERE gold.fact_sales.net_amount > 0 AND gold.fact_sales.quantity BETWEEN 1 AND 10000"
        )

    return stmts, notes


def _worker(
    conn_str: str,
    stmts: List[str],
    iterations: int,
    lock: threading.Lock,
    counter: dict,
    stop: threading.Event,
    min_sleep_ms: int,
    max_sleep_ms: int,
) -> None:
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    cur = conn.cursor()
    try:
        while not stop.is_set():
            with lock:
                if counter["remaining"] <= 0:
                    break
                counter["remaining"] -= 1
            sql = random.choice(stmts)
            try:
                cur.execute(sql)
                if cur.description:
                    cur.fetchall()
                with lock:
                    counter["ok"] += 1
            except Exception as e:
                with lock:
                    counter["err"] += 1
                logger.debug("exec failed: %s | %s", e, sql[:200])
            if max_sleep_ms > 0 and min_sleep_ms >= 0:
                time.sleep(random.randint(min_sleep_ms, max_sleep_ms) / 1000.0)
    finally:
        cur.close()
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Run warehouse workload, collect query_logs, persist ML index + partition recommendations."
        )
    )
    parser.add_argument("--iterations", type=int, default=5000, help="Total executed statements")
    parser.add_argument("--concurrency", type=int, default=12, help="Parallel sessions")
    parser.add_argument(
        "--heavy",
        action="store_true",
        help="Include larger GROUP BY / LIMIT queries to increase execution time variance.",
    )
    parser.add_argument("--min-sleep-ms", type=int, default=0)
    parser.add_argument("--max-sleep-ms", type=int, default=15)
    parser.add_argument(
        "--run-collector",
        action="store_true",
        help=argparse.SUPPRESS,
    )  # Deprecated: collection is default; use --no-collector to skip.
    parser.add_argument(
        "--no-collector",
        action="store_true",
        help="Do not run run_query_collection.py (no query_logs updates).",
    )
    parser.add_argument(
        "--collector-after-only",
        action="store_true",
        help="Collect only after workload (default: also poll during workload).",
    )
    parser.add_argument(
        "--collector-extra-rows",
        type=int,
        default=5000,
        metavar="N",
        help="Final collect targets at least (query_logs at start + N) rows.",
    )
    parser.add_argument("--collector-poll-seconds", type=int, default=2)
    parser.add_argument(
        "--no-persist",
        action="store_true",
        help="Skip writing ML recommendations to ml_optimization.index_recommendations.",
    )
    args = parser.parse_args()

    if args.iterations <= 0:
        logger.error("--iterations must be > 0")
        return 2
    if args.concurrency <= 0:
        logger.error("--concurrency must be > 0")
        return 2

    project_root = _project_root_path()
    conn_str = _db_conn_str()
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    cur = conn.cursor()
    stmts, notes = _build_parser_aligned_statements(cur, heavy=args.heavy)
    cur.close()
    conn.close()

    for n in notes:
        logger.warning("%s", n)
    if not stmts:
        logger.error(
            "No workload statements built. Expected warehouse tables "
            "(e.g. silver.orders, gold.fact_inventory_snapshot, bronze.customer_events)."
        )
        return 1

    logger.info("Built %d statement shape(s). Sample:\n  %s", len(stmts), stmts[0][:300])

    saved = project_root / "ml-optimization" / "saved_models"
    pkl = saved / "query_time_predictor.pkl"
    xgb = saved / "query_time_predictor_xgboost.json"
    anom = saved / "anomaly_detector.pkl"
    if not (pkl.exists() or xgb.exists() or anom.exists()):
        logger.warning(
            "No predictor/anomaly artifacts in %s — persist step will insert 0 ML rows "
            "until models exist (see scripts/ml-optimization/train_all_models.py).",
            saved,
        )
    else:
        logger.info(
            "Model artifacts: predictor_pkl=%s xgb_json=%s anomaly=%s",
            pkl.exists(),
            xgb.exists(),
            anom.exists(),
        )

    coll = Path(__file__).resolve().parent / "run_query_collection.py"
    env = _child_env(project_root)
    qlog_start: int | None = None
    coll_proc: subprocess.Popen | None = None

    if not args.no_collector:
        qlog_start = _query_logs_count(conn_str)
        if qlog_start is None:
            logger.warning("Could not read ml_optimization.query_logs (table missing?).")
        if not args.collector_after_only:
            bg = [
                sys.executable,
                str(coll),
                "--forever",
                "--poll-seconds",
                str(max(1, args.collector_poll_seconds)),
            ]
            logger.info("Background query collector: %s", " ".join(bg))
            coll_proc = subprocess.Popen(bg, cwd=str(project_root), env=env)

    lock = threading.Lock()
    counter = {"remaining": args.iterations, "ok": 0, "err": 0}
    stop = threading.Event()
    t0 = time.perf_counter()
    try:
        with ThreadPoolExecutor(max_workers=args.concurrency, thread_name_prefix="mlw") as pool:
            futs = [
                pool.submit(
                    _worker,
                    conn_str,
                    stmts,
                    args.iterations,
                    lock,
                    counter,
                    stop,
                    args.min_sleep_ms,
                    args.max_sleep_ms,
                )
                for _ in range(args.concurrency)
            ]
            wait(futs)
    finally:
        if coll_proc is not None and coll_proc.poll() is None:
            logger.info("Stopping background query collector...")
            coll_proc.terminate()
            try:
                coll_proc.wait(timeout=20)
            except subprocess.TimeoutExpired:
                coll_proc.kill()

    elapsed = time.perf_counter() - t0
    logger.info(
        "Workload finished in %.1fs: ok=%s err=%s (requested %s)",
        elapsed,
        counter["ok"],
        counter["err"],
        args.iterations,
    )

    if not args.no_collector:
        if qlog_start is not None:
            target_abs = qlog_start + max(1, args.collector_extra_rows)
        else:
            target_abs = max(1, args.collector_extra_rows)
        fin = [
            sys.executable,
            str(coll),
            "--poll-seconds",
            str(max(1, args.collector_poll_seconds)),
            "--target-rows",
            str(target_abs),
            "--max-iterations",
            "500",
        ]
        logger.info(
            "Final query collect -> target_rows=%s (start was %s): %s",
            target_abs,
            qlog_start,
            " ".join(fin),
        )
        rc = subprocess.call(fin, cwd=str(project_root), env=env)
        if rc != 0:
            logger.error("Collector exited with code %s", rc)
            return rc

    if args.no_persist:
        logger.info("Skipping ML persist (--no-persist).")
        return 0

    try:
        n_idx, n_part, pre = _persist_ml_pipeline_recommendations(conn_str, project_root)
        logger.info(
            "ML recommendations persisted: index=%s partition=%s (live_ml_rows=%s). "
            "Open Optimizations or GET /recommendations to view.",
            n_idx,
            n_part,
            pre,
        )
        if n_idx == 0 and n_part == 0:
            return 3
        if n_idx == 0 or n_part == 0:
            logger.warning(
                "Expected both index and partition rows; got index=%s partition=%s. "
                "Try --heavy, more --iterations, or ensure time+key columns exist on warehouse tables.",
                n_idx,
                n_part,
            )
    except Exception:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
