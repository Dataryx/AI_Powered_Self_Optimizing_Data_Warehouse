"""
Query Workload Generator
Generates realistic query workloads for optimization testing.
"""

import psycopg2
import hashlib
import random
import time
import logging
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
import os

logger = logging.getLogger(__name__)


class QueryLogWriter:
    """
    Writes per-execution rows into ml_optimization.query_logs.

    This is separate from pg_stat_statements collection: it lets you generate
    millions of training rows with real measured latency from the workload runner.
    """

    def __init__(self, connection, schema: str = "ml_optimization"):
        self.connection = connection
        self.schema = schema
        self._ensure_table_exists()

    def _ensure_table_exists(self):
        cur = self.connection.cursor()
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.query_logs (
                log_id BIGSERIAL PRIMARY KEY,
                query_hash VARCHAR(64),
                query_text TEXT,
                query_template TEXT,
                calls BIGINT,
                total_exec_time_ms NUMERIC(15, 3),
                mean_exec_time_ms NUMERIC(15, 3),
                min_exec_time_ms NUMERIC(15, 3),
                max_exec_time_ms NUMERIC(15, 3),
                stddev_exec_time_ms NUMERIC(15, 3),
                rows_affected BIGINT,
                shared_blks_hit BIGINT,
                shared_blks_read BIGINT,
                shared_blks_dirtied BIGINT,
                shared_blks_written BIGINT,
                local_blks_hit BIGINT,
                local_blks_read BIGINT,
                local_blks_dirtied BIGINT,
                local_blks_written BIGINT,
                temp_blks_read BIGINT,
                temp_blks_written BIGINT,
                blk_read_time_ms NUMERIC(15, 3),
                blk_write_time_ms NUMERIC(15, 3),
                query_plan JSONB,
                extracted_features JSONB,
                collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_query_logs_query_hash
                ON {self.schema}.query_logs(query_hash);
            CREATE INDEX IF NOT EXISTS idx_query_logs_collected_at
                ON {self.schema}.query_logs(collected_at);
            """
        )
        cur.close()

    def insert_execution_rows(self, rows: list[tuple]):
        """
        Insert execution rows.

        Each row tuple format:
          (query_hash, query_text, query_template, calls,
           total_exec_time_ms, mean_exec_time_ms, min_exec_time_ms, max_exec_time_ms, stddev_exec_time_ms,
           rows_affected,
           shared_blks_hit, shared_blks_read, shared_blks_dirtied, shared_blks_written,
           local_blks_hit, local_blks_read, local_blks_dirtied, local_blks_written,
           temp_blks_read, temp_blks_written,
           blk_read_time_ms, blk_write_time_ms,
           query_plan_json, extracted_features_json, collected_at)
        """
        cur = self.connection.cursor()
        cur.executemany(
            f"""
            INSERT INTO {self.schema}.query_logs (
                query_hash, query_text, query_template, calls,
                total_exec_time_ms, mean_exec_time_ms, min_exec_time_ms, max_exec_time_ms, stddev_exec_time_ms,
                rows_affected,
                shared_blks_hit, shared_blks_read, shared_blks_dirtied, shared_blks_written,
                local_blks_hit, local_blks_read, local_blks_dirtied, local_blks_written,
                temp_blks_read, temp_blks_written,
                blk_read_time_ms, blk_write_time_ms,
                query_plan, extracted_features, collected_at
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                %s, %s,
                %s::jsonb, %s::jsonb, %s
            )
            """,
            rows,
        )
        cur.close()


class QueryWorkloadGenerator:
    """Generates realistic query workloads."""
    
    def __init__(self, connection):
        """Initialize query workload generator."""
        self.connection = connection
        self.cursor = connection.cursor()
        self._query_log_writer = None

    def _hash_query(self, query: str) -> str:
        return hashlib.sha256(query.encode("utf-8")).hexdigest()

    def _normalize_query(self, query: str) -> str:
        # Replace string literals + numbers with placeholders (simple heuristic)
        import re
        normalized = re.sub(r"'[^']*'", "'?'", query)
        normalized = re.sub(r"\b\d+\b", "?", normalized)
        normalized = " ".join(normalized.split())
        return normalized

    def _ensure_query_log_writer(self):
        if self._query_log_writer is None:
            self._query_log_writer = QueryLogWriter(self.connection, schema="ml_optimization")
        return self._query_log_writer
    
    def generate_simple_queries(self, count: int = 100) -> List[Dict[str, Any]]:
        """Generate simple lookup queries. Uses complete_warehouse schema (silver.customer, silver.product, silver.orders)."""
        queries = []
        
        logger.info(f"Generating {count} simple queries...")
        
        # Get random customer IDs (silver.customer - complete_warehouse schema)
        self.cursor.execute("SELECT customer_id FROM silver.customer WHERE is_valid = TRUE LIMIT 1000")
        customer_ids = [row[0] for row in self.cursor.fetchall()]
        
        # Get random product IDs (silver.product)
        self.cursor.execute("SELECT product_id FROM silver.product WHERE is_valid = TRUE LIMIT 1000")
        product_ids = [row[0] for row in self.cursor.fetchall()]
        
        order_ids = self._get_random_order_ids(1000)
        query_templates = []
        if customer_ids:
            query_templates.append(("SELECT * FROM silver.customer WHERE customer_id = %s", customer_ids))
        if product_ids:
            query_templates.append(("SELECT * FROM silver.product WHERE product_id = %s", product_ids))
        if order_ids:
            query_templates.append(("SELECT * FROM silver.orders WHERE order_id = %s", order_ids))
        if not query_templates:
            logger.warning("No silver.customer, silver.product, or silver.orders data found. Run ETL first.")
            return queries

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
        """Generate complex analytical queries. Uses complete_warehouse schema."""
        queries = []
        
        logger.info(f"Generating {count} analytical queries...")
        
        query_templates = [
            """
            SELECT 
                c.income_bracket,
                COUNT(DISTINCT o.order_key) as order_count,
                SUM(o.order_total) as total_revenue,
                AVG(o.order_total) as avg_order_value
            FROM silver.customer c
            JOIN silver.orders o ON c.customer_key = o.customer_key
            WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
            AND o.order_total IS NOT NULL
            GROUP BY c.income_bracket
            ORDER BY total_revenue DESC
            """,
            """
            SELECT 
                p.category_name,
                COUNT(DISTINCT oi.order_item_key) as items_sold,
                SUM(oi.line_total) as revenue,
                AVG(oi.unit_price) as avg_price
            FROM silver.product p
            JOIN silver.order_item oi ON p.product_key = oi.product_key
            JOIN silver.orders o ON oi.order_key = o.order_key
            WHERE o.order_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY p.category_name
            ORDER BY revenue DESC
            """,
            """
            SELECT 
                DATE_TRUNC('week', o.order_date) as week,
                COUNT(DISTINCT o.order_key) as orders,
                SUM(o.order_total) as revenue,
                COUNT(DISTINCT o.customer_key) as customers
            FROM silver.orders o
            WHERE o.order_date >= CURRENT_DATE - INTERVAL '90 days'
            AND o.order_total IS NOT NULL
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
        """Generate queries with joins. Uses complete_warehouse schema."""
        queries = []
        
        logger.info(f"Generating {count} join queries...")
        
        query_templates = [
            """
            SELECT 
                o.order_id,
                o.order_date,
                o.order_total,
                COUNT(oi.order_item_key) as item_count
            FROM silver.orders o
            JOIN silver.customer c ON o.customer_key = c.customer_key
            LEFT JOIN silver.order_item oi ON o.order_key = oi.order_key
            WHERE o.order_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY o.order_id, o.order_date, o.order_total
            ORDER BY o.order_date DESC
            LIMIT 100
            """,
            """
            SELECT 
                p.product_name,
                p.category_name,
                SUM(oi.quantity) as total_quantity,
                SUM(oi.line_total) as total_sales
            FROM silver.product p
            JOIN silver.order_item oi ON p.product_key = oi.product_key
            WHERE p.category_name = %s
            GROUP BY p.product_key, p.product_name, p.category_name
            ORDER BY total_quantity DESC
            LIMIT 50
            """,
        ]
        
        # Get categories (complete_warehouse: silver.product.category_name)
        try:
            self.cursor.execute(
                "SELECT DISTINCT category_name FROM silver.product WHERE category_name IS NOT NULL LIMIT 10"
            )
            categories = [row[0] for row in self.cursor.fetchall()]
        except Exception:
            categories = []
        
        for _ in range(count):
            template = random.choice(query_templates)
            if '%s' in template:
                category = random.choice(categories) if categories else 'Electronics'
                # Escape single quote in category for SQL
                category_escaped = category.replace("'", "''") if category else 'Electronics'
                query = template.replace('%s', f"'{category_escaped}'")
            else:
                query = template
            queries.append({
                'query': query,
                'type': 'join',
                'tables': self._extract_tables(query)
            })
        
        return queries
    
    def _get_random_order_ids(self, limit: int = 1000) -> List[int]:
        """Get random order IDs (complete_warehouse: silver.orders.order_id)."""
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
        total = len(queries)
        logger.info(f"Executing workload of {total:,} queries...")
        log_every = 50_000 if total > 10_000 else 1

        # Leave any transaction from generate_* and enable autocommit (required for set_session)
        try:
            self.connection.rollback()
        except Exception:
            pass
        self.connection.autocommit = True

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
                    self.connection.autocommit = True
                    self.cursor = self.connection.cursor()

                self.cursor.execute(query)
                rows = self.cursor.fetchall()
                execution_time = time.time() - start_time

                if i % log_every == 0 or i == total:
                    logger.info(
                        f"Query {i:,}/{total:,} [{query_info['type']}] - "
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
                except Exception:
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
                        self.connection.autocommit = True
                        self.cursor = self.connection.cursor()
                except Exception:
                    pass

                logger.error(f"Query {i:,}/{total:,} failed: {e}")
                results.append({
                    'query': query,
                    'type': query_info['type'],
                    'execution_time': execution_time,
                    'rows_returned': 0,
                    'timestamp': datetime.now(),
                    'success': False,
                    'error': str(e)
                })

            if delay > 0:
                time.sleep(delay)

        return results

    def execute_streaming_workload(
        self,
        simple_count: int,
        analytical_count: int,
        join_count: int,
        delay: float = 0.0,
        log_to_query_logs: bool = True,
        batch_size: int = 1000,
        seed: int | None = None,
        log_every: int = 50_000,
    ):
        """
        Execute a large workload without building a massive in-memory query list.

        If log_to_query_logs=True, each executed query is also inserted into
        ml_optimization.query_logs (one row per execution) so you can produce
        millions of training rows.
        """
        total = int(simple_count) + int(analytical_count) + int(join_count)
        logger.info(f"Executing streaming workload of {total:,} queries...")

        if seed is not None:
            random.seed(seed)

        # Close any open transaction and enable autocommit for the run
        try:
            self.connection.rollback()
        except Exception:
            pass
        self.connection.autocommit = True

        writer = self._ensure_query_log_writer() if log_to_query_logs else None
        log_rows = []

        # Pre-fetch IDs and categories once (fast, avoids repeated SELECTs)
        self.cursor.execute("SELECT customer_id FROM silver.customer WHERE is_valid = TRUE LIMIT 10000")
        customer_ids = [row[0] for row in self.cursor.fetchall()]
        self.cursor.execute("SELECT product_id FROM silver.product WHERE is_valid = TRUE LIMIT 10000")
        product_ids = [row[0] for row in self.cursor.fetchall()]
        self.cursor.execute("SELECT order_id FROM silver.orders LIMIT 10000")
        order_ids = [row[0] for row in self.cursor.fetchall()]
        try:
            self.cursor.execute("SELECT DISTINCT category_name FROM silver.product WHERE category_name IS NOT NULL LIMIT 100")
            categories = [row[0] for row in self.cursor.fetchall()]
        except Exception:
            categories = []

        if not (customer_ids or product_ids or order_ids):
            raise RuntimeError("No data found in Silver tables. Run ETL first.")

        simple_templates = []
        if customer_ids:
            simple_templates.append(("SELECT * FROM silver.customer WHERE customer_id = %s", customer_ids))
        if product_ids:
            simple_templates.append(("SELECT * FROM silver.product WHERE product_id = %s", product_ids))
        if order_ids:
            simple_templates.append(("SELECT * FROM silver.orders WHERE order_id = %s", order_ids))

        analytical_templates = [
            """
            SELECT
                c.income_bracket,
                COUNT(DISTINCT o.order_key) as order_count,
                SUM(o.order_total) as total_revenue,
                AVG(o.order_total) as avg_order_value
            FROM silver.customer c
            JOIN silver.orders o ON c.customer_key = o.customer_key
            WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
            AND o.order_total IS NOT NULL
            GROUP BY c.income_bracket
            ORDER BY total_revenue DESC
            """,
            """
            SELECT
                p.category_name,
                COUNT(DISTINCT oi.order_item_key) as items_sold,
                SUM(oi.line_total) as revenue,
                AVG(oi.unit_price) as avg_price
            FROM silver.product p
            JOIN silver.order_item oi ON p.product_key = oi.product_key
            JOIN silver.orders o ON oi.order_key = o.order_key
            WHERE o.order_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY p.category_name
            ORDER BY revenue DESC
            """,
            """
            SELECT
                DATE_TRUNC('week', o.order_date) as week,
                COUNT(DISTINCT o.order_key) as orders,
                SUM(o.order_total) as revenue,
                COUNT(DISTINCT o.customer_key) as customers
            FROM silver.orders o
            WHERE o.order_date >= CURRENT_DATE - INTERVAL '90 days'
            AND o.order_total IS NOT NULL
            GROUP BY week
            ORDER BY week DESC
            """,
        ]

        join_templates = [
            """
            SELECT
                o.order_id,
                o.order_date,
                o.order_total,
                COUNT(oi.order_item_key) as item_count
            FROM silver.orders o
            JOIN silver.customer c ON o.customer_key = c.customer_key
            LEFT JOIN silver.order_item oi ON o.order_key = oi.order_key
            WHERE o.order_date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY o.order_id, o.order_date, o.order_total
            ORDER BY o.order_date DESC
            LIMIT 100
            """,
            """
            SELECT
                p.product_name,
                p.category_name,
                SUM(oi.quantity) as total_quantity,
                SUM(oi.line_total) as total_sales
            FROM silver.product p
            JOIN silver.order_item oi ON p.product_key = oi.product_key
            WHERE p.category_name = %s
            GROUP BY p.product_key, p.product_name, p.category_name
            ORDER BY total_quantity DESC
            LIMIT 50
            """,
        ]

        counts_left = {"simple": int(simple_count), "analytical": int(analytical_count), "join": int(join_count)}

        def pick_kind():
            kinds = [k for k, v in counts_left.items() if v > 0]
            return random.choice(kinds)

        successful = 0
        failed = 0
        total_time = 0.0
        # When log_every is small (e.g. 1), this will be very verbose and slower.
        log_every = max(int(log_every), 1)

        for i in range(1, total + 1):
            kind = pick_kind()
            counts_left[kind] -= 1

            if kind == "simple":
                template, ids = random.choice(simple_templates)
                qid = random.choice(ids)
                query = template % (qid,)
            elif kind == "analytical":
                query = random.choice(analytical_templates)
            else:
                template = random.choice(join_templates)
                if "%s" in template:
                    category = random.choice(categories) if categories else "Electronics"
                    category_escaped = category.replace("'", "''") if category else "Electronics"
                    query = template.replace("%s", f"'{category_escaped}'")
                else:
                    query = template

            start_time = time.time()
            try:
                self.cursor.execute(query)
                rows = self.cursor.fetchall()
                execution_time = time.time() - start_time
                successful += 1
            except Exception as e:
                execution_time = time.time() - start_time
                failed += 1
                try:
                    self.connection.rollback()
                except Exception:
                    pass
                logger.error(f"Query {i:,}/{total:,} [{kind}] failed: {e}")
                rows = []

            total_time += execution_time

            if i % log_every == 0 or i == total:
                logger.info(
                    f"Progress {i:,}/{total:,} - success={successful:,} failed={failed:,} "
                    f"avg_time={(total_time / max(i, 1)):.3f}s"
                )

            if writer is not None:
                # One row per execution (good for ML training volume)
                q_hash = self._hash_query(query)
                q_template = self._normalize_query(query)
                exec_ms = float(execution_time * 1000.0)
                # For a single execution, total == mean == min == max, stddev == 0
                total_exec_time_ms = exec_ms
                mean_exec_time_ms = exec_ms
                min_exec_time_ms = exec_ms
                max_exec_time_ms = exec_ms
                stddev_exec_time_ms = 0.0

                # Lightweight extracted_features (similar intent to QueryLogCollector.extract_features)
                q_upper = query.upper()
                extracted_features = {
                    "query_type": query.strip().split()[0].upper() if query.strip() else "OTHER",
                    "table_count": q_upper.count("FROM") + q_upper.count("JOIN"),
                    "join_count": q_upper.count("JOIN"),
                    "has_aggregation": int(any(x in q_upper for x in ["SUM(", "COUNT(", "AVG(", "MIN(", "MAX(", "GROUP BY"])),
                    "has_window_function": int(" OVER " in q_upper),
                    "has_subquery": int("SELECT" in q_upper and q_upper.count("SELECT") > 1),
                    "has_cte": int(q_upper.lstrip().startswith("WITH ")),
                    "filter_predicate_count": q_upper.count(" WHERE "),
                    "order_by_count": q_upper.count("ORDER BY"),
                    "group_by_count": q_upper.count("GROUP BY"),
                    "estimated_rows": None,
                    "estimated_cost": None,
                    "plan_depth": None,
                }

                log_rows.append(
                    (
                        q_hash,
                        query,
                        q_template,
                        1,  # calls per execution
                        total_exec_time_ms,
                        mean_exec_time_ms,
                        min_exec_time_ms,
                        max_exec_time_ms,
                        stddev_exec_time_ms,
                        int(len(rows)),  # rows_affected (proxy)
                        0,  # shared_blks_hit (unknown without EXPLAIN BUFFERS)
                        0,  # shared_blks_read
                        0,  # shared_blks_dirtied
                        0,  # shared_blks_written
                        0,  # local_blks_hit
                        0,  # local_blks_read
                        0,  # local_blks_dirtied
                        0,  # local_blks_written
                        0,  # temp_blks_read
                        0,  # temp_blks_written
                        0.0,  # blk_read_time_ms
                        0.0,  # blk_write_time_ms
                        json.dumps(None),  # query_plan (unknown without EXPLAIN)
                        json.dumps(extracted_features),
                        datetime.now(),
                    )
                )
                if log_every == 1:
                    logger.info(
                        "Inserted row %s/%s kind=%s exec_ms=%.3f calls=1 rows=%s",
                        i,
                        total,
                        kind,
                        exec_ms,
                        len(rows),
                    )
                if len(log_rows) >= batch_size:
                    writer.insert_execution_rows(log_rows)
                    log_rows = []

            if delay > 0:
                time.sleep(delay)

        if writer is not None and log_rows:
            writer.insert_execution_rows(log_rows)

        logger.info("=" * 60)
        logger.info("Streaming Workload Execution Summary")
        logger.info("=" * 60)
        logger.info(f"Total queries: {total:,}")
        logger.info(f"Successful: {successful:,}")
        logger.info(f"Failed: {failed:,}")
        logger.info(f"Total execution time: {total_time:.2f}s")
        logger.info(f"Average execution time: {(total_time / max(total, 1)):.3f}s")
        logger.info("=" * 60)
        if writer is None:
            logger.info(
                "Next: run query collection to copy pg_stat_statements into ml_optimization.query_logs:\n"
                "  python scripts/ml-optimization/run_query_collection.py"
            )
            logger.info("=" * 60)

        return {"total": total, "successful": successful, "failed": failed, "total_time_s": total_time}
    
    def generate_and_execute_workload(
        self,
        simple_count: int = 1_400_000,
        analytical_count: int = 400_000,
        join_count: int = 200_000,
        delay: float = 0.0
    ):
        """Generate and execute a complete workload (default: 2M queries)."""
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

        logger.info(f"\nTotal queries generated: {len(all_queries):,}")
        logger.info(f"  - Simple: {simple_count:,}")
        logger.info(f"  - Analytical: {analytical_count:,}")
        logger.info(f"  - Join: {join_count:,}")
        logger.info(f"  - Delay between queries: {delay}s")

        # Execute workload
        results = self.execute_workload(all_queries, delay=delay)
        
        # Summary
        successful = sum(1 for r in results if r['success'])
        failed = len(results) - successful
        total_time = sum(r['execution_time'] for r in results)
        avg_time = total_time / len(results) if results else 0
        
        logger.info("\n" + "=" * 60)
        logger.info("Workload Execution Summary")
        logger.info("=" * 60)
        logger.info(f"Total queries: {len(results):,}")
        logger.info(f"Successful: {successful:,}")
        logger.info(f"Failed: {failed:,}")
        logger.info(f"Total execution time: {total_time:.2f}s")
        logger.info(f"Average execution time: {avg_time:.3f}s")
        logger.info("=" * 60)
        logger.info(
            "Next: run query collection to copy stats into ml_optimization.query_logs:\n"
            "  python scripts/ml-optimization/run_query_collection.py"
        )
        logger.info("=" * 60)

        return results


if __name__ == "__main__":
    import argparse

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

    parser = argparse.ArgumentParser(description="Generate and execute query workload (default: 2M queries).")
    parser.add_argument("--simple", type=int, default=1_400_000, help="Number of simple lookup queries (default: 1,400,000)")
    parser.add_argument("--analytical", type=int, default=400_000, help="Number of analytical queries (default: 400,000)")
    parser.add_argument("--join", type=int, default=200_000, help="Number of join queries (default: 200,000)")
    parser.add_argument("--delay", type=float, default=0.0, help="Seconds to sleep between queries (default: 0 for 2M run)")
    parser.add_argument(
        "--log-to-query-logs",
        action="store_true",
        help="Insert one row per executed query into ml_optimization.query_logs (enables millions of rows).",
    )
    parser.add_argument("--batch-size", type=int, default=1000, help="Batch size for inserts when --log-to-query-logs is set")
    parser.add_argument("--seed", type=int, default=None, help="Random seed for repeatable workloads")
    parser.add_argument(
        "--log-every",
        type=int,
        default=50_000,
        help="Log progress every N executed queries. Use 1 to log every inserted row (very slow/verbose).",
    )
    args = parser.parse_args()

    connection = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres")
    )

    try:
        generator = QueryWorkloadGenerator(connection)
        generator.execute_streaming_workload(
            simple_count=args.simple,
            analytical_count=args.analytical,
            join_count=args.join,
            delay=args.delay,
            log_to_query_logs=args.log_to_query_logs,
            batch_size=args.batch_size,
            seed=args.seed,
            log_every=args.log_every,
        )
    finally:
        connection.close()

