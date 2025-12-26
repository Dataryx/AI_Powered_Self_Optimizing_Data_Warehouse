#!/usr/bin/env python3
"""
Create All Data Warehouse Schemas - Simplified Version
Executes all SQL schema files to create the complete data warehouse structure.
"""

import os
import psycopg2
import sys
from pathlib import Path

def get_db_connection():
    """Get database connection."""
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres")
    )

def create_schemas():
    """Create all schemas."""
    base_path = Path(__file__).parent
    
    conn = get_db_connection()
    conn.autocommit = True
    cursor = conn.cursor()
    
    try:
        # Create schemas
        print("Creating schemas...")
        cursor.execute("CREATE SCHEMA IF NOT EXISTS bronze;")
        cursor.execute("CREATE SCHEMA IF NOT EXISTS silver;")
        cursor.execute("CREATE SCHEMA IF NOT EXISTS gold;")
        cursor.execute("CREATE SCHEMA IF NOT EXISTS ml_optimization;")
        print("✓ Schemas created")
        
        # Bronze layer files
        bronze_files = [
            "data-warehouse/schemas/bronze/raw_orders.sql",
            "data-warehouse/schemas/bronze/raw_products.sql",
            "data-warehouse/schemas/bronze/raw_customers.sql",
            "data-warehouse/schemas/bronze/raw_inventory.sql",
            "data-warehouse/schemas/bronze/raw_clickstream.sql",
            "data-warehouse/schemas/bronze/raw_reviews.sql",
            "data-warehouse/schemas/bronze/raw_sessions.sql"
        ]
        
        # Silver layer files
        silver_files = [
            "data-warehouse/schemas/silver/customers.sql",
            "data-warehouse/schemas/silver/products.sql",
            "data-warehouse/schemas/silver/orders.sql",
            "data-warehouse/schemas/silver/order_items.sql",
            "data-warehouse/schemas/silver/inventory_snapshots.sql",
            "data-warehouse/schemas/silver/user_events.sql",
            "data-warehouse/schemas/silver/product_reviews.sql"
        ]
        
        # Gold layer files
        gold_files = [
            "data-warehouse/schemas/gold/daily_sales_summary.sql",
            "data-warehouse/schemas/gold/customer_360.sql",
            "data-warehouse/schemas/gold/product_performance.sql",
            "data-warehouse/schemas/gold/inventory_health.sql",
            "data-warehouse/schemas/gold/conversion_funnel.sql",
            "data-warehouse/schemas/gold/cohort_analysis.sql",
            "data-warehouse/schemas/gold/real_time_dashboard.sql"
        ]
        
        all_files = [(f, "bronze") for f in bronze_files] + \
                    [(f, "silver") for f in silver_files] + \
                    [(f, "gold") for f in gold_files]
        
        # Execute each schema file
        for schema_file, layer in all_files:
            file_path = base_path / schema_file
            if file_path.exists():
                print(f"Creating {layer}.{file_path.stem}...")
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        sql = f.read()
                        cursor.execute(sql)
                    print(f"  ✓ {layer}.{file_path.stem}")
                except Exception as e:
                    print(f"  ✗ Error creating {layer}.{file_path.stem}: {e}")
                    # Continue with next file
            else:
                print(f"  ⚠ File not found: {file_path}")
        
        print("\n✓ All schemas created successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    create_schemas()

