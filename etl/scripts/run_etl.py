"""Run the full ETL pipeline: Bronze -> Silver -> Gold. Optional: run scripts/verify_schemas_and_tables.py first to check schemas."""

import sys
import logging
import psycopg2
import os
from pathlib import Path
from datetime import datetime
import time

# Add parent directory to path to allow imports
script_dir = Path(__file__).parent
project_root = script_dir.parent.parent
sys.path.insert(0, str(project_root))

# Import ETL modules
try:
    from etl.transformers.bronze_to_silver import BronzeToSilverTransformer
    from etl.aggregators.silver_to_gold import SilverToGoldAggregator
    from etl.utils.duplicate_checker import validate_silver_layer, validate_gold_layer
except ImportError as e:
    print(f"Error importing ETL modules: {e}")
    print(f"Script directory: {script_dir}")
    print(f"Project root: {project_root}")
    print(f"Python path: {sys.path[:3]}")
    raise

# Configure logging first (before any logger usage)
# Create log file in the script directory
log_file_path = script_dir / 'etl_pipeline.log'
try:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(str(log_file_path))
        ]
    )
except Exception as e:
    # Fallback to console only if file logging fails
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler()]
    )
    print(f"Warning: Could not create log file {log_file_path}: {e}")

logger = logging.getLogger(__name__)

# Try to import ETLJobTracker
try:
    from ml_optimization.utils.etl_job_tracker import ETLJobTracker
    TRACKER_AVAILABLE = True
except ImportError:
    TRACKER_AVAILABLE = False
    logger.warning("ETLJobTracker not available. Jobs will not be tracked.")


def get_table_counts(connection, schema, tables):
    """Get record counts for multiple tables."""
    counts = {}
    cursor = connection.cursor()
    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table};")
            counts[table] = cursor.fetchone()[0]
        except Exception as e:
            logger.warning(f"Could not get count for {schema}.{table}: {e}")
            counts[table] = 0
            # Rollback on error to allow subsequent queries
            try:
                connection.rollback()
            except:
                pass
    cursor.close()
    return counts


