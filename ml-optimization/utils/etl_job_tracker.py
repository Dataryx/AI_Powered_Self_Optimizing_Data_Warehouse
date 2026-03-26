"""
ETL Job Tracker
Utility for tracking ETL job execution with real-time status updates.
"""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from contextlib import contextmanager
import logging
from ml_optimization.utils.db_utils import get_db_connection

logger = logging.getLogger(__name__)


class ETLJobTracker:
    """Track ETL job execution and progress."""
    
    def __init__(self, connection=None):
        """
        Initialize ETL job tracker.
        
        Args:
            connection: Optional database connection. If None, creates new connection.
        """
        self.connection = connection
        self._own_connection = connection is None
        
    def _get_connection(self):
        """Get database connection."""
        if self.connection:
            return self.connection
        return get_db_connection()
    
    def ensure_table_exists(self):
        """
        Ensure the monitoring tables for ETL job definitions and runs exist.

        - monitoring.etl_jobs: job definitions / cronjobs
          (job_id, job_name, job_type, tables, cron_pattern, active_status)
        - monitoring.job_runs: individual job execution history

        active_status: 'A' = Active (job runs automatically), 'I' = Inactive (job does not run).
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Ensure schema exists
            cursor.execute("CREATE SCHEMA IF NOT EXISTS monitoring;")

            # Job definitions table (one row per logical ETL job / cronjob)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS monitoring.etl_jobs (
                    job_id        VARCHAR(255) PRIMARY KEY,
                    job_name      VARCHAR(255) NOT NULL,
                    job_type      VARCHAR(100) NOT NULL,
                    tables        TEXT,
                    cron_pattern  VARCHAR(50),
                    active_status VARCHAR(1) DEFAULT 'A' CHECK (active_status IN ('A', 'I'))
                );
            """)

            # Backwards‑compatible evolution of existing table: add any missing required columns.
            cursor.execute("""
                ALTER TABLE monitoring.etl_jobs
                    ADD COLUMN IF NOT EXISTS job_name VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS job_type VARCHAR(100),
                    ADD COLUMN IF NOT EXISTS tables TEXT,
                    ADD COLUMN IF NOT EXISTS cron_pattern VARCHAR(50),
                    ADD COLUMN IF NOT EXISTS active_status VARCHAR(1) DEFAULT 'A';
            """)
            # Add check constraint for active_status if not present
            cursor.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'etl_jobs_active_status_check'
                          AND conrelid = 'monitoring.etl_jobs'::regclass
                    ) THEN
                        ALTER TABLE monitoring.etl_jobs
                            ADD CONSTRAINT etl_jobs_active_status_check
                            CHECK (active_status IN ('A', 'I'));
                    END IF;
                END $$;
            """)
            # Backfill NULL active_status to 'A'
            cursor.execute("""
                UPDATE monitoring.etl_jobs SET active_status = 'A' WHERE active_status IS NULL;
            """)

            # Drop legacy tracking columns so the table only has the requested shape.
            cursor.execute("""
                ALTER TABLE monitoring.etl_jobs
                    DROP COLUMN IF EXISTS status,
                    DROP COLUMN IF EXISTS progress,
                    DROP COLUMN IF EXISTS layer,
                    DROP COLUMN IF EXISTS table_name,
                    DROP COLUMN IF EXISTS started_at,
                    DROP COLUMN IF EXISTS completed_at,
                    DROP COLUMN IF EXISTS records_processed,
                    DROP COLUMN IF EXISTS records_total,
                    DROP COLUMN IF EXISTS error_message,
                    DROP COLUMN IF EXISTS metadata,
                    DROP COLUMN IF EXISTS enabled,
                    DROP COLUMN IF EXISTS description,
                    DROP COLUMN IF EXISTS last_run_status,
                    DROP COLUMN IF EXISTS last_run_at,
                    DROP COLUMN IF EXISTS created_at,
                    DROP COLUMN IF EXISTS updated_at;
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_etl_jobs_name_type
                    ON monitoring.etl_jobs (job_name, job_type);
            """)

            # Job runs table (one row per execution of a job_id)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS monitoring.job_runs (
                    run_id            VARCHAR(255) PRIMARY KEY,
                    job_id            VARCHAR(255) NOT NULL REFERENCES monitoring.etl_jobs(job_id) ON DELETE CASCADE,
                    status            VARCHAR(50) NOT NULL DEFAULT 'pending',
                    trigger_source    VARCHAR(50) NOT NULL DEFAULT 'manual',
                    progress          INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
                    layer             VARCHAR(50),
                    table_name        VARCHAR(255),
                    started_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    completed_at      TIMESTAMP,
                    records_processed BIGINT DEFAULT 0,
                    records_total     BIGINT,
                    error_message     TEXT,
                    metadata          JSONB,
                    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_job_runs_job_id
                    ON monitoring.job_runs (job_id);
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_job_runs_status_started_at
                    ON monitoring.job_runs (status, started_at DESC);
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_job_runs_layer_table_started_at
                    ON monitoring.job_runs (layer, table_name, started_at DESC);
            """)

            conn.commit()
            logger.info("ETL job definition and run history tables ensured")
    
    def start_job(
        self,
        job_name: str,
        job_type: str,
        layer: Optional[str] = None,
        table_name: Optional[str] = None,
        records_total: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Start a new ETL job run.
        
        Args:
            job_name: Name of the logical job
            job_type: Type of job (e.g., 'ingestion', 'transformation', 'aggregation')
            layer: Data warehouse layer (bronze, silver, gold)
            table_name: Target table name
            records_total: Total number of records expected
            metadata: Additional metadata as dictionary
            
        Returns:
            run_id: Unique identifier for this specific job run
        """
        run_id = str(uuid.uuid4())
        now = datetime.now()
        
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Represent affected tables as a simple string, e.g. "layer.table"
            tables_value = None
            if layer and table_name:
                tables_value = f"{layer}.{table_name}"

            # Find or create a logical job definition row
            cursor.execute(
                """
                SELECT job_id
                FROM monitoring.etl_jobs
                WHERE job_name = %s
                  AND job_type = %s
                LIMIT 1
                """,
                (job_name, job_type),
            )
            row = cursor.fetchone()
            if row:
                job_id = row[0]
            else:
                job_id = str(uuid.uuid4())
                cursor.execute(
                    """
                    INSERT INTO monitoring.etl_jobs
                        (job_id, job_name, job_type, tables, cron_pattern, active_status)
                    VALUES (%s, %s, %s, %s, NULL, 'A')
                    """,
                    (job_id, job_name, job_type, tables_value),
                )

            # Insert a new run record for this execution
            cursor.execute(
                """
                INSERT INTO monitoring.job_runs
                    (run_id, job_id, status, trigger_source, progress,
                     layer, table_name, records_total, metadata, started_at, updated_at)
                VALUES (%s, %s, 'running', 'cron', 0,
                        %s, %s, %s, %s, %s, %s)
                """,
                (run_id, job_id, layer, table_name, records_total, metadata, now, now),
            )

            # Update job definition with last run info
            cursor.execute(
                """
                UPDATE monitoring.etl_jobs
                SET last_run_status = 'running',
                    last_run_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE job_id = %s
                """,
                (job_id,),
            )

            conn.commit()
            logger.info(f"Started ETL job run: {run_id} for job {job_name}")
            return run_id
    
    def update_progress(
        self,
        job_id: str,
        progress: int,
        records_processed: Optional[int] = None
    ):
        """
        Update job run progress.
        
        Args:
            job_id: Run identifier (as returned by start_job)
            progress: Progress percentage (0-100)
            records_processed: Number of records processed so far
        """
        progress = max(0, min(100, progress))
        now = datetime.now()
        
        with self._get_connection() as conn:
            cursor = conn.cursor()

            if records_processed is not None:
                cursor.execute(
                    """
                    UPDATE monitoring.job_runs
                    SET progress = %s,
                        records_processed = %s,
                        updated_at = %s
                    WHERE run_id = %s
                    RETURNING job_id
                    """,
                    (progress, records_processed, now, job_id),
                )
            else:
                cursor.execute(
                    """
                    UPDATE monitoring.job_runs
                    SET progress = %s,
                        updated_at = %s
                    WHERE run_id = %s
                    RETURNING job_id
                    """,
                    (progress, now, job_id),
                )
            conn.commit()
    
    def complete_job(
        self,
        job_id: str,
        records_processed: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Mark job run as completed.
        
        Args:
            job_id: Run identifier (as returned by start_job)
            records_processed: Final number of records processed
            metadata: Additional metadata to update
        """
        now = datetime.now()
        with self._get_connection() as conn:
            cursor = conn.cursor()

            if records_processed is not None and metadata is not None:
                cursor.execute(
                    """
                    UPDATE monitoring.job_runs
                    SET status = 'completed',
                        progress = 100,
                        records_processed = %s,
                        completed_at = %s,
                        metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb,
                        updated_at = %s
                    WHERE run_id = %s
                    """,
                    (records_processed, now, metadata, now, job_id),
                )
            elif records_processed is not None:
                cursor.execute(
                    """
                    UPDATE monitoring.job_runs
                    SET status = 'completed',
                        progress = 100,
                        records_processed = %s,
                        completed_at = %s,
                        updated_at = %s
                    WHERE run_id = %s
                    """,
                    (records_processed, now, now, job_id),
                )
            else:
                cursor.execute(
                    """
                    UPDATE monitoring.job_runs
                    SET status = 'completed',
                        progress = 100,
                        completed_at = %s,
                        updated_at = %s
                    WHERE run_id = %s
                    """,
                    (now, now, job_id),
                )

            conn.commit()
            logger.info(f"Completed ETL job run: {job_id}")
    
    def fail_job(
        self,
        job_id: str,
        error_message: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Mark job run as failed.

        Always opens a new connection so a closed or broken ETL session connection
        cannot block updating monitoring.job_runs (avoids stuck status='running').
        
        Args:
            job_id: Run identifier (as returned by start_job)
            error_message: Error message
            metadata: Additional metadata
        """
        now = datetime.now()
        with get_db_connection() as conn:
            cursor = conn.cursor()

            if metadata:
                cursor.execute(
                    """
                    UPDATE monitoring.job_runs
                    SET status = 'failed',
                        error_message = %s,
                        completed_at = %s,
                        metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb,
                        updated_at = %s
                    WHERE run_id = %s
                    """,
                    (error_message, now, metadata, now, job_id),
                )
            else:
                cursor.execute(
                    """
                    UPDATE monitoring.job_runs
                    SET status = 'failed',
                        error_message = %s,
                        completed_at = %s,
                        updated_at = %s
                    WHERE run_id = %s
                    """,
                    (error_message, now, now, job_id),
                )

            logger.error(f"Failed ETL job run: {job_id} - {error_message}")
    
    @contextmanager
    def track_job(
        self,
        job_name: str,
        job_type: str,
        layer: Optional[str] = None,
        table_name: Optional[str] = None,
        records_total: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Context manager for tracking an ETL job.
        
        Usage:
            with tracker.track_job("Transform Orders", "transformation", "silver", "orders") as job:
                # Do ETL work
                tracker.update_progress(job.job_id, 50)
                # More work
                tracker.update_progress(job.job_id, 100)
        """
        job_id = self.start_job(job_name, job_type, layer, table_name, records_total, metadata)
        job = type('Job', (), {'job_id': job_id})()
        
        try:
            yield job
            self.complete_job(job_id)
        except Exception as e:
            self.fail_job(job_id, str(e))
            raise
    
    def get_active_jobs(self, limit: int = 50):
        """Get active (running) jobs."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT job_id, job_name, job_type, status, progress, layer, table_name,
                       started_at, completed_at, records_processed, records_total, error_message, metadata
                FROM monitoring.etl_jobs
                WHERE status = 'running'
                ORDER BY started_at DESC
                LIMIT %s
            """, (limit,))
            return cursor.fetchall()
    
    def get_recent_jobs(self, limit: int = 50, hours: int = 24):
        """Get recent jobs from the last N hours."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT job_id, job_name, job_type, status, progress, layer, table_name,
                       started_at, completed_at, records_processed, records_total, error_message, metadata
                FROM monitoring.etl_jobs
                WHERE started_at >= CURRENT_TIMESTAMP - INTERVAL '%s hours'
                ORDER BY started_at DESC
                LIMIT %s
            """, (hours, limit))
            return cursor.fetchall()


