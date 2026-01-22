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
                logger.warning("ml_optimization.index_recommendations table does not exist.")
                return {"recommendations": [], "total": 0}
            
            # Build query
            query = """
                SELECT 
                    recommendation_id::text as recommendation_id,
                    recommendation_type as type,
                    table_name as table,
                    ARRAY[column_name] as columns,
                    CASE 
                        WHEN estimated_improvement ~ '^[0-9]+\.?[0-9]*$' 
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
                    "query_count": rec.get('query_count', 0),
                    "avg_execution_time_ms": float(rec.get('avg_execution_time_ms', 0)),
                    "sql_statement": rec.get('sql_statement', ''),
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
                return {"metrics": [], "total": 0}
            
            # Default to last 7 days if dates not provided
            if not start_date:
                start_date = (datetime.utcnow() - timedelta(days=7)).strftime('%Y-%m-%d')
            if not end_date:
                end_date = datetime.utcnow().strftime('%Y-%m-%d')
            
            query = """
                SELECT 
                    query_id::text as query_id,
                    MD5(query_text) as query_hash,
                    COUNT(*) as execution_count,
                    AVG(execution_time_ms) as avg_execution_time,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms) as p50_execution_time,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time,
                    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms) as p99_execution_time,
                    SUM(execution_time_ms) as total_execution_time,
                    MAX(executed_at) as last_executed
                FROM ml_optimization.query_logs
                WHERE executed_at >= %s::date AND executed_at <= %s::date
            """
            params = [start_date, end_date]
            
            if query_id:
                query += " AND query_id = %s"
                params.append(query_id)
            
            query += " GROUP BY query_id, MD5(query_text) ORDER BY total_execution_time DESC LIMIT %s"
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
            
            return {"metrics": result, "total": len(result)}
            
    except Exception as e:
        logger.error(f"Error fetching query performance: {e}", exc_info=True)
        return {"metrics": [], "total": 0}


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


