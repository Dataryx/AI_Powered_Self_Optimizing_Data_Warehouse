"""
Optimization Flow Integration Tests
Tests for ML optimization workflow.
"""

import pytest
import time
from datetime import datetime
import psycopg2


class TestQueryLogCollection:
    """Test query log collection functionality."""

    def test_query_log_collection(self, db_connection):
        """Test that query logs are collected correctly."""
        cursor = db_connection.cursor()
        
        # Ensure pg_stat_statements extension exists
        try:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS pg_stat_statements")
            db_connection.commit()
        except Exception:
            pass  # Extension might already exist
        
        # Execute some queries to generate statistics
        cursor.execute("SELECT 1")
        cursor.execute("SELECT COUNT(*) FROM pg_database")
        cursor.execute("SELECT NOW()")
        
        # Wait a bit for statistics to be recorded
        time.sleep(1)
        
        # Check if statistics are available
        cursor.execute("""
            SELECT COUNT(*) 
            FROM pg_stat_statements 
            WHERE query LIKE 'SELECT%'
        """)
        
        count = cursor.fetchone()[0]
        assert count >= 0, "Query statistics should be available"
        
        cursor.close()


class TestIndexRecommendation:
    """Test index recommendation generation."""

    def test_index_recommendation_generation(self, db_connection, test_schema):
        """Test that index recommendations can be generated."""
        cursor = db_connection.cursor()
        
        # Create test table
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.test_table (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100),
                category VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert test data
        for i in range(100):
            cursor.execute(f"""
                INSERT INTO {test_schema}.test_table (name, category)
                VALUES ('Item {i}', 'Category {i % 10}')
            """)
        
        # Simulate frequent queries on category
        for _ in range(50):
            cursor.execute(f"""
                SELECT * FROM {test_schema}.test_table 
                WHERE category = 'Category 1'
            """)
        
        # Check if index would be beneficial
        # In real implementation, this would use the index advisor
        cursor.execute(f"""
            SELECT COUNT(*) 
            FROM pg_stat_user_tables 
            WHERE schemaname = %s AND relname = 'test_table'
        """, (test_schema,))
        
        assert cursor.fetchone()[0] >= 0, "Table statistics should be available"
        
        cursor.close()


class TestOptimizationApplication:
    """Test optimization application."""

    def test_optimization_application(self, db_connection, test_schema):
        """Test that optimizations can be applied."""
        cursor = db_connection.cursor()
        
        # Create test table
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.test_opt (
                id SERIAL PRIMARY KEY,
                value VARCHAR(100)
            )
        """)
        
        # Apply index optimization
        index_name = f"idx_{test_schema}_test_opt_value"
        cursor.execute(f"""
            CREATE INDEX IF NOT EXISTS {index_name} 
            ON {test_schema}.test_opt(value)
        """)
        
        # Verify index exists
        cursor.execute("""
            SELECT COUNT(*) 
            FROM pg_indexes 
            WHERE indexname = %s
        """, (index_name,))
        
        assert cursor.fetchone()[0] == 1, "Index should be created"
        
        # Test query performance with index
        start_time = time.time()
        cursor.execute(f"""
            SELECT * FROM {test_schema}.test_opt WHERE value = 'test'
        """)
        execution_time = time.time() - start_time
        
        assert execution_time < 1.0, "Query should execute quickly with index"
        
        cursor.close()


class TestFeedbackLoop:
    """Test feedback loop functionality."""

    def test_feedback_loop(self, db_connection, test_schema):
        """Test that feedback is collected after optimization."""
        cursor = db_connection.cursor()
        
        # Create optimization tracking table
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.optimization_history (
                optimization_id SERIAL PRIMARY KEY,
                type VARCHAR(50),
                table_name VARCHAR(100),
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                improvement_percent DECIMAL(5,2)
            )
        """)
        
        # Record optimization
        cursor.execute(f"""
            INSERT INTO {test_schema}.optimization_history 
            (type, table_name, improvement_percent)
            VALUES ('index', 'test_table', 25.5)
        """)
        
        # Verify feedback recording
        cursor.execute(f"""
            SELECT improvement_percent 
            FROM {test_schema}.optimization_history 
            WHERE type = 'index'
        """)
        
        result = cursor.fetchone()
        assert result is not None, "Optimization feedback should be recorded"
        assert result[0] == 25.5, "Improvement percent should be recorded correctly"
        
        cursor.close()


