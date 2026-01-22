"""
Storage Routes
API routes for storage utilization, growth trends, compression, cache, and resource metrics.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime, timedelta
from ml_optimization.utils.db_utils import get_db_connection
from psycopg2.extras import RealDictCursor
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/utilization")
async def get_storage_utilization():
    """Get storage utilization by layer and table."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            utilization = {}
            total_size_bytes = 0
            
            for schema in ['bronze', 'silver', 'gold']:
                cursor.execute("""
                    SELECT 
                        tablename,
                        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size_pretty,
                        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
                        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
                        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
                    FROM pg_tables
                    WHERE schemaname = %s
                    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                """, (schema,))
                
                tables = cursor.fetchall()
                table_utilization = []
                schema_total = 0
                
                for table in tables:
                    size_bytes = table.get('size_bytes', 0) or 0
                    schema_total += size_bytes
                    total_size_bytes += size_bytes
                    
                    table_utilization.append({
                        "table": table.get('tablename', ''),
                        "total_size": table.get('size_pretty', '0 B'),
                        "size_bytes": size_bytes,
                        "table_size": table.get('table_size', '0 B'),
                        "index_size": table.get('index_size', '0 B'),
                        "percentage": 0,  # Will calculate after getting total
                    })
                
                # Calculate percentages
                for table in table_utilization:
                    table["percentage"] = round((table["size_bytes"] / schema_total * 100), 2) if schema_total > 0 else 0
                
                utilization[schema] = {
                    "tables": table_utilization,
                    "total_size": f"{schema_total / (1024**2):.0f} MB",
                    "total_bytes": schema_total,
                    "table_count": len(tables),
                }
            
            # Calculate overall percentages
            for schema in utilization:
                for table in utilization[schema]["tables"]:
                    table["overall_percentage"] = round((table["size_bytes"] / total_size_bytes * 100), 2) if total_size_bytes > 0 else 0
            
            utilization["_total"] = {
                "total_size": f"{total_size_bytes / (1024**2):.0f} MB",
                "total_bytes": total_size_bytes,
            }
            
            return {"utilization": utilization}
    except Exception as e:
        logger.error(f"Error fetching storage utilization: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/growth-trends")
