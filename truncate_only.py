"""
Truncate Silver and Gold Layer Tables Only
This script truncates all tables in Silver and Gold layers without repopulating.
"""

import sys
import logging
import psycopg2
import os
from pathlib import Path
from datetime import datetime

# Configure logging
log_file = Path(__file__).parent / "truncate_only.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(levelname)s] - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def truncate_tables(connection):
    """Truncate all tables in Silver and Gold layers."""
    cursor = connection.cursor()
    
    # Silver layer tables (in dependency order - child tables first)
    silver_tables = [
        'order_item',           # Child of orders
        'orders',               # Child of customer, employee
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
    
    # Gold layer tables
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
    
    logger.info("=" * 80)
    logger.info("TRUNCATING SILVER AND GOLD LAYER TABLES")
    logger.info("=" * 80)
    logger.info(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("")
    
    # Truncate Silver tables
    logger.info("Truncating Silver Layer Tables...")
    logger.info("-" * 80)
    silver_success = 0
    silver_failed = 0
    for table in silver_tables:
        try:
            cursor.execute(f"TRUNCATE TABLE silver.{table} CASCADE;")
            logger.info(f"  [OK] Truncated silver.{table}")
            silver_success += 1
        except Exception as e:
            logger.warning(f"  [FAIL] Could not truncate silver.{table}: {e}")
            silver_failed += 1
    
    connection.commit()
    logger.info("")
    logger.info(f"Silver Layer: {silver_success} truncated, {silver_failed} failed")
    logger.info("")
    
    # Truncate Gold tables
    logger.info("Truncating Gold Layer Tables...")
    logger.info("-" * 80)
    gold_success = 0
    gold_failed = 0
    for table in gold_tables:
        try:
            cursor.execute(f"TRUNCATE TABLE gold.{table} CASCADE;")
            logger.info(f"  [OK] Truncated gold.{table}")
            gold_success += 1
        except Exception as e:
            logger.warning(f"  [FAIL] Could not truncate gold.{table}: {e}")
            gold_failed += 1
    
    connection.commit()
    logger.info("")
    logger.info(f"Gold Layer: {gold_success} truncated, {gold_failed} failed")
    logger.info("")
    logger.info("=" * 80)
    logger.info("TRUNCATION COMPLETE")
    logger.info("=" * 80)
    logger.info(f"Total: {silver_success + gold_success} tables truncated successfully")
    logger.info(f"Failed: {silver_failed + gold_failed} tables")
    logger.info("")
    
    cursor.close()


def main():
    """Main function."""
    start_time = datetime.now()
    
    logger.info("=" * 80)
    logger.info("TRUNCATE SILVER/GOLD LAYERS ONLY")
    logger.info("=" * 80)
    logger.info("")
    logger.info("WARNING: This will delete all data in Silver and Gold layers!")
    logger.info("Bronze layer data will be preserved.")
    logger.info("No repopulation will be performed.")
    logger.info("")
    
    # Database connection
    connection = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres")
    )
    
    try:
        truncate_tables(connection)
        
        end_time = datetime.now()
        duration = end_time - start_time
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("TRUNCATION COMPLETE!")
        logger.info("=" * 80)
        logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"End Time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"Duration: {duration}")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"Error during truncation: {e}", exc_info=True)
        raise
    finally:
        connection.close()
        logger.info("\nDatabase connection closed.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\nProcess interrupted by user.")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

