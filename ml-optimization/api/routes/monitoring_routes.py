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
    """Get ETL job status and progress."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Get ETL job information from system tables or create mock data based on actual tables
            # For now, we'll query table statistics to infer ETL activity
            jobs = []
            
            # Check last update times for each layer
            for schema in ['bronze', 'silver', 'gold']:
                try:
                    cursor.execute("""
                        SELECT 
                            tablename,
                            COALESCE(n_tup_ins, 0) as inserts,
                            COALESCE(n_tup_upd, 0) as updates,
                            COALESCE(n_tup_del, 0) as deletes,
                            last_vacuum,
                            last_autovacuum,
                            last_analyze,
                            last_autoanalyze
                        FROM pg_stat_user_tables
                        WHERE schemaname = %s
                        ORDER BY COALESCE(last_autoanalyze, last_autovacuum, last_vacuum, '1970-01-01'::timestamp) DESC NULLS LAST
                        LIMIT 5
                    """, (schema,))
                    
                    tables = cursor.fetchall()
                    for table in tables:
                        # Get last activity from any of the timestamp columns
                        last_activity = table.get('last_autoanalyze') or table.get('last_autovacuum') or table.get('last_vacuum')
                        if isinstance(last_activity, datetime):
                            pass
                        elif last_activity is None:
                            last_activity = datetime.now() - timedelta(hours=1)
                        else:
                            last_activity = datetime.now() - timedelta(hours=1)
                        
                        # Calculate progress based on recent activity
                        inserts = table.get('inserts', 0) or 0
                        updates = table.get('updates', 0) or 0
                        deletes = table.get('deletes', 0) or 0
                        total_changes = inserts + updates + deletes
                        
                        tablename = table.get('tablename', 'unknown')
                        
                        jobs.append({
                            "job_id": f"{schema}_{tablename}",
                            "job_name": f"{schema.upper()} - {tablename}",
                            "status": "completed" if last_activity else "running",
                            "progress": 100 if last_activity and isinstance(last_activity, datetime) else 75,
                            "started_at": (last_activity - timedelta(minutes=30)).isoformat() if last_activity and isinstance(last_activity, datetime) else datetime.now().isoformat(),
                            "completed_at": last_activity.isoformat() if last_activity and isinstance(last_activity, datetime) else None,
                            "records_processed": total_changes,
                            "layer": schema,
                            "table": tablename,
                        })
                except Exception as schema_error:
                    # Skip this schema if there's an error (e.g., schema doesn't exist)
                    logger.error(f"Error processing schema {schema}: {schema_error}")
                    continue
            
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
    """Get data freshness indicators per layer."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            freshness = {}
            
            for schema in ['bronze', 'silver', 'gold']:
                try:
                    # Get most recent activity for each table
                    cursor.execute("""
                        SELECT 
                            tablename,
                            last_autoanalyze,
                            last_autovacuum,
                            COALESCE(n_tup_ins, 0) as total_inserts,
                            COALESCE(n_tup_upd, 0) as total_updates
                        FROM pg_stat_user_tables
                        WHERE schemaname = %s
                        ORDER BY COALESCE(last_autoanalyze, last_autovacuum, '1970-01-01'::timestamp) DESC
                        LIMIT 10
                    """, (schema,))
                    
                    tables = cursor.fetchall()
                    table_freshness = []
                    
                    for table in tables:
                        last_activity = table.get('last_autoanalyze') or table.get('last_autovacuum')
                        if not last_activity or not isinstance(last_activity, datetime):
                            last_activity = datetime.now() - timedelta(hours=24)
                        
                        hours_ago = (datetime.now() - last_activity).total_seconds() / 3600 if isinstance(last_activity, datetime) else 24.0
                        
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
                        
                        table_freshness.append({
                            "table": table.get('tablename', 'unknown'),
                            "last_updated": last_activity.isoformat() if isinstance(last_activity, datetime) else None,
                            "hours_ago": round(hours_ago, 2),
                            "status": status,
                            "color": color,
                            "total_records": table.get('total_inserts', 0) or 0,
                        })
                    
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
                        "tables": table_freshness,
                        "overall_status": overall_status,
                    }
                except Exception as schema_error:
                    logger.error(f"Error processing freshness for schema {schema}: {schema_error}")
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
    """Get error and retry tracking information."""
    try:
        # Check for common data quality issues
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            errors = []
            
            # Check for tables with no data (potential ETL failures)
            for schema in ['bronze', 'silver', 'gold']:
                try:
                    cursor.execute("""
                        SELECT tablename, COALESCE(n_tup_ins, 0) as n_tup_ins, COALESCE(n_tup_upd, 0) as n_tup_upd, COALESCE(n_tup_del, 0) as n_tup_del
                        FROM pg_stat_user_tables
                        WHERE schemaname = %s AND COALESCE(n_tup_ins, 0) = 0
                    """, (schema,))
                    
                    empty_tables = cursor.fetchall()
                    for table in empty_tables:
                        tablename = table.get('tablename', 'unknown')
                        errors.append({
                            "error_id": f"{schema}_{tablename}_empty",
                            "type": "empty_table",
                            "severity": "warning",
                            "table": f"{schema}.{tablename}",
                            "message": f"Table {tablename} in {schema} layer has no data",
                            "occurred_at": datetime.now().isoformat(),
                            "retry_count": 0,
                            "status": "active",
                        })
                except Exception as schema_error:
                    logger.error(f"Error processing errors for schema {schema}: {schema_error}")
                    continue
            
            # Check for constraint violations (would need logging table)
            # For now, return the errors we found
            return {
                "errors": errors,
                "total": len(errors),
                "active": len([e for e in errors if e["status"] == "active"]),
            }
    except Exception as e:
        logger.error(f"Error in get_etl_errors: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/etl/throughput")
