#!/usr/bin/env python3
"""
Validate Gold layer data correctness.
Checks for duplicates, count mismatches, and data integrity issues.
"""

import psycopg2
import os
import sys

try:
    from tabulate import tabulate
    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False


def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=int(os.getenv('POSTGRES_PORT', '5432')),
        database=os.getenv('POSTGRES_DB', 'datawarehouse'),
        user=os.getenv('POSTGRES_USER', 'postgres'),
        password=os.getenv('POSTGRES_PASSWORD', 'postgres')
    )


def check_table_counts(connection):
    """Check record counts in source vs destination tables."""
    cursor = connection.cursor()
    
    print("=" * 80)
    print("TABLE COUNT VALIDATION")
    print("=" * 80)
    
    validations = [
        # Fact Tables
        {
            'name': 'fact_sales',
            'source_query': "SELECT COUNT(*) FROM silver.order_item WHERE EXISTS (SELECT 1 FROM silver.orders o WHERE o.order_key = order_item.order_key AND o.is_valid = TRUE)",
            'dest_query': "SELECT COUNT(*) FROM gold.fact_sales",
            'source_table': 'silver.order_item (valid orders)'
        },
        {
            'name': 'fact_orders',
            'source_query': "SELECT COUNT(*) FROM silver.orders WHERE is_valid = TRUE",
            'dest_query': "SELECT COUNT(*) FROM gold.fact_orders",
            'source_table': 'silver.orders'
        },
        # Dimension Tables
        {
            'name': 'dim_customer',
            'source_query': "SELECT COUNT(DISTINCT customer_key) FROM silver.customer WHERE is_valid = TRUE",
            'dest_query': "SELECT COUNT(*) FROM gold.dim_customer",
            'source_table': 'silver.customer'
        },
        {
            'name': 'dim_product',
            'source_query': "SELECT COUNT(DISTINCT product_key) FROM silver.product WHERE is_valid = TRUE",
            'dest_query': "SELECT COUNT(*) FROM gold.dim_product",
            'source_table': 'silver.product'
        },
        {
            'name': 'dim_employee',
            'source_query': "SELECT COUNT(DISTINCT employee_key) FROM silver.employee WHERE is_valid = TRUE",
            'dest_query': "SELECT COUNT(*) FROM gold.dim_employee",
            'source_table': 'silver.employee'
        },
        {
            'name': 'dim_location',
            'source_query': "SELECT COUNT(DISTINCT location_key) FROM silver.location WHERE is_valid = TRUE",
            'dest_query': "SELECT COUNT(*) FROM gold.dim_location",
            'source_table': 'silver.location'
        },
        {
            'name': 'dim_warehouse',
            'source_query': "SELECT COUNT(DISTINCT warehouse_key) FROM silver.warehouse WHERE is_valid = TRUE",
            'dest_query': "SELECT COUNT(*) FROM gold.dim_warehouse",
            'source_table': 'silver.warehouse'
        },
    ]
    
    results = []
    for val in validations:
        try:
            cursor.execute(val['source_query'])
            source_count = cursor.fetchone()[0]
            
            cursor.execute(val['dest_query'])
            dest_count = cursor.fetchone()[0]
            
            diff = dest_count - source_count
            diff_pct = (diff / source_count * 100) if source_count > 0 else 0
            status = "[OK]" if abs(diff) <= 1 else "[MISMATCH]"
            
            results.append({
                'Table': val['name'],
                'Source': f"{source_count:,}",
                'Destination': f"{dest_count:,}",
                'Difference': f"{diff:+,}",
                'Diff %': f"{diff_pct:+.2f}%",
                'Status': status
            })
        except Exception as e:
            results.append({
                'Table': val['name'],
                'Source': 'ERROR',
                'Destination': 'ERROR',
                'Difference': str(e),
                'Diff %': 'N/A',
                'Status': '[ERROR]'
            })
    
    print("\n")
    if HAS_TABULATE:
        print(tabulate(results, headers='keys', tablefmt='grid'))
    else:
        # Manual formatting
        if results:
            headers = list(results[0].keys())
            col_widths = {h: max(len(h), max(len(str(r[h])) for r in results)) for h in headers}
            print(" | ".join(h.ljust(col_widths[h]) for h in headers))
            print("-" * sum(col_widths.values()) + "-" * (len(headers) - 1) * 3)
            for row in results:
                print(" | ".join(str(row[h]).ljust(col_widths[h]) for h in headers))
    print("\n")
    
    cursor.close()


