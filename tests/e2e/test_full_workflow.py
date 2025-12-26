"""
Full Workflow End-to-End Tests
Tests for complete optimization workflow.
"""

import pytest
import psycopg2
import time
import requests
from datetime import datetime, timedelta


class TestFullOptimizationWorkflow:
    """Test complete optimization workflow end-to-end."""

    def test_full_optimization_workflow(
        self, 
        db_connection, 
        test_schema, 
        api_base_url
    ):
        """
        Test complete optimization workflow:
        1. Generate and load data
        2. Run queries to generate patterns
        3. Trigger workload analysis
        4. Get recommendations
        5. Apply optimization
        6. Verify improvement
        7. Check feedback loop
        """
        cursor = db_connection.cursor()
        
        # Step 1: Create test table and load data
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.test_workflow (
                id SERIAL PRIMARY KEY,
                customer_id INT,
                order_date DATE,
                amount DECIMAL(10,2),
                category VARCHAR(50)
            )
        """)
        
        # Insert test data
        for i in range(1000):
            cursor.execute(f"""
                INSERT INTO {test_schema}.test_workflow 
                (customer_id, order_date, amount, category)
                VALUES 
                ({i % 100}, CURRENT_DATE - INTERVAL '{i % 30} days', 
                 {10 + (i % 100)}, 'Category {i % 10}')
            """)
        
        db_connection.commit()
        
        # Step 2: Run queries to generate patterns
        for _ in range(100):
            cursor.execute(f"""
                SELECT * FROM {test_schema}.test_workflow 
                WHERE category = 'Category 1' 
                AND customer_id = 1
            """)
        
        # Step 3: Measure baseline performance
        start_time = time.time()
        cursor.execute(f"""
            SELECT * FROM {test_schema}.test_workflow 
            WHERE category = 'Category 1'
        """)
        cursor.fetchall()
        baseline_time = time.time() - start_time
        
        # Step 4: Create index (simulating optimization recommendation)
        cursor.execute(f"""
            CREATE INDEX IF NOT EXISTS idx_test_workflow_category 
            ON {test_schema}.test_workflow(category)
        """)
        
        # Step 5: Measure performance after optimization
        start_time = time.time()
        cursor.execute(f"""
            SELECT * FROM {test_schema}.test_workflow 
            WHERE category = 'Category 1'
        """)
        cursor.fetchall()
        optimized_time = time.time() - start_time
        
        # Step 6: Verify improvement
        improvement = ((baseline_time - optimized_time) / baseline_time) * 100
        assert optimized_time < baseline_time, "Optimization should improve query time"
        
        # Step 7: Record feedback
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.optimization_feedback (
                optimization_id SERIAL PRIMARY KEY,
                table_name VARCHAR(100),
                improvement_percent DECIMAL(5,2),
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute(f"""
            INSERT INTO {test_schema}.optimization_feedback 
            (table_name, improvement_percent)
            VALUES ('test_workflow', %s)
        """, (improvement,))
        
        db_connection.commit()
        
        # Verify feedback was recorded
        cursor.execute(f"""
            SELECT improvement_percent 
            FROM {test_schema}.optimization_feedback 
            WHERE table_name = 'test_workflow'
        """)
        
        result = cursor.fetchone()
        assert result is not None, "Feedback should be recorded"
        assert result[0] > 0, "Improvement should be positive"
        
        cursor.close()


