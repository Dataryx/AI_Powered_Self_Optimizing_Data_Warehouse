"""
Performance Testing Script
Measures optimization effectiveness by comparing query performance.
"""

import sys
import logging
import psycopg2
import time
import statistics
from datetime import datetime
from pathlib import Path
import os
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_performance_tests():
    """Run performance tests to measure optimization effectiveness."""
    
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
        logger.info("Performance Testing - Optimization Effectiveness")
        logger.info("=" * 60)
        
        # Create results table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ml_optimization.performance_test_results (
                test_id BIGSERIAL PRIMARY KEY,
                test_name VARCHAR(255),
                query_text TEXT,
                execution_time_ms NUMERIC,
                test_run_id VARCHAR(100),
                test_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT
            )
        """)
        connection.commit()
        
        # Generate test run ID
        test_run_id = f"test_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        logger.info(f"Test Run ID: {test_run_id}")
        
        # Test queries based on recommendations
        test_queries = [
            {
                'name': 'orders_by_date',
                'query': "SELECT * FROM silver.orders WHERE order_date >= CURRENT_DATE - INTERVAL '30 days' ORDER BY order_date DESC LIMIT 100",
                'description': 'Query on order_date (recommended index)'
            },
            {
                'name': 'customer_lookup',
                'query': "SELECT * FROM silver.customers WHERE customer_id = (SELECT customer_id FROM silver.customers LIMIT 1)",
                'description': 'Customer lookup by customer_id (recommended index)'
            },
            {
                'name': 'products_by_category',
                'query': "SELECT * FROM silver.products WHERE category = 'Electronics' AND is_current = TRUE LIMIT 50",
                'description': 'Products by category (recommended index)'
            },
            {
                'name': 'orders_join_customers',
                'query': """
                    SELECT o.order_id, c.full_name, o.order_date, o.total_amount
                    FROM silver.orders o
                    JOIN silver.customers c ON o.customer_sk = c.customer_sk
                    WHERE o.order_date >= CURRENT_DATE - INTERVAL '7 days'
                    LIMIT 100
                """,
                'description': 'Orders with customer join'
            },
            {
                'name': 'sales_summary',
                'query': """
                    SELECT 
                        DATE_TRUNC('day', o.order_date) as day,
                        COUNT(*) as order_count,
                        SUM(o.total_amount) as total_revenue
                    FROM silver.orders o
                    WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
                    GROUP BY day
                    ORDER BY day DESC
                """,
                'description': 'Daily sales summary aggregation'
            }
        ]
        
        results = []
        
        logger.info(f"\nRunning {len(test_queries)} performance tests...")
        logger.info("-" * 60)
        
        for i, test in enumerate(test_queries, 1):
            logger.info(f"\nTest {i}/{len(test_queries)}: {test['name']}")
            logger.info(f"  Description: {test['description']}")
            
            # Warm up
            try:
                cursor.execute(test['query'])
                cursor.fetchall()
            except:
                pass
            
            # Run multiple times for average
            execution_times = []
            for run in range(5):
                start_time = time.time()
                try:
                    cursor.execute(test['query'])
                    rows = cursor.fetchall()
                    execution_time = (time.time() - start_time) * 1000  # Convert to ms
                    execution_times.append(execution_time)
                except Exception as e:
                    logger.error(f"  Error in run {run+1}: {e}")
                    execution_times.append(None)
            
            # Calculate statistics
            valid_times = [t for t in execution_times if t is not None]
            if valid_times:
                avg_time = statistics.mean(valid_times)
                min_time = min(valid_times)
                max_time = max(valid_times)
                median_time = statistics.median(valid_times)
                
                logger.info(f"  Results (5 runs):")
                logger.info(f"    Average: {avg_time:.2f}ms")
                logger.info(f"    Median: {median_time:.2f}ms")
                logger.info(f"    Min: {min_time:.2f}ms")
                logger.info(f"    Max: {max_time:.2f}ms")
                
                # Store results
                cursor.execute("""
                    INSERT INTO ml_optimization.performance_test_results
                    (test_name, query_text, execution_time_ms, test_run_id, notes)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    test['name'],
                    test['query'],
                    avg_time,
                    test_run_id,
                    json.dumps({
                        'min': min_time,
                        'max': max_time,
                        'median': median_time,
                        'runs': len(valid_times)
                    })
                ))
                
                results.append({
                    'name': test['name'],
                    'description': test['description'],
                    'avg_time': avg_time,
                    'median_time': median_time,
                    'min_time': min_time,
                    'max_time': max_time
                })
            else:
                logger.warning(f"  No valid results for {test['name']}")
        
        connection.commit()
        
        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("Performance Test Summary")
        logger.info("=" * 60)
        
        if results:
            total_time = sum(r['avg_time'] for r in results)
            logger.info(f"\nTotal execution time: {total_time:.2f}ms")
            logger.info(f"Average query time: {total_time/len(results):.2f}ms")
            
            logger.info("\nQuery Performance:")
            for r in results:
                logger.info(f"  {r['name']}: {r['avg_time']:.2f}ms (median: {r['median_time']:.2f}ms)")
            
            # Compare with baseline if available
            cursor.execute("""
                SELECT test_name, AVG(execution_time_ms) as avg_time
                FROM ml_optimization.performance_test_results
                WHERE test_run_id != %s
                GROUP BY test_name
            """, (test_run_id,))
            
            baselines = {row[0]: row[1] for row in cursor.fetchall()}
            
            if baselines:
                logger.info("\nComparison with Previous Runs:")
                for r in results:
                    if r['name'] in baselines:
                        baseline = baselines[r['name']]
                        improvement = ((baseline - r['avg_time']) / baseline) * 100
                        logger.info(f"  {r['name']}: {r['avg_time']:.2f}ms (baseline: {baseline:.2f}ms, {improvement:+.1f}%)")
        
        logger.info(f"\nResults stored with test_run_id: {test_run_id}")
        logger.info("=" * 60)
        
        return test_run_id
        
    except Exception as e:
        logger.error(f"Error running performance tests: {e}", exc_info=True)
        connection.rollback()
        return None
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    run_performance_tests()

