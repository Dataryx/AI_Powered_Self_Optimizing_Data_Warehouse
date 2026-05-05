#!/usr/bin/env python3
"""
Direct PostgreSQL workload for pg_stat_statements / query log collection.

Runs realistic SELECT patterns (joins, filters, aggregates) against bronze/silver/gold
when those relations exist, plus optional CALL to small procedures in ``ml_optimization``.

Use with ``run_query_collection.py`` or ``run_traffic_and_collection.py`` so the collector
sees warehouse-shaped SQL alongside API-driven traffic.

Environment: POSTGRES_* (same as other ML scripts).
"""

from __future__ import annotations

import argparse
from collections import deque
import logging
import os
import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, wait
from typing import List, Tuple

import psycopg2

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(threadName)s] %(levelname)s %(message)s",
)
logger = logging.getLogger("warehouse_db_traffic")


def _db_conn_str() -> str:
    return (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')}"
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


def _build_diversity_sql(cur, mode: str) -> List[Tuple[str, float]]:
    """
    Additional predicate-diverse SQL shapes to expand unique (table, column) keys.
    """
    if mode not in ("on", "aggressive"):
        return []

    g = lambda s, t: _table_exists(cur, s, t)  # noqa: E731
    c = lambda s, t, col: _column_exists(cur, s, t, col)  # noqa: E731
    weight_base = 2.0 if mode == "aggressive" else 1.2
    out: List[Tuple[str, float]] = []
    day_windows = [3, 7, 14, 30, 60, 90] if mode == "aggressive" else [7, 30]
    hour_windows = [6, 12, 24, 48, 72, 168] if mode == "aggressive" else [24, 72]
    top_limits = [120, 250, 400, 700] if mode == "aggressive" else [120, 250]

    if g("silver", "orders"):
        if c("silver", "orders", "order_date"):
            for d in day_windows:
                out.append(
                    (
                        "SELECT count(*) FROM silver.orders "
                        f"WHERE order_date >= current_date - interval '{d} day'",
                        weight_base,
                    )
                )
        if c("silver", "orders", "customer_id"):
            for lim in top_limits:
                out.append(
                    (
                        "SELECT customer_id, count(*) FROM silver.orders "
                        "WHERE customer_id IS NOT NULL GROUP BY customer_id "
                        f"ORDER BY count(*) DESC LIMIT {lim}",
                        weight_base,
                    )
                )
        if c("silver", "orders", "order_status"):
            out.append(
                (
                    "SELECT order_status, count(*) FROM silver.orders "
                    "WHERE order_status IS NOT NULL GROUP BY order_status "
                    "ORDER BY count(*) DESC LIMIT 120",
                    weight_base,
                )
            )

    if g("silver", "order_item"):
        if c("silver", "order_item", "order_key") and c("silver", "order_item", "product_key"):
            for lim in top_limits:
                out.append(
                    (
                        "SELECT oi.product_key, count(*) FROM silver.order_item oi "
                        "WHERE oi.order_key IS NOT NULL GROUP BY oi.product_key "
                        f"ORDER BY count(*) DESC LIMIT {lim}",
                        weight_base,
                    )
                )

    if g("gold", "fact_sales"):
        if c("gold", "fact_sales", "order_date_key"):
            for lim in ([180, 365, 730] if mode == "aggressive" else [365]):
                out.append(
                    (
                        "SELECT order_date_key, sum(net_amount) FROM gold.fact_sales "
                        "WHERE order_date_key IS NOT NULL GROUP BY order_date_key "
                        f"ORDER BY order_date_key DESC LIMIT {lim}",
                        weight_base,
                    )
                )
            for d in day_windows:
                out.append(
                    (
                        "SELECT count(*) FROM gold.fact_sales "
                        f"WHERE order_date_key >= (SELECT max(order_date_key) - {d} FROM gold.fact_sales)",
                        weight_base,
                    )
                )
        if c("gold", "fact_sales", "customer_key"):
            for lim in top_limits:
                out.append(
                    (
                        "SELECT customer_key, sum(net_amount) FROM gold.fact_sales "
                        "WHERE customer_key IS NOT NULL GROUP BY customer_key "
                        f"ORDER BY sum(net_amount) DESC NULLS LAST LIMIT {lim}",
                        weight_base,
                    )
                )
        if c("gold", "fact_sales", "product_key"):
            for lim in top_limits:
                out.append(
                    (
                        "SELECT product_key, sum(quantity) FROM gold.fact_sales "
                        "WHERE product_key IS NOT NULL GROUP BY product_key "
                        f"ORDER BY sum(quantity) DESC NULLS LAST LIMIT {lim}",
                        weight_base,
                    )
                )

    if g("gold", "fact_inventory_snapshot"):
        if c("gold", "fact_inventory_snapshot", "snapshot_date"):
            for lim in ([90, 180, 365] if mode == "aggressive" else [180]):
                out.append(
                    (
                        "SELECT snapshot_date, count(*) FROM gold.fact_inventory_snapshot "
                        "WHERE snapshot_date IS NOT NULL GROUP BY snapshot_date "
                        f"ORDER BY snapshot_date DESC LIMIT {lim}",
                        weight_base,
                    )
                )
        if c("gold", "fact_inventory_snapshot", "product_key"):
            out.append(
                (
                    "SELECT product_key, avg(quantity_on_hand) FROM gold.fact_inventory_snapshot "
                    "GROUP BY product_key ORDER BY avg(quantity_on_hand) DESC NULLS LAST LIMIT 250",
                    weight_base,
                )
            )

    if g("bronze", "customer_events"):
        if c("bronze", "customer_events", "created_at"):
            for h in hour_windows:
                out.append(
                    (
                        "SELECT count(*) FROM bronze.customer_events "
                        f"WHERE created_at >= now() - interval '{h} hour'",
                        weight_base,
                    )
                )
            for h in ([48, 72, 168] if mode == "aggressive" else [72]):
                out.append(
                    (
                        "SELECT date_trunc('hour', created_at) AS hr, count(*) "
                        "FROM bronze.customer_events "
                        f"WHERE created_at >= now() - interval '{h} hour' "
                        "GROUP BY hr ORDER BY hr DESC LIMIT 240",
                        weight_base,
                    )
                )

    if g("bronze", "events") and c("bronze", "events", "event_ts"):
        for d in day_windows:
            out.append(
                (
                    "SELECT date_trunc('day', event_ts) AS d, count(*) FROM bronze.events "
                    f"WHERE event_ts >= now() - interval '{d} day' "
                    "GROUP BY d ORDER BY d DESC LIMIT 180",
                    weight_base,
                )
            )

    return out


def _build_select_workload(cur, diversity_mode: str = "off") -> Tuple[List[Tuple[str, float]], List[str]]:
    """Return (weighted_sql_list, warnings). Each item is (sql, weight)."""
    g = lambda s, t: _table_exists(cur, s, t)  # noqa: E731
    w: List[Tuple[str, float]] = []
    notes: List[str] = []

    if g("gold", "fact_sales"):
        w.extend(
            [
                ("SELECT count(*) FROM gold.fact_sales", 3.0),
                (
                    "SELECT sum(quantity), avg(net_amount) FROM gold.fact_sales WHERE quantity > 0",
                    2.5,
                ),
                (
                    "SELECT p.category_name, sum(fs.quantity) AS q FROM gold.fact_sales fs "
                    "JOIN gold.dim_product p ON p.product_key = fs.product_key "
                    "WHERE fs.net_amount > 0 GROUP BY p.category_name ORDER BY q DESC NULLS LAST LIMIT 200",
                    4.0,
                ),
                (
                    "SELECT c.state_province, count(*) FROM gold.fact_sales fs "
                    "JOIN gold.dim_customer c ON c.customer_key = fs.customer_key "
                    "GROUP BY c.state_province ORDER BY count DESC LIMIT 100",
                    3.0,
                ),
                (
                    "SELECT fs.order_date_key, sum(fs.net_amount) FROM gold.fact_sales fs "
                    "WHERE fs.order_date_key IS NOT NULL GROUP BY fs.order_date_key "
                    "ORDER BY fs.order_date_key DESC LIMIT 200",
                    2.5,
                ),
                (
                    "SELECT fs.sales_key, fs.net_amount, fs.quantity FROM gold.fact_sales fs "
                    "JOIN gold.dim_product p ON fs.product_key = p.product_key "
                    "WHERE p.category_name IS NOT NULL ORDER BY fs.net_amount DESC NULLS LAST LIMIT 5000",
                    2.0,
                ),
                (
                    "SELECT fs.sales_key, fs.net_amount FROM gold.fact_sales fs "
                    "JOIN gold.dim_product p ON fs.product_key = p.product_key "
                    "JOIN gold.dim_customer c ON c.customer_key = fs.customer_key "
                    "WHERE fs.quantity BETWEEN 1 AND 100 ORDER BY fs.order_date_key DESC NULLS LAST LIMIT 3000",
                    2.0,
                ),
            ]
        )
    else:
        notes.append("gold.fact_sales missing — skipping gold sales workload")

    if g("gold", "fact_orders"):
        w.append(
            (
                "SELECT status, count(*) FROM gold.fact_orders GROUP BY status ORDER BY count DESC LIMIT 50",
                2.0,
            )
        )
    if g("silver", "orders"):
        w.extend(
            [
                ("SELECT count(*) FROM silver.orders", 2.0),
                (
                    "SELECT order_status, count(*) FROM silver.orders "
                    "GROUP BY order_status ORDER BY count DESC LIMIT 80",
                    2.5,
                ),
                (
                    "SELECT o.* FROM silver.orders o "
                    "WHERE o.order_date >= current_date - interval '180 day' "
                    "ORDER BY o.order_total DESC NULLS LAST LIMIT 4000",
                    2.0,
                ),
            ]
        )
    if g("silver", "customer"):
        w.append(
            (
                "SELECT customer_type, count(*) FROM silver.customer "
                "GROUP BY customer_type ORDER BY count DESC LIMIT 60",
                1.5,
            )
        )
    if g("silver", "order_item") and g("silver", "orders"):
        w.append(
            (
                "SELECT o.order_id, sum(oi.quantity) FROM silver.order_item oi "
                "JOIN silver.orders o ON o.order_key = oi.order_key "
                "GROUP BY o.order_id ORDER BY sum DESC NULLS LAST LIMIT 500",
                2.0,
            )
        )
    if g("gold", "dim_product"):
        w.append(("SELECT count(*), min(list_price), max(list_price) FROM gold.dim_product", 1.5))
    if g("gold", "dim_customer"):
        w.append(("SELECT count(*) FROM gold.dim_customer WHERE state IS NOT NULL", 1.5))
    if g("gold", "fact_inventory_snapshot"):
        w.append(
            (
                "SELECT product_key, sum(quantity_on_hand) FROM gold.fact_inventory_snapshot "
                "GROUP BY product_key ORDER BY sum DESC NULLS LAST LIMIT 400",
                1.5,
            )
        )

    # Catalog / ML schema reads (always useful)
    w.extend(
        [
            (
                "SELECT schemaname, sum(n_live_tup)::bigint FROM pg_catalog.pg_stat_user_tables "
                "WHERE schemaname IN ('gold','silver','bronze') GROUP BY schemaname",
                1.0,
            ),
            ("SELECT count(*) FROM ml_optimization.query_logs", 0.8),
        ]
    )

    extra = _build_diversity_sql(cur, diversity_mode)
    if extra:
        w.extend(extra)
        notes.append(f"Diversity mode '{diversity_mode}': +{len(extra)} predicate-diverse SQL shapes")
    return w, notes


def _weighted_sql(pairs: List[Tuple[str, float]]) -> str:
    total = sum(wt for _, wt in pairs)
    r = random.random() * total
    acc = 0.0
    for sql, wt in pairs:
        acc += wt
        if acc >= r:
            return sql
    return pairs[-1][0]


def _sql_template_key(sql: str) -> str:
    """
    Stable key for runtime diversity stats.
    Keeps semantic literals (day/hour windows, LIMIT variants) but normalizes whitespace.
    """
    return " ".join((sql or "").strip().split())


def _ensure_procedures(conn) -> List[str]:
    """
    Create idempotent helper procedures for CALL traffic.
    Returns list of procedure names to CALL (schema-qualified).
    """
    cur = conn.cursor()
    cur.execute("CREATE SCHEMA IF NOT EXISTS ml_optimization")
    conn.commit()
    names: List[str] = []
    if not (
        _table_exists(cur, "gold", "fact_sales")
        or _table_exists(cur, "silver", "orders")
    ):
        cur.close()
        return names

    cur.execute(
        """
        CREATE OR REPLACE PROCEDURE ml_optimization.sp_traffic_sales_probe()
        LANGUAGE plpgsql
        AS $$
        DECLARE
          n bigint;
        BEGIN
          IF to_regclass('gold.fact_sales') IS NOT NULL THEN
            SELECT count(*) INTO n FROM gold.fact_sales WHERE quantity > 0;
            PERFORM 1 FROM gold.fact_sales fs
              JOIN gold.dim_product p ON p.product_key = fs.product_key
              WHERE fs.net_amount > 0 LIMIT 2000;
          END IF;
          IF to_regclass('silver.orders') IS NOT NULL THEN
            SELECT count(*) INTO n FROM silver.orders WHERE order_date IS NOT NULL;
          END IF;
        END;
        $$;
        """
    )
    names.append("ml_optimization.sp_traffic_sales_probe()")

    cur.execute(
        """
        CREATE OR REPLACE PROCEDURE ml_optimization.sp_traffic_dim_rollups()
        LANGUAGE plpgsql
        AS $$
        DECLARE
          n bigint;
        BEGIN
          IF to_regclass('gold.dim_customer') IS NOT NULL THEN
            SELECT count(*) INTO n FROM gold.dim_customer;
          END IF;
          IF to_regclass('gold.dim_product') IS NOT NULL THEN
            SELECT count(*) INTO n FROM gold.dim_product WHERE category_name IS NOT NULL;
          END IF;
          IF to_regclass('gold.fact_sales') IS NOT NULL AND to_regclass('gold.dim_product') IS NOT NULL THEN
            SELECT count(*) INTO n FROM (
              SELECT p.category_name
              FROM gold.fact_sales fs
              JOIN gold.dim_product p ON p.product_key = fs.product_key
              GROUP BY p.category_name
            ) t;
          END IF;
        END;
        $$;
        """
    )
    names.append("ml_optimization.sp_traffic_dim_rollups()")

    conn.commit()
    cur.close()
    logger.info("Ensured procedures: %s", ", ".join(names))
    return names


def _worker_loop(
    conn_str: str,
    weighted_sql: List[Tuple[str, float]],
    call_targets: List[str],
    call_weight: float,
    min_sleep_ms: int,
    max_sleep_ms: int,
    stop_event: threading.Event,
    stats: dict,
    stats_lock: threading.Lock,
) -> None:
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    try:
        cur = conn.cursor()
        while not stop_event.is_set():
            use_call = call_targets and random.random() < call_weight
            try:
                if use_call:
                    tgt = random.choice(call_targets)
                    cur.execute(f"CALL {tgt}")
                    stmt_key = f"CALL {tgt}"
                else:
                    stmt = _weighted_sql(weighted_sql)
                    cur.execute(stmt)
                    stmt_key = _sql_template_key(stmt)
                    if cur.description:
                        cur.fetchall()
                with stats_lock:
                    stats["ok"] += 1
                    stats["templates_seen"].add(stmt_key)
                    stats["recent_templates"].append(stmt_key)
            except Exception as e:
                with stats_lock:
                    stats["err"] += 1
                logger.debug("Statement failed: %s", e)
            if max_sleep_ms > 0:
                time.sleep(random.randint(min_sleep_ms, max_sleep_ms) / 1000.0)
        cur.close()
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run warehouse SELECT/CALL traffic against PostgreSQL for query log collection."
    )
    parser.add_argument("--concurrency", type=int, default=8, help="Parallel DB sessions (default: 8)")
    parser.add_argument("--min-sleep-ms", type=int, default=10)
    parser.add_argument("--max-sleep-ms", type=int, default=120)
    parser.add_argument(
        "--call-weight",
        type=float,
        default=0.22,
        help="Fraction of iterations that use CALL ... (0–1). Default: 0.22",
    )
    parser.add_argument(
        "--no-ensure-procedures",
        action="store_true",
        help="Do not CREATE/REPLACE ml_optimization.sp_traffic_* procedures.",
    )
    parser.add_argument(
        "--diversity-mode",
        choices=("off", "on", "aggressive"),
        default="off",
        help=(
            "Add extra predicate-diverse SQL to produce more unique index/partition keys. "
            "off=baseline, on=more variety, aggressive=more/time-heavy variety."
        ),
    )
    parser.add_argument(
        "--forever",
        action="store_true",
        help="Run until Ctrl+C.",
    )
    parser.add_argument("--iterations", type=int, default=0, help="Total statements (split across workers); 0 with --forever")
    args = parser.parse_args()

    if args.concurrency <= 0:
        raise SystemExit("concurrency must be > 0")
    if not 0.0 <= args.call_weight <= 1.0:
        raise SystemExit("call-weight must be between 0 and 1")

    conn_str = _db_conn_str()
    conn = psycopg2.connect(conn_str)
    conn.autocommit = True
    cur = conn.cursor()
    weighted, notes = _build_select_workload(cur, diversity_mode=args.diversity_mode)
    cur.close()
    conn.close()

    for n in notes:
        logger.warning("%s", n)
    if not weighted:
        logger.error("No workload SQL available (missing warehouse tables?). Exiting.")
        raise SystemExit(1)

    call_targets: List[str] = []
    if not args.no_ensure_procedures:
        try:
            conn = psycopg2.connect(conn_str)
            conn.autocommit = True
            call_targets = _ensure_procedures(conn)
            conn.close()
        except Exception as e:
            logger.warning("Could not create procedures (continuing with SELECT-only): %s", e)

    logger.info(
        "Warehouse DB traffic: %d weighted SELECT shapes, %d CALL target(s), concurrency=%d, diversity=%s",
        len(weighted),
        len(call_targets),
        args.concurrency,
        args.diversity_mode,
    )

    if not args.forever:
        if args.iterations <= 0:
            raise SystemExit("Use --forever or pass --iterations N > 0")
        # simple pool: round-robin statements until count
        stats = {"ok": 0, "err": 0}
        lock = threading.Lock()
        stop = threading.Event()
        remaining = {"n": args.iterations}

        def one_shot_worker():
            conn = psycopg2.connect(conn_str)
            conn.autocommit = True
            c = conn.cursor()
            try:
                while True:
                    with lock:
                        if remaining["n"] <= 0:
                            break
                        remaining["n"] -= 1
                    use_call = call_targets and random.random() < args.call_weight
                    try:
                        if use_call:
                            c.execute(f"CALL {random.choice(call_targets)}")
                        else:
                            c.execute(_weighted_sql(weighted))
                            if c.description:
                                c.fetchall()
                        with lock:
                            stats["ok"] += 1
                    except Exception:
                        with lock:
                            stats["err"] += 1
            finally:
                c.close()
                conn.close()

        with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
            futs = [ex.submit(one_shot_worker) for _ in range(args.concurrency)]
            for f in futs:
                f.result()
        logger.info("Done: ok=%s err=%s", stats["ok"], stats["err"])
        return

    stop_event = threading.Event()
    stats = {"ok": 0, "err": 0, "templates_seen": set(), "recent_templates": deque(maxlen=5000)}
    stats_lock = threading.Lock()

    def handle_sigint(*_a):
        stop_event.set()

    try:
        import signal

        signal.signal(signal.SIGINT, handle_sigint)
    except Exception:
        pass

    with ThreadPoolExecutor(max_workers=args.concurrency, thread_name_prefix="dbt") as pool:
        futures = [
            pool.submit(
                _worker_loop,
                conn_str,
                weighted,
                call_targets,
                args.call_weight,
                args.min_sleep_ms,
                args.max_sleep_ms,
                stop_event,
                stats,
                stats_lock,
            )
            for _ in range(args.concurrency)
        ]
        try:
            while not stop_event.is_set():
                time.sleep(2.0)
                with stats_lock:
                    recent_unique = len(set(stats["recent_templates"]))
                    logger.info(
                        "DB traffic: ok=%s err=%s unique_templates_total=%s unique_templates_recent=%s window=%s",
                        stats["ok"],
                        stats["err"],
                        len(stats["templates_seen"]),
                        recent_unique,
                        stats["recent_templates"].maxlen,
                    )
        except KeyboardInterrupt:
            stop_event.set()
        finally:
            stop_event.set()
            wait(futures, timeout=30)

    with stats_lock:
        recent_unique = len(set(stats["recent_templates"]))
        logger.info(
            "Stopped. ok=%s err=%s unique_templates_total=%s unique_templates_recent=%s window=%s",
            stats["ok"],
            stats["err"],
            len(stats["templates_seen"]),
            recent_unique,
            stats["recent_templates"].maxlen,
        )


if __name__ == "__main__":
    main()
