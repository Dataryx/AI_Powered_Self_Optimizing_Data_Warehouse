"""Run before ETL to check that Bronze, Silver, and Gold schemas and tables exist."""

import os
import sys

# Silver table name -> Bronze table name (only employee is different)
BRONZE_TABLE_MAP = {"employee": "employment"}

SILVER_TABLES_ORDER = [
    "country", "location", "warehouse", "product", "inventory",
    "person", "restricted_info", "person_location", "phone_number",
    "customer_company", "customer_employee", "employment_jobs",
    "employee", "customer", "orders", "order_item",
]


def get_bronze_table(silver_table):
    return BRONZE_TABLE_MAP.get(silver_table, silver_table)


def run_checks(conn):
    cursor = conn.cursor()
    errors = []
    warnings = []

    print("=" * 80)
    print("Schema and table check (Bronze / Silver / Gold)")
    print("=" * 80)
    print()
    print("Schemas...")
    cursor.execute("""
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name IN ('bronze', 'silver', 'gold')
        ORDER BY schema_name
    """)
    found = {r[0] for r in cursor.fetchall()}
    for schema in ["bronze", "silver", "gold"]:
        if schema in found:
            print(f"  ok  {schema}")
        else:
            errors.append(f"Schema '{schema}' missing")
            print(f"  missing  {schema}")
    print()
    print("Bronze tables...")
    bronze_expected = [get_bronze_table(t) for t in SILVER_TABLES_ORDER]
    bronze_expected = list(dict.fromkeys(bronze_expected))  # unique, order preserved
    for bt in bronze_expected:
        cursor.execute("""
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'bronze' AND table_name = %s
        """, (bt,))
        if cursor.fetchone():
            print(f"  ok  bronze.{bt}")
        else:
            errors.append(f"bronze.{bt} missing")
            print(f"  missing  bronze.{bt}")
    print()
    print("Silver tables...")
    for st in SILVER_TABLES_ORDER:
        cursor.execute("""
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'silver' AND table_name = %s
        """, (st,))
        if cursor.fetchone():
            print(f"  ok  silver.{st}")
        else:
            errors.append(f"silver.{st} missing")
            print(f"  missing  silver.{st}")
    print()
    print("Silver NOT NULL columns (sample)...")
    critical_checks = [
        ("customer", "person_key", "BIGINT"),
        ("employee", "person_key", "BIGINT"),
        ("employee", "start_date", "DATE"),
        ("orders", "customer_key", "BIGINT"),
        ("orders", "order_date", "DATE"),
        ("orders", "order_status", "VARCHAR"),
        ("order_item", "order_key", "BIGINT"),
        ("order_item", "product_key", "BIGINT"),
        ("order_item", "unit_price", "NUMERIC"),
        ("order_item", "quantity", "NUMERIC"),
    ]
    for table, col, _ in critical_checks:
        cursor.execute("""
            SELECT data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'silver' AND table_name = %s AND column_name = %s
        """, (table, col))
        row = cursor.fetchone()
        if not row:
            warnings.append(f"silver.{table}.{col} not found")
            print(f"  warn  {table}.{col} not found")
        elif row[1] == "NO":
            print(f"  ok  {table}.{col}")
        else:
            warnings.append(f"{table}.{col} nullable")
    print()
    print("Gold tables...")
    gold_tables = [
        "dim_date", "dim_customer", "dim_product", "dim_employee", "dim_location",
        "dim_warehouse", "dim_promotion",
        "fact_sales", "fact_orders", "fact_inventory_snapshot",
        "agg_daily_sales", "agg_monthly_product_sales", "agg_customer_lifetime", "agg_sales_rep_performance",
    ]
    for gt in gold_tables:
        cursor.execute("""
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'gold' AND table_name = %s
        """, (gt,))
        if cursor.fetchone():
            print(f"  ok  gold.{gt}")
        else:
            errors.append(f"gold.{gt} missing")
            print(f"  missing  gold.{gt}")
    print()
    print("Silver foreign keys...")
    fk_checks = [
        ("location", "fk_silver_location_country"),
        ("customer", "fk_silver_customer_person"),
        ("orders", "fk_silver_orders_customer"),
        ("order_item", "fk_silver_orderitem_order"),
        ("order_item", "fk_silver_orderitem_product"),
    ]
    cursor.execute("""
        SELECT conname FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'silver' AND c.contype = 'f'
    """)
    existing_fks = {r[0] for r in cursor.fetchall()}
    for table, conname in fk_checks:
        if conname in existing_fks:
            print(f"  ok  {conname}")
        else:
            warnings.append(conname)
            print(f"  warn  {conname} not found")
    print()
    print("=" * 80)
    if errors:
        print("Failed. Fix the errors above before running ETL.")
        for e in errors:
            print(f"  - {e}")
    else:
        print("Passed. Schemas and tables look fine for ETL.")
    if warnings:
        print("Warnings:", ", ".join(warnings[:10]))
        if len(warnings) > 10:
            print(f"  ... and {len(warnings) - 10} more")
    print("=" * 80)

    cursor.close()
    return len(errors) == 0


def main():
    try:
        conn = __import__("psycopg2").connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            database=os.getenv("POSTGRES_DB", "datawarehouse"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "postgres"),
        )
        ok = run_checks(conn)
        conn.close()
        sys.exit(0 if ok else 1)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