async def get_growth_trends(days: int = Query(30, description="Number of days to analyze")):
    """Get data growth trends over time."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            trends = {}
            
            for schema in ['bronze', 'silver', 'gold']:
                # Get row count changes (approximate based on inserts)
                cursor.execute("""
                    SELECT 
                        relname as tablename,
                        n_tup_ins as total_inserts,
                        n_tup_upd as total_updates,
                        n_tup_del as total_deletes,
                        n_live_tup as current_rows
                    FROM pg_stat_user_tables
                    WHERE schemaname = %s
                    ORDER BY n_live_tup DESC
                    LIMIT 10
                """, (schema,))
                
                tables = cursor.fetchall()
                
                # Calculate growth rate (assuming uniform growth over period)
                schema_total = sum(table.get('current_rows', 0) or 0 for table in tables)
                total_ops = sum(
                    (table.get('total_inserts', 0) or 0) + 
                    (table.get('total_updates', 0) or 0) - 
                    (table.get('total_deletes', 0) or 0) 
                    for table in tables
                )
                
                daily_growth = total_ops / days if days > 0 else 0
                
                trends[schema] = {
                    "current_size": schema_total,
                    "total_operations": total_ops,
                    "daily_growth": round(daily_growth, 2),
                    "growth_rate_percent": round((daily_growth / schema_total * 100), 4) if schema_total > 0 else 0,
                }
            
            # Generate trend data points for visualization
            trend_points = []
            for i in range(days, -1, -1):
                date = datetime.now() - timedelta(days=i)
                point = {
                    "date": date.strftime("%Y-%m-%d"),
                    "bronze": max(0, trends["bronze"]["current_size"] - (trends["bronze"]["daily_growth"] * i)),
                    "silver": max(0, trends["silver"]["current_size"] - (trends["silver"]["daily_growth"] * i)),
                    "gold": max(0, trends["gold"]["current_size"] - (trends["gold"]["daily_growth"] * i)),
                }
                trend_points.append(point)
            
            return {
                "trends": trends,
                "trend_points": trend_points,
                "period_days": days,
            }
    except Exception as e:
        logger.error(f"Error fetching growth trends: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/compression")
async def get_compression_stats():
    """Get compression ratio statistics."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            compression_stats = {}
            
            for schema in ['bronze', 'silver', 'gold']:
                cursor.execute("""
                    SELECT 
                        t.tablename,
                        pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.tablename)) as total_size,
                        pg_total_relation_size(t.schemaname||'.'||t.tablename) as total_bytes,
                        pg_size_pretty(pg_relation_size(t.schemaname||'.'||t.tablename)) as table_size,
                        pg_relation_size(t.schemaname||'.'||t.tablename) as table_bytes,
                        COALESCE(s.n_live_tup, 0) as row_count
                    FROM pg_tables t
                    LEFT JOIN pg_stat_user_tables s ON t.schemaname = s.schemaname AND t.tablename = s.relname
                    WHERE t.schemaname = %s
                    ORDER BY pg_total_relation_size(t.schemaname||'.'||t.tablename) DESC
                    LIMIT 10
                """, (schema,))
                
                tables = cursor.fetchall()
                table_stats = []
                
                for table in tables:
                    total_bytes = table.get('total_bytes', 0) or 0
                    table_bytes = table.get('table_bytes', 0) or 0
                    row_count = table.get('row_count', 0) or 0
                    
                    # Calculate compression ratio
                    # Estimate: Assume average row size would be larger without compression
                    if row_count > 0 and table_bytes > 0:
                        avg_row_size = table_bytes / row_count
                        # Estimate uncompressed size (assuming 2x-3x larger)
                        estimated_uncompressed = table_bytes * 2.5
                        compression_ratio = estimated_uncompressed / table_bytes if table_bytes > 0 else 1
                        compression_percentage = ((estimated_uncompressed - table_bytes) / estimated_uncompressed * 100) if estimated_uncompressed > 0 else 0
                    else:
                        compression_ratio = 1
                        compression_percentage = 0
                    
                    table_stats.append({
                        "table": table.get('tablename', ''),
                        "total_size": table.get('total_size', '0 B'),
                        "table_size": table.get('table_size', '0 B'),
                        "row_count": row_count,
                        "compression_ratio": round(compression_ratio, 2),
                        "compression_percentage": round(compression_percentage, 2),
                    })
                
                # Calculate average compression
                avg_compression = sum(t["compression_ratio"] for t in table_stats) / len(table_stats) if table_stats else 1
                
                compression_stats[schema] = {
                    "tables": table_stats,
                    "average_compression_ratio": round(avg_compression, 2),
                }
            
            return {"compression": compression_stats}
    except Exception as e:
        logger.error(f"Error fetching compression stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache")
