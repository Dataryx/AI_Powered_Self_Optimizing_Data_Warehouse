"""
Create Sample ETL Jobs
Creates sample ETL jobs to demonstrate real-time tracking.
"""

import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
import time
import random

# Add parent directory to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from ml_optimization.utils.etl_job_tracker import ETLJobTracker
except ImportError:
    # Fallback: direct database connection
    import psycopg2
    import uuid
    
    def create_sample_jobs_direct():
        """Create sample jobs directly via database."""
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            database=os.getenv("POSTGRES_DB", "datawarehouse"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "postgres")
        )
        
        cursor = conn.cursor()
        
        # Ensure table exists
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
        """)
        conn.commit()
        
        # Create sample jobs
        sample_jobs = [
            {
                "job_id": str(uuid.uuid4()),
                "job_name": "BRONZE - Raw Orders Ingestion",
                "job_type": "ingestion",
                "status": "completed",
                "progress": 100,
                "layer": "bronze",
                "table_name": "raw_orders",
                "started_at": datetime.now() - timedelta(hours=2),
                "completed_at": datetime.now() - timedelta(hours=1, minutes=45),
                "records_processed": 112501,
                "records_total": 112501,
            },
            {
                "job_id": str(uuid.uuid4()),
                "job_name": "BRONZE - Raw Customers Ingestion",
                "job_type": "ingestion",
                "status": "completed",
                "progress": 100,
                "layer": "bronze",
                "table_name": "raw_customers",
                "started_at": datetime.now() - timedelta(hours=1, minutes=50),
                "completed_at": datetime.now() - timedelta(hours=1, minutes=30),
                "records_processed": 10000,
                "records_total": 10000,
            },
            {
                "job_id": str(uuid.uuid4()),
                "job_name": "SILVER - Orders Transformation",
                "job_type": "transformation",
                "status": "completed",
                "progress": 100,
                "layer": "silver",
                "table_name": "orders",
                "started_at": datetime.now() - timedelta(hours=1, minutes=20),
                "completed_at": datetime.now() - timedelta(minutes=50),
                "records_processed": 112501,
                "records_total": 112501,
            },
            {
                "job_id": str(uuid.uuid4()),
                "job_name": "SILVER - Customers Transformation",
                "job_type": "transformation",
                "status": "completed",
                "progress": 100,
                "layer": "silver",
                "table_name": "customers",
                "started_at": datetime.now() - timedelta(minutes=45),
                "completed_at": datetime.now() - timedelta(minutes=30),
                "records_processed": 10000,
                "records_total": 10000,
            },
            {
                "job_id": str(uuid.uuid4()),
                "job_name": "GOLD - Daily Sales Aggregation",
                "job_type": "aggregation",
                "status": "completed",
                "progress": 100,
                "layer": "gold",
                "table_name": "daily_sales_summary",
                "started_at": datetime.now() - timedelta(minutes=25),
                "completed_at": datetime.now() - timedelta(minutes=15),
                "records_processed": 30,
                "records_total": 30,
            },
            {
                "job_id": str(uuid.uuid4()),
                "job_name": "GOLD - Customer 360 Aggregation",
                "job_type": "aggregation",
                "status": "running",
                "progress": 75,
                "layer": "gold",
                "table_name": "customer_360",
                "started_at": datetime.now() - timedelta(minutes=10),
                "completed_at": None,
                "records_processed": 7500,
                "records_total": 10000,
            },
        ]
        
        for job in sample_jobs:
            cursor.execute("""
                INSERT INTO monitoring.etl_jobs 
                (job_id, job_name, job_type, status, progress, layer, table_name,
                 started_at, completed_at, records_processed, records_total, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (job_id) DO NOTHING
            """, (
                job["job_id"],
                job["job_name"],
                job["job_type"],
                job["status"],
                job["progress"],
                job["layer"],
                job["table_name"],
                job["started_at"],
                job["completed_at"],
                job["records_processed"],
                job["records_total"],
            ))
        
        conn.commit()
        print(f"[OK] Created {len(sample_jobs)} sample ETL jobs")
        print(f"  - 5 completed jobs")
        print(f"  - 1 running job (75% progress)")
        conn.close()
    
    create_sample_jobs_direct()
else:
    # Use the tracker
    def create_sample_jobs():
        """Create sample ETL jobs using the tracker."""
        tracker = ETLJobTracker()
        tracker.ensure_table_exists()
        
        # Create completed jobs
        jobs = []
        
        # Completed jobs
        job1 = tracker.start_job(
            "BRONZE - Raw Orders Ingestion",
            "ingestion",
            "bronze",
            "raw_orders",
            112501
        )
        tracker.update_progress(job1, 100, 112501)
        tracker.complete_job(job1, 112501)
        jobs.append(job1)
        
        job2 = tracker.start_job(
            "SILVER - Orders Transformation",
            "transformation",
            "silver",
            "orders",
            112501
        )
        tracker.update_progress(job2, 100, 112501)
        tracker.complete_job(job2, 112501)
        jobs.append(job2)
        
        job3 = tracker.start_job(
            "GOLD - Daily Sales Aggregation",
            "aggregation",
            "gold",
            "daily_sales_summary",
            30
        )
        tracker.update_progress(job3, 100, 30)
        tracker.complete_job(job3, 30)
        jobs.append(job3)
        
        # Running job
        job4 = tracker.start_job(
            "GOLD - Customer 360 Aggregation",
            "aggregation",
            "gold",
            "customer_360",
            10000
        )
        tracker.update_progress(job4, 75, 7500)
        jobs.append(job4)
        
        print(f"[OK] Created {len(jobs)} sample ETL jobs")
        print(f"  - 3 completed jobs")
        print(f"  - 1 running job (75% progress)")
    
    create_sample_jobs()


