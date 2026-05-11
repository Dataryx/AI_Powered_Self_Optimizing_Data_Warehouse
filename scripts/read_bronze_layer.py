#!/usr/bin/env python3
"""Introspect bronze schema: tables, foreign keys, row estimates. Requires psycopg2."""
import os
import sys

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("Install psycopg2: pip install psycopg2-binary", file=sys.stderr)
    sys.exit(2)


def main() -> int:
    conn = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres"),
    )
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'bronze' AND table_type = 'BASE TABLE'
        ORDER BY table_name
        """
    )
    tables = cur.fetchall()
    print("BRONZE TABLES (%d):" % len(tables))
    for r in tables:
        print(" ", r["table_name"])

    cur.execute(
        """
        SELECT
          tc.table_name AS child_table,
          kcu.column_name AS fk_column,
          ccu.table_name AS parent_table,
          ccu.column_name AS parent_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'bronze'
        ORDER BY tc.table_name, kcu.column_name
        """
    )
    fks = cur.fetchall()
    print()
    print("FOREIGN KEYS (%d):" % len(fks))
    for f in fks:
        print(
            " ",
            f"{f['child_table']}.{f['fk_column']} -> "
            f"{f['parent_table']}.{f['parent_column']}",
        )

    cur.execute(
        """
        SELECT c.relname AS table_name,
               COALESCE(s.n_live_tup::bigint, -1) AS est_rows
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'bronze'
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE c.relkind = 'r'
        ORDER BY c.relname
        """
    )
    stats = cur.fetchall()
    print()
    print("ROW ESTIMATES (pg_stat_user_tables.n_live_tup, -1 if unknown):")
    for s in stats:
        print(" ", s["table_name"], s["est_rows"])

    cur.close()
    conn.close()
    print()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print("ERROR:", e, file=sys.stderr)
        raise SystemExit(1)
