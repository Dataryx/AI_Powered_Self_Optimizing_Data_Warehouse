"""
Query Benchmark Performance Tests
Benchmark tests for query performance evaluation.
"""

import pytest
import psycopg2
import time
import statistics
from typing import List, Dict
from datetime import datetime


class TestQueryBenchmarks:
    """Benchmark query performance tests."""

    def benchmark_simple_queries(self, db_connection, test_schema) -> Dict:
        """Benchmark simple point lookup queries."""
        cursor = db_connection.cursor()
        
        # Create test table
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.benchmark_simple (
                id SERIAL PRIMARY KEY,
                value VARCHAR(100)
            )
        """)
        
        # Insert test data
        for i in range(10000):
            cursor.execute(f"""
                INSERT INTO {test_schema}.benchmark_simple (value)
                VALUES ('Value {i}')
            """)
        
        db_connection.commit()
        
        # Benchmark queries
        execution_times = []
        for i in range(100):
            start_time = time.time()
            cursor.execute(f"""
                SELECT * FROM {test_schema}.benchmark_simple WHERE id = %s
            """, (i * 100,))
            cursor.fetchone()
            execution_times.append((time.time() - start_time) * 1000)  # Convert to ms
        
        cursor.close()
        
        return {
            "query_type": "simple_lookup",
            "iterations": 100,
            "avg_time_ms": statistics.mean(execution_times),
            "p50_time_ms": statistics.median(execution_times),
            "p95_time_ms": sorted(execution_times)[int(len(execution_times) * 0.95)],
            "p99_time_ms": sorted(execution_times)[int(len(execution_times) * 0.99)],
            "min_time_ms": min(execution_times),
            "max_time_ms": max(execution_times),
        }

    def benchmark_complex_queries(self, db_connection, test_schema) -> Dict:
        """Benchmark complex analytical queries."""
        cursor = db_connection.cursor()
        
        # Create test tables
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.benchmark_orders (
                order_id SERIAL PRIMARY KEY,
                customer_id INT,
                order_date DATE,
                amount DECIMAL(10,2)
            )
        """)
        
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.benchmark_customers (
                customer_id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                segment VARCHAR(50)
            )
        """)
        
        # Insert test data
        for i in range(10000):
            cursor.execute(f"""
                INSERT INTO {test_schema}.benchmark_orders 
                (customer_id, order_date, amount)
                VALUES ({i % 1000}, CURRENT_DATE - INTERVAL '{i % 365} days', {100 + i})
            """)
        
        for i in range(1000):
            cursor.execute(f"""
                INSERT INTO {test_schema}.benchmark_customers (name, segment)
                VALUES ('Customer {i}', 'Segment {i % 10}')
            """)
        
        db_connection.commit()
        
        # Benchmark complex query
        execution_times = []
        for _ in range(50):
            start_time = time.time()
            cursor.execute(f"""
                SELECT 
                    c.segment,
                    COUNT(o.order_id) as order_count,
                    SUM(o.amount) as total_revenue,
                    AVG(o.amount) as avg_order_value
                FROM {test_schema}.benchmark_customers c
                JOIN {test_schema}.benchmark_orders o ON c.customer_id = o.customer_id
                WHERE o.order_date >= CURRENT_DATE - INTERVAL '30 days'
                GROUP BY c.segment
                ORDER BY total_revenue DESC
            """)
            cursor.fetchall()
            execution_times.append((time.time() - start_time) * 1000)
        
        cursor.close()
        
        return {
            "query_type": "complex_analytical",
            "iterations": 50,
            "avg_time_ms": statistics.mean(execution_times),
            "p50_time_ms": statistics.median(execution_times),
            "p95_time_ms": sorted(execution_times)[int(len(execution_times) * 0.95)],
            "p99_time_ms": sorted(execution_times)[int(len(execution_times) * 0.99)],
            "min_time_ms": min(execution_times),
            "max_time_ms": max(execution_times),
        }

    def benchmark_concurrent_load(self, db_connection, test_schema) -> Dict:
        """Benchmark concurrent query load."""
        import threading
        
        cursor = db_connection.cursor()
        
        # Create test table
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.benchmark_concurrent (
                id SERIAL PRIMARY KEY,
                value INT
            )
        """)
        
        # Insert test data
        for i in range(10000):
            cursor.execute(f"""
                INSERT INTO {test_schema}.benchmark_concurrent (value)
                VALUES ({i})
            """)
        
        db_connection.commit()
        cursor.close()
        
        # Concurrent query execution
        execution_times = []
        lock = threading.Lock()
        
        def run_queries(thread_id):
            conn = psycopg2.connect(
                "postgresql://postgres:postgres@localhost:5432/datawarehouse_test"
            )
            cur = conn.cursor()
            thread_times = []
            
            for i in range(20):
                start_time = time.time()
                cur.execute(f"""
                    SELECT * FROM {test_schema}.benchmark_concurrent 
                    WHERE value BETWEEN %s AND %s
                """, (thread_id * 100, (thread_id + 1) * 100))
                cur.fetchall()
                thread_times.append((time.time() - start_time) * 1000)
            
            with lock:
                execution_times.extend(thread_times)
            
            cur.close()
            conn.close()
        
        # Run 10 concurrent threads
        threads = []
        for i in range(10):
            thread = threading.Thread(target=run_queries, args=(i,))
            threads.append(thread)
            thread.start()
        
        for thread in threads:
            thread.join()
        
        return {
            "query_type": "concurrent_load",
            "concurrent_threads": 10,
            "queries_per_thread": 20,
            "total_queries": 200,
            "avg_time_ms": statistics.mean(execution_times),
            "p50_time_ms": statistics.median(execution_times),
            "p95_time_ms": sorted(execution_times)[int(len(execution_times) * 0.95)],
            "p99_time_ms": sorted(execution_times)[int(len(execution_times) * 0.99)],
        }

    def benchmark_optimization_impact(
        self, 
        db_connection, 
        test_schema
    ) -> Dict:
        """Benchmark query performance before and after optimization."""
        cursor = db_connection.cursor()
        
        # Create test table
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.benchmark_optimization (
                id SERIAL PRIMARY KEY,
                category VARCHAR(50),
                value INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert test data
        for i in range(50000):
            cursor.execute(f"""
                INSERT INTO {test_schema}.benchmark_optimization (category, value)
                VALUES ('Category {i % 100}', {i})
            """)
        
        db_connection.commit()
        
        # Benchmark BEFORE optimization
        execution_times_before = []
        for _ in range(100):
            start_time = time.time()
            cursor.execute(f"""
                SELECT * FROM {test_schema}.benchmark_optimization 
                WHERE category = 'Category 1'
            """)
            cursor.fetchall()
            execution_times_before.append((time.time() - start_time) * 1000)
        
        avg_before = statistics.mean(execution_times_before)
        
        # Apply optimization (create index)
        cursor.execute(f"""
            CREATE INDEX idx_benchmark_category 
            ON {test_schema}.benchmark_optimization(category)
        """)
        
        # Benchmark AFTER optimization
        execution_times_after = []
        for _ in range(100):
            start_time = time.time()
            cursor.execute(f"""
                SELECT * FROM {test_schema}.benchmark_optimization 
                WHERE category = 'Category 1'
            """)
            cursor.fetchall()
            execution_times_after.append((time.time() - start_time) * 1000)
        
        avg_after = statistics.mean(execution_times_after)
        
        improvement_percent = ((avg_before - avg_after) / avg_before) * 100
        
        cursor.close()
        
        return {
            "query_type": "optimization_impact",
            "baseline_avg_ms": avg_before,
            "optimized_avg_ms": avg_after,
            "improvement_percent": improvement_percent,
            "baseline_p95_ms": sorted(execution_times_before)[int(len(execution_times_before) * 0.95)],
            "optimized_p95_ms": sorted(execution_times_after)[int(len(execution_times_after) * 0.95)],
        }

    @pytest.mark.benchmark
    def test_run_all_benchmarks(self, db_connection, test_schema):
        """Run all benchmarks and collect results."""
        results = {
            "timestamp": datetime.now().isoformat(),
            "benchmarks": []
        }
        
        # Run each benchmark
        results["benchmarks"].append(
            self.benchmark_simple_queries(db_connection, test_schema)
        )
        results["benchmarks"].append(
            self.benchmark_complex_queries(db_connection, test_schema)
        )
        results["benchmarks"].append(
            self.benchmark_concurrent_load(db_connection, test_schema)
        )
        results["benchmarks"].append(
            self.benchmark_optimization_impact(db_connection, test_schema)
        )
        
        # Save results (in real implementation, save to file or database)
        print("\n=== Benchmark Results ===")
        for benchmark in results["benchmarks"]:
            print(f"\n{benchmark['query_type']}:")
            for key, value in benchmark.items():
                if key != 'query_type':
                    print(f"  {key}: {value}")


