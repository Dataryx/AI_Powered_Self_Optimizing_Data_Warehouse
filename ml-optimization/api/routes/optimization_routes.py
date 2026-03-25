"""
Optimization Routes
API routes for optimization operations.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
import logging
from psycopg2.extras import RealDictCursor
from ml_optimization.utils.db_utils import get_db_connection

router = APIRouter()
logger = logging.getLogger(__name__)


class OptimizationRecommendation(BaseModel):
    """Optimization recommendation model."""
    recommendation_id: str
    type: str  # index, partition, cache
    table: str
    columns: List[str]
    estimated_improvement: float
    cost: float
    priority: str
    status: str
    created_at: str


class ApplyOptimizationRequest(BaseModel):
    """Request to apply optimization."""
    optimization_id: str
    auto: bool = False


def _get_table_columns(cursor, schema: str, table: str, limit: int = 5) -> list:
    """Get real column names for a table, preferring id/date/key-like columns first."""
    cursor.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
        LIMIT %s
    """, (schema, table, limit * 2))
    raw = [r.get("column_name", "") for r in cursor.fetchall() if r.get("column_name")]
    # Prefer columns that look like keys/dates for indexing
    key_like = [c for c in raw if c in ("id", "pk", "key", "created_at", "updated_at", "date", "order_id", "customer_id", "product_id")]
    other = [c for c in raw if c not in key_like]
    return (key_like + other)[:limit] if (key_like or other) else raw[:limit]


def _get_fallback_index_recommendations(conn, type_filter: Optional[str]) -> dict:
    """Derive index recommendations from pg_stat_user_tables and real schema when index_recommendations table is missing."""
    if type_filter and type_filter != "index":
        return {"recommendations": [], "total": 0}
    result = []
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                schemaname,
                relname AS tablename,
                COALESCE(seq_scan, 0) AS seq_scan,
                COALESCE(idx_scan, 0) AS idx_scan,
                COALESCE(n_live_tup, 0) AS n_live_tup
            FROM pg_stat_user_tables
            WHERE schemaname IN ('bronze', 'silver', 'gold')
            ORDER BY COALESCE(seq_scan, 0) DESC, COALESCE(n_live_tup, 0) DESC
            LIMIT 20
        """)
        rows = cursor.fetchall()
        for i, row in enumerate(rows):
            schema = row.get("schemaname", "")
            table = row.get("tablename", "")
            seq_scan = int(row.get("seq_scan", 0) or 0)
            idx_scan = int(row.get("idx_scan", 0) or 0)
            n_live = int(row.get("n_live_tup", 0) or 0)
            full_name = f"{schema}.{table}" if schema else table
            priority = "high" if seq_scan > 100 else "medium" if seq_scan > 10 else "low"
            reason = f"Sequential scans: {seq_scan}, index scans: {idx_scan}"
            if n_live > 0:
                reason += f", ~{n_live:,} rows"
            reason += ". Consider index on filter/sort columns."
            columns = _get_table_columns(cursor, schema, table, 5)
            col_list = ", ".join(columns) if columns else "id"
            sql_stmt = f"CREATE INDEX idx_{table}_recommended ON {full_name} ({col_list});"
            result.append({
                "recommendation_id": f"fallback-index-{schema}-{table}-{i}",
                "type": "index",
                "table": full_name,
                "columns": columns,
                "estimated_improvement": 0.25,
                "cost": 0.15,
                "priority": priority,
                "status": "pending",
                "created_at": datetime.utcnow().isoformat(),
                "query_count": seq_scan,
                "avg_execution_time_ms": 0.0,
                "sql_statement": sql_stmt,
                "reason": reason,
            })
        return {"recommendations": result, "total": len(result)}
    except Exception as e:
        logger.warning(f"Fallback index recommendations failed: {e}")
        return {"recommendations": [], "total": 0}


def _get_fallback_partition_recommendations(conn) -> list:
    """Derive partition recommendations from table size/row counts when no recommendations table."""
    result = []
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                s.schemaname,
                s.relname AS tablename,
                COALESCE(s.n_live_tup, 0) AS n_live_tup,
                pg_total_relation_size(s.schemaname||'.'||s.relname) AS total_bytes
            FROM pg_stat_user_tables s
            WHERE s.schemaname IN ('bronze', 'silver', 'gold')
            ORDER BY pg_total_relation_size(s.schemaname||'.'||s.relname) DESC
            LIMIT 15
        """)
        rows = cursor.fetchall()
        for i, row in enumerate(rows):
            schema = row.get("schemaname", "")
            table = row.get("tablename", "")
            n_live = int(row.get("n_live_tup", 0) or 0)
            total_bytes = int(row.get("total_bytes", 0) or 0)
            full_name = f"{schema}.{table}" if schema else table
            size_mb = total_bytes / (1024.0 * 1024.0)
            if n_live < 5000 and size_mb < 1.0:
                continue
            priority = "high" if n_live > 100000 or size_mb > 100 else "medium" if n_live > 25000 or size_mb > 10 else "low"
            reason = f"~{n_live:,} rows, {size_mb:.1f} MB. Partitioning can improve scan and maintenance."
            result.append({
                "recommendation_id": f"fallback-partition-{schema}-{table}-{i}",
                "type": "partition",
                "table": full_name,
                "columns": ["created_at", "id"],
                "estimated_improvement": 0.2,
                "cost": 0.2,
                "priority": priority,
                "status": "pending",
                "created_at": datetime.utcnow().isoformat(),
                "query_count": 0,
                "avg_execution_time_ms": 0.0,
                "sql_statement": f"-- Consider: CREATE TABLE {full_name}_partitioned (LIKE {full_name}) PARTITION BY RANGE (created_at); -- then migrate data",
                "reason": reason,
            })
        return result
    except Exception as e:
        logger.warning(f"Fallback partition recommendations failed: {e}")
        return []


