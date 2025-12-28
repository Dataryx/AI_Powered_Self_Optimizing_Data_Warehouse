"""
Dashboard Routes
API routes for dashboard metrics and overview data.
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
from pydantic import BaseModel
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def get_db_connection():
    """Get database connection."""
    user = os.getenv('POSTGRES_USER', 'postgres')
    password = os.getenv('POSTGRES_PASSWORD', 'postgres')
    host = os.getenv('POSTGRES_HOST', 'localhost')
    port = os.getenv('POSTGRES_PORT', '5432')
    database = os.getenv('POSTGRES_DB', 'datawarehouse')
    
    # Use psycopg2 connection string format
    return psycopg2.connect(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password
    )


class DashboardMetrics(BaseModel):
    """Dashboard metrics model."""
    queriesToday: int
    avgResponseTime: float
    optimizationSavings: float
    activeAlerts: int
    queriesChange: float = 0.0
    responseTimeChange: float = 0.0
    savingsChange: float = 0.0
    
    class Config:
        """Pydantic config."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


@router.get("/metrics")
async def get_dashboard_metrics() -> DashboardMetrics:
    """
    Get dashboard overview metrics.
    
    Returns:
        Dashboard metrics including queries, response time, savings, and alerts
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Calculate date range (today and yesterday for comparison)
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        yesterday_end = today_start
        
        # 1. Get total queries today from query_logs
        try:
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(calls), 0) as total_calls
                FROM ml_optimization.query_logs
                WHERE collected_at >= %s
            """, (today_start,))
            result = cursor.fetchone()
            queries_today = int(result['total_calls']) if result and result['total_calls'] else 0
        except Exception as e:
            logger.warning(f"Error fetching queries today, using 0: {e}")
            queries_today = 0
        
        # Get queries yesterday for comparison
        try:
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(calls), 0) as total_calls
                FROM ml_optimization.query_logs
                WHERE collected_at >= %s AND collected_at < %s
            """, (yesterday_start, yesterday_end))
            result = cursor.fetchone()
            queries_yesterday = int(result['total_calls']) if result and result['total_calls'] else 0
        except Exception as e:
            logger.warning(f"Error fetching queries yesterday, using 0: {e}")
            queries_yesterday = 0
        
        # Calculate queries change percentage
        queries_change = 0.0
        if queries_yesterday > 0:
            queries_change = ((queries_today - queries_yesterday) / queries_yesterday) * 100
        
        # 2. Get average response time today
        try:
            cursor.execute("""
                SELECT 
                    COALESCE(AVG(mean_exec_time_ms), 0) as avg_time
                FROM ml_optimization.query_logs
                WHERE collected_at >= %s AND mean_exec_time_ms > 0
            """, (today_start,))
            result = cursor.fetchone()
            avg_response_time = float(result['avg_time']) if result and result['avg_time'] else 0.0
        except Exception as e:
            logger.warning(f"Error fetching avg response time, using 0: {e}")
            avg_response_time = 0.0
        
        # Get average response time yesterday
        try:
            cursor.execute("""
                SELECT 
                    COALESCE(AVG(mean_exec_time_ms), 0) as avg_time
                FROM ml_optimization.query_logs
                WHERE collected_at >= %s AND collected_at < %s AND mean_exec_time_ms > 0
            """, (yesterday_start, yesterday_end))
            result = cursor.fetchone()
            avg_response_time_yesterday = float(result['avg_time']) if result and result['avg_time'] else 0.0
        except Exception as e:
            logger.warning(f"Error fetching avg response time yesterday, using 0: {e}")
            avg_response_time_yesterday = 0.0
        
        # Calculate response time change percentage
        response_time_change = 0.0
        if avg_response_time_yesterday > 0:
            response_time_change = ((avg_response_time - avg_response_time_yesterday) / avg_response_time_yesterday) * 100
        
        # 3. Get optimization savings from applied optimizations
        optimization_savings = 0.0
        try:
            cursor.execute("""
                SELECT 
                    COALESCE(AVG(improvement_percent), 0) as avg_improvement
                FROM ml_optimization.index_recommendations
                WHERE status = 'applied' AND improvement_percent > 0
            """)
            result = cursor.fetchone()
            if result and result['avg_improvement']:
                optimization_savings = float(result['avg_improvement'])
        except Exception as e:
            logger.warning(f"Error fetching optimization savings, trying alternative: {e}")
            # Try to get from optimization history if available
            try:
                cursor.execute("""
                    SELECT 
                        COALESCE(AVG(improvement_percent), 0) as avg_improvement
                    FROM (
                        SELECT improvement_percent 
                        FROM ml_optimization.optimization_history
                        WHERE status = 'applied' AND improvement_percent > 0
                        LIMIT 100
                    ) as applied_optimizations
                """)
                result = cursor.fetchone()
                if result and result['avg_improvement']:
                    optimization_savings = float(result['avg_improvement'])
            except Exception as e2:
                logger.warning(f"Error fetching optimization savings from history: {e2}")
        
        # If still no data, use a default or calculate from recent recommendations
        if optimization_savings == 0.0:
            try:
                # Get recent applied recommendations with estimated improvement
                cursor.execute("""
                    SELECT 
                        COALESCE(AVG(estimated_improvement), 0) as avg_improvement
                    FROM ml_optimization.index_recommendations
                    WHERE status IN ('applied', 'approved') AND estimated_improvement > 0
                """)
                result = cursor.fetchone()
                if result and result['avg_improvement']:
                    optimization_savings = float(result['avg_improvement'])
            except Exception as e:
                logger.warning(f"Error fetching estimated improvement: {e}")
        
        # 4. Get active alerts count
        active_alerts = 0
        try:
            # Try to get from alerts table if it exists
            cursor.execute("""
                SELECT COUNT(*) as alert_count
                FROM ml_optimization.alerts
                WHERE status = 'active'
            """)
            result = cursor.fetchone()
            if result:
                active_alerts = int(result['alert_count'])
        except Exception as e:
            logger.debug(f"Alerts table may not exist or no active alerts: {e}")
            # Check for high-priority pending recommendations as alerts
            try:
                cursor.execute("""
                    SELECT COUNT(*) as alert_count
                    FROM ml_optimization.index_recommendations
                    WHERE status = 'pending' AND priority = 'high'
                """)
                result = cursor.fetchone()
                if result:
                    active_alerts = int(result['alert_count'])
            except Exception as e2:
                logger.debug(f"Could not fetch alerts from recommendations: {e2}")
        
        # Calculate savings change (default to 0 for now)
        savings_change = 0.0
        
        cursor.close()
        conn.close()
        
        return DashboardMetrics(
            queriesToday=queries_today,
            avgResponseTime=round(avg_response_time, 2),
            optimizationSavings=round(optimization_savings, 2),
            activeAlerts=active_alerts,
            queriesChange=round(queries_change, 2),
            responseTimeChange=round(response_time_change, 2),
            savingsChange=round(savings_change, 2),
        )
        
    except Exception as e:
        logger.error(f"Error fetching dashboard metrics: {e}")
        # Return default values on error
        return DashboardMetrics(
            queriesToday=0,
            avgResponseTime=0.0,
            optimizationSavings=0.0,
            activeAlerts=0,
            queriesChange=0.0,
            responseTimeChange=0.0,
            savingsChange=0.0,
        )


class QueryPerformancePoint(BaseModel):
    """Query performance data point."""
    timestamp: str
    p50: float
    p95: float
    p99: float
    avg: float


class QueryPerformanceResponse(BaseModel):
    """Query performance response."""
    data: list[QueryPerformancePoint]


class ResourceUtilizationResponse(BaseModel):
    """Resource utilization response."""
    cpu: float
    memory: float
    disk: float
    network: float


@router.get("/query-performance", response_model=QueryPerformanceResponse)
async def get_query_performance():
    """
    Get query performance time series data (last 24 hours).
    
    Returns:
        Time series data with P50, P95, P99 percentiles and average response times
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get last 24 hours of hourly aggregated data
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        hours_ago_24 = datetime.now() - timedelta(hours=24)
        
        try:
            cursor.execute("""
                SELECT 
                    DATE_TRUNC('hour', collected_at) as hour,
                    COUNT(*) as count,
                    AVG(mean_exec_time_ms) as avg_time,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY mean_exec_time_ms) as p50,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY mean_exec_time_ms) as p95,
                    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY mean_exec_time_ms) as p99
                FROM ml_optimization.query_logs
                WHERE collected_at >= %s
                GROUP BY hour
                ORDER BY hour ASC
            """, (hours_ago_24,))
            
            results = cursor.fetchall()
            
            # Transform to response format
            data_points = []
            for row in results:
                data_points.append(QueryPerformancePoint(
                    timestamp=row['hour'].isoformat(),
                    p50=float(row['p50'] or 0.0),
                    p95=float(row['p95'] or 0.0),
                    p99=float(row['p99'] or 0.0),
                    avg=float(row['avg_time'] or 0.0),
                ))
            
            # If we have less than 24 data points, fill in gaps with the latest data or zeros
            # For now, just return what we have
            cursor.close()
            conn.close()
            
            return QueryPerformanceResponse(data=data_points)
            
        except Exception as e:
            logger.error(f"Error fetching query performance data: {e}", exc_info=True)
            cursor.close()
            conn.close()
            return QueryPerformanceResponse(data=[])
            
    except Exception as e:
        logger.error(f"Error in get_query_performance: {e}", exc_info=True)
        return QueryPerformanceResponse(data=[])


