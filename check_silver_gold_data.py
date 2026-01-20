"""
Quick script to check Silver and Gold layer data population status
"""

import psycopg2
import os

# Database connection
connection = psycopg2.connect(
    host=os.getenv("POSTGRES_HOST", "localhost"),
    port=int(os.getenv("POSTGRES_PORT", "5432")),
    database=os.getenv("POSTGRES_DB", "datawarehouse"),
    user=os.getenv("POSTGRES_USER", "postgres"),
    password=os.getenv("POSTGRES_PASSWORD", "postgres")
)

def get_count(cursor, schema, table):
    """Get count for a table, handling errors gracefully."""
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table};")
        count = cursor.fetchone()[0]
        connection.commit()  # Commit after successful query
        return f"{count:,}"
    except Exception as e:
        connection.rollback()  # Rollback on error
        error_msg = str(e)
        if "does not exist" in error_msg:
            return "Table not found"
        return f"Error: {error_msg[:40]}"

cursor = connection.cursor()

print("=" * 80)
print("SILVER LAYER DATA STATUS")
print("=" * 80)

# Silver layer tables - check actual table names from schema
silver_tables = [
    'country', 'location', 'warehouse', 'product', 'inventory',
    'person', 'restricted_info', 'person_location', 'phone_number',
    'customer_company', 'customer_employee', 'customer',
    'employment_job', 'employee', 'orders', 'order_item'
]

print(f"{'Table':<30} {'Record Count':>15}")
print("-" * 50)
for table in silver_tables:
    count = get_count(cursor, 'silver', table)
    print(f"{table:<30} {count:>15}")

print("\n" + "=" * 80)
print("GOLD LAYER DATA STATUS")
print("=" * 80)

# Gold layer tables
gold_tables = [
    'dim_date', 'dim_customer', 'dim_product', 'dim_location',
    'fact_sales', 'agg_daily_sales', 'agg_customer_lifetime', 
    'agg_monthly_product_sales'
]

print(f"{'Table':<30} {'Record Count':>15}")
print("-" * 50)
for table in gold_tables:
    count = get_count(cursor, 'gold', table)
    print(f"{table:<30} {count:>15}")

# Also check Bronze for comparison
print("\n" + "=" * 80)
print("BRONZE LAYER DATA STATUS (for comparison)")
print("=" * 80)

bronze_tables = [
    'country', 'location', 'warehouse', 'product', 'inventory',
    'person', 'restricted_info', 'person_location', 'phone_number',
    'customer_company', 'customer_employee', 'customer',
    'employment_job', 'employee', 'orders', 'order_item'
]

print(f"{'Table':<30} {'Record Count':>15}")
print("-" * 50)
for table in bronze_tables:
    count = get_count(cursor, 'bronze', table)
    print(f"{table:<30} {count:>15}")

cursor.close()
connection.close()

print("\n" + "=" * 80)
print("CHECK COMPLETE")
print("=" * 80)
