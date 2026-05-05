"""
Populate ml_optimization.query_logs with a large, ML-friendly dataset quickly.

Goal:
- Insert 2.5M rows fast (COPY) with *all columns populated*.
- Data should look "real": realistic query templates against Bronze/Silver/Gold, plausible latency,
  rows affected, block metrics, and extracted_features JSON for training.

Notes:
- This does NOT execute 2.5M real queries (would be slow). Instead it samples a library of realistic
  query templates and uses a small calibration pass (EXPLAIN) to estimate row counts and set a
  plausible baseline for latency and block metrics. Then it generates a large workload dataset.
- Use --truncate to clear existing rows first.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import os
import random
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Tuple

import psycopg2


SCHEMA = "ml_optimization"
TABLE = "query_logs"


def get_conn():
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres"),
    )


def ensure_table_exists(conn) -> None:
    cur = conn.cursor()
    cur.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA};")
    cur.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {SCHEMA}.{TABLE} (
            log_id BIGSERIAL PRIMARY KEY,
            query_hash VARCHAR(64) NOT NULL,
            query_text TEXT NOT NULL,
            query_template TEXT NOT NULL,
            calls BIGINT NOT NULL,
            total_exec_time_ms NUMERIC(15, 3) NOT NULL,
            mean_exec_time_ms NUMERIC(15, 3) NOT NULL,
            min_exec_time_ms NUMERIC(15, 3) NOT NULL,
            max_exec_time_ms NUMERIC(15, 3) NOT NULL,
            stddev_exec_time_ms NUMERIC(15, 3) NOT NULL,
            rows_affected BIGINT NOT NULL,
            shared_blks_hit BIGINT NOT NULL,
            shared_blks_read BIGINT NOT NULL,
            shared_blks_dirtied BIGINT NOT NULL,
            shared_blks_written BIGINT NOT NULL,
            local_blks_hit BIGINT NOT NULL,
            local_blks_read BIGINT NOT NULL,
            local_blks_dirtied BIGINT NOT NULL,
            local_blks_written BIGINT NOT NULL,
            temp_blks_read BIGINT NOT NULL,
            temp_blks_written BIGINT NOT NULL,
            blk_read_time_ms NUMERIC(15, 3) NOT NULL,
            blk_write_time_ms NUMERIC(15, 3) NOT NULL,
            query_plan JSONB NOT NULL,
            extracted_features JSONB NOT NULL,
            collected_at TIMESTAMP NOT NULL
        );
        """
    )
    cur.execute(
        f"CREATE INDEX IF NOT EXISTS idx_query_logs_query_hash ON {SCHEMA}.{TABLE}(query_hash);"
    )
    cur.execute(
        f"CREATE INDEX IF NOT EXISTS idx_query_logs_collected_at ON {SCHEMA}.{TABLE}(collected_at);"
    )
    conn.commit()
    cur.close()


def truncate_table(conn) -> None:
    cur = conn.cursor()
    cur.execute(f"TRUNCATE TABLE {SCHEMA}.{TABLE};")
    conn.commit()
    cur.close()


@dataclass(frozen=True)
class Template:
    name: str
    sql: str
    weight: float
    # static features
    query_type: str
    layer: str
    tables: List[str]
    join_count: int
    filter_predicate_count: int
    group_by: bool
    order_by: bool
    has_limit: bool


