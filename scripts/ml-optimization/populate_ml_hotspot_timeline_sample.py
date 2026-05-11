"""
Append realistic samples to ml_optimization.query_logs for the Analytics ML Hotspot Timeline.

The dashboard aggregates by query_hash over three UTC windows (1d / 7d / long retention).
This script inserts rows with:
  - collected_at spread across ~35 days (UTC),
  - distinct SQL fingerprints (8 hashes),
  - intentional regimes: "rising" (older fast / recent slow), "stable", "cooling" (older slow / recent fast),

so Long vs 7d vs 1d averages and Trend (1d vs long in the UI) are visibly different.

Does NOT replace your collector — use --truncate only if you want an empty table first.

Example:
  python scripts/ml-optimization/populate_ml_hotspot_timeline_sample.py --rows 12000
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, List, Tuple

import psycopg2


def _db_conn_str() -> str:
    try:
        project_root = Path(__file__).parent.parent.parent
        sys.path.insert(0, str(project_root / "ml-optimization"))
        from utils.db_utils import get_psycopg2_connection_string

        return get_psycopg2_connection_string()
    except Exception:
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


SCHEMA = "ml_optimization"
TABLE = "query_logs"


DDL_SQL = f"""
CREATE SCHEMA IF NOT EXISTS {SCHEMA};
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
CREATE INDEX IF NOT EXISTS idx_query_logs_query_hash ON {SCHEMA}.{TABLE}(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_logs_collected_at ON {SCHEMA}.{TABLE}(collected_at);
"""


def _hash64(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# Eight fingerprints — short, portable SQL (no warehouse tables required).
SQL_TEMPLATES: List[Tuple[str, str]] = [
    ("hotspot_pg_tables", "SELECT COUNT(*)::bigint AS n FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')"),
    ("hotspot_pg_namespace", "SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' ORDER BY nspname LIMIT 50"),
    ("hotspot_pg_class", "SELECT relname, relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' LIMIT 100"),
    ("hotspot_stats_reset", "SELECT COUNT(*)::bigint FROM pg_stat_user_tables"),
    ("hotspot_locks", "SELECT COUNT(*)::bigint FROM pg_locks WHERE NOT granted"),
    ("hotspot_roles", "SELECT COUNT(*)::bigint FROM pg_roles"),
    ("hotspot_indexes", "SELECT COUNT(*)::bigint FROM pg_indexes WHERE schemaname = 'public'"),
    ("hotspot_activity", "SELECT COUNT(*)::bigint FROM pg_stat_activity WHERE datname = current_database()"),
]

# Maps template index -> workload profile for time-varying latency.
PROFILES = ["rising", "rising", "rising", "stable", "stable", "cooling", "cooling", "stable"]


def _blocks_from_latency(mean_ms: float) -> Tuple[int, ...]:
    scale = max(1.0, mean_ms / 12.0)
    sh = int(random.randint(40, 420) * scale)
    sr = int(random.randint(0, 35) * (scale**0.9))
    sd = int(random.randint(0, 3) * scale)
    sw = int(random.randint(0, 2) * scale)
    lh = random.randint(0, 5)
    lr = random.randint(0, 3)
    tr = int(random.randint(0, 4) * (scale**0.75))
    tw = int(random.randint(0, 3) * (scale**0.75))
    br = round(sr * random.uniform(0.01, 0.07), 3)
    bw = round(sw * random.uniform(0.01, 0.09), 3)
    return (sh, sr, sd, sw, lh, lr, 0, 0, tr, tw, br, bw)


def _mean_ms_for_profile(profile: str, collected_at: datetime, now_utc: datetime) -> Tuple[float, float, float, float]:
    """Return (mean_ms, min_ms, max_ms, std_ms)."""
    age_h = max(0.0, (now_utc - collected_at).total_seconds() / 3600.0)

    if profile == "rising":
        if age_h <= 40:
            base = random.uniform(95.0, 240.0)
        else:
            base = random.uniform(22.0, 52.0)
    elif profile == "cooling":
        if age_h <= 48:
            base = random.uniform(25.0, 58.0)
        else:
            base = random.uniform(130.0, 280.0)
    else:  # stable
        base = random.uniform(58.0, 102.0)

    mn = max(0.5, base * random.uniform(0.55, 0.92))
    mx = max(mn * 1.05, base * random.uniform(1.08, 2.1))
    std = max(0.02, (mx - mn) * random.uniform(0.12, 0.32))
    return base, mn, mx, std


def _generate_rows(total_rows: int, spread_days: int, now_utc: datetime) -> Iterable[List[str]]:
    start_at = now_utc - timedelta(days=spread_days)
    span_s = max(1.0, (now_utc - start_at).total_seconds())

    for i in range(total_rows):
        ti = i % len(SQL_TEMPLATES)
        name, sql = SQL_TEMPLATES[ti]
        profile = PROFILES[ti]
        qh = _hash64(sql.strip())

        off = random.uniform(0.0, span_s)
        collected_at = start_at + timedelta(seconds=off)

        mean_ms, min_ms, max_ms, std_ms = _mean_ms_for_profile(profile, collected_at, now_utc)
        calls = random.randint(15, 900)
        total_ms = round(mean_ms * calls, 3)

        blocks = _blocks_from_latency(mean_ms)
        rows_affected = random.randint(1, 500_000)

        tpl = name
        plan = {"source": "populate_ml_hotspot_timeline_sample", "profile": profile}
        feat = {"profile": profile, "template": name, "hotspot_seed": True}

        yield [
            qh,
            sql.strip(),
            tpl,
            str(calls),
            f"{total_ms:.3f}",
            f"{mean_ms:.3f}",
            f"{min_ms:.3f}",
            f"{max_ms:.3f}",
            f"{std_ms:.3f}",
            str(rows_affected),
            *[str(b) for b in blocks[:10]],
            f"{blocks[10]:.3f}",
            f"{blocks[11]:.3f}",
            json.dumps(plan, separators=(",", ":")),
            json.dumps(feat, separators=(",", ":")),
            collected_at.strftime("%Y-%m-%d %H:%M:%S"),
        ]


def _copy(conn: Any, rows: Iterable[List[str]], batch_rows: int) -> int:
    cols = (
        "query_hash,query_text,query_template,calls,"
        "total_exec_time_ms,mean_exec_time_ms,min_exec_time_ms,max_exec_time_ms,stddev_exec_time_ms,"
        "rows_affected,"
        "shared_blks_hit,shared_blks_read,shared_blks_dirtied,shared_blks_written,"
        "local_blks_hit,local_blks_read,local_blks_dirtied,local_blks_written,"
        "temp_blks_read,temp_blks_written,blk_read_time_ms,blk_write_time_ms,"
        "query_plan,extracted_features,collected_at"
    )
    copy_sql = f"COPY {SCHEMA}.{TABLE} ({cols}) FROM STDIN WITH (FORMAT csv)"
    cur = conn.cursor()
    inserted = 0
    buf = io.StringIO()
    writer = csv.writer(buf)
    pending = 0

    def flush() -> None:
        nonlocal inserted, pending, buf, writer
        if pending == 0:
            return
        buf.seek(0)
        cur.copy_expert(copy_sql, buf)
        conn.commit()
        inserted += pending
        pending = 0
        buf = io.StringIO()
        writer = csv.writer(buf)

    for r in rows:
        writer.writerow(r)
        pending += 1
        if pending >= batch_rows:
            flush()
            print(f"Inserted {inserted:,} rows...", flush=True)
    flush()
    cur.close()
    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Append hotspot-friendly samples to ml_optimization.query_logs (ML Hotspot Timeline)."
    )
    parser.add_argument("--rows", type=int, default=10_000, help="Rows to append (default: 10000)")
    parser.add_argument("--batch-rows", type=int, default=50_000, help="COPY batch size")
    parser.add_argument(
        "--spread-days",
        type=int,
        default=35,
        help="Spread collected_at over the last N UTC days (default: 35, covers long+7d+1d)",
    )
    parser.add_argument("--seed", type=int, default=2026, help="RNG seed")
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="TRUNCATE ml_optimization.query_logs before insert (destructive).",
    )
    args = parser.parse_args()

    random.seed(args.seed)
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)

    conn = psycopg2.connect(_db_conn_str())
    try:
        cur = conn.cursor()
        cur.execute("SET statement_timeout = '0';")
        cur.execute(DDL_SQL)
        if args.truncate:
            cur.execute(f"TRUNCATE TABLE {SCHEMA}.{TABLE};")
        conn.commit()
        cur.close()

        print(
            f"Generating {args.rows:,} rows · UTC window ~{args.spread_days}d ending {now_utc.isoformat()} ...",
            flush=True,
        )
        inserted = _copy(conn, _generate_rows(args.rows, args.spread_days, now_utc), args.batch_rows)

        cur2 = conn.cursor()
        cur2.execute(
            f"""
            SELECT setval(
                pg_get_serial_sequence('{SCHEMA}.{TABLE}', 'log_id'),
                COALESCE((SELECT MAX(log_id) FROM {SCHEMA}.{TABLE}), 1),
                true
            )
            """
        )
        conn.commit()
        cur2.close()
        print(f"Done. Inserted {inserted:,} rows into {SCHEMA}.{TABLE}. Refresh Analytics → ML Hotspot Timeline.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
