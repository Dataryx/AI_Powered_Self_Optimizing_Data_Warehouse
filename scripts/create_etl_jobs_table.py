"""
Create ETL Jobs Tracking Table
Run this script to create the monitoring.etl_jobs table.
"""

import psycopg2
import os
from pathlib import Path

def create_etl_jobs_table():
    """Create the monitoring.etl_jobs table."""
    conn = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres")
    )
    
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE SCHEMA IF NOT EXISTS monitoring;
            
            CREATE TABLE IF NOT EXISTS monitoring.etl_jobs (
                job_id VARCHAR(255) PRIMARY KEY,
                job_name VARCHAR(255) NOT NULL,
                job_type VARCHAR(100) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
                layer VARCHAR(50),
                table_name VARCHAR(255),
                started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                records_processed BIGINT DEFAULT 0,
                records_total BIGINT,
                error_message TEXT,
                metadata JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_etl_jobs_status ON monitoring.etl_jobs(status);
            CREATE INDEX IF NOT EXISTS idx_etl_jobs_layer ON monitoring.etl_jobs(layer);
            CREATE INDEX IF NOT EXISTS idx_etl_jobs_started_at ON monitoring.etl_jobs(started_at DESC);
            CREATE INDEX IF NOT EXISTS idx_etl_jobs_updated_at ON monitoring.etl_jobs(updated_at DESC);
        """)
        conn.commit()
        print("[OK] ETL jobs table created successfully!")
    except Exception as e:
        print(f"[ERROR] Error creating table: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    print("Creating ETL jobs tracking table...")
    create_etl_jobs_table()