def _hash64(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _now_floor_min(dt: datetime) -> datetime:
    return dt.replace(second=0, microsecond=0)


def build_templates() -> List[Template]:
    """
    Dashboard-only workload mix.
    Every template is derived from the SQL patterns used by dashboard-facing API routes:
    - warehouse_routes.py
    - monitoring_routes.py
    - storage_routes.py
    - alert_routes.py
    """
    return [
        # ---------------------------
        # Warehouse dashboard queries
        # ---------------------------
        Template(
            name="warehouse_summary_sizes",
            sql="""
                SELECT schemaname, COUNT(*) AS table_count
                FROM pg_tables
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                GROUP BY schemaname
                ORDER BY schemaname
            """.strip(),
            weight=5.0,
            query_type="aggregate",
            layer="gold",
            tables=["pg_tables"],
            join_count=0,
            filter_predicate_count=1,
            group_by=True,
            order_by=True,
            has_limit=False,
        ),
        Template(
            name="warehouse_sales_stats",
            sql="""
                SELECT
                    COUNT(*) AS total_sales,
                    SUM(net_amount) AS total_revenue,
                    AVG(net_amount) AS avg_sale,
                    SUM(quantity) AS total_quantity
                FROM gold.fact_sales
            """.strip(),
            weight=7.0,
            query_type="aggregate",
            layer="gold",
            tables=["gold.fact_sales"],
            join_count=0,
            filter_predicate_count=0,
            group_by=True,
            order_by=False,
            has_limit=False,
        ),
        Template(
            name="warehouse_top_products",
            sql="""
                SELECT
                    COALESCE(p.product_name, 'Unknown') AS product_name,
                    COUNT(*) AS sales_count,
                    SUM(fs.net_amount) AS revenue,
                    SUM(fs.quantity) AS quantity_sold
                FROM gold.fact_sales fs
                LEFT JOIN gold.dim_product p ON fs.product_key = p.product_key
                GROUP BY p.product_name
                ORDER BY SUM(fs.net_amount) DESC NULLS LAST
                LIMIT 20
            """.strip(),
            weight=8.0,
            query_type="join_aggregate",
            layer="gold",
            tables=["gold.fact_sales", "gold.dim_product"],
            join_count=1,
            filter_predicate_count=0,
            group_by=True,
            order_by=True,
            has_limit=True,
        ),
        Template(
            name="warehouse_customer_stats",
            sql="""
                SELECT
                    COUNT(DISTINCT customer_key) AS unique_customers,
                    COUNT(*) AS total_orders,
                    SUM(net_amount) AS total_revenue
                FROM gold.fact_orders
            """.strip(),
            weight=5.0,
            query_type="aggregate",
            layer="gold",
            tables=["gold.fact_orders"],
            join_count=0,
            filter_predicate_count=0,
            group_by=True,
            order_by=False,
            has_limit=False,
        ),
        # -----------------------------
        # Monitoring dashboard queries
        # -----------------------------
        Template(
            name="monitoring_etl_jobs",
            sql="""
                SELECT
                    jr.run_id,
                    jr.status,
                    jr.progress,
                    jr.layer,
                    jr.table_name,
                    jr.started_at,
                    jr.completed_at,
                    jr.records_processed
                FROM monitoring.job_runs jr
                ORDER BY jr.started_at DESC
                LIMIT 200
            """.strip(),
            weight=8.0,
            query_type="lookup",
            layer="silver",
            tables=["monitoring.job_runs"],
            join_count=0,
            filter_predicate_count=0,
            group_by=False,
            order_by=True,
            has_limit=True,
        ),
        Template(
            name="monitoring_etl_errors",
            sql="""
                SELECT
                    jr.run_id,
                    jr.layer,
                    jr.table_name,
                    jr.error_message,
                    jr.started_at
                FROM monitoring.job_runs jr
                WHERE jr.status = 'failed'
                  AND jr.started_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
                ORDER BY jr.started_at DESC
                LIMIT 100
            """.strip(),
            weight=6.0,
            query_type="lookup",
            layer="silver",
            tables=["monitoring.job_runs"],
            join_count=0,
            filter_predicate_count=2,
            group_by=False,
            order_by=True,
            has_limit=True,
        ),
        Template(
            name="monitoring_etl_throughput",
            sql="""
                SELECT
                    layer,
                    table_name,
                    records_processed,
                    started_at,
                    completed_at
                FROM monitoring.job_runs
                WHERE status = 'completed'
                  AND completed_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                  AND records_processed > 0
                ORDER BY completed_at DESC
                LIMIT 500
            """.strip(),
            weight=6.0,
            query_type="lookup",
            layer="silver",
            tables=["monitoring.job_runs"],
            join_count=0,
            filter_predicate_count=3,
            group_by=False,
            order_by=True,
            has_limit=True,
        ),
        # --------------------------
        # Storage dashboard queries
        # --------------------------
        Template(
            name="storage_utilization_pg_tables",
            sql="""
                SELECT
                    tablename,
                    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
                FROM pg_tables
                WHERE schemaname = 'gold'
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
            """.strip(),
            weight=5.0,
            query_type="system_stats",
            layer="gold",
            tables=["pg_tables"],
            join_count=0,
            filter_predicate_count=1,
            group_by=False,
            order_by=True,
            has_limit=False,
        ),
        Template(
            name="storage_cache_pg_statio",
            sql="""
                SELECT
                    schemaname,
                    relname,
                    heap_blks_read,
                    heap_blks_hit
                FROM pg_statio_user_tables
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                ORDER BY heap_blks_hit DESC
                LIMIT 50
            """.strip(),
            weight=4.0,
            query_type="system_stats",
            layer="silver",
            tables=["pg_statio_user_tables"],
            join_count=0,
            filter_predicate_count=1,
            group_by=False,
            order_by=True,
            has_limit=True,
        ),
        Template(
            name="storage_growth_pg_stat",
            sql="""
                SELECT
                    relname,
                    n_tup_ins,
                    n_tup_upd,
                    n_tup_del,
                    n_live_tup
                FROM pg_stat_user_tables
                WHERE schemaname = 'silver'
                ORDER BY n_live_tup DESC
                LIMIT 20
            """.strip(),
            weight=4.0,
            query_type="system_stats",
            layer="silver",
            tables=["pg_stat_user_tables"],
            join_count=0,
            filter_predicate_count=1,
            group_by=False,
            order_by=True,
            has_limit=True,
        ),
        # ------------------------
        # Alerts dashboard queries
        # ------------------------
        Template(
            name="alerts_empty_tables",
            sql="""
                SELECT schemaname, relname
                FROM pg_stat_user_tables
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                  AND n_live_tup = 0
            """.strip(),
            weight=3.0,
            query_type="system_stats",
            layer="silver",
            tables=["pg_stat_user_tables"],
            join_count=0,
            filter_predicate_count=2,
            group_by=False,
            order_by=False,
            has_limit=False,
        ),
        Template(
            name="alerts_recent_failures",
            sql="""
                SELECT run_id, layer, table_name, error_message, started_at
                FROM monitoring.job_runs
                WHERE status IN ('failed', 'error')
                ORDER BY started_at DESC
                LIMIT 50
            """.strip(),
            weight=4.0,
            query_type="lookup",
            layer="silver",
            tables=["monitoring.job_runs"],
            join_count=0,
            filter_predicate_count=1,
            group_by=False,
            order_by=True,
            has_limit=True,
        ),
    ]


def calibrate_templates(conn, templates: List[Template], timeout_ms: int = 2000) -> Dict[str, Dict[str, Any]]:
    """
    Run a small calibration pass so query_plan and estimated_rows are grounded in real DB structure.
    Uses EXPLAIN (FORMAT JSON) (no ANALYZE) to keep it fast.
    """
    cur = conn.cursor()
    cur.execute(f"SET statement_timeout = {int(timeout_ms)};")
    out: Dict[str, Dict[str, Any]] = {}

    for t in templates:
        plan = None
        est_rows = 0.0
        try:
            cur.execute("EXPLAIN (FORMAT JSON) " + t.sql)
            row = cur.fetchone()
            if row and row[0]:
                plan = row[0][0] if isinstance(row[0], list) else row[0]
                # common place: plan["Plan"]["Plan Rows"]
                est_rows = float(
                    (((plan or {}).get("Plan") or {}).get("Plan Rows") or 0.0)
                )
        except Exception:
            conn.rollback()
            plan = {"note": "explain_failed", "template": t.name}
            est_rows = 0.0

        out[t.name] = {
            "query_plan": plan if plan is not None else {"note": "no_plan"},
            "estimated_rows": est_rows,
        }

    cur.close()
    return out


def _sample_exec_ms(base: float, jitter: float, min_ms: float = 0.2) -> Tuple[float, float, float, float, float]:
    """
    Produce (total, mean, min, max, stddev) in ms.
    We generate a per-execution distribution-like summary for training.
    """
    mean = max(min_ms, random.lognormvariate(math.log(max(base, min_ms)), jitter))
    # min/max around mean
    mn = max(min_ms, mean * random.uniform(0.6, 0.95))
    mx = max(mn, mean * random.uniform(1.05, 2.2))
    std = max(0.01, (mx - mn) * random.uniform(0.12, 0.35))
    total = mean  # calls=1 (per execution row)
    return (round(total, 3), round(mean, 3), round(mn, 3), round(mx, 3), round(std, 3))


def _blocks_from_latency(mean_ms: float) -> Dict[str, int]:
    """
    Plausible block stats correlated with latency.
    """
    # hit-heavy by default; reads increase with slower queries
    scale = max(1.0, mean_ms / 10.0)
    shared_hit = int(random.randint(50, 500) * scale)
    shared_read = int(random.randint(0, 40) * (scale ** 1.1))
    shared_dirtied = int(random.randint(0, 3) * (scale ** 0.6))
    shared_written = int(random.randint(0, 2) * (scale ** 0.6))
    local_hit = int(random.randint(0, 5))
    local_read = int(random.randint(0, 2))
    local_dirtied = 0
    local_written = 0
    temp_read = int(random.randint(0, 4) * (scale ** 0.7))
    temp_written = int(random.randint(0, 4) * (scale ** 0.7))
    return {
        "shared_blks_hit": shared_hit,
        "shared_blks_read": shared_read,
        "shared_blks_dirtied": shared_dirtied,
        "shared_blks_written": shared_written,
        "local_blks_hit": local_hit,
        "local_blks_read": local_read,
        "local_blks_dirtied": local_dirtied,
        "local_blks_written": local_written,
        "temp_blks_read": temp_read,
        "temp_blks_written": temp_written,
    }


def _rw_time_ms(shared_read: int, shared_written: int) -> Tuple[float, float]:
    # correlated with physical read/write volume
    read_ms = max(0.0, random.uniform(0.0, 0.08) * shared_read)
    write_ms = max(0.0, random.uniform(0.0, 0.10) * shared_written)
    return (round(read_ms, 3), round(write_ms, 3))


def _features_for_template(t: Template, calib: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "template_name": t.name,
        "query_type": t.query_type,
        "layer": t.layer,
        "tables": t.tables,
        "table_count": len(t.tables),
        "join_count": t.join_count,
        "filter_predicate_count": t.filter_predicate_count,
        "has_group_by": t.group_by,
        "has_order_by": t.order_by,
        "has_limit": t.has_limit,
        "estimated_rows": float(calib.get("estimated_rows", 0.0) or 0.0),
    }


def _weighted_choice(templates: List[Template]) -> Template:
    total = sum(t.weight for t in templates)
    r = random.random() * total
    upto = 0.0
    for t in templates:
        upto += t.weight
        if upto >= r:
            return t
    return templates[-1]


def _csv_escape(value: Any) -> str:
    """
    Create a CSV-safe field with quoting when needed.
    COPY expects plain CSV with commas/newlines handled via quotes.
    """
    if value is None:
        return ""
    s = str(value)
    if any(ch in s for ch in [",", "\n", "\r", '"']):
        s = s.replace('"', '""')
        return f'"{s}"'
    return s


def generate_rows(
    templates: List[Template],
    calibration: Dict[str, Dict[str, Any]],
    start_at: datetime,
    total_rows: int,
    spread_days: int,
) -> Iterable[Tuple[Any, ...]]:
    """
    Yield row tuples in query_logs column order (excluding log_id).
    """
    # Spread collected_at across time, increasing.
    start_at = _now_floor_min(start_at)
    end_at = start_at + timedelta(days=spread_days)
    total_seconds = max(1, int((end_at - start_at).total_seconds()))
    step = total_seconds / max(1, total_rows)

    for i in range(total_rows):
        t = _weighted_choice(templates)
        calib = calibration.get(t.name) or {"query_plan": {"note": "missing_calibration"}, "estimated_rows": 0.0}

        query_text = t.sql
        query_template = t.name
        query_hash = _hash64(query_text)

        # Baseline latency by layer / complexity
        base = 6.0
        if t.layer == "bronze":
            base = 2.0
        elif t.layer == "silver":
            base = 8.0
        elif t.layer == "gold":
            base = 10.0
        base += t.join_count * 4.0
        base += (2.0 if t.group_by else 0.0) + (1.0 if t.order_by else 0.0)
        base += float(min(5.0, (calib.get("estimated_rows", 0.0) or 0.0) / 1_000_000.0 * 5.0))

        total_ms, mean_ms, min_ms, max_ms, std_ms = _sample_exec_ms(base=base, jitter=0.35)

        blocks = _blocks_from_latency(mean_ms)
        brt, bwt = _rw_time_ms(blocks["shared_blks_read"], blocks["shared_blks_written"])

        # rows_affected: for SELECT-like workloads, interpret as rows returned/processed.
        est = float(calib.get("estimated_rows", 0.0) or 0.0)
        rows_affected = int(max(1, random.uniform(0.1, 1.1) * max(1.0, est)))
        # clamp to reasonable
        rows_affected = min(rows_affected, 50_000_000)

        plan_json = calib.get("query_plan") or {"note": "no_plan"}
        feat_json = _features_for_template(t, calib)

        # Arrange timestamps
        collected_at = start_at + timedelta(seconds=(i * step))

        yield (
            query_hash,
            query_text,
            query_template,
            1,  # calls
            total_ms,
            mean_ms,
            min_ms,
            max_ms,
            std_ms,
            rows_affected,
            blocks["shared_blks_hit"],
            blocks["shared_blks_read"],
            blocks["shared_blks_dirtied"],
            blocks["shared_blks_written"],
            blocks["local_blks_hit"],
            blocks["local_blks_read"],
            blocks["local_blks_dirtied"],
            blocks["local_blks_written"],
            blocks["temp_blks_read"],
            blocks["temp_blks_written"],
            brt,
            bwt,
            json.dumps(plan_json, separators=(",", ":")),
            json.dumps(feat_json, separators=(",", ":")),
            collected_at.strftime("%Y-%m-%d %H:%M:%S"),
        )


def copy_insert(conn, rows: Iterable[Tuple[Any, ...]], batch_rows: int) -> int:
    """
    COPY FROM STDIN using CSV for speed.
    Returns total inserted count.
    """
    inserted = 0
    cur = conn.cursor()

    cols = (
        "query_hash,query_text,query_template,calls,"
        "total_exec_time_ms,mean_exec_time_ms,min_exec_time_ms,max_exec_time_ms,stddev_exec_time_ms,"
        "rows_affected,"
        "shared_blks_hit,shared_blks_read,shared_blks_dirtied,shared_blks_written,"
        "local_blks_hit,local_blks_read,local_blks_dirtied,local_blks_written,"
        "temp_blks_read,temp_blks_written,"
        "blk_read_time_ms,blk_write_time_ms,"
        "query_plan,extracted_features,collected_at"
    )

    copy_sql = (
        f"COPY {SCHEMA}.{TABLE} ({cols}) "
        "FROM STDIN WITH (FORMAT csv)"
    )

    buf = io.StringIO()
    batch_n = 0

    def flush():
        nonlocal inserted, batch_n, buf
        if batch_n == 0:
            return
        buf.seek(0)
        cur.copy_expert(copy_sql, buf)
        conn.commit()
        inserted += batch_n
        buf = io.StringIO()
        batch_n = 0

    for row in rows:
        line = ",".join(_csv_escape(v) for v in row)
        buf.write(line + "\n")
        batch_n += 1
        if batch_n >= batch_rows:
            flush()
            print(f"Inserted {inserted:,} rows...", flush=True)

    flush()
    cur.close()
    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Fast populate ml_optimization.query_logs (2.5M rows).")
    parser.add_argument("--rows", type=int, default=2_500_000, help="Rows to insert (default: 2_500_000).")
    parser.add_argument("--batch-rows", type=int, default=100_000, help="COPY batch size (default: 100_000).")
    parser.add_argument("--spread-days", type=int, default=30, help="Spread collected_at across N days (default: 30).")
    parser.add_argument("--seed", type=int, default=1337, help="RNG seed for reproducibility.")
    parser.add_argument("--truncate", action="store_true", help="Truncate ml_optimization.query_logs before insert.")
    parser.add_argument("--calibrate-timeout-ms", type=int, default=2000, help="EXPLAIN timeout per template.")
    args = parser.parse_args()

    random.seed(args.seed)

    conn = get_conn()
    try:
        ensure_table_exists(conn)
        if args.truncate:
            truncate_table(conn)

        templates = build_templates()
        calibration = calibrate_templates(conn, templates, timeout_ms=args.calibrate_timeout_ms)

        start_at = datetime.now() - timedelta(days=args.spread_days)
        rows_iter = generate_rows(
            templates=templates,
            calibration=calibration,
            start_at=start_at,
            total_rows=args.rows,
            spread_days=args.spread_days,
        )

        inserted = copy_insert(conn, rows_iter, batch_rows=args.batch_rows)
        print(f"Done. Inserted {inserted:,} rows into {SCHEMA}.{TABLE}.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()

