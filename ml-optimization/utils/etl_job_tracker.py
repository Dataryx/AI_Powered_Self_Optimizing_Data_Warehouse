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
        """Ensure the etl_jobs table exists."""
        with self._get_connection() as conn:
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
            logger.info("ETL jobs table ensured")
    
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
        Start a new ETL job.
        
        Args:
            job_name: Name of the job
            job_type: Type of job (e.g., 'ingestion', 'transformation', 'aggregation')
            layer: Data warehouse layer (bronze, silver, gold)
            table_name: Target table name
            records_total: Total number of records expected
            metadata: Additional metadata as dictionary
            
        Returns:
            job_id: Unique job identifier
        """
        job_id = str(uuid.uuid4())
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO monitoring.etl_jobs 
                (job_id, job_name, job_type, status, layer, table_name, records_total, metadata, started_at, updated_at)
                VALUES (%s, %s, %s, 'running', %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, (
                job_id,
                job_name,
                job_type,
                layer,
                table_name,
                records_total,
                metadata
            ))
            conn.commit()
            logger.info(f"Started ETL job: {job_id} - {job_name}")
            return job_id
    
    def update_progress(
        self,
        job_id: str,
        progress: int,
        records_processed: Optional[int] = None
    ):
        """
        Update job progress.
        
        Args:
            job_id: Job identifier
            progress: Progress percentage (0-100)
            records_processed: Number of records processed so far
        """
        progress = max(0, min(100, progress))
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if records_processed is not None:
                cursor.execute("""
                    UPDATE monitoring.etl_jobs
                    SET progress = %s, records_processed = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE job_id = %s
                """, (progress, records_processed, job_id))
            else:
                cursor.execute("""
                    UPDATE monitoring.etl_jobs
                    SET progress = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE job_id = %s
                """, (progress, job_id))
            conn.commit()
    
    def complete_job(
        self,
        job_id: str,
        records_processed: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Mark job as completed.
        
        Args:
            job_id: Job identifier
            records_processed: Final number of records processed
            metadata: Additional metadata to update
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if records_processed is not None and metadata is not None:
                cursor.execute("""
                    UPDATE monitoring.etl_jobs
                    SET status = 'completed',
                        progress = 100,
                        records_processed = %s,
                        completed_at = CURRENT_TIMESTAMP,
                        metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE job_id = %s
                """, (records_processed, metadata, job_id))
            elif records_processed is not None:
                cursor.execute("""
                    UPDATE monitoring.etl_jobs
                    SET status = 'completed',
                        progress = 100,
                        records_processed = %s,
                        completed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE job_id = %s
                """, (records_processed, job_id))
            else:
                cursor.execute("""
                    UPDATE monitoring.etl_jobs
                    SET status = 'completed',
                        progress = 100,
                        completed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE job_id = %s
                """, (job_id,))
            conn.commit()
            logger.info(f"Completed ETL job: {job_id}")
    
    def fail_job(
        self,
        job_id: str,
        error_message: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Mark job as failed.
        
        Args:
            job_id: Job identifier
            error_message: Error message
            metadata: Additional metadata
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            if metadata:
                cursor.execute("""
                    UPDATE monitoring.etl_jobs
                    SET status = 'failed',
                        error_message = %s,
                        completed_at = CURRENT_TIMESTAMP,
                        metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE job_id = %s
                """, (error_message, metadata, job_id))
            else:
                cursor.execute("""
                    UPDATE monitoring.etl_jobs
                    SET status = 'failed',
                        error_message = %s,
                        completed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE job_id = %s
                """, (error_message, job_id))
            conn.commit()
            logger.error(f"Failed ETL job: {job_id} - {error_message}")
    
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


