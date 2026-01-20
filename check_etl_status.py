"""
Script to check ETL pipeline status and data population progress
"""

import psycopg2
import os
from datetime import datetime

# Database connection
connection = psycopg2.connect(
    host=os.getenv("POSTGRES_HOST", "localhost"),
    port=int(os.getenv("POSTGRES_PORT", "5432")),
    database=os.getenv("POSTGRES_DB", "datawarehouse"),
    user=os.getenv("POSTGRES_USER", "postgres"),
    password=os.getenv("POSTGRES_PASSWORD", "postgres")
)

cursor = connection.cursor()

def get_count(cursor, schema, table):
    """Get count for a table, handling errors gracefully."""
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table};")
        count = cursor.fetchone()[0]
        connection.commit()
        return count
    except Exception as e:
        connection.rollback()
        return None

print("=" * 80)
print(f"ETL STATUS CHECK - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 80)

# Bronze Layer (Source)
print("\n[BRONZE] BRONZE LAYER (Source Data)")
print("-" * 80)
bronze_tables = [
    'country', 'location', 'warehouse', 'product', 'inventory',
    'person', 'restricted_info', 'person_location', 'phone_number',
    'customer_company', 'customer_employee', 'customer',
    'employment_jobs', 'employment', 'orders', 'order_item'
]

bronze_total = 0
for table in bronze_tables:
    count = get_count(cursor, 'bronze', table)
    if count is not None:
        bronze_total += count
        print(f"  {table:<25} {count:>15,}")

print(f"\n  {'TOTAL':<25} {bronze_total:>15,}")

# Silver Layer (Transformed)
print("\n[SILVER] SILVER LAYER (Transformed Data)")
print("-" * 80)
silver_tables = [
    'country', 'location', 'warehouse', 'product', 'inventory',
    'person', 'restricted_info', 'person_location', 'phone_number',
    'customer_company', 'customer_employee', 'customer',
    'employment_jobs', 'employee', 'orders', 'order_item'
]

silver_total = 0
silver_data = {}
for table in silver_tables:
    count = get_count(cursor, 'silver', table)
    if count is not None:
        silver_total += count
        silver_data[table] = count
        print(f"  {table:<25} {count:>15,}")
    else:
        print(f"  {table:<25} {'Error/Not Found':>15}")

print(f"\n  {'TOTAL':<25} {silver_total:>15,}")

# Gold Layer (Aggregated)
print("\n[GOLD] GOLD LAYER (Aggregated Data)")
print("-" * 80)
gold_tables = [
    'dim_date', 'dim_customer', 'dim_product', 'dim_location',
    'fact_sales', 'agg_daily_sales', 'agg_customer_lifetime', 
    'agg_monthly_product_sales'
]

gold_total = 0
for table in gold_tables:
    count = get_count(cursor, 'gold', table)
    if count is not None:
        gold_total += count
        print(f"  {table:<25} {count:>15,}")
    else:
        print(f"  {table:<25} {'Error/Not Found':>15}")

print(f"\n  {'TOTAL':<25} {gold_total:>15,}")

# Progress Summary
print("\n" + "=" * 80)
print("[PROGRESS] PROGRESS SUMMARY")
print("=" * 80)

# Key tables progress
key_tables = {
    'customers': ('customer', 'customer'),
    'orders': ('orders', 'orders'),
    'order_items': ('order_item', 'order_item'),
    'products': ('product', 'product'),
    'persons': ('person', 'person')
}

print(f"\n{'Table':<20} {'Bronze':>15} {'Silver':>15} {'Progress':>15}")
print("-" * 65)
for name, (bronze_table, silver_table) in key_tables.items():
    bronze_count = get_count(cursor, 'bronze', bronze_table) or 0
    silver_count = get_count(cursor, 'silver', silver_table) or 0
    if bronze_count > 0:
        progress = (silver_count / bronze_count) * 100
        print(f"{name:<20} {bronze_count:>15,} {silver_count:>15,} {progress:>14.1f}%")
    else:
        print(f"{name:<20} {bronze_count:>15,} {silver_count:>15,} {'N/A':>15}")

# Overall progress
if bronze_total > 0:
    overall_progress = (silver_total / bronze_total) * 100
    print("-" * 65)
    print(f"{'OVERALL':<20} {bronze_total:>15,} {silver_total:>15,} {overall_progress:>14.1f}%")

cursor.close()
connection.close()

print("\n" + "=" * 80)
print("[COMPLETE] Check Complete!")
print("=" * 80)
print("\n[TIPS]")
print("  - Run this script periodically to monitor ETL progress")
print("  - ETL processes data in batches, so progress will be gradual")
print("  - Large tables (orders, order_items) will take longer to process")

