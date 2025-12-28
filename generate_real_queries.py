#!/usr/bin/env python3
"""Execute real queries to generate pg_stat_statements data."""

import psycopg2
import os
import time
from datetime import datetime

# Database connection
conn = psycopg2.connect(
    host=os.getenv('POSTGRES_HOST', 'localhost'),
    port=os.getenv('POSTGRES_PORT', '5432'),
    database=os.getenv('POSTGRES_DB', 'datawarehouse'),
    user=os.getenv('POSTGRES_USER', 'postgres'),
    password=os.getenv('POSTGRES_PASSWORD', 'postgres')
)

cursor = conn.cursor()

print("Executing real queries to generate statistics...")

# Execute various queries that will be tracked by pg_stat_statements
queries = [
    "SELECT version()",
    "SELECT current_database()",
    "SELECT current_user",
    "SELECT NOW()",
    "SELECT COUNT(*) FROM information_schema.tables",
    "SELECT COUNT(*) FROM information_schema.columns",
    "SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'ml_optimization'",
    "SELECT COUNT(*) FROM ml_optimization.query_logs",
    "SELECT COUNT(*) FROM ml_optimization.index_recommendations",
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 10",
    "SELECT COUNT(*) FROM pg_stat_statements",
    "SELECT datname FROM pg_database",
    "SELECT COUNT(*) FROM pg_namespace",
    "SELECT COUNT(*) FROM pg_class",
    "SELECT COUNT(*) FROM pg_attribute",
]

executed = 0
for i, query in enumerate(queries, 1):
    try:
        start = time.time()
        cursor.execute(query)
        result = cursor.fetchall()
        elapsed = time.time() - start
        executed += 1
        print(f"Query {i}/{len(queries)}: {elapsed:.3f}s - {len(result)} rows")
        time.sleep(0.1)  # Small delay
    except Exception as e:
        print(f"Query {i} failed: {e}")

# Execute queries multiple times to get better statistics
print("\nExecuting queries multiple times for better statistics...")
for _ in range(50):
    for query in queries[:5]:  # Repeat first 5 queries
        try:
            cursor.execute(query)
            cursor.fetchall()
        except:
            pass
    time.sleep(0.05)

conn.close()

print(f"\nExecuted {executed} unique queries (repeated 50 times)")
print("Query statistics should now be available in pg_stat_statements")
print("Run: python scripts/ml-optimization/run_query_collection.py")