async def get_throughput_metrics():
    """Get throughput metrics (records/second)."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Calculate throughput based on recent insertions
            throughput_data = []
            
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
                        # Estimate throughput (assuming 1 hour window for simplicity)
                        total_inserts = table.get('total_inserts', 0) or 0
                        total_updates = table.get('total_updates', 0) or 0
                        total_ops = total_inserts + total_updates
                        estimated_throughput = total_ops / 3600 if total_ops > 0 else 0
                        
                        throughput_data.append({
                            "table": f"{schema}.{table.get('tablename', 'unknown')}",
                            "layer": schema,
                            "records_per_second": round(estimated_throughput, 2),
                            "total_records": table.get('live_tuples', 0) or 0,
                            "total_operations": total_ops,
                        })
                except Exception as schema_error:
                    logger.error(f"Error processing throughput for schema {schema}: {schema_error}")
                    continue
            
            # Calculate overall throughput
            total_throughput = sum(t["records_per_second"] for t in throughput_data)
            
            return {
                "throughput": throughput_data,
                "overall_throughput": round(total_throughput, 2),
                "timestamp": datetime.now().isoformat(),
            }
    except Exception as e:
        logger.error(f"Error in get_throughput_metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-quality")
async def get_data_quality_metrics():
    """Get data quality metrics per pipeline stage."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            quality_metrics = {}
            
            for schema in ['bronze', 'silver', 'gold']:
                try:
                    # Get table statistics to infer data quality
                    cursor.execute("""
                        SELECT 
                            tablename,
                            COALESCE(n_live_tup, 0) as row_count,
                            COALESCE(n_dead_tup, 0) as dead_rows,
                            last_vacuum,
                            last_autovacuum
                        FROM pg_stat_user_tables
                        WHERE schemaname = %s
                        LIMIT 10
                    """, (schema,))
                    
                    tables = cursor.fetchall()
                    table_metrics = []
                    
                    for table in tables:
                        row_count = table.get('row_count', 0) or 0
                        dead_rows = table.get('dead_rows', 0) or 0
                        
                        # Calculate quality score
                        if row_count > 0:
                            dead_row_percentage = (dead_rows / row_count) * 100
                            quality_score = max(0, 100 - dead_row_percentage)
                        else:
                            quality_score = 0
                        
                        table_metrics.append({
                            "table": table.get('tablename', 'unknown'),
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
                    logger.error(f"Error processing quality metrics for schema {schema}: {schema_error}")
                    quality_metrics[schema] = {
                        "tables": [],
                        "average_quality_score": 0,
                        "overall_status": "poor",
                    }
            
            return {"quality_metrics": quality_metrics}
    except Exception as e:
        logger.error(f"Error in get_data_quality_metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

