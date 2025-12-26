"""
Generate Optimization Recommendations
Generates index and partition recommendations based on query logs.
"""

import sys
import logging
import psycopg2
import os
import json
from pathlib import Path
from datetime import datetime

# Add parent directory to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "ml-optimization"))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def generate_index_recommendations():
    """Generate index recommendations from query logs."""
    
    db_conn_str = (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')}"
    )
    
    connection = psycopg2.connect(db_conn_str)
    cursor = connection.cursor()
    
    try:
        logger.info("=" * 60)
        logger.info("Generating Index Recommendations")
        logger.info("=" * 60)
        
        # Analyze frequently filtered columns from query logs
        cursor.execute("""
            SELECT 
                query_text,
                calls,
                mean_exec_time_ms,
                extracted_features
            FROM ml_optimization.query_logs
            WHERE query_text LIKE '%WHERE%'
            AND calls > 10
            ORDER BY calls DESC, mean_exec_time_ms DESC
            LIMIT 50
        """)
        
        queries = cursor.fetchall()
        logger.info(f"Analyzing {len(queries)} queries for index recommendations...")
        
        recommendations = []
        
        # Simple pattern matching for WHERE clauses
        for query_text, calls, exec_time, features in queries:
            if not query_text:
                continue
            
            query_upper = query_text.upper()
            
            # Extract table and column patterns
            if 'WHERE' in query_upper:
                # Look for patterns like "table.column = " or "column = "
                if 'SILVER.' in query_upper or 'BRONZE.' in query_upper or 'GOLD.' in query_upper:
                    # Extract table name
                    if 'SILVER.ORDERS' in query_upper and 'ORDER_DATE' in query_upper:
                        recommendations.append({
                            'type': 'index',
                            'table': 'silver.orders',
                            'column': 'order_date',
                            'priority': 'high' if exec_time > 100 else 'medium',
                            'estimated_improvement': f"{float(exec_time) * 0.5:.2f}ms reduction",
                            'query_count': calls,
                            'avg_execution_time_ms': exec_time
                        })
                    elif 'SILVER.CUSTOMERS' in query_upper and 'CUSTOMER_ID' in query_upper:
                        recommendations.append({
                            'type': 'index',
                            'table': 'silver.customers',
                            'column': 'customer_id',
                            'priority': 'high' if exec_time > 50 else 'medium',
                            'estimated_improvement': f"{float(exec_time) * 0.3:.2f}ms reduction",
                            'query_count': calls,
                            'avg_execution_time_ms': exec_time
                        })
                    elif 'SILVER.PRODUCTS' in query_upper and ('PRODUCT_ID' in query_upper or 'CATEGORY' in query_upper):
                        col = 'product_id' if 'PRODUCT_ID' in query_upper else 'category'
                        recommendations.append({
                            'type': 'index',
                            'table': 'silver.products',
                            'column': col,
                            'priority': 'medium',
                            'estimated_improvement': f"{float(exec_time) * 0.4:.2f}ms reduction",
                            'query_count': calls,
                            'avg_execution_time_ms': exec_time
                        })
        
        # Deduplicate recommendations
        seen = set()
        unique_recommendations = []
        for rec in recommendations:
            key = (rec['table'], rec['column'])
            if key not in seen:
                seen.add(key)
                unique_recommendations.append(rec)
        
        logger.info(f"\nGenerated {len(unique_recommendations)} index recommendations:")
        for i, rec in enumerate(unique_recommendations, 1):
            logger.info(f"\n{i}. {rec['table']}.{rec['column']}")
            logger.info(f"   Priority: {rec['priority']}")
            logger.info(f"   Estimated improvement: {rec['estimated_improvement']}")
            logger.info(f"   Based on {rec['query_count']} queries")
        
        # Store recommendations in database
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ml_optimization.index_recommendations (
                recommendation_id BIGSERIAL PRIMARY KEY,
                table_name VARCHAR(255) NOT NULL,
                column_name VARCHAR(255) NOT NULL,
                recommendation_type VARCHAR(50),
                priority VARCHAR(20),
                estimated_improvement TEXT,
                query_count INTEGER,
                avg_execution_time_ms NUMERIC,
                sql_statement TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        for rec in unique_recommendations:
            sql = f"CREATE INDEX IF NOT EXISTS idx_{rec['table'].split('.')[1]}_{rec['column']} ON {rec['table']}({rec['column']})"
            cursor.execute("""
                INSERT INTO ml_optimization.index_recommendations 
                (table_name, column_name, recommendation_type, priority, estimated_improvement, 
                 query_count, avg_execution_time_ms, sql_statement)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                rec['table'],
                rec['column'],
                rec['type'],
                rec['priority'],
                rec['estimated_improvement'],
                rec['query_count'],
                rec['avg_execution_time_ms'],
                sql
            ))
        
        connection.commit()
        logger.info(f"\nStored {len(unique_recommendations)} recommendations in database")
        
        logger.info("=" * 60)
        logger.info("Index Recommendations Complete!")
        logger.info("=" * 60)
        
        return unique_recommendations
        
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}", exc_info=True)
        connection.rollback()
        return []
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    generate_index_recommendations()

