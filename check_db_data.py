#!/usr/bin/env python3
"""Check database tables for dashboard metrics data."""

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

print("=" * 60)
print("Checking Database Tables for Dashboard Metrics")
print("=" * 60)
print()

# Check all schemas
try:
    cursor.execute("""
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        ORDER BY schema_name
    """)
    schemas = cursor.fetchall()
    print("Available schemas:")
    for schema in schemas:
        print(f"  - {schema[0]}")
    print()
except Exception as e:
    print(f"Error checking schemas: {e}")
    print()

# Check if tables exist in ml_optimization
try:
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'ml_optimization' 
        ORDER BY table_name
    """)
    tables = cursor.fetchall()
    if tables:
        print("Tables in ml_optimization schema:")
        for table in tables:
            print(f"  - {table[0]}")
    else:
        print("No tables found in ml_optimization schema")
    print()
except Exception as e:
    print(f"Error checking ml_optimization tables: {e}")
    print()

# Check all tables that might be related
try:
    cursor.execute("""
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_name LIKE '%query%' OR table_name LIKE '%log%' OR table_name LIKE '%recommendation%' OR table_name LIKE '%optimization%'
        ORDER BY table_schema, table_name
    """)
    related_tables = cursor.fetchall()
    if related_tables:
        print("Related tables (query/log/recommendation/optimization):")
        for schema, table in related_tables:
            print(f"  - {schema}.{table}")
    else:
        print("No related tables found")
    print()
except Exception as e:
    print(f"Error checking related tables: {e}")
    print()

# Check query_logs
try:
    cursor.execute("SELECT COUNT(*) FROM ml_optimization.query_logs")
    total_rows = cursor.fetchone()[0]
    print(f"Total rows in query_logs: {total_rows}")
    
    if total_rows > 0:
        cursor.execute("""
            SELECT MIN(collected_at), MAX(collected_at), 
                   SUM(calls), AVG(mean_exec_time_ms)
            FROM ml_optimization.query_logs
        """)
        stats = cursor.fetchone()
        print(f"  Date range: {stats[0]} to {stats[1]}")
        print(f"  Total calls: {stats[2] or 0}")
        print(f"  Avg response time: {stats[3] or 0:.2f}ms")
        
        # Check today's data
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        cursor.execute("""
            SELECT COUNT(*), SUM(calls), AVG(mean_exec_time_ms)
            FROM ml_optimization.query_logs
            WHERE collected_at >= %s
        """, (today_start,))
        today_stats = cursor.fetchone()
        print(f"  Today's rows: {today_stats[0]}")
        print(f"  Today's calls: {today_stats[1] or 0}")
        print(f"  Today's avg response: {today_stats[2] or 0:.2f}ms")
    print()
except Exception as e:
    print(f"Error checking query_logs: {e}")
    print()

# Check index_recommendations
try:
    cursor.execute("SELECT COUNT(*) FROM ml_optimization.index_recommendations")
    total_rows = cursor.fetchone()[0]
    print(f"Total rows in index_recommendations: {total_rows}")
    
    if total_rows > 0:
        cursor.execute("""
            SELECT status, COUNT(*), AVG(improvement_percent), AVG(estimated_improvement)
            FROM ml_optimization.index_recommendations
            GROUP BY status
        """)
        status_stats = cursor.fetchall()
        print("  Status breakdown:")
        for status, count, avg_imp, avg_est in status_stats:
            print(f"    {status}: {count} rows, avg improvement: {avg_imp or avg_est or 0:.2f}%")
    print()
except Exception as e:
    print(f"Error checking index_recommendations: {e}")
    print()

cursor.close()
conn.close()

print("=" * 60)

