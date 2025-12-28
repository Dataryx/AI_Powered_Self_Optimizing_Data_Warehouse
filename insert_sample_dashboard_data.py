#!/usr/bin/env python3
"""Insert sample data for dashboard metrics."""

import psycopg2
import os
from datetime import datetime, timedelta

# Database connection
conn = psycopg2.connect(
    host=os.getenv('POSTGRES_HOST', 'localhost'),
    port=os.getenv('POSTGRES_PORT', '5432'),
    database=os.getenv('POSTGRES_DB', 'datawarehouse'),
    user=os.getenv('POSTGRES_USER', 'postgres'),
    password=os.getenv('POSTGRES_PASSWORD', 'postgres')
)

cursor = conn.cursor()

print("Inserting sample data for dashboard metrics...")

try:
    # Insert sample query logs for today
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday = today - timedelta(days=1)
    
    # Sample queries for today - simplified to just essential fields
    insert_sql = """
        INSERT INTO ml_optimization.query_logs 
        (query_hash, query_text, query_template, calls, total_exec_time_ms, mean_exec_time_ms, 
         min_exec_time_ms, max_exec_time_ms, stddev_exec_time_ms, rows_affected, 
         shared_blks_hit, shared_blks_read, shared_blks_dirtied, shared_blks_written,
         local_blks_hit, local_blks_read, local_blks_dirtied, local_blks_written,
         temp_blks_read, temp_blks_written, blk_read_time_ms, blk_write_time_ms,
         query_plan, extracted_features, collected_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    # Insert today's data
    cursor.execute(insert_sql, (
        "hash1", "SELECT * FROM silver.customers WHERE customer_id = $1", 
        "SELECT * FROM silver.customers WHERE customer_id = $1", 
        15234, 1523400.0, 100.0, 50.0, 500.0, 45.0, 1523400, 
        1000000, 500000, 0, 0, 0, 0, 0, 0, 0, 0, None, None, None, None, 
        today + timedelta(hours=1)
    ))
    
    cursor.execute(insert_sql, (
        "hash2", "SELECT COUNT(*) FROM silver.orders WHERE order_date >= $1", 
        "SELECT COUNT(*) FROM silver.orders WHERE order_date >= $1", 
        8500, 1275000.0, 150.0, 75.0, 800.0, 60.0, 850000, 
        800000, 200000, 0, 0, 0, 0, 0, 0, 0, 0, None, None, None, None, 
        today + timedelta(hours=2)
    ))
    
    cursor.execute(insert_sql, (
        "hash3", "SELECT * FROM gold.daily_sales_summary WHERE date = $1", 
        "SELECT * FROM gold.daily_sales_summary WHERE date = $1", 
        3200, 192000.0, 60.0, 40.0, 200.0, 25.0, 320000, 
        300000, 50000, 0, 0, 0, 0, 0, 0, 0, 0, None, None, None, None, 
        today + timedelta(hours=3)
    ))
    
    # Insert yesterday's data
    cursor.execute(insert_sql, (
        "hash1", "SELECT * FROM silver.customers WHERE customer_id = $1", 
        "SELECT * FROM silver.customers WHERE customer_id = $1", 
        13500, 1350000.0, 100.0, 50.0, 500.0, 45.0, 1350000, 
        900000, 450000, 0, 0, 0, 0, 0, 0, 0, 0, None, None, None, None, 
        yesterday + timedelta(hours=1)
    ))
    
    cursor.execute(insert_sql, (
        "hash2", "SELECT COUNT(*) FROM silver.orders WHERE order_date >= $1", 
        "SELECT COUNT(*) FROM silver.orders WHERE order_date >= $1", 
        7800, 1170000.0, 150.0, 75.0, 800.0, 60.0, 780000, 
        750000, 180000, 0, 0, 0, 0, 0, 0, 0, 0, None, None, None, None, 
        yesterday + timedelta(hours=2)
    ))
    conn.commit()
    
    print(f"[OK] Inserted {len(sample_queries_today)} query log records for today")
    print(f"[OK] Inserted {len(sample_queries_yesterday)} query log records for yesterday")
    
    # Insert sample index recommendations
    sample_recommendations = [
        ('silver.customers', 'customer_id', 'index', 'high', 'applied', 23.5, 23.5, 15234, 100.0, 'CREATE INDEX idx_customers_customer_id ON silver.customers(customer_id);', today),
        ('silver.orders', 'order_date', 'index', 'high', 'applied', 18.2, 18.2, 8500, 150.0, 'CREATE INDEX idx_orders_order_date ON silver.orders(order_date);', today),
        ('gold.daily_sales_summary', 'date', 'index', 'medium', 'pending', 15.8, 15.8, 3200, 60.0, 'CREATE INDEX idx_daily_sales_date ON gold.daily_sales_summary(date);', today),
    ]
    
    insert_rec_sql = """
        INSERT INTO ml_optimization.index_recommendations
        (table_name, column_name, recommendation_type, priority, status, estimated_improvement, 
         improvement_percent, query_count, avg_execution_time_ms, sql_statement, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    cursor.executemany(insert_rec_sql, sample_recommendations)
    conn.commit()
    
    print(f"[OK] Inserted {len(sample_recommendations)} index recommendation records")
    
    # Verify data
    cursor.execute("SELECT COUNT(*) FROM ml_optimization.query_logs")
    total_logs = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM ml_optimization.index_recommendations")
    total_recs = cursor.fetchone()[0]
    
    print(f"\nTotal query logs: {total_logs}")
    print(f"Total recommendations: {total_recs}")
    print("\nSample data inserted successfully!")
    print("The dashboard should now show real data.")
    
except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
    import traceback
    traceback.print_exc()
finally:
    cursor.close()
    conn.close()

