"""
Monitoring Routes
API routes for ETL monitoring, pipeline status, and data quality metrics.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime, timedelta
import logging
from psycopg2.extras import RealDictCursor
from ml_optimization.utils.db_utils import get_db_connection

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/etl/jobs")
async def get_etl_jobs():
    """Get ETL job status and progress from tracking table."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check if monitoring.etl_jobs table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'monitoring' AND table_name = 'etl_jobs'
                )
            """)
            table_exists = cursor.fetchone().get('exists', False)
            
            if not table_exists:
                # Table doesn't exist, return empty or create it
                logger.warning("monitoring.etl_jobs table does not exist. Run scripts/create_etl_jobs_table.py to create it.")
                return {"jobs": [], "total": 0}
            
            # Get recent jobs (last 24 hours, limit 50)
            cursor.execute("""
                SELECT 
                    job_id,
                    job_name,
                    job_type,
                    status,
                    progress,
                    layer,
                    table_name as table,
                    started_at,
                    completed_at,
                    records_processed,
                    records_total,
                    error_message,
                    metadata
                FROM monitoring.etl_jobs
                WHERE started_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                ORDER BY started_at DESC
                LIMIT 50
            """)
            
            jobs = []
            for row in cursor.fetchall():
                job = {
                    "job_id": row.get('job_id'),
                    "job_name": row.get('job_name'),
                    "status": row.get('status', 'pending'),
                    "progress": int(row.get('progress', 0)),
                    "started_at": row.get('started_at').isoformat() if row.get('started_at') else None,
                    "completed_at": row.get('completed_at').isoformat() if row.get('completed_at') else None,
                    "records_processed": int(row.get('records_processed', 0) or 0),
                    "layer": row.get('layer'),
                    "table": row.get('table'),
                }
                jobs.append(job)
            
            return {"jobs": jobs, "total": len(jobs)}
    except Exception as e:
        logger.error(f"Error in get_etl_jobs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/etl/pipeline-dag")
async def get_pipeline_dag():
    """Get pipeline DAG visualization data."""
    try:
        # Define the ETL pipeline structure
        dag = {
            "nodes": [
                {"id": "bronze_ingest", "label": "Bronze Ingestion", "type": "source", "layer": "bronze"},
                {"id": "bronze_raw_orders", "label": "raw_orders", "type": "table", "layer": "bronze"},
                {"id": "bronze_raw_customers", "label": "raw_customers", "type": "table", "layer": "bronze"},
                {"id": "bronze_raw_products", "label": "raw_products", "type": "table", "layer": "bronze"},
                {"id": "silver_transform", "label": "Silver Transformation", "type": "transform", "layer": "silver"},
                {"id": "silver_orders", "label": "orders", "type": "table", "layer": "silver"},
                {"id": "silver_customers", "label": "customers", "type": "table", "layer": "silver"},
                {"id": "silver_products", "label": "products", "type": "table", "layer": "silver"},
                {"id": "gold_aggregate", "label": "Gold Aggregation", "type": "aggregate", "layer": "gold"},
                {"id": "gold_fact_sales", "label": "fact_sales", "type": "table", "layer": "gold"},
                {"id": "gold_dim_customer", "label": "dim_customer", "type": "table", "layer": "gold"},
                {"id": "gold_dim_product", "label": "dim_product", "type": "table", "layer": "gold"},
            ],
            "edges": [
                {"from": "bronze_ingest", "to": "bronze_raw_orders"},
                {"from": "bronze_ingest", "to": "bronze_raw_customers"},
                {"from": "bronze_ingest", "to": "bronze_raw_products"},
                {"from": "bronze_raw_orders", "to": "silver_transform"},
                {"from": "bronze_raw_customers", "to": "silver_transform"},
                {"from": "bronze_raw_products", "to": "silver_transform"},
                {"from": "silver_transform", "to": "silver_orders"},
                {"from": "silver_transform", "to": "silver_customers"},
                {"from": "silver_transform", "to": "silver_products"},
                {"from": "silver_orders", "to": "gold_aggregate"},
                {"from": "silver_customers", "to": "gold_aggregate"},
                {"from": "silver_products", "to": "gold_aggregate"},
                {"from": "gold_aggregate", "to": "gold_fact_sales"},
                {"from": "gold_aggregate", "to": "gold_dim_customer"},
                {"from": "gold_aggregate", "to": "gold_dim_product"},
            ]
        }
        
        return dag
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/etl/freshness")
async def get_data_freshness():
    """Get data freshness indicators per layer using real table data and ETL job completion times."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            freshness = {}
            
            # First, get ETL job completion times for each table (primary source of truth)
            etl_completion_times = {}
            etl_records_processed = {}
            try:
                cursor.execute("""
                    SELECT 
                        layer,
                        table_name,
                        MAX(completed_at) as last_completed,
                        SUM(records_processed) as total_records
                    FROM monitoring.etl_jobs
                    WHERE status = 'completed' AND completed_at IS NOT NULL
                    GROUP BY layer, table_name
                """)
                for row in cursor.fetchall():
                    layer = row.get('layer')
                    table_name = row.get('table_name')
                    last_completed = row.get('last_completed')
                    total_records = row.get('total_records', 0)
                    if layer and table_name and last_completed:
                        key = f"{layer}.{table_name}"
                        etl_completion_times[key] = last_completed
                        etl_records_processed[key] = int(total_records or 0)
                logger.info(f"Found {len(etl_completion_times)} tables with ETL job data")
            except Exception as etl_error:
                logger.warning(f"Could not fetch ETL completion times: {etl_error}", exc_info=True)
            
            for schema in ['bronze', 'silver', 'gold']:
                try:
                    # Start with tables from ETL jobs (most reliable)
                    etl_tables = {}
                    for key, last_completed in etl_completion_times.items():
                        if key.startswith(f"{schema}."):
                            table_name = key.replace(f"{schema}.", "")
                            etl_tables[table_name] = {
                                'last_updated': last_completed,
                                'total_records': etl_records_processed.get(key, 0)
                            }
                    
                    # Check if schema exists and get actual tables
                    cursor.execute("""
                        SELECT EXISTS (
                            SELECT 1 FROM information_schema.schemata 
                            WHERE schema_name = %s
                        )
                    """, (schema,))
                    schema_exists = cursor.fetchone().get('exists', False)
                    
                    table_names_set = set(etl_tables.keys())  # Start with ETL job tables
                    
                    if schema_exists:
                        # Get all tables in the schema
                        cursor.execute("""
                            SELECT table_name
                            FROM information_schema.tables
                            WHERE table_schema = %s
                            AND table_type = 'BASE TABLE'
                            ORDER BY table_name
                        """, (schema,))
                        
                        db_tables = [row.get('table_name') for row in cursor.fetchall()]
                        table_names_set.update(db_tables)
                        logger.info(f"Found {len(db_tables)} tables in schema {schema}: {db_tables}")
                    
                    table_names = list(table_names_set)
                    table_freshness = []
                    
                    for table_name in table_names:
                        if not table_name:
                            continue
                            
                        last_updated = None
                        total_records = 0
                        
                        # Try to get last update time from ETL jobs first (most reliable)
                        etl_key = f"{schema}.{table_name}"
                        if etl_key in etl_completion_times:
                            last_updated = etl_completion_times[etl_key]
                            if etl_key in etl_records_processed:
                                total_records = etl_records_processed[etl_key]
                        
                        # If no ETL job data, try to get max timestamp from common timestamp columns
                        if not last_updated:
                            timestamp_columns = [
                                'ingestion_timestamp',
                                'created_at',
                                'updated_at',
                                'order_date',
                                'event_timestamp',
                                'start_time',
                                'date',
                                'timestamp'
                            ]
                            
                            for col in timestamp_columns:
                                try:
                                    # Check if column exists first
                                    cursor.execute("""
                                        SELECT EXISTS (
                                            SELECT 1 FROM information_schema.columns
                                            WHERE table_schema = %s AND table_name = %s AND column_name = %s
                                        )
                                    """, (schema, table_name, col))
                                    col_exists = cursor.fetchone().get('exists', False)
                                    
                                    if col_exists:
                                        cursor.execute(f"""
                                            SELECT MAX({col}) as max_ts, COUNT(*) as row_count
                                            FROM {schema}.{table_name}
                                        """)
                                        result = cursor.fetchone()
                                        if result and result.get('max_ts'):
                                            last_updated = result.get('max_ts')
                                            total_records = int(result.get('row_count', 0) or 0)
                                            logger.debug(f"Found timestamp column {col} for {schema}.{table_name}: {last_updated}")
                                            break
                                except Exception as col_error:
                                    logger.debug(f"Error checking column {col} in {schema}.{table_name}: {col_error}")
                                    continue
                        
                        # If still no timestamp found, try to get row count and use current time minus 24h as fallback
                        if not last_updated:
                            try:
                                cursor.execute(f"SELECT COUNT(*) as row_count FROM {schema}.{table_name}")
                                result = cursor.fetchone()
                                if result:
                                    total_records = int(result.get('row_count', 0) or 0)
                                    if total_records > 0:
                                        # If table has data but no timestamp, assume it was updated recently
                                        last_updated = datetime.now() - timedelta(hours=1)
                                    else:
                                        # Empty table, use old timestamp
                                        last_updated = datetime.now() - timedelta(days=7)
                            except Exception:
                                total_records = 0
                                last_updated = datetime.now() - timedelta(days=7)
                        
                        # Calculate hours ago
                        if isinstance(last_updated, datetime):
                            hours_ago = (datetime.now() - last_updated).total_seconds() / 3600
                        elif isinstance(last_updated, str):
                            try:
                                last_updated_dt = datetime.fromisoformat(last_updated.replace('Z', '+00:00'))
                                hours_ago = (datetime.now() - last_updated_dt.replace(tzinfo=None)).total_seconds() / 3600
                            except:
                                hours_ago = 24.0
                        else:
                            hours_ago = 24.0
                        
                        # Determine freshness status
                        if hours_ago < 1:
                            status = "fresh"
                            color = "success"
                        elif hours_ago < 6:
                            status = "stale"
                            color = "warning"
                        else:
                            status = "outdated"
                            color = "error"
                        
                        # Format last_updated for display
                        if isinstance(last_updated, datetime):
                            last_updated_iso = last_updated.isoformat()
                        elif isinstance(last_updated, str):
                            last_updated_iso = last_updated
                        else:
                            last_updated_iso = None
                        
                        table_freshness.append({
                            "table": table_name,
                            "last_updated": last_updated_iso,
                            "hours_ago": round(hours_ago, 2),
                            "status": status,
                            "color": color,
                            "total_records": total_records,
                        })
                    
                    # Sort by hours_ago (most recent first)
                    table_freshness.sort(key=lambda x: x['hours_ago'])
                    
                    # Determine overall status
                    if not table_freshness:
                        overall_status = "outdated"
                    elif all(t["status"] == "fresh" for t in table_freshness[:3]):
                        overall_status = "fresh"
                    elif all(t["status"] != "outdated" for t in table_freshness[:3]):
                        overall_status = "stale"
                    else:
                        overall_status = "outdated"
                    
                    freshness[schema] = {
                        "tables": table_freshness[:10],  # Limit to top 10 most recent
                        "overall_status": overall_status,
                    }
                except Exception as schema_error:
                    logger.error(f"Error processing freshness for schema {schema}: {schema_error}", exc_info=True)
                    freshness[schema] = {
                        "tables": [],
                        "overall_status": "outdated",
                    }
            
            return {"freshness": freshness}
    except Exception as e:
        logger.error(f"Error in get_data_freshness: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/etl/errors")
