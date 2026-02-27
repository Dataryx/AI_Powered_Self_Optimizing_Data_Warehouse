#!/usr/bin/env python3
"""
Truncate All Data Warehouse Layers
This script truncates all tables in Bronze, Silver, and Gold layers.
Tables are truncated in reverse dependency order to handle foreign keys properly.
"""

import sys
import logging
import psycopg2
import os
from pathlib import Path
from datetime import datetime

# Configure logging
log_file = Path(__file__).parent / "truncate_all_layers.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def truncate_all_layers(connection):
    """Truncate all tables in Bronze, Silver, and Gold layers."""
    cursor = connection.cursor()
    
    # Bronze layer tables (in reverse dependency order - child tables first)
    bronze_tables = [
        'order_item',           # Child of orders, product
        'orders',               # Child of customer, employee, warehouse
        'customer',             # Child of person, customer_employee
        'employee',             # Child of person, employment_jobs
        'customer_employee',    # Child of customer_company
        'person_location',      # Child of person, location
        'phone_number',         # Child of person, location
        'restricted_info',      # Child of person
        'inventory',            # Child of product, warehouse
        'warehouse',            # Child of location
        'product',              # Standalone
        'location',             # Child of country
        'person',               # Standalone
        'customer_company',     # Standalone
        'employment_jobs',      # Standalone
        'country',              # Root table
    ]
    
    # Silver layer tables (in reverse dependency order - child tables first)
    silver_tables = [
        'order_item',           # Child of orders
        'orders',               # Child of customer, employee
        'customer',             # Child of person, customer_employee
        'employee',            # Child of person, employment_jobs
        'customer_employee',    # Child of customer_company
        'person_location',      # Child of person, location
        'phone_number',         # Child of person, location
        'restricted_info',      # Child of person
        'inventory',            # Child of product, warehouse
        'warehouse',            # Child of location
        'product',              # Standalone
        'location',             # Child of country
        'person',               # Standalone
        'customer_company',     # Standalone
        'employment_jobs',      # Standalone
        'country',              # Root table
    ]
    
    # Gold layer tables (in reverse dependency order - facts first, then dimensions)
    gold_tables = [
        'agg_daily_sales',
        'agg_customer_lifetime',
        'agg_monthly_product_sales',
        'agg_sales_rep_performance',
        'fact_sales',
        'fact_orders',
        'fact_inventory_snapshot',
        'dim_customer',
        'dim_product',
        'dim_location',
        'dim_employee',
        'dim_warehouse',
        'dim_promotion',
        'dim_date',
    ]
    
    start_time = datetime.now()
    
    logger.info("=" * 80)
    logger.info("TRUNCATING ALL DATA WAREHOUSE LAYERS")
    logger.info("=" * 80)
    logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("")
    logger.info("This will truncate:")
    logger.info(f"  - Bronze Layer: {len(bronze_tables)} tables")
    logger.info(f"  - Silver Layer: {len(silver_tables)} tables")
    logger.info(f"  - Gold Layer: {len(gold_tables)} tables")
    logger.info("")
    logger.info("=" * 80)
    logger.info("")
    
    total_truncated = 0
    total_errors = 0
    
    # ========================================================================
    # TRUNCATE GOLD LAYER (First, since it depends on Silver)
    # ========================================================================
    logger.info("=" * 80)
    logger.info("STEP 1: Truncating Gold Layer Tables")
    logger.info("=" * 80)
    logger.info("")
    
    gold_truncated = 0
    gold_errors = 0
    
    for table in gold_tables:
        try:
            cursor.execute(f"TRUNCATE TABLE gold.{table} CASCADE;")
            logger.info(f"  ✓ Truncated gold.{table}")
            gold_truncated += 1
        except Exception as e:
            logger.error(f"  ✗ Could not truncate gold.{table}: {e}")
            gold_errors += 1
    
    connection.commit()
    logger.info("")
    logger.info(f"Gold Layer: {gold_truncated} tables truncated, {gold_errors} errors")
    logger.info("")
    
    total_truncated += gold_truncated
    total_errors += gold_errors
    
    # ========================================================================
    # TRUNCATE SILVER LAYER (Second, since it depends on Bronze)
    # ========================================================================
    logger.info("=" * 80)
    logger.info("STEP 2: Truncating Silver Layer Tables")
    logger.info("=" * 80)
    logger.info("")
    
    silver_truncated = 0
    silver_errors = 0
    
    for table in silver_tables:
        try:
            cursor.execute(f"TRUNCATE TABLE silver.{table} CASCADE;")
            logger.info(f"  ✓ Truncated silver.{table}")
            silver_truncated += 1
        except Exception as e:
            logger.error(f"  ✗ Could not truncate silver.{table}: {e}")
            silver_errors += 1
    
    connection.commit()
    logger.info("")
    logger.info(f"Silver Layer: {silver_truncated} tables truncated, {silver_errors} errors")
    logger.info("")
    
    total_truncated += silver_truncated
    total_errors += silver_errors
    
    # ========================================================================
    # TRUNCATE BRONZE LAYER (Last, since it's the source)
    # ========================================================================
    logger.info("=" * 80)
    logger.info("STEP 3: Truncating Bronze Layer Tables")
    logger.info("=" * 80)
    logger.info("")
    
    bronze_truncated = 0
    bronze_errors = 0
    
    for table in bronze_tables:
        try:
            cursor.execute(f"TRUNCATE TABLE bronze.{table} CASCADE;")
            logger.info(f"  ✓ Truncated bronze.{table}")
            bronze_truncated += 1
        except Exception as e:
            logger.error(f"  ✗ Could not truncate bronze.{table}: {e}")
            bronze_errors += 1
    
    connection.commit()
    logger.info("")
    logger.info(f"Bronze Layer: {bronze_truncated} tables truncated, {bronze_errors} errors")
    logger.info("")
    
    total_truncated += bronze_truncated
    total_errors += bronze_errors
    
    # ========================================================================
    # FINAL SUMMARY
    # ========================================================================
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    logger.info("")
    logger.info("=" * 80)
    logger.info("TRUNCATION COMPLETE")
    logger.info("=" * 80)
    logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"End Time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Duration: {duration:.2f} seconds ({duration/60:.2f} minutes)")
    logger.info("")
    logger.info("Summary:")
    logger.info(f"  Gold Layer:   {len(gold_tables)} tables ({gold_truncated} truncated, {gold_errors} errors)")
    logger.info(f"  Silver Layer: {len(silver_tables)} tables ({silver_truncated} truncated, {silver_errors} errors)")
    logger.info(f"  Bronze Layer: {len(bronze_tables)} tables ({bronze_truncated} truncated, {bronze_errors} errors)")
    logger.info(f"  Total:        {total_truncated} tables truncated, {total_errors} errors")
    logger.info("=" * 80)
    logger.info("")
    
    cursor.close()
    
    return {
        'gold_truncated': gold_truncated,
        'silver_truncated': silver_truncated,
        'bronze_truncated': bronze_truncated,
        'total_truncated': total_truncated,
        'total_errors': total_errors,
        'duration': duration
    }


