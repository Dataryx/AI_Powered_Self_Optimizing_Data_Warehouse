"""
ETL Pipeline Integration Tests
Tests for end-to-end ETL pipeline functionality.
"""

import pytest
import psycopg2
from datetime import datetime, timedelta
import pandas as pd


class TestBronzeToSilverTransformation:
    """Test Bronze to Silver layer transformations."""

    def test_bronze_to_silver_transformation(self, db_connection, test_schema):
        """Test transformation from Bronze to Silver layer."""
        cursor = db_connection.cursor()
        
        # Create Bronze table
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.raw_orders (
                order_id VARCHAR(50),
                customer_id VARCHAR(50),
                order_date TIMESTAMP,
                total_amount DECIMAL(15,2),
                source_system VARCHAR(50),
                ingestion_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert test data
        cursor.execute(f"""
            INSERT INTO {test_schema}.raw_orders 
            (order_id, customer_id, order_date, total_amount, source_system)
            VALUES 
            ('ORD001', 'CUST001', CURRENT_TIMESTAMP, 100.50, 'ecommerce')
        """)
        
        # Create Silver table
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.orders (
                order_sk SERIAL PRIMARY KEY,
                order_id VARCHAR(50),
                customer_id VARCHAR(50),
                order_date DATE,
                total_amount DECIMAL(15,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Simulate transformation
        cursor.execute(f"""
            INSERT INTO {test_schema}.orders (order_id, customer_id, order_date, total_amount)
            SELECT 
                order_id,
                customer_id,
                DATE(order_date),
                total_amount
            FROM {test_schema}.raw_orders
            WHERE source_system = 'ecommerce'
        """)
        
        # Verify transformation
        cursor.execute(f"SELECT COUNT(*) FROM {test_schema}.orders")
        count = cursor.fetchone()[0]
        assert count == 1, "Transformation should create one record in Silver layer"
        
        cursor.close()

    def test_data_quality_validation(self, db_connection, test_schema):
        """Test data quality validation in transformations."""
        cursor = db_connection.cursor()
        
        # Create Bronze table with invalid data
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.raw_orders_test (
                order_id VARCHAR(50),
                total_amount DECIMAL(15,2),
                status VARCHAR(50)
            )
        """)
        
        # Insert valid and invalid records
        cursor.execute(f"""
            INSERT INTO {test_schema}.raw_orders_test VALUES
            ('ORD001', 100.50, 'completed'),
            ('ORD002', -50.00, 'completed'),  -- Invalid: negative amount
            ('', 200.00, 'pending')  -- Invalid: empty order_id
        """)
        
        # Validate data quality
        cursor.execute(f"""
            SELECT COUNT(*) FROM {test_schema}.raw_orders_test
            WHERE total_amount > 0 AND order_id != ''
        """)
        valid_count = cursor.fetchone()[0]
        assert valid_count == 1, "Should identify invalid records"
        
        cursor.close()

    def test_incremental_load(self, db_connection, test_schema):
        """Test incremental loading from Bronze to Silver."""
        cursor = db_connection.cursor()
        
        # Create tables
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.raw_orders_inc (
                order_id VARCHAR(50),
                ingestion_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.orders_inc (
                order_id VARCHAR(50) PRIMARY KEY,
                loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # First load
        cursor.execute(f"""
            INSERT INTO {test_schema}.raw_orders_inc (order_id) VALUES ('ORD001')
        """)
        
        cursor.execute(f"""
            INSERT INTO {test_schema}.orders_inc (order_id)
            SELECT order_id FROM {test_schema}.raw_orders_inc
            WHERE order_id NOT IN (SELECT order_id FROM {test_schema}.orders_inc)
        """)
        
        # Verify first load
        cursor.execute(f"SELECT COUNT(*) FROM {test_schema}.orders_inc")
        assert cursor.fetchone()[0] == 1
        
        # Second load (incremental)
        cursor.execute(f"""
            INSERT INTO {test_schema}.raw_orders_inc (order_id) VALUES ('ORD002')
        """)
        
        cursor.execute(f"""
            INSERT INTO {test_schema}.orders_inc (order_id)
            SELECT order_id FROM {test_schema}.raw_orders_inc
            WHERE order_id NOT IN (SELECT order_id FROM {test_schema}.orders_inc)
        """)
        
        # Verify incremental load
        cursor.execute(f"SELECT COUNT(*) FROM {test_schema}.orders_inc")
        assert cursor.fetchone()[0] == 2, "Incremental load should add new records only"
        
        cursor.close()


class TestSilverToGoldAggregation:
    """Test Silver to Gold layer aggregations."""

    def test_silver_to_gold_aggregation(self, db_connection, test_schema):
        """Test aggregation from Silver to Gold layer."""
        cursor = db_connection.cursor()
        
        # Create Silver orders table
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.orders_silver (
                order_id VARCHAR(50),
                order_date DATE,
                total_amount DECIMAL(15,2)
            )
        """)
        
        # Insert test data
        test_date = datetime.now().date()
        cursor.execute(f"""
            INSERT INTO {test_schema}.orders_silver VALUES
            ('ORD001', %s, 100.50),
            ('ORD002', %s, 200.00),
            ('ORD003', %s, 150.75)
        """, (test_date, test_date, test_date))
        
        # Create Gold aggregation table
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS {test_schema}.daily_sales_summary (
                date_key DATE PRIMARY KEY,
                total_orders INT,
                total_revenue DECIMAL(15,2)
            )
        """)
        
        # Aggregate
        cursor.execute(f"""
            INSERT INTO {test_schema}.daily_sales_summary
            SELECT 
                order_date as date_key,
                COUNT(*) as total_orders,
                SUM(total_amount) as total_revenue
            FROM {test_schema}.orders_silver
            GROUP BY order_date
        """)
        
        # Verify aggregation
        cursor.execute(f"""
            SELECT total_orders, total_revenue 
            FROM {test_schema}.daily_sales_summary 
            WHERE date_key = %s
        """, (test_date,))
        
        result = cursor.fetchone()
        assert result[0] == 3, "Should aggregate 3 orders"
        assert result[1] == 451.25, "Should sum total revenue correctly"
        
        cursor.close()


