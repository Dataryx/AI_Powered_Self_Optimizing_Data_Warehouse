"""
Warehouse Routes
API routes for accessing data warehouse information.
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import date, timedelta
from ml_optimization.utils.db_utils import get_db_connection

router = APIRouter()


@router.get("/schemas")
async def get_schemas():
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
async def get_tables(schema: str):
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
async def get_table_stats(schema: str, table: str):
    """Get statistics for a specific table."""
    if schema not in ['bronze', 'silver', 'gold']:
        raise HTTPException(status_code=400, detail="Schema must be bronze, silver, or gold")
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Get row count
            cursor.execute(f"""
                SELECT COUNT(*) 
                FROM {schema}.{table}
            """)
            row_count = cursor.fetchone()[0]
            
            # Get table size
            cursor.execute("""
                SELECT pg_size_pretty(pg_total_relation_size(%s.%s)) as size,
                       pg_total_relation_size(%s.%s) as size_bytes
            """, (schema, table, schema, table))
            size_info = cursor.fetchone()
            
            return {
                "schema": schema,
                "table": table,
                "row_count": row_count,
                "size": size_info[0] if size_info else "Unknown",
                "size_bytes": size_info[1] if size_info else 0
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_warehouse_summary():
    """Get summary statistics for the entire data warehouse."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            summary = {}
            
            for schema in ['bronze', 'silver', 'gold']:
                # Get table count
                cursor.execute("""
                    SELECT COUNT(*) 
                    FROM pg_tables 
                    WHERE schemaname = %s
                """, (schema,))
                table_count = cursor.fetchone()[0]
                
                # Get total row count across all tables in schema
                cursor.execute("""
                    SELECT SUM(n_tup_ins - n_tup_del) as estimated_rows
                    FROM pg_stat_user_tables
                    WHERE schemaname = %s
                """, (schema,))
                row_result = cursor.fetchone()
                estimated_rows = row_result[0] if row_result[0] else 0
                
                # Get total size
                cursor.execute("""
                    SELECT pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) as total_size,
                           SUM(pg_total_relation_size(schemaname||'.'||tablename)) as total_size_bytes
                    FROM pg_tables
                    WHERE schemaname = %s
                """, (schema,))
                size_result = cursor.fetchone()
                
                summary[schema] = {
                    "table_count": table_count,
                    "estimated_rows": estimated_rows,
                    "total_size": size_result[0] if size_result and size_result[0] else "0 bytes",
                    "total_size_bytes": size_result[1] if size_result and size_result[1] else 0
                }
            
            cursor.execute("SELECT current_database()")
            db_name = cursor.fetchone()[0]
            
            return {
                "warehouse_summary": summary,
                "database": db_name
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data/{schema}/{table}")
async def get_table_data(schema: str, table: str, limit: int = 100, offset: int = 0):
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
async def get_sales_statistics():
    """Get sales statistics from gold layer."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            stats = {}
            
            # Total sales
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_sales,
                    SUM(net_amount) as total_revenue,
                    AVG(net_amount) as avg_sale,
                    SUM(quantity) as total_quantity
                FROM gold.fact_sales
            """)
            row = cursor.fetchone()
            stats['total_sales'] = {
                "count": row[0] or 0,
                "revenue": float(row[1] or 0),
                "avg_sale": float(row[2] or 0),
                "total_quantity": row[3] or 0
            }
            
            # Sales by date (last 30 days) - optimized
            # Calculate date threshold
            threshold_date = date.today() - timedelta(days=30)
            threshold_key = int(threshold_date.strftime('%Y%m%d'))
            
            cursor.execute("""
                SELECT 
                    TO_CHAR(TO_DATE(order_date_key::text, 'YYYYMMDD'), 'YYYY-MM-DD') as date,
                    COUNT(*) as sales_count,
                    SUM(net_amount) as revenue
                FROM gold.fact_sales
                WHERE order_date_key >= %s
                GROUP BY order_date_key
                ORDER BY order_date_key DESC
                LIMIT 30
            """, (threshold_key,))
            daily_sales = [
                {"date": row[0], "count": row[1], "revenue": float(row[2] or 0)}
                for row in cursor.fetchall()
            ]
            stats['daily_sales'] = daily_sales
            
            # Top products - optimized
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
                LIMIT 10
            """)
            top_products = [
                {
                    "product": row[0],
                    "sales_count": row[1],
                    "revenue": float(row[2] or 0),
                    "quantity": row[3] or 0
                }
                for row in cursor.fetchall()
            ]
            stats['top_products'] = top_products
            
            return stats
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in sales-stats: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error fetching sales statistics: {str(e)}")


@router.get("/customer-stats")
async def get_customer_statistics():
    """Get customer statistics."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            stats = {}
            
            # Total customers
            cursor.execute("SELECT COUNT(*) FROM gold.dim_customer")
            stats['total_customers'] = cursor.fetchone()[0]
            
            # Customer orders
            cursor.execute("""
                SELECT 
                    COUNT(DISTINCT customer_key) as unique_customers,
                    COUNT(*) as total_orders,
                    SUM(net_amount) as total_revenue
                FROM gold.fact_orders
            """)
            row = cursor.fetchone()
            stats['orders'] = {
                "unique_customers": row[0] or 0,
                "total_orders": row[1] or 0,
                "total_revenue": float(row[2] or 0)
            }
            
            return stats
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error in customer-stats: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error fetching customer statistics: {str(e)}")