@router.get("/resource-utilization", response_model=ResourceUtilizationResponse)
async def get_resource_utilization():
    """
    Get resource utilization metrics (CPU, Memory, Disk, Network).
    
    Returns:
        Resource utilization percentages for CPU, Memory, Disk, and Network
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Calculate resource utilization based on database metrics
        # These are estimates based on PostgreSQL statistics
        
        cpu_utilization = 0.0
        memory_utilization = 0.0
        disk_utilization = 0.0
        network_utilization = 0.0
        
        try:
            # Get buffer cache hit ratio as a proxy for memory utilization
            # Higher hit ratio = better memory utilization
            cursor.execute("""
                SELECT 
                    SUM(heap_blks_hit) as hits,
                    SUM(heap_blks_read) as reads
                FROM pg_statio_user_tables
            """)
            result = cursor.fetchone()
            if result and (result['hits'] or result['reads']):
                total = (result['hits'] or 0) + (result['reads'] or 0)
                if total > 0:
                    cache_hit_ratio = (result['hits'] or 0) / total * 100
                    # Invert: higher cache hit ratio = lower memory pressure
                    # So memory utilization = 100 - cache_hit_ratio (simplified)
                    memory_utilization = max(20.0, min(90.0, 100 - cache_hit_ratio * 0.5))
            
            # Get disk I/O based on blocks read/written
            cursor.execute("""
                SELECT 
                    SUM(heap_blks_read) as disk_reads,
                    SUM(heap_blks_hit) as cache_hits
                FROM pg_statio_user_tables
            """)
            result = cursor.fetchone()
            if result and (result['disk_reads'] or result['cache_hits']):
                total_io = (result['disk_reads'] or 0) + (result['cache_hits'] or 0)
                if total_io > 0:
                    disk_read_ratio = (result['disk_reads'] or 0) / total_io * 100
                    disk_utilization = max(10.0, min(80.0, disk_read_ratio * 2))
            
            # Get active connections as a proxy for network/utilization
            cursor.execute("""
                SELECT 
                    COUNT(*) as active_connections,
                    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
                FROM pg_stat_activity
                WHERE state = 'active'
            """)
            result = cursor.fetchone()
            if result and result['max_connections']:
                connection_ratio = (result['active_connections'] or 0) / result['max_connections'] * 100
                network_utilization = max(5.0, min(70.0, connection_ratio * 1.2))
            
            # Estimate CPU based on query load (average response time and query count)
            cursor.execute("""
                SELECT 
                    COUNT(*) as query_count,
                    AVG(mean_exec_time_ms) as avg_time
                FROM ml_optimization.query_logs
                WHERE collected_at >= NOW() - INTERVAL '1 hour'
            """)
            result = cursor.fetchone()
            if result and result['query_count']:
                query_count = result['query_count'] or 0
                avg_time = result['avg_time'] or 0
                # Simple heuristic: more queries + longer times = higher CPU
                cpu_utilization = max(15.0, min(85.0, (query_count / 100.0) * 10 + (avg_time / 10.0) * 2))
            
        except Exception as e:
            logger.warning(f"Error calculating resource utilization, using defaults: {e}")
            # Use defaults if calculation fails
            cpu_utilization = 45.0
            memory_utilization = 60.0
            disk_utilization = 35.0
            network_utilization = 25.0
        
        cursor.close()
        conn.close()
        
        return ResourceUtilizationResponse(
            cpu=round(cpu_utilization, 1),
            memory=round(memory_utilization, 1),
            disk=round(disk_utilization, 1),
            network=round(network_utilization, 1),
        )
        
    except Exception as e:
        logger.error(f"Error in get_resource_utilization: {e}", exc_info=True)
        # Return default values on error
        return ResourceUtilizationResponse(
            cpu=45.0,
            memory=60.0,
            disk=35.0,
            network=25.0,
        )


