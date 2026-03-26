#!/usr/bin/env python3
"""
Truncate all user tables in the bronze, silver, and gold schemas.

Connects with the same env vars as run_etl.py (POSTGRES_HOST, POSTGRES_PORT,
POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD).

Order: gold → silver → bronze (no cross-schema FKs; within each schema one
TRUNCATE … CASCADE satisfies intra-schema foreign keys).

Does not touch other schemas (e.g. monitoring).

Usage:
  python etl/scripts/truncate_warehouse_layers.py          # prompt for confirmation
  python etl/scripts/truncate_warehouse_layers.py --yes    # no prompt
  python etl/scripts/truncate_warehouse_layers.py --schemas silver bronze
"""

from __future__ import annotations

import argparse
import os
import sys

import psycopg2
from psycopg2 import sql

DEFAULT_ORDER = ("gold", "silver", "bronze")


def _connect():
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres"),
    )


def list_tables(cur, schema: str) -> list[str]:
    cur.execute(
        """
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = %s
        ORDER BY tablename
        """,
        (schema,),
    )
    return [row[0] for row in cur.fetchall()]


def truncate_schema(conn, schema: str, *, restart_identity: bool) -> int:
    """Return number of tables truncated."""
    with conn.cursor() as cur:
        tables = list_tables(cur, schema)
        if not tables:
            return 0
        idents = [sql.Identifier(schema, t) for t in tables]
        if restart_identity:
            tail = sql.SQL("RESTART IDENTITY CASCADE")
        else:
            tail = sql.SQL("CASCADE")
        stmt = sql.SQL("TRUNCATE TABLE {} {}").format(
            sql.SQL(", ").join(idents),
            tail,
        )
        cur.execute(stmt)
    conn.commit()
    return len(tables)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="Truncate without interactive confirmation",
    )
    parser.add_argument(
        "--no-restart-identity",
        action="store_true",
        help="Truncate without RESTART IDENTITY (sequences keep current values)",
    )
    parser.add_argument(
        "--schemas",
        nargs="+",
        choices=["bronze", "silver", "gold"],
        help=f"Schemas to truncate (default: {' '.join(DEFAULT_ORDER)})",
    )
    args = parser.parse_args()

    order = tuple(args.schemas) if args.schemas else DEFAULT_ORDER
    if len(set(order)) != len(order):
        print("error: duplicate schema in --schemas", file=sys.stderr)
        return 2

    if not args.yes:
        print("This will DELETE ALL ROWS in:", ", ".join(order))
        print("Database:", os.getenv("POSTGRES_DB", "datawarehouse"))
        confirm = input("Type TRUNCATE to continue: ").strip()
        if confirm != "TRUNCATE":
            print("Aborted.")
            return 1

    ri = not args.no_restart_identity
    try:
        conn = _connect()
    except Exception as e:
        print(f"Connection failed: {e}", file=sys.stderr)
        return 1

    try:
        for schema in order:
            n = truncate_schema(conn, schema, restart_identity=ri)
            print(f"[ok] {schema}: truncated {n} table(s)")
    except Exception as e:
        conn.rollback()
        print(f"Truncate failed: {e}", file=sys.stderr)
        return 1
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