async def get_etl_errors():
    """Get error and retry tracking information from ETL jobs."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            errors = []
            
            # Get failed ETL jobs (primary source of errors)
            try:
                cursor.execute("""
                    SELECT 
                        job_id,
                        job_name,
                        job_type,
                        layer,
                        table_name,
                        status,
                        error_message,
                        started_at,
                        completed_at,
                        progress,
                        records_processed
                    FROM monitoring.etl_jobs
                    WHERE status = 'failed' 
                    AND started_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
                    ORDER BY started_at DESC
                    LIMIT 50
                """)
                
                failed_jobs = cursor.fetchall()
                for job in failed_jobs:
                    error_id = job.get('job_id')
                    error_message = job.get('error_message') or 'ETL job failed'
                    table_name = job.get('table_name')
                    layer = job.get('layer')
                    
                    # Determine severity based on layer and error type
                    if layer == 'gold':
                        severity = 'critical'
                    elif layer == 'silver':
                        severity = 'high'
                    else:
                        severity = 'warning'
                    
                    # Determine error type
                    if 'timeout' in error_message.lower() or 'timeout' in error_message.lower():
                        error_type = 'timeout'
                    elif 'connection' in error_message.lower() or 'network' in error_message.lower():
                        error_type = 'connection'
                    elif 'constraint' in error_message.lower() or 'violation' in error_message.lower():
                        error_type = 'constraint_violation'
                    elif 'null' in error_message.lower() or 'missing' in error_message.lower():
                        error_type = 'data_quality'
                    else:
                        error_type = 'processing_error'
                    
                    errors.append({
                        "error_id": error_id,
                        "type": error_type,
                        "severity": severity,
                        "table": f"{layer}.{table_name}" if layer and table_name else None,
                        "message": error_message[:200],  # Truncate long messages
                        "occurred_at": job.get('started_at').isoformat() if job.get('started_at') else datetime.now().isoformat(),
                        "retry_count": 0,  # Could track retries if we add that field
                        "status": "active",
                        "job_name": job.get('job_name'),
                        "progress": job.get('progress', 0),
                    })
                
                logger.info(f"Found {len(failed_jobs)} failed ETL jobs")
            except Exception as etl_error:
                logger.warning(f"Could not fetch ETL job errors: {etl_error}", exc_info=True)
            
            # Also check for tables with no recent updates (potential issues)
            for schema in ['bronze', 'silver', 'gold']:
                try:
                    cursor.execute("""
                        SELECT tablename
                        FROM information_schema.tables
                        WHERE table_schema = %s
                        AND table_type = 'BASE TABLE'
                    """, (schema,))
                    
                    all_tables = cursor.fetchall()
                    
                    # Check if tables exist but have no data
                    for table in all_tables[:5]:  # Limit to avoid too many errors
                        tablename = table.get('tablename')
                        try:
                            cursor.execute(f"SELECT COUNT(*) as cnt FROM {schema}.{tablename}")
                            result = cursor.fetchone()
                            row_count = result.get('cnt', 0) if result else 0
                            
                            # Check if table should have data but doesn't (based on ETL jobs)
                            cursor.execute("""
                                SELECT COUNT(*) as job_count
                                FROM monitoring.etl_jobs
                                WHERE layer = %s AND table_name = %s AND status = 'completed'
                            """, (schema, tablename))
                            job_result = cursor.fetchone()
                            has_completed_jobs = (job_result.get('job_count', 0) or 0) > 0 if job_result else False
                            
                            if has_completed_jobs and row_count == 0:
                                errors.append({
                                    "error_id": f"{schema}_{tablename}_empty",
                                    "type": "empty_table",
                                    "severity": "warning",
                                    "table": f"{schema}.{tablename}",
                                    "message": f"Table {tablename} in {schema} layer has no data despite completed ETL jobs",
                                    "occurred_at": datetime.now().isoformat(),
                                    "retry_count": 0,
                                    "status": "active",
                                })
                        except Exception:
                            continue
                except Exception as schema_error:
                    logger.error(f"Error processing errors for schema {schema}: {schema_error}")
                    continue
            
            return {
                "errors": errors,
                "total": len(errors),
                "active": len([e for e in errors if e.get("status") == "active"]),
                "timestamp": datetime.now().isoformat(),
            }
    except Exception as e:
        logger.error(f"Error in get_etl_errors: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/etl/throughput")
async def get_throughput_metrics():
    """Get throughput metrics (records/second) based on ETL job performance."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            throughput_data = []
            
            # Get throughput from ETL jobs (most accurate)
            try:
                cursor.execute("""
                    SELECT 
                        layer,
                        table_name,
                        records_processed,
                        started_at,
                        completed_at,
                        EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
                    FROM monitoring.etl_jobs
                    WHERE status = 'completed' 
                    AND completed_at IS NOT NULL 
                    AND started_at IS NOT NULL
                    AND records_processed > 0
                    AND completed_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                    ORDER BY completed_at DESC
                """)
                
                job_throughput = {}
                for row in cursor.fetchall():
                    layer = row.get('layer')
                    table_name = row.get('table_name')
                    records = int(row.get('records_processed', 0) or 0)
                    duration = float(row.get('duration_seconds', 0) or 0)
                    
                    if not layer or not table_name or records == 0 or duration == 0:
                        continue
                    
                    table_key = f"{layer}.{table_name}"
                    records_per_second = records / duration if duration > 0 else 0
                    
                    # Keep the highest throughput for each table
                    if table_key not in job_throughput or records_per_second > job_throughput[table_key]['records_per_second']:
                        job_throughput[table_key] = {
                            "table": table_key,
                            "layer": layer,
                            "records_per_second": round(records_per_second, 2),
                            "total_records": records,
                            "total_operations": records,
                            "duration_seconds": round(duration, 2),
                        }
                
                throughput_data = list(job_throughput.values())
                logger.info(f"Found {len(throughput_data)} tables with ETL job throughput data")
            except Exception as etl_error:
                logger.warning(f"Could not fetch ETL job throughput: {etl_error}", exc_info=True)
            
            # Fallback to pg_stat_user_tables if no ETL data
            if not throughput_data:
                for schema in ['bronze', 'silver', 'gold']:
                    try:
                        cursor.execute("""
                            SELECT 
                                tablename,
                                COALESCE(n_tup_ins, 0) as total_inserts,
                                COALESCE(n_tup_upd, 0) as total_updates,
                                COALESCE(n_live_tup, 0) as live_tuples
                            FROM pg_stat_user_tables
                            WHERE schemaname = %s
                            ORDER BY COALESCE(n_tup_ins, 0) DESC
                            LIMIT 5
                        """, (schema,))
                        
                        tables = cursor.fetchall()
                        
                        for table in tables:
                            total_inserts = table.get('total_inserts', 0) or 0
                            total_updates = table.get('total_updates', 0) or 0
                            total_ops = total_inserts + total_updates
                            # Estimate throughput (assuming 1 hour window)
                            estimated_throughput = total_ops / 3600 if total_ops > 0 else 0
                            
                            throughput_data.append({
                                "table": f"{schema}.{table.get('tablename', 'unknown')}",
                                "layer": schema,
                                "records_per_second": round(estimated_throughput, 2),
                                "total_records": table.get('live_tuples', 0) or 0,
                                "total_operations": total_ops,
                                "duration_seconds": 3600,  # Estimated
                            })
                    except Exception as schema_error:
                        logger.error(f"Error processing throughput for schema {schema}: {schema_error}")
                        continue
            
            # Sort by throughput (highest first)
            throughput_data.sort(key=lambda x: x['records_per_second'], reverse=True)
            
            # Calculate overall throughput
            total_throughput = sum(t["records_per_second"] for t in throughput_data)
            
            return {
                "throughput": throughput_data[:10],  # Top 10
                "overall_throughput": round(total_throughput, 2),
                "timestamp": datetime.now().isoformat(),
            }
    except Exception as e:
        logger.error(f"Error in get_throughput_metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-quality")
