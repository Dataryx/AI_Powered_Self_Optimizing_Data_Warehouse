"""
Query Workload Generator
Generates realistic query workloads for optimization testing.
"""

import psycopg2
import random
import time
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
import os

logger = logging.getLogger(__name__)


class QueryWorkloadGenerator:
    """Generates realistic query workloads."""
    
    def __init__(self, connection):
        """Initialize query workload generator."""
        self.connection = connection
        self.cursor = connection.cursor()
    
    def generate_simple_queries(self, count: int = 100) -> List[Dict[str, Any]]:
        """Generate simple lookup queries."""
        queries = []
        
        logger.info(f"Generating {count} simple queries...")
        
        # Get random customer IDs
        self.cursor.execute("SELECT customer_id FROM silver.customers WHERE is_current = TRUE LIMIT 1000")
        customer_ids = [row[0] for row in self.cursor.fetchall()]
        
        # Get random product IDs
        self.cursor.execute("SELECT product_id FROM silver.products WHERE is_current = TRUE LIMIT 1000")
        product_ids = [row[0] for row in self.cursor.fetchall()]
        
        query_templates = [
            ("SELECT * FROM silver.customers WHERE customer_id = %s", customer_ids),
            ("SELECT * FROM silver.products WHERE product_id = %s", product_ids),
            ("SELECT * FROM silver.orders WHERE order_id = %s", self._get_random_order_ids(1000)),
        ]
        
        for _ in range(count):
            template, ids = random.choice(query_templates)
            query_id = random.choice(ids)
            queries.append({
                'query': template % (query_id,),
                'type': 'simple_lookup',
                'tables': self._extract_tables(template)
            })
        
        return queries
    
    def generate_analytical_queries(self, count: int = 50) -> List[Dict[str, Any]]:
        """Generate complex analytical queries."""
        queries = []
        
        logger.info(f"Generating {count} analytical queries...")
        
        query_templates = [
            """
            SELECT 
                c.customer_segment,
                COUNT(DISTINCT o.order_sk) as order_count,
                SUM(o.total_amount) as total_revenue,
                AVG(o.total_amount) as avg_order_value
            FROM silver.customers c
            JOIN silver.orders o ON c.customer_sk = o.customer_sk
            WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY c.customer_segment
            ORDER BY total_revenue DESC
            """,
            """
            SELECT 
                p.category,
                COUNT(DISTINCT oi.order_item_sk) as items_sold,
                SUM(oi.total_amount) as revenue,
                AVG(oi.unit_price) as avg_price
            FROM silver.products p
            JOIN silver.order_items oi ON p.product_sk = oi.product_sk
            JOIN silver.orders o ON oi.order_sk = o.order_sk
            WHERE o.order_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY p.category
            ORDER BY revenue DESC
            """,
            """
            SELECT 
                DATE_TRUNC('week', o.order_date) as week,
                COUNT(DISTINCT o.order_sk) as orders,
                SUM(o.total_amount) as revenue,
                COUNT(DISTINCT o.customer_sk) as customers
            FROM silver.orders o
            WHERE o.order_date >= CURRENT_DATE - INTERVAL '90 days'
            GROUP BY week
            ORDER BY week DESC
            """,
        ]
        
        for _ in range(count):
            query = random.choice(query_templates)
            queries.append({
                'query': query,
                'type': 'analytical',
                'tables': self._extract_tables(query)
            })
        
        return queries
    
    def generate_join_queries(self, count: int = 30) -> List[Dict[str, Any]]:
        """Generate queries with joins."""
        queries = []
        
        logger.info(f"Generating {count} join queries...")
        
        query_templates = [
            """
            SELECT 
                o.order_id,
                c.full_name,
                o.order_date,
                o.total_amount,
                COUNT(oi.order_item_sk) as item_count
            FROM silver.orders o
            JOIN silver.customers c ON o.customer_sk = c.customer_sk
            LEFT JOIN silver.order_items oi ON o.order_sk = oi.order_sk
            WHERE o.order_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY o.order_id, c.full_name, o.order_date, o.total_amount
            ORDER BY o.order_date DESC
            LIMIT 100
            """,
            """
            SELECT 
                p.product_name,
                p.category,
                SUM(oi.quantity) as total_quantity,
                AVG(pr.rating) as avg_rating
            FROM silver.products p
            JOIN silver.order_items oi ON p.product_sk = oi.product_sk
            LEFT JOIN silver.product_reviews pr ON p.product_sk = pr.product_sk
            WHERE p.category = %s
            GROUP BY p.product_sk, p.product_name, p.category
            ORDER BY total_quantity DESC
            LIMIT 50
            """,
        ]
        
        # Get categories
        self.cursor.execute("SELECT DISTINCT category FROM silver.products WHERE category IS NOT NULL LIMIT 10")
        categories = [row[0] for row in self.cursor.fetchall()]
        
        for _ in range(count):
            template = random.choice(query_templates)
            if '%s' in template:
                category = random.choice(categories) if categories else 'Electronics'
                query = template.replace('%s', f"'{category}'")
            else:
                query = template
            queries.append({
                'query': query,
                'type': 'join',
                'tables': self._extract_tables(query)
            })
        
        return queries
    
    def _get_random_order_ids(self, limit: int = 1000) -> List[str]:
        """Get random order IDs."""
        self.cursor.execute("SELECT order_id FROM silver.orders LIMIT %s", (limit,))
        return [row[0] for row in self.cursor.fetchall()]
    
    def _extract_tables(self, query: str) -> List[str]:
        """Extract table names from query."""
        tables = []
        query_lower = query.lower()
        if 'from silver.' in query_lower:
            for line in query.split('\n'):
                if 'from silver.' in line.lower():
                    table = line.lower().split('silver.')[1].split()[0].strip()
                    if table not in tables:
                        tables.append(table)
        return tables
    
    def execute_workload(self, queries: List[Dict[str, Any]], delay: float = 0.1):
        """Execute a workload of queries and log results."""
        logger.info(f"Executing workload of {len(queries)} queries...")
        
        results = []
        
        for i, query_info in enumerate(queries, 1):
            query = query_info['query']
            start_time = time.time()
            
            try:
                # Reset connection if previous query failed
                if self.connection.closed:
                    self.connection = psycopg2.connect(
                        host=os.getenv("POSTGRES_HOST", "localhost"),
                        port=int(os.getenv("POSTGRES_PORT", "5432")),
                        database=os.getenv("POSTGRES_DB", "datawarehouse"),
                        user=os.getenv("POSTGRES_USER", "postgres"),
                        password=os.getenv("POSTGRES_PASSWORD", "postgres")
                    )
                    self.cursor = self.connection.cursor()
                
                # Use autocommit for each query
                self.connection.autocommit = True
                self.cursor.execute(query)
                rows = self.cursor.fetchall()
                execution_time = time.time() - start_time
                
                logger.info(
                    f"Query {i}/{len(queries)} [{query_info['type']}] - "
                    f"Execution time: {execution_time:.3f}s - Rows: {len(rows)}"
                )
                
                results.append({
                    'query': query,
                    'type': query_info['type'],
                    'execution_time': execution_time,
                    'rows_returned': len(rows),
                    'timestamp': datetime.now(),
                    'success': True
                })
                
            except Exception as e:
                execution_time = time.time() - start_time
                # Rollback and reset connection on error
                try:
                    self.connection.rollback()
                except:
                    pass
                
                # Reconnect if connection is bad
                try:
                    if self.connection.closed:
                        self.connection = psycopg2.connect(
                            host=os.getenv("POSTGRES_HOST", "localhost"),
                            port=int(os.getenv("POSTGRES_PORT", "5432")),
                            database=os.getenv("POSTGRES_DB", "datawarehouse"),
                            user=os.getenv("POSTGRES_USER", "postgres"),
                            password=os.getenv("POSTGRES_PASSWORD", "postgres")
                        )
                        self.cursor = self.connection.cursor()
                except:
                    pass
                
                logger.error(f"Query {i}/{len(queries)} failed: {e}")
                results.append({
                    'query': query,
                    'type': query_info['type'],
                    'execution_time': execution_time,
                    'rows_returned': 0,
                    'timestamp': datetime.now(),
                    'success': False,
                    'error': str(e)
                })
            
            time.sleep(delay)
        
        return results
    
    def generate_and_execute_workload(
        self,
        simple_count: int = 100,
        analytical_count: int = 50,
        join_count: int = 30
    ):
        """Generate and execute a complete workload."""
        logger.info("=" * 60)
        logger.info("Generating Query Workload")
        logger.info("=" * 60)
        
        all_queries = []
        
        # Generate different query types
        all_queries.extend(self.generate_simple_queries(simple_count))
        all_queries.extend(self.generate_analytical_queries(analytical_count))
        all_queries.extend(self.generate_join_queries(join_count))
        
        # Shuffle queries
        random.shuffle(all_queries)
        
        logger.info(f"\nTotal queries generated: {len(all_queries)}")
        logger.info(f"  - Simple: {simple_count}")
        logger.info(f"  - Analytical: {analytical_count}")
        logger.info(f"  - Join: {join_count}")
        
        # Execute workload
        results = self.execute_workload(all_queries)
        
        # Summary
        successful = sum(1 for r in results if r['success'])
        failed = len(results) - successful
        total_time = sum(r['execution_time'] for r in results)
        avg_time = total_time / len(results) if results else 0
        
        logger.info("\n" + "=" * 60)
        logger.info("Workload Execution Summary")
        logger.info("=" * 60)
        logger.info(f"Total queries: {len(results)}")
        logger.info(f"Successful: {successful}")
        logger.info(f"Failed: {failed}")
        logger.info(f"Total execution time: {total_time:.2f}s")
        logger.info(f"Average execution time: {avg_time:.3f}s")
        logger.info("=" * 60)
        
        return results


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    connection = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres")
    )
    
    try:
        generator = QueryWorkloadGenerator(connection)
        generator.generate_and_execute_workload(
            simple_count=100,
            analytical_count=50,
            join_count=30
        )
    finally:
        connection.close()