def run_etl_pipeline(batch_size=1000):
    """
    Run the complete ETL pipeline with job tracking.
    
    Args:
        batch_size: Number of records to process per batch (default: 1000)
    """
    pipeline_start_time = datetime.now()
    
    logger.info("")
    logger.info("=" * 80)
    logger.info("ETL PIPELINE STARTED")
    logger.info("=" * 80)
    logger.info(f"Start Time: {pipeline_start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Batch Size: {batch_size:,}")
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
        logger.info("[OK] Database connection established")
    except Exception as e:
        logger.error(f"[ERROR] Failed to connect to database: {e}")
        raise
    
    tracker = None
    if TRACKER_AVAILABLE:
        try:
            tracker = ETLJobTracker(connection)
            tracker.ensure_table_exists()
            logger.info("[OK] Job tracker initialized")
        except Exception as e:
            logger.warning(f"[WARN] Could not initialize job tracker: {e}")
            tracker = None
    
    # Get initial counts - ensure transaction is clean first
    try:
        connection.rollback()  # Start with clean transaction
    except:
        pass
    
    logger.info("")
    logger.info("Initial Data Warehouse State:")
    logger.info("-" * 80)
    
    # Note: bronze.employee table is actually bronze.employment
    bronze_tables = ['country', 'location', 'warehouse', 'product', 'inventory', 
                     'person', 'customer', 'employment', 'orders', 'order_item']
    silver_tables = ['country', 'location', 'warehouse', 'product', 'inventory',
                     'person', 'customer', 'employee', 'orders', 'order_item',
                     'customer_company', 'customer_employee', 'employment_jobs',
                     'person_location', 'phone_number', 'restricted_info']
    gold_tables = [
        # Dimensions
        'dim_date', 'dim_customer', 'dim_product', 'dim_employee',
        'dim_location', 'dim_warehouse', 'dim_promotion',
        # Facts
        'fact_sales', 'fact_orders', 'fact_inventory_snapshot',
        # Aggregates
        'agg_daily_sales', 'agg_customer_lifetime', 'agg_monthly_product_sales',
        'agg_sales_rep_performance'
    ]
    
    bronze_counts = get_table_counts(connection, 'bronze', bronze_tables)
    silver_counts_before = get_table_counts(connection, 'silver', silver_tables)
    gold_counts_before = get_table_counts(connection, 'gold', gold_tables)
    
    # Ensure transaction is clean before starting ETL
    try:
        connection.rollback()
    except:
        pass
    
    logger.info("Bronze Layer:")
    for table, count in sorted(bronze_counts.items()):
        logger.info(f"  {table:20s}: {count:>15,} records")
    
    logger.info("")
    logger.info("Silver Layer (Before ETL):")
    for table, count in sorted(silver_counts_before.items()):
        logger.info(f"  {table:20s}: {count:>15,} records")
    
    logger.info("")
    logger.info("Gold Layer (Before ETL):")
    for table, count in sorted(gold_counts_before.items()):
        logger.info(f"  {table:20s}: {count:>15,} records")
    
    logger.info("")
    logger.info("=" * 80)
    
    pipeline_job_id = None
    try:
        # Overall pipeline job
        if tracker:
            pipeline_job_id = tracker.start_job(
                "Complete ETL Pipeline",
                "pipeline",
                None,
                None
            )
            tracker.update_progress(pipeline_job_id, 0)
        
        # Step 1: Bronze → Silver
        logger.info("")
        logger.info("=" * 80)
        logger.info("STEP 1: Bronze -> Silver Transformation")
        logger.info("=" * 80)
        logger.info(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("")
        
        step1_start = time.time()
        transformer = BronzeToSilverTransformer(connection, tracker=tracker)
        transformation_results = transformer.transform_all(batch_size=batch_size)
        step1_elapsed = time.time() - step1_start
        
        logger.info("")
        logger.info("-" * 80)
        logger.info(f"[OK] Bronze -> Silver Transformation Complete")
        logger.info(f"  Time taken: {step1_elapsed:.2f}s ({step1_elapsed/60:.2f} min)")
        logger.info("-" * 80)
        
        # Get Silver counts after transformation
        silver_counts_after = get_table_counts(connection, 'silver', silver_tables)
        logger.info("")
        logger.info("Silver Layer (After ETL):")
        for table, count in sorted(silver_counts_after.items()):
            before = silver_counts_before.get(table, 0)
            added = count - before
            logger.info(f"  {table:20s}: {count:>15,} records (+{added:>15,})")
        
        if tracker and pipeline_job_id:
            tracker.update_progress(pipeline_job_id, 50)
        
        # Step 2: Silver → Gold
        logger.info("")
        logger.info("=" * 80)
        logger.info("STEP 2: Silver -> Gold Aggregation")
        logger.info("=" * 80)
        logger.info(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("")
        
        step2_start = time.time()
        aggregator = SilverToGoldAggregator(connection, tracker=tracker)
        aggregation_results = aggregator.aggregate_all()
        step2_elapsed = time.time() - step2_start
        
        logger.info("")
        logger.info("-" * 80)
        logger.info(f"[OK] Silver -> Gold Aggregation Complete")
        logger.info(f"  Time taken: {step2_elapsed:.2f}s ({step2_elapsed/60:.2f} min)")
        logger.info("-" * 80)
        
        # Get Gold counts after aggregation
        gold_counts_after = get_table_counts(connection, 'gold', gold_tables)
        logger.info("")
        logger.info("Gold Layer (After ETL):")
        for table, count in sorted(gold_counts_after.items()):
            before = gold_counts_before.get(table, 0)
            added = count - before
            logger.info(f"  {table:20s}: {count:>15,} records (+{added:>15,})")
        
        # Step 3: Validate for Duplicates
        logger.info("")
        logger.info("=" * 80)
        logger.info("STEP 3: Duplicate Validation")
        logger.info("=" * 80)
        logger.info("Checking for duplicate records...")
        logger.info("")
        
        validation_start = time.time()
        silver_validation = validate_silver_layer(connection)
        gold_validation = validate_gold_layer(connection)
        validation_elapsed = time.time() - validation_start
        
        # Check if validation passed
        silver_has_duplicates = any(has_dup for _, has_dup in silver_validation.values())
        gold_has_duplicates = any(has_dup for _, has_dup in gold_validation.values())
        
        if silver_has_duplicates or gold_has_duplicates:
            logger.warning("")
            logger.warning("=" * 80)
            logger.warning("[WARN] WARNING: DUPLICATES DETECTED!")
            logger.warning("=" * 80)
            logger.warning("Please review the duplicate validation results above.")
            logger.warning("The ETL may need to be fixed to prevent duplicate generation.")
            logger.warning("=" * 80)
        else:
            logger.info("")
            logger.info("[OK] All validations passed - No duplicates detected")
        
        logger.info(f"Validation time: {validation_elapsed:.2f}s")
        
        if tracker and pipeline_job_id:
            tracker.update_progress(pipeline_job_id, 100)
            tracker.complete_job(pipeline_job_id)
        
        # Final Summary
        pipeline_end_time = datetime.now()
        pipeline_duration = pipeline_end_time - pipeline_start_time
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("ETL PIPELINE COMPLETE!")
        logger.info("=" * 80)
        logger.info(f"Start Time: {pipeline_start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"End Time: {pipeline_end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"Total Duration: {pipeline_duration}")
        logger.info(f"Duration (seconds): {pipeline_duration.total_seconds():.2f}")
        logger.info(f"Duration (minutes): {pipeline_duration.total_seconds()/60:.2f}")
        logger.info("")
        logger.info("Summary:")
        logger.info(f"  Step 1 (Bronze->Silver): {step1_elapsed:.2f}s")
        logger.info(f"  Step 2 (Silver->Gold):   {step2_elapsed:.2f}s")
        logger.info(f"  Total:                  {pipeline_duration.total_seconds():.2f}s")
        logger.info("")
        logger.info("=" * 80)
        
    except Exception as e:
        if tracker and pipeline_job_id:
            tracker.fail_job(pipeline_job_id, str(e))
        logger.error("")
        logger.error("=" * 80)
        logger.error("ETL PIPELINE FAILED!")
        logger.error("=" * 80)
        logger.error(f"Error: {e}", exc_info=True)
        logger.error("=" * 80)
        raise
    finally:
        connection.close()
        logger.info("")
        logger.info("Database connection closed.")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Run ETL Pipeline: Bronze -> Silver -> Gold')
    parser.add_argument('--batch-size', type=int, default=1000,
                       help='Number of records to process per batch (default: 1000)')
    args = parser.parse_args()
    
    try:
        run_etl_pipeline(batch_size=args.batch_size)
    except KeyboardInterrupt:
        logger.info("\nETL pipeline interrupted by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error in ETL pipeline: {e}", exc_info=True)
        print(f"\nError: {e}")
        print(f"Check the log file for details: {log_file_path}")
        sys.exit(1)