@router.get("/recommendations")
async def get_optimization_recommendations(
    type: Optional[str] = Query(None, description="Filter by type"),
    status: Optional[str] = Query(None, description="Filter by status"),
) -> dict:
    """
    Get ML-generated optimization recommendations.
    
    Args:
        type: Filter by recommendation type (index, partition, cache)
        status: Filter by status (pending, applied, rejected)
        
    Returns:
        List of optimization recommendations
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check if table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'ml_optimization' AND table_name = 'index_recommendations'
                )
            """)
            table_exists = cursor.fetchone().get('exists', False)
            
            if not table_exists:
                # Fallback: derive index and/or partition recommendations from table stats
                index_res = _get_fallback_index_recommendations(conn, type)
                index_list = index_res.get("recommendations", [])
                partition_list = _get_fallback_partition_recommendations(conn) if (type is None or type == "partition") else []
                combined = index_list + partition_list
                return {"recommendations": combined, "total": len(combined)}
            
            # Build query
            query = """
                SELECT 
                    recommendation_id::text as recommendation_id,
                    recommendation_type as type,
                    table_name as table,
                    ARRAY[column_name] as columns,
                    CASE 
                        WHEN estimated_improvement::text ~ '^[0-9]+\.?[0-9]*$' 
                        THEN CAST(estimated_improvement AS FLOAT) / 100.0
                        ELSE 0.3
                    END as estimated_improvement,
                    CASE 
                        WHEN priority = 'high' THEN 0.2
                        WHEN priority = 'medium' THEN 0.15
                        ELSE 0.1
                    END as cost,
                    priority,
                    'pending' as status,
                    created_at::text as created_at,
                    query_count,
                    avg_execution_time_ms,
                    sql_statement
                FROM ml_optimization.index_recommendations
                WHERE 1=1
            """
            params = []
            
            if type:
                query += " AND recommendation_type = %s"
                params.append(type)
            
            query += " ORDER BY priority DESC, query_count DESC LIMIT 100"
            
            cursor.execute(query, params)
            recommendations = cursor.fetchall()
            
            result = []
            for rec in recommendations:
                qc = rec.get('query_count', 0) or 0
                avg_ms = float(rec.get('avg_execution_time_ms', 0) or 0)
                result.append({
                    "recommendation_id": rec.get('recommendation_id', ''),
                    "type": rec.get('type', 'index'),
                    "table": rec.get('table', ''),
                    "columns": rec.get('columns', []),
                    "estimated_improvement": float(rec.get('estimated_improvement', 0.3)),
                    "cost": float(rec.get('cost', 0.15)),
                    "priority": rec.get('priority', 'medium'),
                    "status": rec.get('status', 'pending'),
                    "created_at": rec.get('created_at', datetime.utcnow().isoformat()),
                    "query_count": qc,
                    "avg_execution_time_ms": avg_ms,
                    "sql_statement": rec.get('sql_statement', ''),
                    "reason": f"Query count: {qc}, avg {avg_ms:.0f} ms — consider index to improve performance.",
                })
            
            return {"recommendations": result, "total": len(result)}
            
    except Exception as e:
        logger.error(f"Error fetching optimization recommendations: {e}", exc_info=True)
        return {"recommendations": [], "total": 0}


@router.post("/recommendations/{recommendation_id}/apply")
async def apply_optimization(
    recommendation_id: str,
    request: ApplyOptimizationRequest
) -> dict:
    """
    Apply an optimization recommendation.
    
    Args:
        recommendation_id: ID of recommendation to apply
        request: Apply optimization request
        
    Returns:
        Result of applying optimization
    """
    # TODO: Implement actual optimization application
    return {
        "recommendation_id": recommendation_id,
        "status": "applied",
        "applied_at": datetime.utcnow().isoformat(),
    }


