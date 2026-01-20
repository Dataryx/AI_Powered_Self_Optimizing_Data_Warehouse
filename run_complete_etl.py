"""
Complete ETL Pipeline Runner with Progress Monitoring
Runs the complete ETL pipeline: Bronze → Silver → Gold
Ensures all data is populated
"""

import sys
import logging
import psycopg2
import os
import time
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from etl.transformers.bronze_to_silver import BronzeToSilverTransformer
from etl.aggregators.silver_to_gold import SilverToGoldAggregator

# Configure logging with more detailed format
log_file = Path(__file__).parent / "etl_complete.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(levelname)s] - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def get_table_count(connection, schema, table):
    """Get count of records in a table."""
    try:
        cursor = connection.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table};")
        count = cursor.fetchone()[0]
        cursor.close()
        return count
    except Exception as e:
        logger.warning(f"Could not get count for {schema}.{table}: {e}")
        return 0


def log_table_counts(connection, schema, tables, label=""):
    """Log counts for multiple tables."""
    logger.info(f"\n{label} Table Counts:")
    logger.info("-" * 60)
    for table in tables:
        count = get_table_count(connection, schema, table)
        logger.info(f"  {schema}.{table:30s}: {count:>15,} records")
    logger.info("-" * 60)


def run_etl_pipeline():
    """Run the complete ETL pipeline with progress monitoring."""
    
    pipeline_start = time.time()
    
    logger.info("=" * 80)
    logger.info("COMPLETE ETL PIPELINE - STARTING")
    logger.info("=" * 80)
    logger.info(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
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
        # Get initial Bronze counts
        logger.info("STEP 0: Checking Bronze Layer Status")
        logger.info("=" * 80)
        bronze_tables = [
            'country', 'location', 'warehouse', 'product', 'inventory',
            'person', 'restricted_info', 'person_location', 'phone_number',
            'customer_company', 'customer_employee', 'employment_job',
            'employee', 'customer', 'orders', 'order_item'
        ]
        log_table_counts(connection, 'bronze', bronze_tables, "Initial Bronze")
        
        # Get initial Silver counts
        logger.info("\nInitial Silver Layer Status:")
        silver_tables = [
            'country', 'location', 'warehouse', 'product', 'inventory',
            'person', 'restricted_info', 'person_location', 'phone_number',
            'customer_company', 'customer_employee', 'employment_jobs',
            'employee', 'customer', 'orders', 'order_item'
        ]
        log_table_counts(connection, 'silver', silver_tables, "Initial Silver")
        
        # Get initial Gold counts
        logger.info("\nInitial Gold Layer Status:")
        gold_tables = ['agg_daily_sales', 'agg_customer_lifetime', 'agg_monthly_product_sales']
        log_table_counts(connection, 'gold', gold_tables, "Initial Gold")
        
        # Step 1: Bronze → Silver
        logger.info("\n" + "=" * 80)
        logger.info("STEP 1: Bronze → Silver Transformation")
        logger.info("=" * 80)
        logger.info(f"Transformation Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("")
        
        transformer = BronzeToSilverTransformer(connection)
        start_time = time.time()
        
        # Transform with larger batch size for efficiency
        totals = transformer.transform_all(batch_size=5000)
        
        elapsed = time.time() - start_time
        logger.info("")
        logger.info("=" * 80)
        logger.info(f"STEP 1 COMPLETE: Bronze → Silver Transformation")
        logger.info(f"Total Time: {elapsed:.2f} seconds ({elapsed/60:.2f} minutes)")
        logger.info("=" * 80)
        logger.info("Transformation Summary:")
        for key, value in sorted(totals.items()):
            logger.info(f"  {key.replace('_', ' ').title():30s}: {value:>15,} records")
        logger.info("")
        
        # Check Silver layer counts after transformation
        logger.info("Silver Layer Counts After Transformation:")
        log_table_counts(connection, 'silver', silver_tables, "Final Silver")
        
        # Step 2: Silver → Gold
        logger.info("\n" + "=" * 80)
        logger.info("STEP 2: Silver → Gold Aggregation")
        logger.info("=" * 80)
        logger.info(f"Aggregation Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("")
        
        aggregator = SilverToGoldAggregator(connection)
        start_time = time.time()
        
        gold_totals = aggregator.aggregate_all()
        
        elapsed = time.time() - start_time
        logger.info("")
        logger.info("=" * 80)
        logger.info(f"STEP 2 COMPLETE: Silver → Gold Aggregation")
        logger.info(f"Total Time: {elapsed:.2f} seconds ({elapsed/60:.2f} minutes)")
        logger.info("=" * 80)
        logger.info("Aggregation Summary:")
        for key, value in sorted(gold_totals.items()):
            logger.info(f"  {key.replace('_', ' ').title():30s}: {value:>15,} records")
        logger.info("")
        
        # Final summary
        total_elapsed = time.time() - pipeline_start
        logger.info("")
        logger.info("=" * 80)
        logger.info("ETL PIPELINE COMPLETE!")
        logger.info("=" * 80)
        logger.info(f"End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"Total Pipeline Duration: {total_elapsed:.2f} seconds ({total_elapsed/60:.2f} minutes)")
        logger.info("")
        
        # Final counts
        logger.info("Final Table Counts:")
        logger.info("=" * 80)
        log_table_counts(connection, 'silver', silver_tables, "Final Silver")
        log_table_counts(connection, 'gold', gold_tables, "Final Gold")
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("ETL PIPELINE SUCCESSFULLY COMPLETED!")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"Error in ETL pipeline: {e}", exc_info=True)
        raise
    finally:
        connection.close()
        logger.info("\nDatabase connection closed.")


if __name__ == "__main__":
    try:
        run_etl_pipeline()
    except KeyboardInterrupt:
        logger.info("\nETL pipeline interrupted by user.")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


