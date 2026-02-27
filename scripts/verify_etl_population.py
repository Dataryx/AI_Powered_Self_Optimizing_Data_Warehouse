#!/usr/bin/env python3
"""Check which Silver and Gold tables have been populated after ETL."""

import sys
import psycopg2
import os

def print_header(text):
    print("\n" + "=" * 80)
    print(text)
    print("=" * 80)

def print_section(text):
    print("\n" + "-" * 80)
    print(text)
    print("-" * 80)

def main():
    print_header("ETL Population Check")
    try:
        connection = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            database=os.getenv("POSTGRES_DB", "datawarehouse"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "postgres")
        )
        print("Connected to database.")
    except Exception as e:
        print(f"[ERROR] Failed to connect to database: {e}")
        sys.exit(1)
    
    cursor = connection.cursor()
    
    silver_tables = [
        'country', 'location', 'warehouse', 'product', 'inventory',
        'person', 'customer', 'employee', 'orders', 'order_item',
        'customer_company', 'customer_employee', 'employment_jobs',
        'person_location', 'phone_number', 'restricted_info'
    ]
    
    gold_tables = [
        'dim_date', 'dim_customer', 'dim_product', 'dim_employee',
        'dim_location', 'dim_warehouse', 'dim_promotion',
        'fact_sales', 'fact_orders', 'fact_inventory_snapshot',
        'agg_daily_sales', 'agg_customer_lifetime', 'agg_monthly_product_sales',
        'agg_sales_rep_performance'
    ]
    
    print_section("SILVER LAYER TABLES")
    silver_empty = []
    silver_populated = []
    
    for table in silver_tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM silver.{table};")
            count = cursor.fetchone()[0]
            status = "[OK]" if count > 0 else "[EMPTY]"
            print(f"  {status} {table:25s}: {count:>15,} records")
            if count > 0:
                silver_populated.append(table)
            else:
                silver_empty.append(table)
        except Exception as e:
            print(f"  [ERROR] {table:25s}: {str(e)[:50]}")
            silver_empty.append(table)
    
    print_section("GOLD LAYER TABLES")
    gold_empty = []
    gold_populated = []
    
    for table in gold_tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM gold.{table};")
            count = cursor.fetchone()[0]
            status = "[OK]" if count > 0 else "[EMPTY]"
            print(f"  {status} {table:30s}: {count:>15,} records")
            if count > 0:
                gold_populated.append(table)
            else:
                gold_empty.append(table)
        except Exception as e:
            print(f"  [ERROR] {table:30s}: {str(e)[:50]}")
            gold_empty.append(table)
    
    # Summary
    print_section("SUMMARY")
    print(f"Silver Layer:")
    print(f"  Populated: {len(silver_populated)}/{len(silver_tables)} tables")
    print(f"  Empty:     {len(silver_empty)}/{len(silver_tables)} tables")
    if silver_empty:
        print(f"  Empty tables: {', '.join(silver_empty)}")
    
    print(f"\nGold Layer:")
    print(f"  Populated: {len(gold_populated)}/{len(gold_tables)} tables")
    print(f"  Empty:     {len(gold_empty)}/{len(gold_tables)} tables")
    if gold_empty:
        print(f"  Empty tables: {', '.join(gold_empty)}")
    
    print_section("Bronze layer (source for ETL)")
    bronze_tables = ['country', 'location', 'warehouse', 'product', 'inventory',
                     'person', 'customer', 'employment', 'orders', 'order_item']
    
    bronze_has_data = []
    bronze_empty = []
    for table in bronze_tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM bronze.{table};")
            count = cursor.fetchone()[0]
            status = "[OK]" if count > 0 else "[EMPTY]"
            print(f"  {status} {table:20s}: {count:>15,} records")
            if count > 0:
                bronze_has_data.append(table)
            else:
                bronze_empty.append(table)
        except Exception as e:
            print(f"  [ERROR] {table:20s}: {str(e)[:50]}")
            bronze_empty.append(table)
    
    print_section("What to do next")
    if bronze_empty:
        print("Some Bronze tables are empty. Populate Bronze first (e.g. load from source), then run ETL.")
        print(f"  Empty Bronze tables: {', '.join(bronze_empty)}")
    
    if silver_empty and bronze_has_data:
        print("Bronze has data but some Silver tables are empty. Run ETL:")
        print("  python etl/scripts/run_etl.py")
    if gold_empty and silver_populated:
        print("Silver has data but some Gold tables are empty. Run ETL (it fills both Silver and Gold):")
        print("  python etl/scripts/run_etl.py")
    if not silver_empty and not gold_empty:
        print("All layers are populated.")
    
    cursor.close()
    connection.close()
    print("\n" + "=" * 80)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nProcess interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\nFatal error: {e}", exc_info=True)
        sys.exit(1)




