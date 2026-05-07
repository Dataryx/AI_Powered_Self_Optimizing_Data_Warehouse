"""
Warehouse Routes
API routes for accessing data warehouse information.
"""

import asyncio
import re
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import date, timedelta
from psycopg2 import sql
from ml_optimization.utils.db_utils import get_db_connection

router = APIRouter()

# Safe table/schema name pattern (alphanumeric and underscore only)
SAFE_IDENT = re.compile(r"^[a-zA-Z0-9_]+$")


def _fetch_warehouse_summary(conn) -> dict:
    """Body of GET /warehouse/summary using an existing connection."""
    cursor = conn.cursor()
    summary = {}
    for schema in ["bronze", "silver", "gold"]:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM pg_tables
            WHERE schemaname = %s
            """,
            (schema,),
        )
        table_count = cursor.fetchone()[0]
        # Exact row counts per table for correctness (stats estimates can be stale).
        cursor.execute(
            """
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = %s
            ORDER BY tablename
            """,
            (schema,),
        )
        table_names = [str(r[0]) for r in cursor.fetchall()]
        estimated_rows = 0
        for tname in table_names:
            try:
                cursor.execute(
                    sql.SQL("SELECT COUNT(*) FROM {}.{}").format(
                        sql.Identifier(schema),
                        sql.Identifier(tname),
                    )
                )
                estimated_rows += int(cursor.fetchone()[0] or 0)
            except Exception:
                # Conservative fallback: use pg_stat count for just this table if exact count fails.
                try:
                    cursor.execute(
                        """
                        SELECT COALESCE(n_live_tup, 0)
                        FROM pg_stat_user_tables
                        WHERE schemaname = %s AND relname = %s
                        """,
                        (schema, tname),
                    )
                    estimated_rows += int(cursor.fetchone()[0] or 0)
                except Exception:
                    continue
        cursor.execute(
            """
            SELECT pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) as total_size,
                   SUM(pg_total_relation_size(schemaname||'.'||tablename)) as total_size_bytes
            FROM pg_tables
            WHERE schemaname = %s
            """,
            (schema,),
        )
        size_result = cursor.fetchone()
        summary[schema] = {
            "table_count": table_count,
            "estimated_rows": estimated_rows,
            "total_size": size_result[0] if size_result and size_result[0] else "0 bytes",
            "total_size_bytes": size_result[1] if size_result and size_result[1] else 0,
        }
    cursor.execute("SELECT current_database()")
    db_name = cursor.fetchone()[0]
    return {"warehouse_summary": summary, "database": db_name}


def _fetch_sales_stats(conn, daily_lookback_days: int = 60) -> dict:
    """Body of GET /warehouse/sales-stats using an existing connection.

    `daily_lookback_days` <= 0 means no date filter (all daily buckets in fact_sales).
    Totals (total_sales) are always all-time.
    """
    cursor = conn.cursor()
    stats: dict = {}
    cursor.execute(
        """
        SELECT
            COUNT(*) as total_sales,
            SUM(net_amount) as total_revenue,
            AVG(net_amount) as avg_sale,
            SUM(quantity) as total_quantity
        FROM gold.fact_sales
        """
    )
    row = cursor.fetchone()
    stats["total_sales"] = {
        "count": row[0] or 0,
        "revenue": float(row[1] or 0),
        "avg_sale": float(row[2] or 0),
        "total_quantity": row[3] or 0,
    }
    daily_sql = """
        SELECT
            TO_CHAR(TO_DATE(order_date_key::text, 'YYYYMMDD'), 'YYYY-MM-DD') as date,
            COUNT(*) as sales_count,
            SUM(net_amount) as revenue
        FROM gold.fact_sales
    """
    today_key = int(date.today().strftime("%Y%m%d"))
    if daily_lookback_days > 0:
        threshold_date = date.today() - timedelta(days=int(daily_lookback_days))
        threshold_key = int(threshold_date.strftime("%Y%m%d"))
        cursor.execute(
            daily_sql
            + """
        WHERE order_date_key >= %s AND order_date_key <= %s
        GROUP BY order_date_key
        ORDER BY order_date_key DESC
        """,
            (threshold_key, today_key),
        )
    else:
        cursor.execute(
            daily_sql
            + """
        WHERE order_date_key <= %s
        GROUP BY order_date_key
        ORDER BY order_date_key DESC
        """,
            (today_key,),
        )
    stats["daily_sales"] = [
        {
            "date": str(row[0]) if row[0] is not None else "",
            "count": int(row[1] or 0),
            "revenue": float(row[2] or 0),
        }
        for row in cursor.fetchall()
    ]
    stats["daily_sales_lookback_days"] = daily_lookback_days if daily_lookback_days and daily_lookback_days > 0 else 0
    cursor.execute(
        """
        SELECT
            COALESCE(p.product_name, 'Unknown') as product_name,
            COUNT(*) as sales_count,
            SUM(fs.net_amount) as revenue,
            SUM(fs.quantity) as quantity_sold
        FROM gold.fact_sales fs
        LEFT JOIN gold.dim_product p ON fs.product_key = p.product_key
        GROUP BY p.product_name
        ORDER BY SUM(fs.net_amount) DESC NULLS LAST
        LIMIT 20
        """
    )
    stats["top_products"] = [
        {
            "product": row[0],
            "sales_count": row[1],
            "revenue": float(row[2] or 0),
            "quantity": row[3] or 0,
        }
        for row in cursor.fetchall()
    ]
    return stats


def _fetch_customer_stats(conn) -> dict:
    """Body of GET /warehouse/customer-stats using an existing connection."""
    cursor = conn.cursor()
    stats: dict = {}
    cursor.execute("SELECT COUNT(*) FROM gold.dim_customer")
    stats["total_customers"] = cursor.fetchone()[0]
    cursor.execute(
        """
        SELECT
            COUNT(DISTINCT customer_key) as unique_customers,
            COUNT(*) as total_orders,
            SUM(net_amount) as total_revenue
        FROM gold.fact_orders
        """
    )
    row = cursor.fetchone()
    stats["orders"] = {
        "unique_customers": row[0] or 0,
        "total_orders": row[1] or 0,
        "total_revenue": float(row[2] or 0),
    }
    return stats


def _fetch_home_health(conn) -> dict:
    """Lightweight health payload for the home dashboard (one DB round-trip)."""
    cursor = conn.cursor()
    cursor.execute("SELECT current_database(), version()")
    db_name, version = cursor.fetchone()
    cursor.execute(
        """
        SELECT schemaname, COUNT(*) as table_count
        FROM pg_tables
        WHERE schemaname IN ('bronze', 'silver', 'gold')
        GROUP BY schemaname
        ORDER BY schemaname
        """
    )
    schemas = {row[0]: row[1] for row in cursor.fetchall()}
    return {
        "status": "healthy",
        "service": "ML Optimization API",
        "database": {
            "name": db_name,
            "version": version.split(",")[0] if version else "Unknown",
            "connected": True,
            "schemas": schemas,
        },
    }


@router.get("/schemas")
def get_schemas():
    """Get all data warehouse schemas (bronze, silver, gold)."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT schemaname, COUNT(*) as table_count
                FROM pg_tables 
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                GROUP BY schemaname
                ORDER BY schemaname
            """)
            schemas = [
                {"name": row[0], "table_count": row[1]}
                for row in cursor.fetchall()
            ]
            return {"schemas": schemas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tables/{schema}")
def get_tables(schema: str):
    """Get all tables in a specific schema."""
    if schema not in ['bronze', 'silver', 'gold']:
        raise HTTPException(status_code=400, detail="Schema must be bronze, silver, or gold")
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT tablename, 
                       (SELECT COUNT(*) FROM information_schema.columns 
                        WHERE table_schema = %s AND table_name = tablename) as column_count
                FROM pg_tables 
                WHERE schemaname = %s
                ORDER BY tablename
            """, (schema, schema))
            tables = [
                {"name": row[0], "column_count": row[1]}
                for row in cursor.fetchall()
            ]
            return {"schema": schema, "tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/{schema}/{table}")
