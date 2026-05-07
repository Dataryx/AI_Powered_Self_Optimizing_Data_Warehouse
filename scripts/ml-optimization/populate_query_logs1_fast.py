"""
Generate NEW ml_optimization.query_logs1 rows quickly (no copy from query_logs).

Generated query_text/query_template are readable and runnable full SQL statements
drawn from bronze/silver/gold layer table data.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import os
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable, List, Tuple

import psycopg2
from psycopg2 import sql


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


DDL_SQL = """
CREATE SCHEMA IF NOT EXISTS ml_optimization;
CREATE TABLE IF NOT EXISTS ml_optimization.query_logs1
(LIKE ml_optimization.query_logs INCLUDING ALL);
CREATE INDEX IF NOT EXISTS idx_query_logs1_query_hash ON ml_optimization.query_logs1(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_logs1_collected_at ON ml_optimization.query_logs1(collected_at);
"""


def _hash64(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _local_db_statements(conn, limit: int) -> List[str]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT format('SELECT * FROM %%I.%%I', schemaname, tablename)
        FROM pg_tables
        WHERE schemaname IN ('bronze','silver','gold')
        ORDER BY schemaname, tablename
        LIMIT %s
        """,
        (max(1, limit),),
    )
    selects = [r[0] for r in cur.fetchall()]
    cur.close()
    return selects


def _table_columns(conn, schema_name: str, table_name: str) -> List[str]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = %s
          AND table_name = %s
        ORDER BY ordinal_position
        """,
        (schema_name, table_name),
    )
    cols = [r[0] for r in cur.fetchall()]
    cur.close()
    return cols


def _existing_layer_tables(conn, limit: int) -> List[Tuple[str, str]]:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname IN ('bronze', 'silver', 'gold')
        ORDER BY schemaname, tablename
        LIMIT %s
        """,
        (max(1, limit),),
    )
    tables = [(r[0], r[1]) for r in cur.fetchall()]
    cur.close()
    return tables


def _basic_select_queries(conn, limit: int) -> List[str]:
    out: List[str] = []
    for schema_name, table_name in _existing_layer_tables(conn, limit):
        out.append(
            sql.SQL("SELECT * FROM {}.{}")
            .format(sql.Identifier(schema_name), sql.Identifier(table_name))
            .as_string(conn)
        )
        cols = _table_columns(conn, schema_name, table_name)
        if cols:
            head_cols = [sql.Identifier(c) for c in cols[: min(4, len(cols))]]
            out.append(
                sql.SQL("SELECT {} FROM {}.{}").format(
                    sql.SQL(", ").join(head_cols),
                    sql.Identifier(schema_name),
                    sql.Identifier(table_name),
                ).as_string(conn)
            )
    return out