async def get_data_quality_metrics():
    """Get data quality metrics per pipeline stage using real table data and ETL job success rates."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            quality_metrics = {}
            
            # Get ETL job success rates per table
            etl_success_rates = {}
            try:
                cursor.execute("""
                    SELECT 
                        layer,
                        table_name,
                        COUNT(*) as total_jobs,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_jobs,
                        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs
                    FROM monitoring.etl_jobs
                    WHERE started_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
                    GROUP BY layer, table_name
                """)
                
                for row in cursor.fetchall():
                    layer = row.get('layer')
                    table_name = row.get('table_name')
                    total = int(row.get('total_jobs', 0) or 0)
                    successful = int(row.get('successful_jobs', 0) or 0)
                    
                    if layer and table_name and total > 0:
                        key = f"{layer}.{table_name}"
                        success_rate = (successful / total) * 100
                        etl_success_rates[key] = success_rate
            except Exception as etl_error:
                logger.warning(f"Could not fetch ETL success rates: {etl_error}")
            
            for schema in ['bronze', 'silver', 'gold']:
                try:
                    # Get tables from information_schema first
                    cursor.execute("""
                        SELECT table_name
                        FROM information_schema.tables
                        WHERE table_schema = %s
                        AND table_type = 'BASE TABLE'
                        ORDER BY table_name
                        LIMIT 10
                    """, (schema,))
                    
                    table_names = [row.get('table_name') for row in cursor.fetchall()]
                    
                    # If no tables in schema, try to get from ETL jobs
                    if not table_names:
                        cursor.execute("""
                            SELECT DISTINCT table_name
                            FROM monitoring.etl_jobs
                            WHERE layer = %s
                            LIMIT 10
                        """, (schema,))
                        table_names = [row.get('table_name') for row in cursor.fetchall()]
                    
                    table_metrics = []
                    
                    for table_name in table_names:
                        if not table_name:
                            continue
                            
                        row_count = 0
                        dead_rows = 0
                        quality_score = 0
                        
                        # Try to get table statistics
                        try:
                            cursor.execute(f"""
                                SELECT 
                                    COUNT(*) as row_count
                                FROM {schema}.{table_name}
                            """)
                            result = cursor.fetchone()
                            row_count = int(result.get('row_count', 0) or 0) if result else 0
                            
                            # Try to get dead tuples from pg_stat_user_tables
                            cursor.execute("""
                                SELECT 
                                    COALESCE(n_live_tup, 0) as live_tup,
                                    COALESCE(n_dead_tup, 0) as dead_tup
                                FROM pg_stat_user_tables
                                WHERE schemaname = %s AND tablename = %s
                            """, (schema, table_name))
                            stat_result = cursor.fetchone()
                            if stat_result:
                                live_tup = int(stat_result.get('live_tup', 0) or 0)
                                dead_tup = int(stat_result.get('dead_tup', 0) or 0)
                                if live_tup > 0:
                                    dead_rows = dead_tup
                                    dead_row_percentage = (dead_tup / live_tup) * 100
                                    quality_score = max(0, 100 - dead_row_percentage)
                                elif row_count > 0:
                                    # Use row_count if pg_stat doesn't have data
                                    quality_score = 95  # Assume good quality if we have data
                        except Exception:
                            # If we can't query the table, use ETL success rate
                            pass
                        
                        # Factor in ETL success rate
                        table_key = f"{schema}.{table_name}"
                        if table_key in etl_success_rates:
                            etl_rate = etl_success_rates[table_key]
                            # Combine table quality (70%) with ETL success rate (30%)
                            quality_score = (quality_score * 0.7) + (etl_rate * 0.3)
                        elif row_count == 0:
                            # No data and no ETL jobs = poor quality
                            quality_score = 0
                        elif quality_score == 0 and row_count > 0:
                            # Has data but no stats = assume good quality
                            quality_score = 85
                        
                        table_metrics.append({
                            "table": table_name,
                            "row_count": row_count,
                            "dead_rows": dead_rows,
                            "quality_score": round(quality_score, 2),
                            "status": "excellent" if quality_score >= 95 else "good" if quality_score >= 80 else "fair" if quality_score >= 60 else "poor",
                        })
                    
                    # Calculate average quality for layer
                    avg_quality = sum(t["quality_score"] for t in table_metrics) / len(table_metrics) if table_metrics else 0
                    
                    quality_metrics[schema] = {
                        "tables": table_metrics,
                        "average_quality_score": round(avg_quality, 2),
                        "overall_status": "excellent" if avg_quality >= 95 else "good" if avg_quality >= 80 else "fair" if avg_quality >= 60 else "poor",
                    }
                except Exception as schema_error:
                    logger.error(f"Error processing quality metrics for schema {schema}: {schema_error}", exc_info=True)
                    quality_metrics[schema] = {
                        "tables": [],
                        "average_quality_score": 0,
                        "overall_status": "poor",
                    }
            
            return {"quality_metrics": quality_metrics}
    except Exception as e:
        logger.error(f"Error in get_data_quality_metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