def get_table_stats(schema: str, table: str):
    """Get statistics for a specific table."""
    if schema not in ("bronze", "silver", "gold"):
        raise HTTPException(status_code=400, detail="Schema must be bronze, silver, or gold")
    if not SAFE_IDENT.match(table):
        raise HTTPException(status_code=400, detail="Invalid table name")
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            qualified = f"{schema}.{table}"
            quoted = '"' + schema.replace('"', '""') + '"."' + table.replace('"', '""') + '"'
            
            # Row count (identifiers validated above)
            cursor.execute("SELECT COUNT(*) FROM " + quoted)
            row_count = cursor.fetchone()[0]
            
            # Table size: use qualified name as regclass (single parameter)
            cursor.execute(
                "SELECT pg_size_pretty(pg_total_relation_size(%s::regclass)) AS size, pg_total_relation_size(%s::regclass) AS size_bytes",
                (qualified, qualified),
            )
            size_info = cursor.fetchone()
            
            # Column count and last updated (from pg_stat_user_tables)
            cursor.execute(
                "SELECT n_live_tup, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze FROM pg_stat_user_tables WHERE schemaname = %s AND relname = %s",
                (schema, table),
            )
            stat_row = cursor.fetchone()
            cursor.execute(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = %s AND table_name = %s",
                (schema, table),
            )
            col_count = cursor.fetchone()[0]
            updated = "Unknown"
            n_live_tup = None
            last_vacuum = None
            last_autovacuum = None
            last_analyze = None
            last_autoanalyze = None

            def _ts(val):
                if not val:
                    return None
                return val.isoformat() if hasattr(val, "isoformat") else str(val)

            if stat_row:
                n_live_tup = stat_row[0]
                last_vacuum = _ts(stat_row[1])
                last_autovacuum = _ts(stat_row[2])
                last_analyze = _ts(stat_row[3])
                last_autoanalyze = _ts(stat_row[4])
                for ts in (stat_row[1], stat_row[2], stat_row[3], stat_row[4]):
                    if ts:
                        updated = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
                        break

            return {
                "schema": schema,
                "table": table,
                "row_count": row_count,
                "columns": col_count,
                "updated": updated,
                "size": size_info[0] if size_info else "Unknown",
                "size_bytes": size_info[1] if size_info else 0,
                "n_live_tup": n_live_tup,
                "last_vacuum": last_vacuum,
                "last_autovacuum": last_autovacuum,
                "last_analyze": last_analyze,
                "last_autoanalyze": last_autoanalyze,
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
def get_warehouse_summary():
    """Get summary statistics for the entire data warehouse."""
    try:
        with get_db_connection() as conn:
            return _fetch_warehouse_summary(conn)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/home-dashboard")
async def get_home_dashboard():
    """Single round-trip payload for the Data Warehouse Dashboard home page (summary, sales, customers, alerts, health)."""
    from ml_optimization.api.routes.alert_routes import build_active_alerts_payload

    def _build_sync() -> dict:
        with get_db_connection() as conn:
            summary = _fetch_warehouse_summary(conn)
            sales = _fetch_sales_stats(conn)
            customers = _fetch_customer_stats(conn)
            alerts = build_active_alerts_payload(conn)
            health = _fetch_home_health(conn)
            return {
                "summary": summary,
                "sales": sales,
                "customers": customers,
                "alerts": alerts,
                "health": health,
            }

    try:
        return await asyncio.to_thread(_build_sync)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error building home dashboard: {str(e)}")


@router.get("/data/{schema}/{table}")
def get_table_data(schema: str, table: str, limit: int = 100, offset: int = 0):
    """Get sample data from a table."""
    if schema not in ['bronze', 'silver', 'gold']:
        raise HTTPException(status_code=400, detail="Schema must be bronze, silver, or gold")
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get column names
            cursor.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s
                ORDER BY ordinal_position
            """, (schema, table))
            columns = [{"name": row[0], "type": row[1]} for row in cursor.fetchall()]
            
            # Get sample data
            cursor.execute(f"""
                SELECT * FROM {schema}.{table}
                LIMIT %s OFFSET %s
            """, (limit, offset))
            
            rows = cursor.fetchall()
            data = []
            for row in rows:
                row_dict = {}
                for i, col in enumerate(columns):
                    value = row[i]
                    # Convert non-serializable types
                    if hasattr(value, 'isoformat'):
                        value = value.isoformat()
                    row_dict[col['name']] = value
                data.append(row_dict)
            
            # Get total count
            cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table}")
            total_count = cursor.fetchone()[0]
            
            return {
                "schema": schema,
                "table": table,
                "columns": columns,
                "data": data,
                "total_count": total_count,
                "limit": limit,
                "offset": offset
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sales-stats")
def get_sales_statistics(
    days: int = Query(
        60,
        ge=0,
        le=5000,
        description="Days of daily_sales history; 0 = all dates in fact_sales",
    ),
):
    """Get sales statistics from gold layer."""
    try:
        with get_db_connection() as conn:
            return _fetch_sales_stats(conn, daily_lookback_days=days)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Error in sales-stats: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error fetching sales statistics: {str(e)}")


@router.get("/top-products")
def get_top_products(limit: int = 20):
    """Get top products by revenue."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Top products by revenue
            cursor.execute("""
                SELECT 
                    COALESCE(p.product_name, 'Unknown') as product_name,
                    COUNT(*) as sales_count,
                    SUM(fs.net_amount) as revenue,
                    SUM(fs.quantity) as quantity_sold
                FROM gold.fact_sales fs
                LEFT JOIN gold.dim_product p ON fs.product_key = p.product_key
                GROUP BY p.product_name
                ORDER BY SUM(fs.net_amount) DESC NULLS LAST
                LIMIT %s
            """, (limit,))
            
            top_products = [
                {
                    "product": row[0],
                    "sales_count": row[1],
                    "revenue": float(row[2] or 0),
                    "quantity": row[3] or 0
                }
                for row in cursor.fetchall()
            ]
            
            return {
                "products": top_products,
                "count": len(top_products),
                "limit": limit
            }
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in top-products: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error fetching top products: {str(e)}")


@router.get("/customer-stats")
def get_customer_statistics():
    """Get customer statistics."""
    try:
        with get_db_connection() as conn:
            return _fetch_customer_stats(conn)
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Error in customer-stats: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error fetching customer statistics: {str(e)}")
