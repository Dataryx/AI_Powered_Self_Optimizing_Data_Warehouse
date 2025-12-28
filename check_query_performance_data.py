#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Check query performance data in database."""

import psycopg2
from datetime import datetime, timedelta
import os

def check_data():
    conn = psycopg2.connect(
        host=os.getenv('POSTGRES_HOST', 'localhost'),
        port=os.getenv('POSTGRES_PORT', '5432'),
        database=os.getenv('POSTGRES_DB', 'datawarehouse'),
        user=os.getenv('POSTGRES_USER', 'postgres'),
        password=os.getenv('POSTGRES_PASSWORD', 'postgres')
    )
    cur = conn.cursor()
    
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get hourly aggregated query performance
    cur.execute("""
        SELECT 
            DATE_TRUNC('hour', collected_at) as hour,
            COUNT(*) as count,
            SUM(calls) as total_calls,
            AVG(mean_exec_time_ms) as avg_time,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mean_exec_time_ms) as p50,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY mean_exec_time_ms) as p95,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY mean_exec_time_ms) as p99
        FROM ml_optimization.query_logs
        WHERE collected_at >= %s
        GROUP BY hour
        ORDER BY hour DESC
        LIMIT 24
    """, (today,))
    
    results = cur.fetchall()
    print("Hourly Query Performance Data (last 24 hours):")
    print("-" * 80)
    for r in results[:10]:
        print(f"Hour: {r[0]}")
        print(f"  Count: {r[1]}, Total Calls: {r[2]}")
        print(f"  Avg: {r[3]:.2f}ms, P50: {r[4]:.2f}ms, P95: {r[5]:.2f}ms, P99: {r[6]:.2f}ms")
        print()
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_data()