async def get_cache_performance():
    """Get cache performance metrics."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Get PostgreSQL cache statistics
            cursor.execute("""
                SELECT 
                    schemaname,
                    relname as tablename,
                    heap_blks_read as disk_reads,
                    heap_blks_hit as cache_hits,
                    CASE 
                        WHEN (heap_blks_read + heap_blks_hit) > 0 
                        THEN (heap_blks_hit::float / (heap_blks_read + heap_blks_hit) * 100)
                        ELSE 0
                    END as hit_rate
                FROM pg_statio_user_tables
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                ORDER BY heap_blks_hit DESC
                LIMIT 20
            """)
            
            cache_stats = cursor.fetchall()
            
            tables = []
            total_hits = 0
            total_reads = 0
            
            for stat in cache_stats:
                disk_reads = stat.get('disk_reads', 0) or 0
                cache_hits = stat.get('cache_hits', 0) or 0
                hit_rate = stat.get('hit_rate', 0) or 0
                
                total_hits += cache_hits
                total_reads += disk_reads
                
                tables.append({
                    "table": f"{stat.get('schemaname', '')}.{stat.get('tablename', '')}",
                    "schema": stat.get('schemaname', ''),
                    "cache_hits": cache_hits,
                    "disk_reads": disk_reads,
                    "hit_rate": round(hit_rate, 2),
                    "status": "excellent" if hit_rate >= 95 else "good" if hit_rate >= 85 else "fair" if hit_rate >= 70 else "poor",
                })
            
            overall_hit_rate = (total_hits / (total_hits + total_reads) * 100) if (total_hits + total_reads) > 0 else 0
            
            return {
                "tables": tables,
                "overall": {
                    "cache_hits": total_hits,
                    "disk_reads": total_reads,
                    "hit_rate": round(overall_hit_rate, 2),
                    "status": "excellent" if overall_hit_rate >= 95 else "good" if overall_hit_rate >= 85 else "fair" if overall_hit_rate >= 70 else "poor",
                },
            }
    except Exception as e:
        logger.error(f"Error fetching cache performance: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/resources")
async def get_resource_allocation():
    """Get resource allocation history."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Get connection and activity information
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_connections,
                    COUNT(*) FILTER (WHERE state = 'active') as active_connections,
                    COUNT(*) FILTER (WHERE state = 'idle') as idle_connections
                FROM pg_stat_activity
                WHERE datname = current_database()
            """)
            
            connection_stats = cursor.fetchone()
            
            # Get database size
            cursor.execute("SELECT pg_size_pretty(pg_database_size(current_database())) as db_size")
            db_size_result = cursor.fetchone()
            db_size = db_size_result.get('db_size', '0 B') if db_size_result else '0 B'
            
            return {
                "connections": {
                    "total": connection_stats.get('total_connections', 0) or 0 if connection_stats else 0,
                    "active": connection_stats.get('active_connections', 0) or 0 if connection_stats else 0,
                    "idle": connection_stats.get('idle_connections', 0) or 0 if connection_stats else 0,
                },
                "database_size": db_size,
                "timestamp": datetime.now().isoformat(),
            }
    except Exception as e:
        logger.error(f"Error fetching resource allocation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cost")
async def get_cost_tracking():
    """Get cost tracking information."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            cost_breakdown = {}
            
            # Estimate costs based on storage size
            # Assuming $0.10 per GB per month
            COST_PER_GB_MONTH = 0.10
            
            for schema in ['bronze', 'silver', 'gold']:
                cursor.execute("""
                    SELECT SUM(pg_total_relation_size(schemaname||'.'||tablename)) as total_bytes
                    FROM pg_tables
                    WHERE schemaname = %s
                """, (schema,))
                
                result = cursor.fetchone()
                total_bytes = result.get('total_bytes', 0) or 0 if result else 0
                # Convert to float if it's a Decimal
                if hasattr(total_bytes, '__float__'):
                    total_bytes = float(total_bytes)
                total_gb = total_bytes / (1024**3)
                monthly_cost = float(total_gb) * COST_PER_GB_MONTH
                
                cost_breakdown[schema] = {
                    "storage_gb": round(total_gb, 2),
                    "monthly_cost": round(monthly_cost, 2),
                    "yearly_cost": round(monthly_cost * 12, 2),
                }
            
            total_monthly = sum(c["monthly_cost"] for c in cost_breakdown.values())
            total_yearly = sum(c["yearly_cost"] for c in cost_breakdown.values())
            
            return {
                "breakdown": cost_breakdown,
                "total": {
                    "monthly_cost": round(total_monthly, 2),
                    "yearly_cost": round(total_yearly, 2),
                },
                "currency": "USD",
            }
    except Exception as e:
        logger.error(f"Error fetching cost tracking: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