def check_duplicates(connection):
    """Check for duplicate records in Gold tables."""
    cursor = connection.cursor()
    
    print("=" * 80)
    print("DUPLICATE DETECTION")
    print("=" * 80)
    
    duplicate_checks = [
        {
            'name': 'fact_sales',
            'unique_cols': ['order_id', 'order_item_id'],
            'query': """
                SELECT COUNT(*) - COUNT(DISTINCT (order_id, order_item_id)) as duplicates,
                       COUNT(*) as total_records,
                       COUNT(DISTINCT (order_id, order_item_id)) as unique_combinations
                FROM gold.fact_sales
            """
        },
        {
            'name': 'fact_orders',
            'unique_cols': ['order_id'],
            'query': """
                SELECT COUNT(*) - COUNT(DISTINCT order_id) as duplicates,
                       COUNT(*) as total_records,
                       COUNT(DISTINCT order_id) as unique_records
                FROM gold.fact_orders
            """
        },
        {
            'name': 'dim_customer',
            'unique_cols': ['customer_key'],
            'query': """
                SELECT COUNT(*) - COUNT(DISTINCT customer_key) as duplicates,
                       COUNT(*) as total_records,
                       COUNT(DISTINCT customer_key) as unique_keys
                FROM gold.dim_customer
            """
        },
        {
            'name': 'dim_product',
            'unique_cols': ['product_key'],
            'query': """
                SELECT COUNT(*) - COUNT(DISTINCT product_key) as duplicates,
                       COUNT(*) as total_records,
                       COUNT(DISTINCT product_key) as unique_keys
                FROM gold.dim_product
            """
        },
        {
            'name': 'dim_employee',
            'unique_cols': ['employee_key'],
            'query': """
                SELECT COUNT(*) - COUNT(DISTINCT employee_key) as duplicates,
                       COUNT(*) as total_records,
                       COUNT(DISTINCT employee_key) as unique_keys
                FROM gold.dim_employee
            """
        },
    ]
    
    results = []
    for check in duplicate_checks:
        try:
            cursor.execute(check['query'])
            row = cursor.fetchone()
            duplicates, total, unique_count = row
            
            status = "[OK]" if duplicates == 0 else f"[{duplicates:,} DUPLICATES]"
            
            results.append({
                'Table': check['name'],
                'Unique Columns': ', '.join(check['unique_cols']),
                'Total Records': f"{total:,}",
                'Unique Combinations': f"{unique_count:,}",
                'Duplicates': f"{duplicates:,}",
                'Status': status
            })
        except Exception as e:
            results.append({
                'Table': check['name'],
                'Unique Columns': ', '.join(check['unique_cols']),
                'Total Records': 'ERROR',
                'Unique Combinations': 'ERROR',
                'Duplicates': str(e),
                'Status': '[ERROR]'
            })
    
    print("\n")
    if HAS_TABULATE:
        print(tabulate(results, headers='keys', tablefmt='grid'))
    else:
        # Manual formatting
        if results:
            headers = list(results[0].keys())
            col_widths = {h: max(len(h), max(len(str(r[h])) for r in results)) for h in headers}
            print(" | ".join(h.ljust(col_widths[h]) for h in headers))
            print("-" * sum(col_widths.values()) + "-" * (len(headers) - 1) * 3)
            for row in results:
                print(" | ".join(str(row[h]).ljust(col_widths[h]) for h in headers))
    print("\n")
    
    cursor.close()


