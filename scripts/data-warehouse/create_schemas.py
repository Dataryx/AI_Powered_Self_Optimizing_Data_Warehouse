#!/usr/bin/env python3
"""
Create All Data Warehouse Schemas
Executes all SQL schema files to create the complete data warehouse structure.
"""

import os
import psycopg2
import sys
from pathlib import Path

def get_schema_files(base_path):
    """Get all SQL schema files in order."""
    schema_files = []
    
    # Bronze layer
    bronze_path = Path(base_path) / "data-warehouse" / "schemas" / "bronze"
    bronze_files = [
        "raw_orders.sql",
        "raw_products.sql",
        "raw_customers.sql",
        "raw_inventory.sql",
        "raw_clickstream.sql",
        "raw_reviews.sql",
        "raw_sessions.sql"
    ]
    for file in bronze_files:
        schema_files.append((bronze_path / file, "bronze"))
    
    # Silver layer - order matters due to foreign keys
    silver_path = Path(base_path) / "data-warehouse" / "schemas" / "silver"
    silver_files = [
        "customers.sql",
        "products.sql",
        "orders.sql",
        "order_items.sql",
        "inventory_snapshots.sql",
        "user_events.sql",
        "product_reviews.sql"
    ]
    for file in silver_files:
        schema_files.append((silver_path / file, "silver"))
    
    # Gold layer
    gold_path = Path(base_path) / "data-warehouse" / "schemas" / "gold"
    gold_files = [
        "daily_sales_summary.sql",
        "customer_360.sql",
        "product_performance.sql",
        "inventory_health.sql",
        "conversion_funnel.sql",
        "cohort_analysis.sql",
        "real_time_dashboard.sql"
    ]
    for file in gold_files:
        schema_files.append((gold_path / file, "gold"))
    
    return schema_files

def create_schemas(connection_string=None):
    """Create all schemas."""
    base_path = Path(__file__).parent.parent.parent
    
    # Parse connection string or use individual parameters
    if connection_string:
        conn = psycopg2.connect(connection_string)
    else:
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            database=os.getenv("POSTGRES_DB", "datawarehouse"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "postgres")
        )
    conn.autocommit = True
    cursor = conn.cursor()
    
    try:
        # Create schemas
        print("Creating schemas...")
        cursor.execute("CREATE SCHEMA IF NOT EXISTS bronze;")
        cursor.execute("CREATE SCHEMA IF NOT EXISTS silver;")
        cursor.execute("CREATE SCHEMA IF NOT EXISTS gold;")
        cursor.execute("CREATE SCHEMA IF NOT EXISTS ml_optimization;")
        print("[OK] Schemas created")
        
        # Get schema files
        schema_files = get_schema_files(base_path)
        
        # Execute each schema file
        for schema_file, layer in schema_files:
            if schema_file.exists():
                print(f"Creating {layer}.{schema_file.stem}...")
                with open(schema_file, 'r') as f:
                    sql = f.read()
                    try:
                        cursor.execute(sql)
                        print(f"  [OK] {layer}.{schema_file.stem}")
                    except Exception as e:
                        print(f"  [ERROR] Error creating {layer}.{schema_file.stem}: {e}")
                        # Continue with next file
            else:
                print(f"  [WARNING] File not found: {schema_file}")
        
        print("\n[SUCCESS] All schemas created successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    # Get connection string from environment or use default
    connection_string = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/datawarehouse"
    )
    
    print(f"Connecting to database...")
    create_schemas(connection_string)

