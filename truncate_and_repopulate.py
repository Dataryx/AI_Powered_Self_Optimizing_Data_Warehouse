"""
Truncate Silver and Gold Layer Tables and Repopulate
This script truncates all tables in Silver and Gold layers, then runs the ETL to repopulate them.
"""

import sys
import logging
import psycopg2
import os
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from etl.transformers.bronze_to_silver import BronzeToSilverTransformer
from etl.aggregators.silver_to_gold import SilverToGoldAggregator

# Configure logging
log_file = Path(__file__).parent / "truncate_repopulate.log"
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
    
    # Gold layer tables (in dependency order - facts first, then dimensions)
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
    for table in silver_tables:
        try:
            cursor.execute(f"TRUNCATE TABLE silver.{table} CASCADE;")
            logger.info(f"  ✓ Truncated silver.{table}")
        except Exception as e:
            logger.warning(f"  ✗ Could not truncate silver.{table}: {e}")
    
    connection.commit()
    logger.info("")
    
    # Truncate Gold tables
    logger.info("Truncating Gold Layer Tables...")
    logger.info("-" * 80)
    for table in gold_tables:
        try:
            cursor.execute(f"TRUNCATE TABLE gold.{table} CASCADE;")
            logger.info(f"  ✓ Truncated gold.{table}")
        except Exception as e:
            logger.warning(f"  ✗ Could not truncate gold.{table}: {e}")
    
    connection.commit()
    logger.info("")
    logger.info("=" * 80)
    logger.info("TRUNCATION COMPLETE")
    logger.info("=" * 80)
    logger.info("")
    
    cursor.close()


def run_etl_after_truncate(connection):
    """Run ETL pipeline after truncation."""
    logger.info("=" * 80)
    logger.info("STARTING ETL PIPELINE TO REPOPULATE")
    logger.info("=" * 80)
    logger.info("")
    
    # Step 1: Bronze → Silver
    logger.info("STEP 1: Bronze → Silver Transformation")
    logger.info("-" * 80)
    transformer = BronzeToSilverTransformer(connection)
    totals = transformer.transform_all(batch_size=5000)
    logger.info("")
    logger.info("Bronze → Silver Summary:")
    for key, value in sorted(totals.items()):
        logger.info(f"  {key.replace('_', ' ').title():30s}: {value:>15,} records")
    logger.info("")
    
    # Step 2: Silver → Gold
    logger.info("STEP 2: Silver → Gold Aggregation")
    logger.info("-" * 80)
    aggregator = SilverToGoldAggregator(connection)
    gold_totals = aggregator.aggregate_all()
    logger.info("")
    logger.info("Silver → Gold Summary:")
    for key, value in sorted(gold_totals.items()):
        logger.info(f"  {key.replace('_', ' ').title():30s}: {value:>15,} records")
    logger.info("")


def main():
    """Main function."""
    start_time = datetime.now()
    
    logger.info("=" * 80)
    logger.info("TRUNCATE AND REPOPULATE SILVER/GOLD LAYERS")
    logger.info("=" * 80)
    logger.info("")
    logger.info("WARNING: This will delete all data in Silver and Gold layers!")
    logger.info("Bronze layer data will be preserved.")
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
        # Step 1: Truncate tables
        truncate_tables(connection)
        
        # Step 2: Run ETL to repopulate
        run_etl_after_truncate(connection)
        
        end_time = datetime.now()
        duration = end_time - start_time
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("TRUNCATE AND REPOPULATE COMPLETE!")
        logger.info("=" * 80)
        logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"End Time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"Total Duration: {duration}")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"Error during truncate and repopulate: {e}", exc_info=True)
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

