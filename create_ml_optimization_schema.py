#!/usr/bin/env python3
"""Create ml_optimization schema and tables for dashboard metrics."""

import psycopg2
import os

# Database connection
conn = psycopg2.connect(
    host=os.getenv('POSTGRES_HOST', 'localhost'),
    port=os.getenv('POSTGRES_PORT', '5432'),
    database=os.getenv('POSTGRES_DB', 'datawarehouse'),
    user=os.getenv('POSTGRES_USER', 'postgres'),
    password=os.getenv('POSTGRES_PASSWORD', 'postgres')
)

cursor = conn.cursor()

print("Creating ml_optimization schema and tables...")

try:
    # Create schema
    cursor.execute("CREATE SCHEMA IF NOT EXISTS ml_optimization")
    conn.commit()
    print("[OK] Schema ml_optimization created")
    
    # Create query_logs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ml_optimization.query_logs (
            log_id BIGSERIAL PRIMARY KEY,
            query_hash VARCHAR(64),
            query_text TEXT,
            query_template TEXT,
            calls BIGINT,
            total_exec_time_ms NUMERIC(15, 3),
            mean_exec_time_ms NUMERIC(15, 3),
            min_exec_time_ms NUMERIC(15, 3),
            max_exec_time_ms NUMERIC(15, 3),
            stddev_exec_time_ms NUMERIC(15, 3),
            rows_affected BIGINT,
            shared_blks_hit BIGINT,
            shared_blks_read BIGINT,
            shared_blks_dirtied BIGINT,
            shared_blks_written BIGINT,
            local_blks_hit BIGINT,
            local_blks_read BIGINT,
            local_blks_dirtied BIGINT,
            local_blks_written BIGINT,
            temp_blks_read BIGINT,
            temp_blks_written BIGINT,
            blk_read_time_ms NUMERIC(15, 3),
            blk_write_time_ms NUMERIC(15, 3),
            query_plan JSONB,
            extracted_features JSONB,
            collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    print("[OK] Table query_logs created")
    
    # Create index_recommendations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ml_optimization.index_recommendations (
            recommendation_id BIGSERIAL PRIMARY KEY,
            table_name VARCHAR(255) NOT NULL,
            column_name VARCHAR(255),
            recommendation_type VARCHAR(50),
            priority VARCHAR(20),
            status VARCHAR(20) DEFAULT 'pending',
            estimated_improvement NUMERIC(10, 2),
            improvement_percent NUMERIC(10, 2),
            query_count INTEGER,
            avg_execution_time_ms NUMERIC(15, 3),
            sql_statement TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    print("[OK] Table index_recommendations created")
    
    # Create indexes
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_query_logs_collected_at 
        ON ml_optimization.query_logs(collected_at)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_index_recommendations_status 
        ON ml_optimization.index_recommendations(status)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_index_recommendations_created_at 
        ON ml_optimization.index_recommendations(created_at)
    """)
    conn.commit()
    print("[OK] Indexes created")
    
    print("\nSchema and tables created successfully!")
    print("\nNote: Tables are empty. To populate data:")
    print("  1. Run: python scripts/ml-optimization/run_query_collection.py")
    print("  2. Run: python scripts/ml-optimization/generate_recommendations.py")
    
except Exception as e:
    print(f"Error: {e}")
    conn.rollback()
finally:
    cursor.close()
    conn.close()