@router.get("/query-performance")
async def get_query_performance(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    query_id: Optional[str] = Query(None, description="Filter by query ID"),
    limit: int = Query(100, description="Maximum results"),
) -> dict:
    """
    Get query performance metrics.
    
    Args:
        start_date: Start date
        end_date: End date
        query_id: Optional query ID filter
        limit: Maximum results
        
    Returns:
        Query performance metrics
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check if query_logs table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'ml_optimization' AND table_name = 'query_logs'
                )
            """)
            table_exists = cursor.fetchone().get('exists', False)
            
            if not table_exists:
                logger.warning("ml_optimization.query_logs table does not exist.")
                return {"queries": [], "metrics": [], "total": 0}
            
            # Default to last 7 days if dates not provided
            if not start_date:
                start_date = (datetime.utcnow() - timedelta(days=7)).strftime('%Y-%m-%d')
            if not end_date:
                end_date = datetime.utcnow().strftime('%Y-%m-%d')
            
            query = """
                SELECT 
                    query_hash::text as query_id,
                    query_hash::text as query_hash,
                    COUNT(*) as execution_count,
                    AVG(mean_exec_time_ms) as avg_execution_time,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mean_exec_time_ms) as p50_execution_time,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY mean_exec_time_ms) as p95_execution_time,
                    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY mean_exec_time_ms) as p99_execution_time,
                    SUM(COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0), 0)) as total_execution_time,
                    MAX(collected_at) as last_executed
                FROM ml_optimization.query_logs
                WHERE collected_at::date >= %s::date AND collected_at::date <= %s::date
            """
            params = [start_date, end_date]
            
            if query_id:
                query += " AND query_hash::text = %s"
                params.append(query_id)
            
            query += " GROUP BY query_hash ORDER BY total_execution_time DESC NULLS LAST LIMIT %s"
            params.append(limit)
            
            cursor.execute(query, params)
            metrics = cursor.fetchall()
            
            result = []
            for metric in metrics:
                result.append({
                    "query_id": metric.get('query_id', ''),
                    "query_hash": metric.get('query_hash', ''),
                    "execution_count": int(metric.get('execution_count', 0)),
                    "avg_execution_time": float(metric.get('avg_execution_time', 0)) / 1000.0,  # Convert to seconds
                    "p50_execution_time": float(metric.get('p50_execution_time', 0)) / 1000.0,
                    "p95_execution_time": float(metric.get('p95_execution_time', 0)) / 1000.0,
                    "p99_execution_time": float(metric.get('p99_execution_time', 0)) / 1000.0,
                    "total_execution_time": float(metric.get('total_execution_time', 0)) / 1000.0,
                    "cache_hit_rate": 0.75,  # Placeholder - would need pg_stat_statements
                    "last_executed": metric.get('last_executed', datetime.utcnow()).isoformat() if metric.get('last_executed') else datetime.utcnow().isoformat(),
                })
            
            return {"queries": result, "metrics": result, "total": len(result)}
            
    except Exception as e:
        logger.error(f"Error fetching query performance: {e}", exc_info=True)
        return {"queries": [], "metrics": [], "total": 0}


@router.get("/history")
async def get_optimization_history(
    limit: int = Query(100, description="Maximum results"),
) -> dict:
    """
    Get optimization history.
    
    Args:
        limit: Maximum results
        
    Returns:
        Optimization history
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check if table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'ml_optimization' AND table_name = 'index_recommendations'
                )
            """)
            table_exists = cursor.fetchone().get('exists', False)
            
            if not table_exists:
                return {"history": [], "total": 0}
            
            # Get applied recommendations (assuming status tracking)
            query = """
                SELECT 
                    recommendation_id::text as recommendation_id,
                    recommendation_type as type,
                    table_name as table,
                    ARRAY[column_name] as columns,
                    priority,
                    created_at::text as created_at,
                    query_count,
                    avg_execution_time_ms,
                    sql_statement
                FROM ml_optimization.index_recommendations
                ORDER BY created_at DESC
                LIMIT %s
            """
            
            cursor.execute(query, [limit])
            history = cursor.fetchall()
            
            result = []
            for item in history:
                result.append({
                    "recommendation_id": item.get('recommendation_id', ''),
                    "type": item.get('type', 'index'),
                    "table": item.get('table', ''),
                    "columns": item.get('columns', []),
                    "priority": item.get('priority', 'medium'),
                    "created_at": item.get('created_at', datetime.utcnow().isoformat()),
                    "query_count": item.get('query_count', 0),
                    "avg_execution_time_ms": float(item.get('avg_execution_time_ms', 0)),
                    "sql_statement": item.get('sql_statement', ''),
                })
            
            return {"history": result, "total": len(result)}
            
    except Exception as e:
        logger.error(f"Error fetching optimization history: {e}", exc_info=True)
        return {"history": [], "total": 0}


