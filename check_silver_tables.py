"""
Detailed check of all Silver layer tables
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

def get_table_info(cursor, schema, table):
    """Get detailed information about a table."""
    info = {
        'exists': False,
        'count': 0,
        'columns': [],
        'sample': None,
        'error': None
    }
    
    try:
        # Check if table exists and get count
        cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table};")
        info['count'] = cursor.fetchone()[0]
        info['exists'] = True
        connection.commit()
        
        # Get column names
        cursor.execute(f"""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position;
        """, (schema, table))
        info['columns'] = cursor.fetchall()
        
        # Get sample data (first 3 rows)
        if info['count'] > 0:
            cursor.execute(f"SELECT * FROM {schema}.{table} LIMIT 3;")
            info['sample'] = cursor.fetchall()
        
    except psycopg2.errors.UndefinedTable:
        info['error'] = "Table does not exist"
        connection.rollback()
    except Exception as e:
        info['error'] = str(e)[:100]
        connection.rollback()
    
    return info

print("=" * 100)
print(f"SILVER LAYER - COMPLETE TABLE ANALYSIS")
print(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 100)

# All Silver layer tables (based on schema)
silver_tables = [
    'country',
    'location', 
    'warehouse',
    'product',
    'inventory',
    'person',
    'restricted_info',
    'person_location',
    'phone_number',
    'customer_company',
    'customer_employee',
    'customer',
    'employment_jobs',
    'employee',
    'orders',
    'order_item'
]

total_records = 0
tables_with_data = 0
tables_empty = 0
tables_missing = 0

print("\n" + "=" * 100)
print("TABLE SUMMARY")
print("=" * 100)
print(f"{'Table Name':<30} {'Status':<15} {'Record Count':>15} {'Columns':>10}")
print("-" * 100)

for table in silver_tables:
    info = get_table_info(cursor, 'silver', table)
    
    if info['error']:
        status = "NOT FOUND"
        tables_missing += 1
        count_str = "N/A"
        cols_str = "N/A"
    elif info['count'] == 0:
        status = "EMPTY"
        tables_empty += 1
        count_str = "0"
        cols_str = str(len(info['columns']))
    else:
        status = "HAS DATA"
        tables_with_data += 1
        count_str = f"{info['count']:,}"
        cols_str = str(len(info['columns']))
        total_records += info['count']
    
    print(f"{table:<30} {status:<15} {count_str:>15} {cols_str:>10}")

print("-" * 100)
print(f"{'TOTAL':<30} {'':<15} {total_records:>15,} {'':>10}")

print("\n" + "=" * 100)
print("STATISTICS")
print("=" * 100)
print(f"Tables with data:     {tables_with_data}")
print(f"Empty tables:          {tables_empty}")
print(f"Missing tables:        {tables_missing}")
print(f"Total records:         {total_records:,}")

# Detailed information for tables with data
print("\n" + "=" * 100)
print("DETAILED INFORMATION - TABLES WITH DATA")
print("=" * 100)

for table in silver_tables:
    info = get_table_info(cursor, 'silver', table)
    
    if info['exists'] and info['count'] > 0:
        print(f"\n[TABLE] {table}")
        print("-" * 100)
        print(f"Record Count: {info['count']:,}")
        print(f"Columns ({len(info['columns'])}):")
        
        # Show column information
        for col in info['columns'][:10]:  # Show first 10 columns
            col_name, data_type, nullable = col
            null_str = "NULL" if nullable == 'YES' else "NOT NULL"
            print(f"  - {col_name:<30} {data_type:<20} {null_str}")
        
        if len(info['columns']) > 10:
            print(f"  ... and {len(info['columns']) - 10} more columns")
        
        # Show sample data
        if info['sample']:
            print(f"\nSample Data (first {len(info['sample'])} row(s)):")
            for idx, row in enumerate(info['sample'], 1):
                # Show first few values
                values_str = ", ".join([str(val)[:30] for val in row[:5]])
                if len(row) > 5:
                    values_str += f" ... (+{len(row) - 5} more columns)"
                print(f"  Row {idx}: {values_str}")

# Compare with Bronze layer
print("\n" + "=" * 100)
print("BRONZE vs SILVER COMPARISON")
print("=" * 100)
print(f"{'Table':<30} {'Bronze Count':>15} {'Silver Count':>15} {'Progress':>15}")
print("-" * 100)

for table in silver_tables:
    # Get Bronze count
    bronze_count = 0
    try:
        # Handle table name differences
        bronze_table = table
        if table == 'employment_jobs':
            bronze_table = 'employment_jobs'
        elif table == 'employee':
            bronze_table = 'employment'
        
        cursor.execute(f"SELECT COUNT(*) FROM bronze.{bronze_table};")
        bronze_count = cursor.fetchone()[0]
        connection.commit()
    except:
        connection.rollback()
        bronze_count = None
    
    # Get Silver count
    silver_info = get_table_info(cursor, 'silver', table)
    silver_count = silver_info['count'] if silver_info['exists'] else 0
    
    if bronze_count is not None and bronze_count > 0:
        progress = (silver_count / bronze_count) * 100
        bronze_str = f"{bronze_count:,}"
        silver_str = f"{silver_count:,}"
        progress_str = f"{progress:.1f}%"
    else:
        bronze_str = "N/A"
        silver_str = f"{silver_count:,}" if silver_info['exists'] else "N/A"
        progress_str = "N/A"
    
    print(f"{table:<30} {bronze_str:>15} {silver_str:>15} {progress_str:>15}")

cursor.close()
connection.close()

print("\n" + "=" * 100)
print("ANALYSIS COMPLETE")
print("=" * 100)