def check_foreign_key_integrity(connection):
    """Check for orphaned records (foreign key integrity)."""
    cursor = connection.cursor()
    
    print("=" * 80)
    print("FOREIGN KEY INTEGRITY CHECK")
    print("=" * 80)
    
    fk_checks = [
        {
            'name': 'fact_sales -> dim_customer',
            'query': """
                SELECT COUNT(*) as orphaned
                FROM gold.fact_sales fs
                WHERE NOT EXISTS (
                    SELECT 1 FROM gold.dim_customer dc 
                    WHERE dc.customer_key = fs.customer_key
                )
            """
        },
        {
            'name': 'fact_sales -> dim_product',
            'query': """
                SELECT COUNT(*) as orphaned
                FROM gold.fact_sales fs
                WHERE NOT EXISTS (
                    SELECT 1 FROM gold.dim_product dp 
                    WHERE dp.product_key = fs.product_key
                )
            """
        },
        {
            'name': 'fact_sales -> dim_employee',
            'query': """
                SELECT COUNT(*) as orphaned
                FROM gold.fact_sales fs
                WHERE fs.employee_key IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1 FROM gold.dim_employee de 
                    WHERE de.employee_key = fs.employee_key
                )
            """
        },
        {
            'name': 'fact_sales -> dim_date',
            'query': """
                SELECT COUNT(*) as orphaned
                FROM gold.fact_sales fs
                WHERE NOT EXISTS (
                    SELECT 1 FROM gold.dim_date dd 
                    WHERE dd.date_key = fs.order_date_key
                )
            """
        },
        {
            'name': 'fact_orders -> dim_customer',
            'query': """
                SELECT COUNT(*) as orphaned
                FROM gold.fact_orders fo
                WHERE NOT EXISTS (
                    SELECT 1 FROM gold.dim_customer dc 
                    WHERE dc.customer_key = fo.customer_key
                )
            """
        },
    ]
    
    results = []
    for check in fk_checks:
        try:
            cursor.execute(check['query'])
            orphaned = cursor.fetchone()[0]
            
            status = "[OK]" if orphaned == 0 else f"[{orphaned:,} ORPHANED]"
            
            results.append({
                'Relationship': check['name'],
                'Orphaned Records': f"{orphaned:,}",
                'Status': status
            })
        except Exception as e:
            results.append({
                'Relationship': check['name'],
                'Orphaned Records': str(e),
                'Status': '[ERROR]'
            })
    
    print("\n")
    if HAS_TABULATE:
        print(tabulate(results, headers='keys', tablefmt='grid'))
    else:
        # Manual formatting
        if results:
            headers = list(results[0].keys())
            col_widths = {h: max(len(h), max(len(str(r[h])) for r in results)) for h in headers}
            print(" | ".join(h.ljust(col_widths[h]) for h in headers))
            print("-" * sum(col_widths.values()) + "-" * (len(headers) - 1) * 3)
            for row in results:
                print(" | ".join(str(row[h]).ljust(col_widths[h]) for h in headers))
    print("\n")
    
    cursor.close()


def check_aggregation_consistency(connection):
    """Check if aggregation tables are consistent with fact tables."""
    cursor = connection.cursor()
    
    print("=" * 80)
    print("AGGREGATION CONSISTENCY CHECK")
    print("=" * 80)
    
    agg_checks = [
        {
            'name': 'agg_daily_sales vs fact_sales',
            'query': """
                SELECT 
                    (SELECT COUNT(DISTINCT order_date_key) FROM gold.fact_sales) as fact_dates,
                    (SELECT COUNT(DISTINCT date_key) FROM gold.agg_daily_sales) as agg_dates
            """
        },
        {
            'name': 'Total Revenue Comparison',
            'query': """
                SELECT 
                    (SELECT COALESCE(SUM(net_amount), 0) FROM gold.fact_sales) as fact_total,
                    (SELECT COALESCE(SUM(net_revenue), 0) FROM gold.agg_daily_sales) as agg_total
            """
        },
    ]
    
    results = []
    for check in agg_checks:
        try:
            cursor.execute(check['query'])
            row = cursor.fetchone()
            
            if len(row) == 2:
                val1, val2 = row
                diff = abs(val1 - val2)
                diff_pct = (diff / val1 * 100) if val1 > 0 else 0
                status = "[OK]" if diff_pct < 1.0 else f"[{diff_pct:.2f}% DIFFERENCE]"
                
                results.append({
                    'Check': check['name'],
                    'Value 1': f"{val1:,.2f}" if isinstance(val1, (int, float)) else f"{val1:,}",
                    'Value 2': f"{val2:,.2f}" if isinstance(val2, (int, float)) else f"{val2:,}",
                    'Difference': f"{diff:,.2f}" if isinstance(diff, (int, float)) else f"{diff:,}",
                    'Status': status
                })
        except Exception as e:
            results.append({
                'Check': check['name'],
                'Value 1': 'ERROR',
                'Value 2': 'ERROR',
                'Difference': str(e),
                'Status': '[ERROR]'
            })
    
    if results:
        print("\n")
        if HAS_TABULATE:
            print(tabulate(results, headers='keys', tablefmt='grid'))
        else:
            # Manual formatting
            headers = list(results[0].keys())
            col_widths = {h: max(len(h), max(len(str(r[h])) for r in results)) for h in headers}
            print(" | ".join(h.ljust(col_widths[h]) for h in headers))
            print("-" * sum(col_widths.values()) + "-" * (len(headers) - 1) * 3)
            for row in results:
                print(" | ".join(str(row[h]).ljust(col_widths[h]) for h in headers))
        print("\n")
    
    cursor.close()


def main():
    """Run all validation checks."""
    try:
        connection = get_db_connection()
        
        print("\n")
        print("=" * 80)
        print(" " * 20 + "GOLD LAYER DATA VALIDATION" + " " * 35)
        print("=" * 80)
        print("\n")
        
        check_table_counts(connection)
        check_duplicates(connection)
        check_foreign_key_integrity(connection)
        check_aggregation_consistency(connection)
        
        print("=" * 80)
        print("VALIDATION COMPLETE")
        print("=" * 80)
        print("\n")
        
        connection.close()
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()