def _basic_join_queries(conn, limit: int) -> List[str]:
    out: List[str] = []
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            tc.table_schema,
            tc.table_name,
            kcu.column_name,
            ccu.table_schema AS ref_schema,
            ccu.table_name   AS ref_table,
            ccu.column_name  AS ref_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema IN ('bronze','silver','gold')
          AND ccu.table_schema IN ('bronze','silver','gold')
        ORDER BY tc.table_schema, tc.table_name
        LIMIT %s
        """,
        (max(1, limit),),
    )
    for src_schema, src_table, src_col, dst_schema, dst_table, dst_col in cur.fetchall():
        out.append(
            sql.SQL(
                "SELECT a.{src_col}, b.{dst_col} "
                "FROM {src_schema}.{src_table} a "
                "JOIN {dst_schema}.{dst_table} b "
                "ON a.{src_col} = b.{dst_col}"
            ).format(
                src_col=sql.Identifier(src_col),
                dst_col=sql.Identifier(dst_col),
                src_schema=sql.Identifier(src_schema),
                src_table=sql.Identifier(src_table),
                dst_schema=sql.Identifier(dst_schema),
                dst_table=sql.Identifier(dst_table),
            ).as_string(conn)
        )
    cur.close()
    return out


def _project_sql_patterns() -> List[str]:
    return []


def _project_cte_sql_patterns() -> List[str]:
    return []


def _dynamic_cte_statements(conn, limit: int) -> List[str]:
    """
    Build CTE queries from real existing tables and FK relationships so they run in current DB.
    """
    out: List[str] = []
    cur = conn.cursor()
    cur.execute(
        """
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname IN ('bronze','silver','gold')
        ORDER BY schemaname, tablename
        LIMIT %s
        """,
        (max(1, limit),),
    )
    tables = cur.fetchall()
    for schema_name, table_name in tables:
        stmt = sql.SQL(
            "WITH base AS (SELECT * FROM {s}.{t}), "
            "stats AS (SELECT SUM(1) AS row_count FROM base) "
            "SELECT row_count FROM stats"
        ).format(s=sql.Identifier(schema_name), t=sql.Identifier(table_name))
        out.append(stmt.as_string(conn))

    cur.execute(
        """
        SELECT
            tc.table_schema,
            tc.table_name,
            kcu.column_name,
            ccu.table_schema AS ref_schema,
            ccu.table_name   AS ref_table,
            ccu.column_name  AS ref_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema IN ('bronze','silver','gold')
          AND ccu.table_schema IN ('bronze','silver','gold')
        ORDER BY tc.table_schema, tc.table_name
        LIMIT %s
        """,
        (max(1, limit),),
    )
    fks = cur.fetchall()
    cur.close()
    for src_schema, src_table, src_col, dst_schema, dst_table, dst_col in fks:
        stmt = sql.SQL(
            "WITH left_src AS (SELECT * FROM {src_s}.{src_t}), "
            "right_ref AS (SELECT * FROM {dst_s}.{dst_t}), "
            "joined AS (SELECT l.{src_c} AS src_key FROM left_src l JOIN right_ref r ON l.{src_c} = r.{dst_c}) "
            "SELECT src_key, SUM(1) AS hit_count FROM joined GROUP BY src_key ORDER BY hit_count DESC"
        ).format(
            src_s=sql.Identifier(src_schema),
            src_t=sql.Identifier(src_table),
            dst_s=sql.Identifier(dst_schema),
            dst_t=sql.Identifier(dst_table),
            src_c=sql.Identifier(src_col),
            dst_c=sql.Identifier(dst_col),
        )
        out.append(stmt.as_string(conn))
    return out


def _project_non_cte_variety_patterns() -> List[str]:
    return []


def _report_analysis_patterns(conn, limit: int) -> List[str]:
    out: List[str] = []
    cur = conn.cursor()
    cur.execute(
        """
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
          AND table_schema IN ('bronze','silver','gold')
        ORDER BY table_schema, table_name
        LIMIT %s
        """,
        (max(1, limit),),
    )
    tables = cur.fetchall()
    for schema_name, table_name in tables:
        cur.execute(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            (schema_name, table_name),
        )
        cols = cur.fetchall()
        col_names = [c[0] for c in cols]
        numeric_cols = [c[0] for c in cols if c[1] in ("smallint", "integer", "bigint", "numeric", "real", "double precision", "decimal")]
        date_cols = [c[0] for c in cols if ("date" in c[1]) or ("time" in c[1])]
        text_cols = [c[0] for c in cols if c[1] in ("character varying", "text", "character")]

        if not col_names:
            continue

        # Basic table queries
        out.append(
            sql.SQL("SELECT * FROM {}.{}")
            .format(sql.Identifier(schema_name), sql.Identifier(table_name))
            .as_string(conn)
        )
        out.append(
            sql.SQL("SELECT {} FROM {}.{}")
            .format(
                sql.SQL(", ").join(sql.Identifier(c) for c in col_names[: min(4, len(col_names))]),
                sql.Identifier(schema_name),
                sql.Identifier(table_name),
            )
            .as_string(conn)
        )

        if numeric_cols:
            ncol = numeric_cols[0]
            if date_cols:
                dcol = date_cols[0]
                # Cumulative + change over time style analyses
                out.append(
                    sql.SQL(
                        "SELECT {d}, SUM({n}) AS metric, "
                        "SUM(SUM({n})) OVER (ORDER BY {d} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_metric "
                        "FROM {s}.{t} GROUP BY {d} ORDER BY {d}"
                    )
                    .format(
                        d=sql.Identifier(dcol),
                        n=sql.Identifier(ncol),
                        s=sql.Identifier(schema_name),
                        t=sql.Identifier(table_name),
                    )
                    .as_string(conn)
                )
                out.append(
                    sql.SQL(
                        "SELECT {d}, SUM({n}) AS metric, "
                        "LAG(SUM({n})) OVER (ORDER BY {d}) AS previous_metric "
                        "FROM {s}.{t} GROUP BY {d} ORDER BY {d}"
                    )
                    .format(
                        d=sql.Identifier(dcol),
                        n=sql.Identifier(ncol),
                        s=sql.Identifier(schema_name),
                        t=sql.Identifier(table_name),
                    )
                    .as_string(conn)
                )
            if text_cols:
                gcol = text_cols[0]
                # Magnitude / ranking / segmentation / part-to-whole
                out.append(
                    sql.SQL(
                        "SELECT {g}, SUM({n}) AS magnitude "
                        "FROM {s}.{t} GROUP BY {g} ORDER BY magnitude DESC"
                    )
                    .format(
                        g=sql.Identifier(gcol),
                        n=sql.Identifier(ncol),
                        s=sql.Identifier(schema_name),
                        t=sql.Identifier(table_name),
                    )
                    .as_string(conn)
                )
                out.append(
                    sql.SQL(
                        "SELECT {g}, SUM({n}) AS metric, "
                        "DENSE_RANK() OVER (ORDER BY SUM({n}) DESC) AS metric_rank "
                        "FROM {s}.{t} GROUP BY {g} ORDER BY metric_rank"
                    )
                    .format(
                        g=sql.Identifier(gcol),
                        n=sql.Identifier(ncol),
                        s=sql.Identifier(schema_name),
                        t=sql.Identifier(table_name),
                    )
                    .as_string(conn)
                )
                out.append(
                    sql.SQL(
                        "WITH grp AS (SELECT {g}, SUM({n}) AS metric FROM {s}.{t} GROUP BY {g}), "
                        "tot AS (SELECT SUM(metric) AS total_metric FROM grp) "
                        "SELECT grp.{g}, grp.metric, CASE WHEN tot.total_metric = 0 THEN 0 ELSE grp.metric / tot.total_metric END AS share "
                        "FROM grp CROSS JOIN tot ORDER BY grp.metric DESC"
                    )
                    .format(
                        g=sql.Identifier(gcol),
                        n=sql.Identifier(ncol),
                        s=sql.Identifier(schema_name),
                        t=sql.Identifier(table_name),
                    )
                    .as_string(conn)
                )
                out.append(
                    sql.SQL(
                        "WITH seg AS (SELECT {g}, SUM({n}) AS metric FROM {s}.{t} GROUP BY {g}) "
                        "SELECT {g}, metric, NTILE(4) OVER (ORDER BY metric DESC) AS segment "
                        "FROM seg ORDER BY metric DESC"
                    )
                    .format(
                        g=sql.Identifier(gcol),
                        n=sql.Identifier(ncol),
                        s=sql.Identifier(schema_name),
                        t=sql.Identifier(table_name),
                    )
                    .as_string(conn)
                )
    cur.close()
    return out


def _real_join_statements(conn, limit: int) -> List[str]:
    """
    Build runnable join queries from actual FK relationships in non-system schemas.
    """
    cur = conn.cursor()
    cur.execute(
        """
        SELECT
            tc.table_schema,
            tc.table_name,
            kcu.column_name,
            ccu.table_schema AS ref_schema,
            ccu.table_name   AS ref_table,
            ccu.column_name  AS ref_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema IN ('bronze','silver','gold')
          AND ccu.table_schema IN ('bronze','silver','gold')
        ORDER BY tc.table_schema, tc.table_name
        LIMIT %s
        """,
        (max(1, limit),),
    )
    joins = []
    for src_schema, src_table, src_col, dst_schema, dst_table, dst_col in cur.fetchall():
        src_schema_i = sql.Identifier(src_schema)
        src_table_i = sql.Identifier(src_table)
        src_col_i = sql.Identifier(src_col)
        dst_schema_i = sql.Identifier(dst_schema)
        dst_table_i = sql.Identifier(dst_table)
        dst_col_i = sql.Identifier(dst_col)
        joins.append(
            sql.SQL(
                "SELECT a.{src_col} AS src_key, SUM(1) AS row_count, "
                "COUNT(DISTINCT a.{src_col}) AS distinct_src_keys "
                "FROM {src_schema}.{src_table} a "
                "JOIN {dst_schema}.{dst_table} b ON a.{src_col} = b.{dst_col} "
                "GROUP BY a.{src_col} "
                "ORDER BY row_count DESC"
            ).format(
                src_col=src_col_i,
                src_schema=src_schema_i,
                src_table=src_table_i,
                dst_schema=dst_schema_i,
                dst_table=dst_table_i,
                dst_col=dst_col_i,
            ).as_string(conn)
        )
        joins.append(
            sql.SQL(
                "SELECT a.{src_col} AS src_key, "
                "SUM(CASE WHEN b.{dst_col} IS NULL THEN 1 ELSE 0 END) AS unmatched_rows, "
                "SUM(1) AS scanned_rows "
                "FROM {src_schema}.{src_table} a "
                "LEFT JOIN {dst_schema}.{dst_table} b ON a.{src_col} = b.{dst_col} "
                "GROUP BY a.{src_col} "
                "ORDER BY scanned_rows DESC"
            ).format(
                src_col=src_col_i,
                dst_col=dst_col_i,
                src_schema=src_schema_i,
                src_table=src_table_i,
                dst_schema=dst_schema_i,
                dst_table=dst_table_i,
            ).as_string(conn)
        )
    cur.close()
    return joins


def _real_big_join_statements(conn, limit: int) -> List[str]:
    cur = conn.cursor()
    cur.execute(
        """
        WITH fk AS (
            SELECT
                tc.table_schema,
                tc.table_name,
                kcu.column_name,
                ccu.table_schema AS ref_schema,
                ccu.table_name AS ref_table,
                ccu.column_name AS ref_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema IN ('bronze','silver','gold')
              AND ccu.table_schema IN ('bronze','silver','gold')
            ORDER BY tc.table_schema, tc.table_name
            LIMIT %s
        )
        SELECT
            fk1.table_schema, fk1.table_name, fk1.column_name,
            fk1.ref_schema, fk1.ref_table, fk1.ref_column,
            fk2.table_schema, fk2.table_name, fk2.column_name,
            fk2.ref_schema, fk2.ref_table, fk2.ref_column
        FROM fk fk1
        JOIN fk fk2
          ON fk1.ref_schema = fk2.table_schema
         AND fk1.ref_table = fk2.table_name
        ORDER BY fk1.table_schema, fk1.table_name
        LIMIT %s
        """,
        (max(1, limit), max(1, limit)),
    )
    out: List[str] = []
    for r in cur.fetchall():
        (
            a_schema, a_table, a_col,
            b_schema, b_table, b_col,
            _b_schema2, _b_table2, b2_col,
            c_schema, c_table, c_col,
        ) = r
        out.append(
            sql.SQL(
                "SELECT "
                "SUM(1) AS joined_rows, "
                "SUM(CASE WHEN c.{c_col} IS NULL THEN 1 ELSE 0 END) AS null_in_third_table, "
                "COUNT(DISTINCT a.{a_col}) AS distinct_left_keys "
                "FROM {a_schema}.{a_table} a "
                "JOIN {b_schema}.{b_table} b ON a.{a_col} = b.{b_col} "
                "LEFT JOIN {c_schema}.{c_table} c ON b.{b2_col} = c.{c_col}"
            ).format(
                a_col=sql.Identifier(a_col),
                b_col=sql.Identifier(b_col),
                b2_col=sql.Identifier(b2_col),
                c_col=sql.Identifier(c_col),
                a_schema=sql.Identifier(a_schema),
                a_table=sql.Identifier(a_table),
                b_schema=sql.Identifier(b_schema),
                b_table=sql.Identifier(b_table),
                c_schema=sql.Identifier(c_schema),
                c_table=sql.Identifier(c_table),
            ).as_string(conn)
        )
    cur.close()
    return out


def _randomize_statement(stmt: str) -> str:
    s = stmt.strip().rstrip(";")
    return s


def _pick_statement(
    statements: List[str],
    simple_queries: List[str],
    cte_queries: List[str],
    heavy_queries: List[str],
    regular_queries: List[str],
) -> str:
    # Keep strong variety: simple selects, CTE-heavy, join-heavy, and regular queries.
    r = random.random()
    if simple_queries and r < 0.22:
        return random.choice(simple_queries)
    if cte_queries and r < 0.58:
        return random.choice(cte_queries)
    if heavy_queries and r < 0.86:
        return random.choice(heavy_queries)
    if regular_queries:
        return random.choice(regular_queries)
    return random.choice(statements)


def _sample_metrics() -> Tuple[float, float, float, float, float]:
    mean_ms = max(0.2, random.lognormvariate(2.0, 0.45))
    min_ms = max(0.1, mean_ms * random.uniform(0.5, 0.9))
    max_ms = max(mean_ms, mean_ms * random.uniform(1.1, 2.8))
    std_ms = max(0.01, (max_ms - min_ms) * random.uniform(0.10, 0.35))
    total_ms = mean_ms
    return (
        round(total_ms, 3),
        round(mean_ms, 3),
        round(min_ms, 3),
        round(max_ms, 3),
        round(std_ms, 3),
    )


def _sample_blocks(mean_ms: float) -> Tuple[int, int, int, int, int, int, int, int, int, int, float, float]:
    scale = max(1.0, mean_ms / 10.0)
    shared_hit = int(random.randint(20, 600) * scale)
    shared_read = int(random.randint(0, 60) * scale)
    shared_dirtied = int(random.randint(0, 4) * scale)
    shared_written = int(random.randint(0, 3) * scale)
    local_hit = int(random.randint(0, 6))
    local_read = int(random.randint(0, 3))
    local_dirtied = 0
    local_written = 0
    temp_read = int(random.randint(0, 4) * (scale ** 0.8))
    temp_written = int(random.randint(0, 4) * (scale ** 0.8))
    blk_read_ms = round(shared_read * random.uniform(0.01, 0.09), 3)
    blk_write_ms = round(shared_written * random.uniform(0.01, 0.10), 3)
    return (
        shared_hit,
        shared_read,
        shared_dirtied,
        shared_written,
        local_hit,
        local_read,
        local_dirtied,
        local_written,
        temp_read,
        temp_written,
        blk_read_ms,
        blk_write_ms,
    )


def _rows(statements: List[str], total_rows: int, spread_days: int) -> Iterable[List[str]]:
    simple_queries = [
        s
        for s in statements
        if s.lower().startswith("select * from ")
        or (
            s.lower().startswith("select ")
            and " join " not in s.lower()
            and " with " not in f" {s.lower()}"
            and " group by " not in f" {s.lower()}"
        )
    ]
    cte_queries = [s for s in statements if s.lower().startswith("with ")]
    heavy_queries = [s for s in statements if (" join " in s.lower()) or s.lower().startswith("with ")]
    regular_queries = [s for s in statements if s not in heavy_queries]
    start_at = (datetime.now() - timedelta(days=spread_days)).replace(second=0, microsecond=0)
    step = max(1.0, (spread_days * 86400.0) / max(1, total_rows))
    for i in range(total_rows):
        stmt = _randomize_statement(_pick_statement(statements, simple_queries, cte_queries, heavy_queries, regular_queries))
        tpl = stmt  # template remains runnable/readable too
        qh = _hash64(stmt)
        total_ms, mean_ms, min_ms, max_ms, std_ms = _sample_metrics()
        (
            shared_hit,
            shared_read,
            shared_dirtied,
            shared_written,
            local_hit,
            local_read,
            local_dirtied,
            local_written,
            temp_read,
            temp_written,
            blk_read_ms,
            blk_write_ms,
        ) = _sample_blocks(mean_ms)
        stmt_l = stmt.lower()
        is_heavy = (" join " in stmt_l) or stmt_l.startswith("with ")
        if is_heavy:
            calls = random.randint(60, 1500)
        else:
            calls = random.randint(5, 400)
        rows_affected = max(1, int(random.lognormvariate(3.0, 1.0)))
        query_plan = '{"note":"synthetic_runnable_sql"}'
        extracted = '{"source":"populate_query_logs1_fast","runnable":true}'
        collected_at = (start_at + timedelta(seconds=i * step)).strftime("%Y-%m-%d %H:%M:%S")
        yield [
            qh,
            stmt,
            tpl,
            str(calls),
            f"{total_ms:.3f}",
            f"{mean_ms:.3f}",
            f"{min_ms:.3f}",
            f"{max_ms:.3f}",
            f"{std_ms:.3f}",
            str(rows_affected),
            str(shared_hit),
            str(shared_read),
            str(shared_dirtied),
            str(shared_written),
            str(local_hit),
            str(local_read),
            str(local_dirtied),
            str(local_written),
            str(temp_read),
            str(temp_written),
            f"{blk_read_ms:.3f}",
            f"{blk_write_ms:.3f}",
            query_plan,
            extracted,
            collected_at,
        ]


def _copy(conn, rows: Iterable[List[str]], batch_rows: int) -> int:
    cols = (
        "query_hash,query_text,query_template,calls,"
        "total_exec_time_ms,mean_exec_time_ms,min_exec_time_ms,max_exec_time_ms,stddev_exec_time_ms,"
        "rows_affected,"
        "shared_blks_hit,shared_blks_read,shared_blks_dirtied,shared_blks_written,"
        "local_blks_hit,local_blks_read,local_blks_dirtied,local_blks_written,"
        "temp_blks_read,temp_blks_written,blk_read_time_ms,blk_write_time_ms,"
        "query_plan,extracted_features,collected_at"
    )
    copy_sql = f"COPY ml_optimization.query_logs1 ({cols}) FROM STDIN WITH (FORMAT csv)"
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
    parser = argparse.ArgumentParser(description="Generate NEW runnable data for ml_optimization.query_logs1.")
    parser.add_argument("--rows", type=int, default=1_000_000, help="Rows to generate (default: 1,000,000)")
    parser.add_argument("--batch-rows", type=int, default=100_000, help="COPY batch size (default: 100,000)")
    parser.add_argument("--spread-days", type=int, default=30, help="Spread collected_at over N days")
    parser.add_argument("--seed", type=int, default=1337, help="RNG seed")
    parser.add_argument("--truncate", action="store_true", help="Truncate query_logs1 before insert")
    parser.add_argument("--max-db-statements", type=int, default=60, help="Max local DB-derived statements to include")
    parser.add_argument(
        "--include-big-joins",
        action="store_true",
        help="Include expensive FK-chain big join templates (slower startup).",
    )
    args = parser.parse_args()

    random.seed(args.seed)
    conn = psycopg2.connect(_db_conn_str())
    try:
        cur = conn.cursor()
        cur.execute("SET statement_timeout = '0';")
        cur.execute(DDL_SQL)
        if args.truncate:
            cur.execute("TRUNCATE TABLE ml_optimization.query_logs1;")
        conn.commit()
        cur.close()

        statements = _project_sql_patterns()
        statements.extend(_project_cte_sql_patterns())
        statements.extend(_dynamic_cte_statements(conn, max(20, args.max_db_statements)))
        statements.extend(_project_non_cte_variety_patterns())
        statements.extend(_report_analysis_patterns(conn, max(20, args.max_db_statements)))
        statements.extend(_basic_select_queries(conn, max(20, args.max_db_statements)))
        statements.extend(_basic_join_queries(conn, max(20, args.max_db_statements)))
        statements.extend(_real_join_statements(conn, args.max_db_statements))
        if args.include_big_joins:
            statements.extend(_real_big_join_statements(conn, max(1, args.max_db_statements // 2)))
        statements.extend(_local_db_statements(conn, args.max_db_statements))
        # Keep unique, non-empty, and manually runnable (no stray formatting tokens).
        statements = [s for s in dict.fromkeys((x.strip() for x in statements if x and x.strip() and "%" not in x))]
        max_pool = min(800, max(200, args.max_db_statements * 2))
        statements = statements[:max_pool]
        print(f"Statement pool size: {len(statements):,}", flush=True)
        if not statements:
            raise RuntimeError("No runnable statements found in current database/project patterns.")

        inserted = _copy(conn, _rows(statements, args.rows, args.spread_days), args.batch_rows)
        cur2 = conn.cursor()
        cur2.execute(
            """
            SELECT setval(
                pg_get_serial_sequence('ml_optimization.query_logs1', 'log_id'),
                COALESCE((SELECT MAX(log_id) FROM ml_optimization.query_logs1), 1),
                true
            )
            """
        )
        conn.commit()
        cur2.close()
        print(f"Done. Generated {inserted:,} NEW rows in ml_optimization.query_logs1.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()