def main():
    """Main function."""
    logger.info("=" * 80)
    logger.info("TRUNCATE ALL DATA WAREHOUSE LAYERS SCRIPT")
    logger.info("=" * 80)
    logger.info("")
    logger.info("This script will truncate ALL tables in Bronze, Silver, and Gold layers.")
    logger.info("This action cannot be undone!")
    logger.info("")
    
    # Database connection
    try:
        connection = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            database=os.getenv("POSTGRES_DB", "datawarehouse"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "postgres")
        )
        logger.info("✓ Connected to database")
        logger.info("")
    except Exception as e:
        logger.error(f"✗ Failed to connect to database: {e}")
        sys.exit(1)
    
    try:
        # Truncate all layers
        summary = truncate_all_layers(connection)
        
        logger.info("")
        logger.info("Script completed successfully!")
        logger.info(f"Log file saved to: {log_file}")
        
        if summary['total_errors'] > 0:
            logger.warning(f"⚠ Warning: {summary['total_errors']} errors occurred during truncation.")
            logger.warning("Please review the log file for details.")
            sys.exit(1)
        else:
            logger.info("✓ All tables truncated successfully!")
            sys.exit(0)
            
    except Exception as e:
        logger.error(f"Error during truncation: {e}", exc_info=True)
        sys.exit(1)
    finally:
        connection.close()
        logger.info("\nDatabase connection closed.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\nProcess interrupted by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

